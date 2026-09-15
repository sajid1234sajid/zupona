// Apply 0009 through 0015 to a database shaped like production and assert,
// after each one, both what it changed and what it must not have.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const R = `${HERE}.work`;
const M = `${HERE}../migrations`;

let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n}${d ? "  -> " + d : ""}`)); };
const eq = (n, g, w) => ok(n, JSON.stringify(g) === JSON.stringify(w), `got ${JSON.stringify(g)}, want ${JSON.stringify(w)}`);

// D1 applies a --file atomically; mimic that with one transaction per file.
function applyFile(db, file) {
  try { db.exec("BEGIN;\n" + fs.readFileSync(`${M}/${file}`, "utf8") + "\nCOMMIT;"); return { applied: true }; }
  catch (e) { try { db.exec("ROLLBACK;"); } catch {} return { applied: false, error: e.message }; }
}
const cols = (db, t) => db.prepare(`SELECT name FROM pragma_table_info(?)`).all(t).map((r) => r.name);
const hasTable = (db, n) => db.prepare(`SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name=?`).get(n).c === 1;
const hasIndex = (db, n) => db.prepare(`SELECT COUNT(*) c FROM sqlite_master WHERE type='index' AND name=?`).get(n).c === 1;
const one = (db, sql, ...p) => db.prepare(sql).get(...p);
const all = (db, sql, ...p) => db.prepare(sql).all(...p);

function fresh(path, extra = "") {
  fs.rmSync(path, { force: true });
  fs.copyFileSync(`${R}/base.sqlite`, path);
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(fs.readFileSync(`${HERE}/seed.sql`, "utf8"));
  if (extra) db.exec(extra);
  return db;
}
function probe(db, name, fn, shouldThrow) {
  db.exec("SAVEPOINT p;");
  let threw = null;
  try { fn(); } catch (e) { threw = e.message; }
  db.exec("ROLLBACK TO p; RELEASE p;");
  ok(name, shouldThrow ? threw !== null : threw === null, threw ?? "no error raised");
}

const db = fresh(`${R}/work.sqlite`);
const before = {
  orders: all(db, `SELECT id, subtotal, shipping_fee, total, status FROM orders ORDER BY id`),
  items: all(db, `SELECT id, price, quantity FROM order_items ORDER BY id`),
  stock: all(db, `SELECT id, stock_quantity, price FROM product_variants ORDER BY id`),
  cart: all(db, `SELECT id, user_id, product_id, variant_id, seller_id, color, quantity FROM cart_items ORDER BY id`),
};

console.log("\n=== BASELINE: the 0008 schema, as production stands ===");
eq("orders seeded", one(db, `SELECT COUNT(*) c FROM orders`).c, 4);
eq("variants seeded", one(db, `SELECT COUNT(*) c FROM product_variants`).c, 8);
eq("cart lines seeded", one(db, `SELECT COUNT(*) c FROM cart_items`).c, 3);
eq("only o3 has a suborder", all(db, `SELECT order_id FROM suborders`).map((r) => r.order_id), ["o3"]);
for (const t of ["product_option_groups", "product_option_values", "product_variant_options", "buy_now_sessions"])
  ok(`${t} does not exist yet`, !hasTable(db, t));

// ---------------------------------------------------------------- 0009
console.log("\n=== 0009_dynamic_options ===");
let r = applyFile(db, "0009_dynamic_options.sql");
ok("0009 applied", r.applied, r.error);
for (const t of ["product_option_groups", "product_option_values", "product_variant_options", "buy_now_sessions"])
  ok(`${t} created`, hasTable(db, t));
for (const i of ["idx_option_groups_product", "idx_option_values_group", "idx_variant_options_value", "idx_buy_now_user"])
  ok(`index ${i}`, hasIndex(db, i));
ok("product_variants.image_id added", cols(db, "product_variants").includes("image_id"));
for (const c of ["short_description", "badge_label", "return_policy", "warranty"])
  ok(`products.${c} added`, cols(db, "products").includes(c));
ok("product_features.value added", cols(db, "product_features").includes("value"));
ok("product_images.alt added", cols(db, "product_images").includes("alt"));
ok("product_videos.alt added", cols(db, "product_videos").includes("alt"));
eq("a group per legacy option, keyed by its slug",
   all(db, `SELECT product_id, key, display, sort_order FROM product_option_groups ORDER BY product_id, sort_order`),
   [{ product_id: "p1", key: "color", display: "swatch", sort_order: 0 },
    { product_id: "p2", key: "color", display: "swatch", sort_order: 0 },
    { product_id: "p2", key: "size",  display: "pill",   sort_order: 1 },
    { product_id: "p3", key: "volume",display: "pill",   sort_order: 0 },
    { product_id: "p4", key: "color", display: "pill",   sort_order: 0 }]);
eq("a colour group with no swatch is drawn as pills",
   one(db, `SELECT display FROM product_option_groups WHERE product_id='p4'`).display, "pill");
eq("every distinct legacy value became a value row", one(db, `SELECT COUNT(*) c FROM product_option_values`).c, 8);
eq("swatches carried across",
   all(db, `SELECT label, color_hex FROM product_option_values WHERE color_hex IS NOT NULL ORDER BY label`),
   [{ label: "Black & Gold", color_hex: "#111111" }, { label: "Red", color_hex: "#dd2222" }, { label: "Silver", color_hex: "#cccccc" }]);
eq("every optioned variant linked, the option-less one not",
   all(db, `SELECT pv.id, COUNT(o.variant_id) n FROM product_variants pv
              LEFT JOIN product_variant_options o ON o.variant_id = pv.id GROUP BY pv.id ORDER BY pv.id`),
   [{ id: "v1", n: 1 }, { id: "v2", n: 1 }, { id: "v3", n: 2 }, { id: "v4", n: 2 },
    { id: "v5", n: 1 }, { id: "v6", n: 1 }, { id: "v7", n: 1 }, { id: "v8", n: 0 }]);
eq("0009 moved no stock and no price", all(db, `SELECT id, stock_quantity, price FROM product_variants ORDER BY id`), before.stock);

// ---------------------------------------------------------------- 0010
console.log("\n=== 0010_variant_cart (the only migration that drops a table) ===");
r = applyFile(db, "0010_variant_cart.sql");
ok("0010 applied", r.applied, r.error);
eq("cart_items keeps exactly its columns", cols(db, "cart_items"),
   ["id", "user_id", "product_id", "variant_id", "seller_id", "color", "quantity", "created_at"]);
eq("every cart line survived the rebuild, value for value",
   all(db, `SELECT id, user_id, product_id, variant_id, seller_id, color, quantity FROM cart_items ORDER BY id`), before.cart);
ok("the scratch table is gone", !hasTable(db, "cart_items_new"));
for (const i of ["idx_cart_variant_unique", "idx_cart_legacy_unique", "idx_cart_user_id"]) ok(`index ${i}`, hasIndex(db, i));
const cart = (id, variant, color) => db.exec(
  `INSERT INTO cart_items (id, user_id, product_id, variant_id, color, quantity)
   VALUES ('${id}', 'u1', 'p1', ${variant ? `'${variant}'` : "NULL"}, '${color}', 1);`);
probe(db, "two variants of one product may now sit in the cart together", () => cart("x1", "v2", "Black & Gold"), false);
probe(db, "the same variant cannot be added twice", () => cart("x2", "v1", "Black & Gold"), true);
probe(db, "a colour-only line still cannot be duplicated", () => { cart("x3", null, "Beige"); cart("x4", null, "Beige"); }, true);
eq("0010 changed no order", all(db, `SELECT id, subtotal, shipping_fee, total, status FROM orders ORDER BY id`), before.orders);

// ---------------------------------------------------------------- 0011
console.log("\n=== 0011_order_integrity ===");
r = applyFile(db, "0011_order_integrity.sql");
ok("0011 applied", r.applied, r.error);
ok("orders.idempotency_key added", cols(db, "orders").includes("idempotency_key"));
ok("orders.stock_state added", cols(db, "orders").includes("stock_state"));
ok("buy_now_sessions.consumed_at added", cols(db, "buy_now_sessions").includes("consumed_at"));
eq("every legacy order stock_state='none'", one(db, `SELECT COUNT(*) c FROM orders WHERE stock_state='none'`).c, 4);
for (const i of ["idx_orders_idempotency", "idx_inventory_reference", "idx_inventory_order_once", "idx_buy_now_expiry"])
  ok(`index ${i}`, hasIndex(db, i));
const newOrder = (id, key) => db.exec(
  `INSERT INTO orders (id, order_number, user_id, subtotal, total, address_label, address_full_name,
     address_phone, address_line, payment_label, idempotency_key)
   VALUES ('${id}', 'N-${id}', 'u1', 1, 1, 'Home', 'X', '017', 'L', 'COD', ${key === null ? "NULL" : `'${key}'`});`);
probe(db, "two orders may share a NULL idempotency_key", () => { newOrder("t1", null); newOrder("t2", null); }, false);
probe(db, "two orders may NOT share the same key", () => { newOrder("t3", "K1"); newOrder("t4", "K1"); }, true);
probe(db, "a second 'sale' for the same order+variant is refused", () =>
  db.exec(`INSERT INTO inventory_movements (id,variant_id,change_qty,reason,reference_type,reference_id)
           VALUES ('m2','v1',-1,'sale','order','o1');`), true);
probe(db, "a manual adjustment is outside that index", () =>
  db.exec(`INSERT INTO inventory_movements (id,variant_id,change_qty,reason,reference_type,reference_id)
           VALUES ('m3','v1',-1,'adjustment','manual',NULL);`), false);
eq("0011 changed no order row", all(db, `SELECT id, subtotal, shipping_fee, total, status FROM orders ORDER BY id`), before.orders);

// ---------------------------------------------------------------- 0012
console.log("\n=== 0012_order_suborders ===");
r = applyFile(db, "0012_order_suborders.sql");
ok("0012 applied", r.applied, r.error);
eq("one suborder per order, four orders", all(db, `SELECT order_id, COUNT(*) n FROM suborders GROUP BY order_id ORDER BY order_id`),
   [{ order_id: "o1", n: 1 }, { order_id: "o2", n: 1 }, { order_id: "o3", n: 1 }, { order_id: "o4", n: 1 }]);
eq("o3's existing suborder untouched",
   one(db, `SELECT id, tracking_number, courier_name, subtotal, shipping_fee, status FROM suborders WHERE order_id='o3'`),
   { id: "sub_pre", tracking_number: "TRK-999", courier_name: "Pathao", subtotal: 3500, shipping_fee: 60, status: "confirmed" });
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
r = applyFile(db, "0012_order_suborders.sql");
ok("0012 re-runs cleanly", r.applied, r.error);
eq("re-run created no second suborder", one(db, `SELECT COUNT(*) c FROM suborders`).c, 4);

// ---------------------------------------------------------------- 0013
console.log("\n=== 0013_option_builder ===");
const groupsBefore13 = one(db, `SELECT COUNT(*) c FROM product_option_groups`).c;
r = applyFile(db, "0013_option_builder.sql");
ok("0013 applied", r.applied, r.error);
ok("product_option_groups.is_active added", cols(db, "product_option_groups").includes("is_active"));
ok("product_option_values.is_active added", cols(db, "product_option_values").includes("is_active"));
ok("product_variants.option_signature added", cols(db, "product_variants").includes("option_signature"));
eq("0013 invented no group -- 0009 had already made them all",
   one(db, `SELECT COUNT(*) c FROM product_option_groups`).c, groupsBefore13);
const sig = (id) => one(db, `SELECT option_signature s FROM product_variants WHERE id=?`, id).s;
const valueId = (label) => one(db, `SELECT id FROM product_option_values WHERE label=?`, label).id;
eq("v1 signature is key=value_id", sig("v1"), `color=${valueId("Black & Gold")}`);
eq("v3 signature sorts by group key", sig("v3"), `color=${valueId("Red")}|size=${valueId("42")}`);
eq("a non-colour group signs the same way", sig("v5"), `volume=${valueId("30 ml")}`);
eq("option-less variant signs empty", sig("v8"), "");
eq("every variant signed", one(db, `SELECT COUNT(*) c FROM product_variants WHERE option_signature IS NOT NULL`).c, 8);
eq("nothing was mirrored into a legacy slot -- every group came from one",
   one(db, `SELECT COUNT(*) c FROM product_variants WHERE id='v8' AND (option1_value IS NOT NULL OR option2_value IS NOT NULL)`).c, 0);
eq("no duplicate active signatures", one(db,
  `SELECT COUNT(*) c FROM (SELECT product_id FROM product_variants WHERE is_active=1 GROUP BY product_id, option_signature HAVING COUNT(*)>1)`).c, 0);
ok("index idx_variant_combination", hasIndex(db, "idx_variant_combination"));
eq("0013 moved no stock and no price", all(db, `SELECT id, stock_quantity, price FROM product_variants ORDER BY id`), before.stock);
eq("0013 wrote nothing to the stock ledger", one(db, `SELECT COUNT(*) c FROM inventory_movements`).c, 1);
probe(db, "a duplicate active combination is now refused", () =>
  db.exec(`INSERT INTO product_variants (id, product_id, sku, option_signature, is_active) VALUES ('v9','p1','X-1','${sig("v1")}',1);`), true);
probe(db, "a retired variant may reuse a combination", () =>
  db.exec(`INSERT INTO product_variants (id, product_id, sku, option_signature, is_active) VALUES ('v9','p1','X-1','${sig("v1")}',0);`), false);

// ---------------------------------------------------------------- 0014, 0015
console.log("\n=== 0014_address_district ===");
r = applyFile(db, "0014_address_district.sql");
ok("0014 applied", r.applied, r.error);
ok("orders.address_district added", cols(db, "orders").includes("address_district"));
ok("addresses.district added", cols(db, "addresses").includes("district"));
eq("no district invented for orders placed before it",
   one(db, `SELECT COUNT(*) c FROM orders WHERE address_district IS NULL`).c, one(db, `SELECT COUNT(*) c FROM orders`).c);

console.log("\n=== 0015_payment_and_scale ===");
r = applyFile(db, "0015_payment_and_scale.sql");
ok("0015 applied", r.applied, r.error);
for (const c of ["method", "failure_reason", "initiated_at", "completed_at", "idempotency_key"])
  ok(`payment_transactions.${c} added`, cols(db, "payment_transactions").includes(c));
for (const i of ["idx_payment_idempotency", "idx_payment_order", "idx_payment_provider_ref",
                 "idx_orders_placed_at", "idx_orders_status", "idx_orders_payment_status",
                 "idx_orders_number", "idx_orders_phone", "idx_order_history_order", "idx_notifications_user"])
  ok(`index ${i}`, hasIndex(db, i));

// ------------------------------------------------------------- end state
console.log("\n=== END STATE: seven migrations on, compared with a fresh install ===");
eq("no order lost or gained", one(db, `SELECT COUNT(*) c FROM orders`).c, 4);
eq("every money figure is exactly as seeded", all(db, `SELECT id, price, quantity FROM order_items ORDER BY id`), before.items);
eq("every stock figure is exactly as seeded", all(db, `SELECT id, stock_quantity, price FROM product_variants ORDER BY id`), before.stock);
eq("every order row is exactly as seeded", all(db, `SELECT id, subtotal, shipping_fee, total, status FROM orders ORDER BY id`), before.orders);
eq("every cart line is exactly as seeded",
   all(db, `SELECT id, user_id, product_id, variant_id, seller_id, color, quantity FROM cart_items ORDER BY id`), before.cart);

fs.rmSync(`${R}/fresh.sqlite`, { force: true });
const freshDb = new DatabaseSync(`${R}/fresh.sqlite`);
freshDb.exec(fs.readFileSync(`${HERE}../schema.sql`, "utf8"));
const shape = (d) => Object.fromEntries(all(d, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
  .map((t) => [t.name, cols(d, t.name).slice().sort()]));
const upShape = shape(db), frShape = shape(freshDb);
eq("every table has the columns a fresh install has",
   Object.keys(frShape).filter((t) => JSON.stringify(frShape[t]) !== JSON.stringify(upShape[t])), []);
const idxOf = (d) => all(d, `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'`).map((x) => x.name);
eq("every index a fresh install has is present", idxOf(freshDb).filter((i) => !idxOf(db).includes(i)), []);
freshDb.close();
db.close();

