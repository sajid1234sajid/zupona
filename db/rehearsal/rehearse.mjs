import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const R = `${HERE}.work`;          // scratch databases, not committed
const M = `${HERE}../migrations`;

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  -> " + detail : ""}`); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// D1 applies a --file atomically; mimic that with one transaction per file.
function applyFile(db, file, label = file) {
  const sql = fs.readFileSync(`${M}/${file}`, "utf8");
  try {
    db.exec("BEGIN;\n" + sql + "\nCOMMIT;");
    return { applied: true };
  } catch (e) {
    try { db.exec("ROLLBACK;"); } catch {}
    return { applied: false, error: e.message };
  }
}
const cols = (db, t) => db.prepare(`SELECT name FROM pragma_table_info(?)`).all(t).map(r => r.name);
const hasIndex = (db, n) => db.prepare(`SELECT COUNT(*) c FROM sqlite_master WHERE type='index' AND name=?`).get(n).c === 1;
const one = (db, sql, ...p) => db.prepare(sql).get(...p);
const all = (db, sql, ...p) => db.prepare(sql).all(...p);

function fresh(path) {
  fs.rmSync(path, { force: true });
  fs.copyFileSync(`${R}/base.sqlite`, path);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(`${HERE}/seed.sql`, "utf8"));
  return db;
}

const db = fresh(`${R}/work.sqlite`);

// What must survive every migration untouched.
const before = {
  orders: all(db, `SELECT id, subtotal, shipping_fee, total, status FROM orders ORDER BY id`),
  items: all(db, `SELECT id, price, quantity FROM order_items ORDER BY id`),
  stock: all(db, `SELECT id, stock_quantity, price FROM product_variants ORDER BY id`),
};

console.log("\n=== BASELINE (pre-0011, matching production) ===");
eq("orders seeded", one(db, `SELECT COUNT(*) c FROM orders`).c, 4);
eq("order_items seeded", one(db, `SELECT COUNT(*) c FROM order_items`).c, 4);
eq("variants seeded", one(db, `SELECT COUNT(*) c FROM product_variants`).c, 8);
eq("only o3 has a suborder", all(db, `SELECT order_id FROM suborders`).map(r => r.order_id), ["o3"]);
ok("orders has no idempotency_key", !cols(db, "orders").includes("idempotency_key"));
ok("variants have no option_signature", !cols(db, "product_variants").includes("option_signature"));

// ---------------------------------------------------------------- 0011
console.log("\n=== 0011_order_integrity ===");
let r = applyFile(db, "0011_order_integrity.sql");
ok("0011 applied", r.applied, r.error);
ok("orders.idempotency_key added", cols(db, "orders").includes("idempotency_key"));
ok("orders.stock_state added", cols(db, "orders").includes("stock_state"));
eq("every legacy order stock_state='none'", one(db, `SELECT COUNT(*) c FROM orders WHERE stock_state='none'`).c, 4);
eq("every legacy order idempotency_key NULL", one(db, `SELECT COUNT(*) c FROM orders WHERE idempotency_key IS NULL`).c, 4);
ok("buy_now_sessions.consumed_at added", cols(db, "buy_now_sessions").includes("consumed_at"));
for (const i of ["idx_orders_idempotency", "idx_inventory_reference", "idx_inventory_order_once", "idx_buy_now_expiry"])
  ok(`index ${i}`, hasIndex(db, i));
eq("0011 changed no order row", all(db, `SELECT id, subtotal, shipping_fee, total, status FROM orders ORDER BY id`), before.orders);

// The guarantees actually bite. Each probe is rolled back.
const probe = (name, fn, shouldThrow) => {
  db.exec("SAVEPOINT p;");
  let threw = null;
  try { fn(); } catch (e) { threw = e.message; }
  db.exec("ROLLBACK TO p; RELEASE p;");
  ok(name, shouldThrow ? threw !== null : threw === null, threw ?? "no error raised");
};
const newOrder = (id, key) => db.exec(
  `INSERT INTO orders (id, order_number, user_id, subtotal, total, address_label, address_full_name,
     address_phone, address_line, payment_label, idempotency_key)
   VALUES ('${id}', 'N-${id}', 'u1', 1, 1, 'Home', 'X', '017', 'L', 'COD', ${key === null ? "NULL" : `'${key}'`});`);
