// db/preflight.sql runs against the remote database before anything is
// applied. Two things have to be true of it: every statement must work on the
// 0008 schema, touching no table 0009 creates, and query 6 must correctly
// predict whether 0013's unique index can be built. Both are checked here.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const R = `${HERE}.work`;
const M = `${HERE}../migrations`;
const CHAIN = ["0009_dynamic_options.sql", "0010_variant_cart.sql", "0011_order_integrity.sql",
               "0012_order_suborders.sql", "0013_option_builder.sql"];

let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${d ? "  -> " + d : ""}`)); };
const eq = (n, g, w) => ok(n, JSON.stringify(g) === JSON.stringify(w), `got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`);

const queries = fs.readFileSync(`${HERE}../preflight.sql`, "utf8")
  .split("\n").filter((l) => !/^\s*--/.test(l)).join("\n")
  .split(";").map((s) => s.trim()).filter(Boolean);
if (queries.length !== 7) throw new Error(`expected 7 preflight queries, parsed ${queries.length}`);

function build(path, extra = "") {
  fs.rmSync(path, { force: true });
  fs.copyFileSync(`${R}/base.sqlite`, path);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(`${HERE}/seed.sql`, "utf8"));
  if (extra) db.exec(extra);
  return db;
}
const apply = (db, f) => {
  try { db.exec("BEGIN;" + fs.readFileSync(`${M}/${f}`, "utf8") + "COMMIT;"); return { applied: true }; }
  catch (e) { try { db.exec("ROLLBACK;"); } catch {} return { applied: false, error: e.message }; }
};

console.log("\n=== every query runs on the 0008 schema ===");
const db = build(`${R}/pre.sqlite`);
const q = (i) => db.prepare(queries[i]).all();
queries.forEach((_, i) => {
  try { db.prepare(queries[i]).all(); ok(`query ${i + 1} runs`, true); }
  catch (e) { ok(`query ${i + 1} runs`, false, e.message); }
});

console.log("\n=== and reports the state correctly ===");
eq("Q1 finds 0009's four tables missing and everything earlier present",
   q(0).filter((r) => r.state === "MISSING").map((r) => r.table_name),
   ["buy_now_sessions", "product_option_groups", "product_option_values", "product_variant_options"]);
eq("Q2 reports every pending column as not yet applied", [...new Set(q(1).map((r) => r.state))], ["not yet"]);
eq("Q3 reports every pending index as not yet applied", [...new Set(q(2).map((r) => r.state))], ["not yet"]);
eq("Q4 counts the cart lines 0010 must copy", q(3)[0], {
  cart_lines_to_copy: 3, lines_chosen_by_variant: 2, lines_chosen_by_colour_only: 1,
  duplicate_variant_lines: 0, duplicate_colour_lines: 0,
});
eq("Q5 counts the 0012 workload", q(4)[0], {
  orders_total: 4, suborders_to_create: 3, suborders_now: 1, lines_to_attach: 3,
  lines_to_stamp_with_a_seller: 3, lines_whose_product_is_gone: 0, orders_already_split: 0,
});
eq("Q6 predicts no collision", q(5), []);
eq("Q7 describes what 0009 will build", q(6)[0], {
  products_total: 5, variants_total: 8, variants_active: 8,
  groups_from_option1: 4, groups_from_option2: 1,
  variants_with_no_options: 1, variants_using_slot_two_only: 0,
});

// Q7 said 0009 would build five groups. Hold it to that.
for (const f of CHAIN) apply(db, f);
eq("0009 built exactly the number of groups Q7 predicted",
   db.prepare(`SELECT COUNT(*) c FROM product_option_groups`).get().c, 4 + 1);
ok("0013 applies, as Q6 predicted",
   db.prepare(`SELECT COUNT(*) c FROM pragma_table_info('product_variants') WHERE name='option_signature'`).get().c === 1);
eq("and 0013 found no duplicates either",
   db.prepare(`SELECT COUNT(*) c FROM (SELECT product_id FROM product_variants
                WHERE is_active = 1 GROUP BY product_id, option_signature HAVING COUNT(*) > 1)`).get().c, 0);
db.close();

console.log("\n=== a database that would break 0013 ===");
for (const [name, extra, expect] of [
  ["a repeated colour",
   `INSERT INTO product_variants (id, product_id, sku, option1_name, option1_value, swatch, stock_quantity)
    VALUES ('vdup','p1','CW-SL2','Color','Silver','#cccccc',2);`,
   { product: "Classic Watch", combination: "color=Silver", active_variants: 2 }],
  ["the same pair with the slots swapped",
   `INSERT INTO product_variants (id, product_id, sku, option1_name, option1_value, option2_name, option2_value, stock_quantity)
    VALUES ('vswap','p2','RS-X','Size','42','Color','Red',1);`,
   { product: "Runner Shoe", combination: "color=Red|size=42", active_variants: 2 }],
  ["a second variant with no options at all",
   `INSERT INTO product_variants (id, product_id, sku, stock_quantity) VALUES ('vbare','p5','CS-2',5);`,
   { product: "Cotton Socks", combination: "(no options)", active_variants: 2 }],
]) {
  const d = build(`${R}/dirty.sqlite`, extra);
  const rows = d.prepare(queries[5]).all();
  eq(`Q6 names ${name}`,
     rows.map((r) => ({ product: r.product, combination: r.combination, active_variants: r.active_variants })), [expect]);
  for (const f of CHAIN.slice(0, 4)) apply(d, f);
  const bad = apply(d, "0013_option_builder.sql");
  ok(`0013 does fail on ${name}`, !bad.applied, bad.error ?? "it applied");
  ok(`and rolls back whole on ${name}`,
     d.prepare(`SELECT COUNT(*) c FROM pragma_table_info('product_variants') WHERE name='option_signature'`).get().c === 0);
  d.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