// ------------------------------------------- the option builder in between
console.log("\n=== 0013 where the admin renamed a group after 0009 ===");
const b = fresh(`${R}/renamed.sqlite`);
applyFile(b, "0009_dynamic_options.sql");
applyFile(b, "0010_variant_cart.sql");
// What the option builder produces: a key fixed at creation, a name since
// renamed -- "Color" to "Colour" -- on a product with no legacy options.
b.exec(`INSERT INTO products (id, category_id, name, slug, price) VALUES ('p6', 'c1', 'Silk Scarf', 'silk-scarf', 1800);
        INSERT INTO product_option_groups (id, product_id, key, name, display, show_labels, sort_order)
          VALUES ('g6', 'p6', 'color', 'Colour', 'swatch', 1, 0);
        INSERT INTO product_option_values (id, group_id, value, label, color_hex, sort_order)
          VALUES ('ov6', 'g6', 'midnight-blue', 'Midnight Blue', '#12325f', 0);
        INSERT INTO product_variants (id, product_id, sku, stock_quantity) VALUES ('v10', 'p6', 'SS-MB', 9);
        INSERT INTO product_variant_options (variant_id, group_id, value_id) VALUES ('v10', 'g6', 'ov6');`);
for (const f of ["0011_order_integrity.sql", "0012_order_suborders.sql", "0013_option_builder.sql"]) applyFile(b, f);
eq("the renamed group is mirrored into the legacy slot",
   one(b, `SELECT option1_name n, option1_value v, swatch s FROM product_variants WHERE id='v10'`),
   { n: "Colour", v: "Midnight Blue", s: "#12325f" });
