// db/preflight.sql claims to predict, before 0013 runs, whether its unique
// index can be created. This proves the claim: run the prediction on a
// pre-0013 database, then run 0013 and compare.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const R = `${HERE}.work`;
const M = `${HERE}../migrations`;

let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${d ? "  -> " + d : ""}`)); };
const eq = (n, g, w) => ok(n, JSON.stringify(g) === JSON.stringify(w), `got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`);

// Split preflight.sql into its statements, ignoring comment-only lines.
const queries = fs.readFileSync(`${HERE}../preflight.sql`, "utf8")
  .split("\n").filter((l) => !/^\s*--/.test(l)).join("\n")
  .split(";").map((s) => s.trim()).filter(Boolean);
if (queries.length !== 5) throw new Error(`expected 5 preflight queries, parsed ${queries.length}`);

function build(path, extraSeed = "") {
  fs.rmSync(path, { force: true });
  fs.copyFileSync(`${R}/base.sqlite`, path);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(`${HERE}/seed.sql`, "utf8"));
  if (extraSeed) db.exec(extraSeed);
  return db;
}
const apply = (db, f) => {
  try { db.exec("BEGIN;" + fs.readFileSync(`${M}/${f}`, "utf8") + "COMMIT;"); return { applied: true }; }
  catch (e) { try { db.exec("ROLLBACK;"); } catch {} return { applied: false, error: e.message }; }
};

console.log("\n=== preflight on a clean pre-0011 database ===");
const db = build(`${R}/pre.sqlite`);
const q = (i) => db.prepare(queries[i]).all();

eq("Q1 reports every column as not yet applied",
   [...new Set(q(0).map((r) => r.state))], ["not yet"]);
eq("Q1 covers thirteen columns", q(0).length, 13);
eq("Q2 reports every index as not yet applied",
   [...new Set(q(1).map((r) => r.state))], ["not yet"]);
eq("Q3 counts the 0012 workload", q(2)[0], {
  orders_total: 4, suborders_to_create: 3, suborders_now: 1,
  lines_to_attach: 3, lines_to_stamp_with_a_seller: 3,
  lines_whose_product_is_gone: 0, orders_already_split: 0,
});
eq("Q4 predicts no collision", q(3), []);
eq("Q5 describes the option catalog", q(4)[0], {
  variants_total: 8, variants_active: 8, option_groups_now: 2, variant_links_now: 3,
  legacy_variants_to_convert: 4, variants_to_mirror_into_legacy: 1,
  renamed_groups_the_0013_fix_protects: 1,
});

// The prediction, stated as label signatures, before the column exists.
const predicted = db.prepare(`
  WITH pairs(vid, k, lb) AS (
    SELECT o.variant_id, g.key, ov.label FROM product_variant_options o
      JOIN product_option_groups g ON g.id = o.group_id
      JOIN product_option_values ov ON ov.id = o.value_id
    UNION
    SELECT pv.id, COALESCE((SELECT g.key FROM product_option_groups g
                             WHERE g.product_id = pv.product_id AND g.name = pv.option1_name),
                           replace(lower(pv.option1_name), ' ', '-')), pv.option1_value
      FROM product_variants pv WHERE pv.option1_value IS NOT NULL AND pv.option1_name IS NOT NULL
    UNION
    SELECT pv.id, COALESCE((SELECT g.key FROM product_option_groups g
                             WHERE g.product_id = pv.product_id AND g.name = pv.option2_name),
                           replace(lower(pv.option2_name), ' ', '-')), pv.option2_value
      FROM product_variants pv WHERE pv.option2_value IS NOT NULL AND pv.option2_name IS NOT NULL
  )
  SELECT pv.id, COALESCE((SELECT group_concat(k || '=' || lb, '|' ORDER BY k) FROM pairs WHERE vid = pv.id), '') s
    FROM product_variants pv ORDER BY pv.id`).all();

apply(db, "0011_order_integrity.sql");
apply(db, "0012_order_suborders.sql");
const r13 = apply(db, "0013_option_builder.sql");
ok("0013 applies, as Q4 predicted", r13.applied, r13.error);

// What 0013 actually computed, with value ids translated back to labels.
const actual = db.prepare(`
  SELECT pv.id,
         COALESCE((SELECT group_concat(g.key || '=' || ov.label, '|' ORDER BY g.key)
                     FROM product_variant_options o
                     JOIN product_option_groups g  ON g.id = o.group_id
                     JOIN product_option_values ov ON ov.id = o.value_id
                    WHERE o.variant_id = pv.id), '') s
    FROM product_variants pv ORDER BY pv.id`).all();
eq("the prediction matches what 0013 computed, variant for variant", predicted, actual);
eq("and 0013 found no duplicates either",
   db.prepare(`SELECT COUNT(*) c FROM (SELECT product_id FROM product_variants
                WHERE is_active = 1 GROUP BY product_id, option_signature HAVING COUNT(*) > 1)`).get().c, 0);
db.close();

console.log("\n=== preflight on a database that would break 0013 ===");
const dirty = build(`${R}/pre-dirty.sqlite`,
  `INSERT INTO product_variants (id, product_id, sku, option1_name, option1_value, swatch, stock_quantity)
   VALUES ('vdup','p1','CW-SL2','Color','Silver','#cccccc',2);`);
const rows = dirty.prepare(queries[3]).all();
eq("Q4 names the collision before anything is applied",
   rows.map((r) => ({ product: r.product, combination: r.combination, active_variants: r.active_variants })),
   [{ product: "Classic Watch", combination: "color=Silver", active_variants: 2 }]);
eq("Q4 names the two variants", rows[0].variant_ids.split(", ").sort(), ["v2", "vdup"]);
apply(dirty, "0011_order_integrity.sql");
apply(dirty, "0012_order_suborders.sql");
const bad = apply(dirty, "0013_option_builder.sql");
ok("0013 does fail, as Q4 predicted", !bad.applied, bad.error ?? "it applied");
dirty.close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