probe("two orders may share a NULL idempotency_key", () => { newOrder("t1", null); newOrder("t2", null); }, false);
probe("two orders may NOT share the same key", () => { newOrder("t3", "K1"); newOrder("t4", "K1"); }, true);
probe("a second 'sale' for the same order+variant is refused", () =>
  db.exec(`INSERT INTO inventory_movements (id,variant_id,change_qty,reason,reference_type,reference_id)
           VALUES ('m2','v1',-1,'sale','order','o1');`), true);
probe("a manual adjustment is outside that index", () =>
  db.exec(`INSERT INTO inventory_movements (id,variant_id,change_qty,reason,reference_type,reference_id)
           VALUES ('m3','v1',-1,'adjustment','manual',NULL);`), false);

// ---------------------------------------------------------------- 0012
console.log("\n=== 0012_order_suborders ===");
r = applyFile(db, "0012_order_suborders.sql");
ok("0012 applied", r.applied, r.error);
eq("one suborder per order, four orders", all(db, `SELECT order_id, COUNT(*) n FROM suborders GROUP BY order_id ORDER BY order_id`),
   [{ order_id: "o1", n: 1 }, { order_id: "o2", n: 1 }, { order_id: "o3", n: 1 }, { order_id: "o4", n: 1 }]);
const pre = one(db, `SELECT id, tracking_number, courier_name, subtotal, shipping_fee, status FROM suborders WHERE order_id='o3'`);
eq("o3's existing suborder untouched", pre, { id: "sub_pre", tracking_number: "TRK-999", courier_name: "Pathao", subtotal: 3500, shipping_fee: 60, status: "confirmed" });
eq("o1 suborder carries the line total", one(db, `SELECT subtotal, shipping_fee FROM suborders WHERE order_id='o1'`), { subtotal: 10900, shipping_fee: 60 });
eq("o2 suborder carries the line total", one(db, `SELECT subtotal, shipping_fee FROM suborders WHERE order_id='o2'`), { subtotal: 2400, shipping_fee: 80 });
eq("an order with no items gets subtotal 0", one(db, `SELECT subtotal, shipping_fee FROM suborders WHERE order_id='o4'`), { subtotal: 0, shipping_fee: 60 });
eq("suborder status mirrors the order", one(db, `SELECT COUNT(*) c FROM suborders s JOIN orders o ON o.id=s.order_id WHERE s.status <> o.status`).c, 0);
eq("o1 lines attached to o1's suborder", one(db,
  `SELECT COUNT(*) c FROM order_items i JOIN suborders s ON s.order_id='o1' WHERE i.order_id='o1' AND i.suborder_id=s.id`).c, 2);
eq("o3's line still on sub_pre", one(db, `SELECT suborder_id s FROM order_items WHERE id='i4'`).s, "sub_pre");
eq("seller snapshotted from the product", all(db, `SELECT id, seller_id FROM order_items ORDER BY id`),
   [{ id: "i1", seller_id: null }, { id: "i2", seller_id: null }, { id: "i3", seller_id: "s1" }, { id: "i4", seller_id: "s1" }]);
eq("0012 changed no money", all(db, `SELECT id, price, quantity FROM order_items ORDER BY id`), before.items);
eq("0012 changed no order row", all(db, `SELECT id, subtotal, shipping_fee, total, status FROM orders ORDER BY id`), before.orders);
r = applyFile(db, "0012_order_suborders.sql", "0012 rerun");
ok("0012 re-runs cleanly", r.applied, r.error);
eq("re-run created no second suborder", one(db, `SELECT COUNT(*) c FROM suborders`).c, 4);

// ---------------------------------------------------------------- 0013
console.log("\n=== 0013_option_builder ===");
r = applyFile(db, "0013_option_builder.sql");
ok("0013 applied", r.applied, r.error);
ok("product_option_groups.is_active added", cols(db, "product_option_groups").includes("is_active"));
ok("product_option_values.is_active added", cols(db, "product_option_values").includes("is_active"));
ok("product_variants.option_signature added", cols(db, "product_variants").includes("option_signature"));
eq("every group active by default", one(db, `SELECT COUNT(*) c FROM product_option_groups WHERE is_active=1`).c,
   one(db, `SELECT COUNT(*) c FROM product_option_groups`).c);
