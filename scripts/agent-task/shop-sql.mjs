#!/usr/bin/env node
/** Read the live shop database, and nothing else.
 *
 *   node scripts/agent-task/shop-sql.mjs "SELECT ..." [--csv name.csv]
 *
 * The agent-task workflow gives Claude Code this script, and no other way to
 * run commands, when the owner only asked a question on WhatsApp: a question
 * starts without the owner's ✅, so it must not be able to change anything.
 * One statement, and only SELECT (or the schema PRAGMAs); everything else is
 * refused before it reaches Cloudflare. `--csv` also saves the rows as a file
 * the owner can be sent. */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const csvAt = args.indexOf("--csv");
const csvName = csvAt >= 0 ? args.splice(csvAt, 2)[1] : null;
const sql = (args.join(" ") || "").trim().replace(/;\s*$/, "");

function refuse(msg) {
  console.error(`refused: ${msg}`);
  process.exit(2);
}

if (!sql) refuse('usage: node scripts/agent-task/shop-sql.mjs "SELECT ..." [--csv name.csv]');
if (sql.includes(";")) refuse("one statement at a time");
// SQLite reads begin with SELECT; a WITH can end in DELETE or UPDATE, so it is not allowed.
if (!/^(select\b|pragma\s+(table_info|table_list|index_list|foreign_key_list)\s*\()/i.test(sql)) {
  refuse("only SELECT (and PRAGMA table_info/table_list/index_list/foreign_key_list) — this run cannot change data");
}

// wrangler's own entry point, not npx: the same on the runner and on Windows, with no shell to re-quote the SQL.
const wrangler = path.join(import.meta.dirname, "..", "..", "node_modules", "wrangler", "bin", "wrangler.js");
const r = spawnSync(process.execPath, [wrangler, "d1", "execute", "zupona-v3-db", "--remote", "--json", "--command", sql], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
});
if (r.status !== 0) {
  console.error((r.stderr || r.stdout || String(r.error ?? "wrangler failed")).slice(-3000));
  process.exit(1);
}

let rows;
try {
  rows = JSON.parse(r.stdout)[0]?.results ?? [];
} catch {
  console.error(r.stdout.slice(-3000));
  process.exit(1);
}

if (csvName) {
  const out = process.env.AGENT_OUT;
  if (!out) refuse("AGENT_OUT is not set");
  const file = path.join(out, path.basename(csvName).replace(/[^\w.-]/g, "_"));
  const cols = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const cell = (v) => (v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  mkdirSync(out, { recursive: true });
  // A BOM so Excel on a phone opens Bangla text correctly.
  writeFileSync(file, String.fromCharCode(0xfeff) + [cols.join(","), ...rows.map((row) => cols.map((c) => cell(row[c])).join(","))].join("\n"));
  console.error(`saved ${rows.length} rows to ${file}`);
}

const text = JSON.stringify(rows, null, 1);
console.log(text.length > 60_000 ? `${text.slice(0, 60_000)}\n… (${rows.length} rows; truncated — narrow the query)` : text);