eq("v10 signs against the group it already had", one(b, `SELECT option_signature s FROM product_variants WHERE id='v10'`).s, "color=ov6");
eq("p6 still has exactly one group", one(b, `SELECT COUNT(*) c FROM product_option_groups WHERE product_id='p6'`).c, 1);
const sigs = all(b, `SELECT id, option_signature FROM product_variants ORDER BY id`);
const groups = one(b, `SELECT COUNT(*) c FROM product_option_groups`).c;
const body = fs.readFileSync(`${M}/0013_option_builder.sql`, "utf8").split("\n").filter((l) => !/^ALTER TABLE/.test(l)).join("\n");
try { b.exec("BEGIN;" + body + "COMMIT;"); ok("0013's data section re-runs cleanly", true); }
catch (e) { try { b.exec("ROLLBACK;"); } catch {} ok("0013's data section re-runs cleanly", false, e.message); }
eq("the re-run minted no second group", one(b, `SELECT COUNT(*) c FROM product_option_groups`).c, groups);
eq("the re-run changed no signature", all(b, `SELECT id, option_signature FROM product_variants ORDER BY id`), sigs);
b.close();

// ------------------------------------------------- 0013 against dirty data
console.log("\n=== 0013 where two active variants already share a combination ===");
const dirty = fresh(`${R}/dirty.sqlite`,
  `INSERT INTO product_variants (id, product_id, sku, option1_name, option1_value, swatch, stock_quantity)
   VALUES ('vdup','p1','CW-SL2','Color','Silver','#cccccc',2);`);
for (const f of ["0009_dynamic_options.sql", "0010_variant_cart.sql", "0011_order_integrity.sql", "0012_order_suborders.sql"])
  applyFile(dirty, f);
const dup = applyFile(dirty, "0013_option_builder.sql");
ok("0013 refuses to apply", !dup.applied, dup.error ?? "it applied");
ok("the failure names the unique index", /idx_variant_combination|UNIQUE/i.test(dup.error ?? ""), dup.error);
ok("rolled back: no option_signature column", !cols(dirty, "product_variants").includes("option_signature"));
ok("rolled back: no is_active on groups", !cols(dirty, "product_option_groups").includes("is_active"));
eq("rolled back: the duplicate variant is untouched", one(dirty, `SELECT stock_quantity q FROM product_variants WHERE id='vdup'`).q, 2);
dirty.close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