eq("legacy p1 gained a swatch Color group", one(db, `SELECT key, name, display FROM product_option_groups WHERE product_id='p1'`),
   { key: "color", name: "Color", display: "swatch" });
eq("legacy p2 gained Color and Size", all(db, `SELECT key, display, sort_order FROM product_option_groups WHERE product_id='p2' ORDER BY sort_order`),
   [{ key: "color", display: "swatch", sort_order: 0 }, { key: "size", display: "pill", sort_order: 1 }]);
eq("p1 values carry their swatches", all(db, `SELECT ov.label, ov.color_hex FROM product_option_values ov
     JOIN product_option_groups g ON g.id=ov.group_id WHERE g.product_id='p1' ORDER BY ov.label`),
   [{ label: "Black & Gold", color_hex: "#111111" }, { label: "Silver", color_hex: "#cccccc" }]);
eq("every legacy variant linked to its value", one(db,
  `SELECT COUNT(DISTINCT variant_id) c FROM product_variant_options WHERE variant_id IN ('v1','v2','v3','v4')`).c, 4);
const sig = id => one(db, `SELECT option_signature s FROM product_variants WHERE id=?`, id).s;
const valueId = (label) => one(db, `SELECT id FROM product_option_values WHERE label=?`, label).id;
eq("v1 signature is key=value_id", sig("v1"), `color=${valueId("Black & Gold")}`);
eq("v3 signature sorts by group key", sig("v3"), `color=${valueId("Red")}|size=${valueId("42")}`);
eq("canonical volume variant signed", sig("v5"), "volume=ov30");
eq("canonical colour variant signed", sig("v7"), "color=ovblu");
eq("option-less variant signs empty", sig("v8"), "");
eq("all eight variants signed", one(db, `SELECT COUNT(*) c FROM product_variants WHERE option_signature IS NOT NULL`).c, 8);
eq("colour group mirrored back to the legacy slot", one(db,
  `SELECT option1_name n, option1_value v, swatch s FROM product_variants WHERE id='v7'`),
   { n: "Colour", v: "Midnight Blue", s: "#12325f" });
eq("a volume group is NOT written into the colour slot", all(db,
  `SELECT id, option1_value FROM product_variants WHERE id IN ('v5','v6') ORDER BY id`),
   [{ id: "v5", option1_value: null }, { id: "v6", option1_value: null }]);
eq("no duplicate active signatures", one(db,
  `SELECT COUNT(*) c FROM (SELECT product_id FROM product_variants WHERE is_active=1 GROUP BY product_id, option_signature HAVING COUNT(*)>1)`).c, 0);
ok("index idx_variant_combination", hasIndex(db, "idx_variant_combination"));
eq("0013 moved no stock and no price", all(db, `SELECT id, stock_quantity, price FROM product_variants ORDER BY id`), before.stock);
eq("0013 wrote nothing to the stock ledger", one(db, `SELECT COUNT(*) c FROM inventory_movements`).c, 1);
probe("a duplicate active combination is now refused", () =>
  db.exec(`INSERT INTO product_variants (id, product_id, sku, option_signature, is_active)
           VALUES ('v9','p1','X-1','${sig("v1")}',1);`), true);
probe("a retired variant may reuse a combination", () =>
  db.exec(`INSERT INTO product_variants (id, product_id, sku, option_signature, is_active)
           VALUES ('v9','p1','X-1','${sig("v1")}',0);`), false);

// re-run the data half (the ALTERs cannot repeat -- SQLite rejects a duplicate column)
const body = fs.readFileSync(`${M}/0013_option_builder.sql`, "utf8").split("\n").filter(l => !/^ALTER TABLE/.test(l)).join("\n");
const sigsBefore = all(db, `SELECT id, option_signature FROM product_variants ORDER BY id`);
const groupsBefore = one(db, `SELECT COUNT(*) c FROM product_option_groups`).c;
try { db.exec("BEGIN;" + body + "COMMIT;"); ok("0013 data section re-runs cleanly", true); }
catch (e) { try { db.exec("ROLLBACK;"); } catch {} ok("0013 data section re-runs cleanly", false, e.message); }
eq("re-run changed no signature", all(db, `SELECT id, option_signature FROM product_variants ORDER BY id`), sigsBefore);
eq("re-run created no second group", one(db, `SELECT COUNT(*) c FROM product_option_groups`).c, groupsBefore);

