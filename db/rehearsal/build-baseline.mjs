// Build the baseline: the database as production actually stands today.
//
// Production runs the code on `main`, and `main` carries migrations 0001..0008
// only -- 0009 onwards live on the development branch and have never been
// deployed, which is why product_option_groups does not exist there. So the
// authoritative baseline is not a reconstruction: it is `db/schema.sql` as of
// origin/main, the schema belonging to the deployed code.
import { DatabaseSync } from "node:sqlite";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const HERE = new URL(".", import.meta.url).pathname;
const R = `${HERE}.work`;
fs.mkdirSync(R, { recursive: true });

const REF = process.env.BASELINE_REF ?? "origin/main";
const schema = execFileSync("git", ["show", `${REF}:db/schema.sql`], { cwd: `${HERE}..`, encoding: "utf8" });
fs.writeFileSync(`${R}/baseline.sql`, schema);

fs.rmSync(`${R}/base.sqlite`, { force: true });
const db = new DatabaseSync(`${R}/base.sqlite`);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(schema);

// The Cloudflare D1 console reports these 23 columns, in this order, for the
// remote `orders` table. If this ever stops matching, the baseline no longer
// reflects production and nothing rehearsed on top of it means anything.
const PRODUCTION_ORDERS = [
  "id", "order_number", "user_id", "status", "payment_status", "subtotal",
  "shipping_fee", "discount_total", "coupon_code", "total", "currency",
  "points_earned", "address_label", "address_full_name", "address_phone",
  "address_line", "address_area", "address_city", "payment_label",
  "delivery_method", "placed_at", "created_at", "updated_at",
];
// And these four come with 0009, which production has not had.
const MUST_BE_ABSENT = ["product_option_groups", "product_option_values", "product_variant_options", "buy_now_sessions"];

const got = db.prepare("SELECT name FROM pragma_table_info('orders')").all().map((r) => r.name);
const tables = db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'").get().n;
const present = MUST_BE_ABSENT.filter((t) =>
  db.prepare("SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name=?").get(t).c > 0);
db.close();

console.log(`baseline from ${REF}: ${tables} tables`);
let bad = false;
if (JSON.stringify(got) !== JSON.stringify(PRODUCTION_ORDERS)) {
  bad = true;
  console.log(`FAIL  orders has ${got.length} columns, production has ${PRODUCTION_ORDERS.length}`);
  console.log(`      got      : ${got.join(", ")}`);
  console.log(`      expected : ${PRODUCTION_ORDERS.join(", ")}`);
} else console.log(`PASS  orders matches production exactly, all ${got.length} columns in order`);
if (present.length) { bad = true; console.log(`FAIL  these should not exist yet: ${present.join(", ")}`); }
else console.log(`PASS  the four tables 0009 creates are absent, as on production`);
process.exit(bad ? 1 : 0);
