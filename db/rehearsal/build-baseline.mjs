// Build a pre-0011 baseline database: exactly what production looks like today.
// Strategy: create the full schema, read the CREATE statements back out of
// sqlite_master, remove line-by-line what migrations 0011..0015 added, then
// build a second, empty database from the edited statements.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const R = `${HERE}.work`;
fs.mkdirSync(R, { recursive: true });
const SCHEMA = `${HERE}../schema.sql`;

// Columns each migration added, keyed by table.
const DROP_COLS = {
  orders: ["idempotency_key", "stock_state", "address_district"],
  buy_now_sessions: ["consumed_at"],
  product_option_groups: ["is_active"],
  product_option_values: ["is_active"],
  product_variants: ["option_signature"],
  addresses: ["district"],
  payment_transactions: ["method", "failure_reason", "initiated_at", "completed_at", "idempotency_key"],
};

const DROP_INDEXES = new Set([
  "idx_orders_idempotency", "idx_inventory_reference", "idx_inventory_order_once",
  "idx_buy_now_expiry",                                   // 0011
  "idx_order_items_suborder", "idx_order_items_seller",    // 0012
  "idx_variant_combination",                              // 0013
  "idx_payment_idempotency", "idx_payment_order", "idx_payment_provider_ref",
  "idx_orders_placed_at", "idx_orders_status", "idx_orders_payment_status",
  "idx_orders_number", "idx_orders_phone", "idx_order_history_order",
  "idx_notifications_user",                               // 0015
]);

// ---------------------------------------------------------------------------
// 1. Full schema, to read canonical CREATE text from.
// ---------------------------------------------------------------------------
fs.rmSync(`${R}/full.sqlite`, { force: true });
const full = new DatabaseSync(`${R}/full.sqlite`);
full.exec(fs.readFileSync(SCHEMA, "utf8"));

const objects = full.prepare(
  `SELECT type, name, tbl_name, sql FROM sqlite_master
    WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'`
).all();
full.close();

// ---------------------------------------------------------------------------
// 2. Edit the CREATE TABLE text, one line at a time.
// ---------------------------------------------------------------------------
const removed = [];

function stripColumns(sql, table, cols) {
  let lines = sql.split("\n");
  for (const col of cols) {
    const at = lines.findIndex((l) => new RegExp(`^\\s*${col}\\s`).test(l));
    if (at === -1) throw new Error(`${table}.${col} not found in CREATE text`);
    // Take the contiguous comment-only lines directly above it as well.
    let from = at;
    while (from > 0 && /^\s*--/.test(lines[from - 1])) from--;
    lines.splice(from, at - from + 1);
    removed.push(`${table}.${col}`);
  }
  // The last column line must not end in a comma. Find it by walking back
  // from the closing paren, skipping comment-only and blank lines.
  let end = lines.length - 1;
  while (end >= 0 && !/^\s*\)/.test(lines[end])) end--;
  let last = end - 1;
  while (last >= 0 && /^\s*(--.*)?$/.test(lines[last])) last--;
  lines[last] = lines[last].replace(/,(\s*)(--.*)?$/, "$1$2").replace(/\s+$/, "");
  return lines.join("\n");
}

const statements = [];
for (const o of objects) {
  if (o.type === "index" && DROP_INDEXES.has(o.name)) {
    removed.push(`index ${o.name}`);
    continue;
  }
  let sql = o.sql;
  if (o.type === "table" && DROP_COLS[o.name]) sql = stripColumns(sql, o.name, DROP_COLS[o.name]);
  statements.push(sql + ";");
}

fs.writeFileSync(`${R}/baseline.sql`, statements.join("\n\n") + "\n");

// ---------------------------------------------------------------------------
// 3. Build the baseline and prove it parses.
// ---------------------------------------------------------------------------
fs.rmSync(`${R}/base.sqlite`, { force: true });
const base = new DatabaseSync(`${R}/base.sqlite`);
base.exec("PRAGMA foreign_keys = ON;");
base.exec(fs.readFileSync(`${R}/baseline.sql`, "utf8"));

// ---------------------------------------------------------------------------
// 4. Compare `orders` against the production console output.
// ---------------------------------------------------------------------------
const PRODUCTION_ORDERS = [
  "id", "order_number", "user_id", "status", "payment_status", "subtotal",
  "shipping_fee", "discount_total", "coupon_code", "total", "currency",
  "points_earned", "address_label", "address_full_name", "address_phone",
  "address_line", "address_area", "address_city", "payment_label",
  "delivery_method", "placed_at", "created_at", "updated_at",
];
const got = base.prepare("SELECT name FROM pragma_table_info('orders')").all().map((r) => r.name);

const tables = base.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'").get().n;
base.close();

console.log(`removed ${removed.length} objects:`);
for (const r of removed) console.log(`  - ${r}`);
console.log(`\nbaseline built: ${tables} tables`);
console.log(`orders columns: ${got.length} (production: ${PRODUCTION_ORDERS.length})`);
const same = got.length === PRODUCTION_ORDERS.length && got.every((c, i) => c === PRODUCTION_ORDERS[i]);
if (!same) {
  console.log("MISMATCH");
  console.log("  got      :", got.join(", "));
  console.log("  expected :", PRODUCTION_ORDERS.join(", "));
  process.exit(1);
}
console.log("orders matches production exactly, in order. PASS");
