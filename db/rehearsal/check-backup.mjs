// Prove a Cloudflare D1 export is a usable backup.
//
//   npx wrangler d1 export zupona-v3-db --remote --output=./backup-0008.sql
//   node --experimental-sqlite db/rehearsal/check-backup.mjs ./backup-0008.sql
//
// A file that exists is not a backup. This loads the export into a throwaway
// SQLite database -- which only succeeds if the SQL is complete and valid --
// and prints the same census db/census.sql prints against the remote database,
// so the two can be compared row for row. An export cut short by a dropped
// connection fails here rather than three weeks from now.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const file = process.argv[2];
if (!file) { console.error("usage: check-backup.mjs <backup.sql>"); process.exit(2); }
if (!fs.existsSync(file)) { console.error(`no such file: ${file}`); process.exit(2); }

const sql = fs.readFileSync(file, "utf8");
const bytes = fs.statSync(file).size;
console.log(`file        ${file}`);
console.log(`size        ${(bytes / 1024).toFixed(1)} KB`);
if (bytes === 0) { console.log("\nFAIL  the file is empty"); process.exit(1); }

const HERE = fileURLToPath(new URL(".", import.meta.url));
// Scratch databases live outside the repository: a SQLite file inside the
// project is watched by the dev server, and on Windows a locked one crashes it.
const WORK = path.join(os.tmpdir(), "zupona-rehearsal");
const tmp = `${WORK}/backup-check.sqlite`;
fs.mkdirSync(`${WORK}`, { recursive: true });
fs.rmSync(tmp, { force: true });

const db = new DatabaseSync(tmp);
try {
  db.exec(sql);
} catch (e) {
  console.log(`\nFAIL  the export does not load: ${e.message}`);
  console.log("      the file is truncated or corrupt -- take the export again.");
  process.exit(1);
}
console.log(`loads       yes, cleanly`);

const TABLES = ["users", "sellers", "categories", "products", "product_variants", "product_images",
                "orders", "order_items", "suborders", "cart_items", "addresses",
                "inventory_movements", "notifications", "reviews", "site_settings"];
const missing = TABLES.filter((t) =>
  db.prepare(`SELECT COUNT(*) c FROM sqlite_master WHERE type='table' AND name=?`).get(t).c === 0);
const tables = db.prepare(`SELECT COUNT(*) n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).get().n;
console.log(`tables      ${tables}`);

console.log(`\ncensus -- compare these with db/census.sql run against the remote database:`);
let total = 0;
for (const t of TABLES) {
  if (missing.includes(t)) { console.log(`  MISSING   ${t}`); continue; }
  const n = db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get().c;
  total += n;
  console.log(`  ${String(n).padStart(7)}   ${t}`);
}

const orders = db.prepare(`SELECT name FROM pragma_table_info('orders')`).all().map((r) => r.name);
console.log(`\norders has ${orders.length} columns, ending at ${orders[orders.length - 1]}`);

let bad = false;
if (missing.length) { bad = true; console.log(`\nFAIL  tables absent from the export: ${missing.join(", ")}`); }
if (total === 0) { bad = true; console.log(`\nFAIL  the export carries no rows at all`); }
db.close();

if (bad) process.exit(1);
console.log(`\nPASS  the export loads, carries ${tables} tables and ${total} rows in the counted ones.`);
console.log(`      Keep this file until the migrations are done and the site is verified.`);