// ---------------------------------------------------------------- 0014
console.log("\n=== 0014_address_district (same database, next in the chain) ===");
r = applyFile(db, "0014_address_district.sql");
ok("0014 applied", r.applied, r.error);
ok("orders.address_district added", cols(db, "orders").includes("address_district"));
ok("addresses.district added", cols(db, "addresses").includes("district"));
eq("legacy orders have no district invented for them", one(db, `SELECT COUNT(*) c FROM orders WHERE address_district IS NULL`).c,
   one(db, `SELECT COUNT(*) c FROM orders`).c);
eq("0014 changed no order row", all(db, `SELECT id, subtotal, shipping_fee, total, status FROM orders ORDER BY id`), before.orders);

// ---------------------------------------------------------------- 0015
console.log("\n=== 0015_payment_and_scale (same database, next in the chain) ===");
r = applyFile(db, "0015_payment_and_scale.sql");
ok("0015 applied", r.applied, r.error);
for (const c of ["method", "failure_reason", "initiated_at", "completed_at", "idempotency_key"])
  ok(`payment_transactions.${c} added`, cols(db, "payment_transactions").includes(c));
for (const i of ["idx_payment_idempotency", "idx_payment_order", "idx_payment_provider_ref",
                 "idx_orders_placed_at", "idx_orders_status", "idx_orders_payment_status",
                 "idx_orders_number", "idx_orders_phone", "idx_order_history_order", "idx_notifications_user"])
  ok(`index ${i}`, hasIndex(db, i));

// ------------------------------------------------- the whole chain, end state
console.log("\n=== END STATE: upgraded database vs a fresh one built from schema.sql ===");
eq("no order was lost or gained", one(db, `SELECT COUNT(*) c FROM orders`).c, 4);
eq("no order line was lost or gained", one(db, `SELECT COUNT(*) c FROM order_items`).c, 4);
eq("every money figure is exactly as seeded", all(db, `SELECT id, price, quantity FROM order_items ORDER BY id`), before.items);
eq("every stock figure is exactly as seeded", all(db, `SELECT id, stock_quantity, price FROM product_variants ORDER BY id`), before.stock);
eq("every order row is exactly as seeded", all(db, `SELECT id, subtotal, shipping_fee, total, status FROM orders ORDER BY id`), before.orders);

const fresh1 = new DatabaseSync(`${R}/full.sqlite`);
const shape = (d) => {
  const out = {};
  for (const t of all(d, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`))
    out[t.name] = cols(d, t.name).slice().sort();
  return out;
};
const idxOf = (d) => all(d, `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name`).map(x => x.name);
const upShape = shape(db), frShape = shape(fresh1);
const diff = Object.keys(frShape).filter(t => JSON.stringify(frShape[t]) !== JSON.stringify(upShape[t]));
eq("every table has the same columns as a fresh install", diff, []);
const missing = idxOf(fresh1).filter(i => !idxOf(db).includes(i));
eq("every index of a fresh install is present", missing, []);
fresh1.close();
db.close();

// ------------------------------------------------- 0013 against dirty data
console.log("\n=== 0013 on a database that already has a duplicate combination ===");
const dirty = fresh(`${R}/dirty.sqlite`);
dirty.exec(`INSERT INTO product_variants (id, product_id, sku, option1_name, option1_value, swatch, stock_quantity)
            VALUES ('vdup','p1','CW-SL2','Color','Silver','#cccccc',2);`);
applyFile(dirty, "0011_order_integrity.sql");
applyFile(dirty, "0012_order_suborders.sql");
const dup = applyFile(dirty, "0013_option_builder.sql");
ok("0013 refuses to apply", !dup.applied, dup.error ?? "it applied");
ok("the failure names the unique index", /idx_variant_combination|UNIQUE/i.test(dup.error ?? ""), dup.error);
ok("rolled back: no option_signature column", !cols(dirty, "product_variants").includes("option_signature"));
ok("rolled back: no is_active on groups", !cols(dirty, "product_option_groups").includes("is_active"));
eq("rolled back: no option groups invented", one(dirty, `SELECT COUNT(*) c FROM product_option_groups`).c, 2);
eq("the duplicate variant is still there, untouched", one(dirty, `SELECT stock_quantity q FROM product_variants WHERE id='vdup'`).q, 2);
dirty.close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
