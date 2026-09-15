// Run a read-only .sql file against D1 and print the rows it returns.
//
//   node db/run-query.mjs db/census.sql              (the remote database)
//   node db/run-query.mjs db/preflight.sql --local   (the local one)
//
// `wrangler d1 execute --file` sends a file through D1's import path, which
// runs it but hands back no rows -- only "Total queries executed: 1". Every
// check in db/ is a SELECT whose rows are the whole point, so each statement
// is sent through `--command` instead, which returns them.
//
// Anything that is not a SELECT is refused before it is sent, so this cannot
// be used to change a database by accident.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Called through node directly rather than npx: no shell sits in between to
// mangle the quotes and pipes a SQL statement is full of.
const wrangler = path.join(repo, "node_modules", "wrangler", "bin", "wrangler.js");

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const target = args.includes("--local") ? "--local" : "--remote";
if (!file) {
  console.error("usage: node db/run-query.mjs <file.sql> [--local]");
  process.exit(2);
}

const statements = fs
  .readFileSync(file, "utf8")
  .split(/\r?\n/)
  .filter((line) => !/^\s*--/.test(line))
  .join("\n")
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

const refused = statements.findIndex((statement) => !/^(SELECT|WITH)\b/i.test(statement));
if (refused !== -1) {
  console.error(`refusing to run ${file}: statement ${refused + 1} is not a SELECT`);
  process.exit(1);
}

for (const [index, statement] of statements.entries()) {
  const raw = execFileSync(
    process.execPath,
    [wrangler, "d1", "execute", "zupona-v3-db", target, "--json", "--command", statement.replace(/\s+/g, " ")],
    { cwd: repo, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] }
  );
  // Wrangler can print progress lines ahead of the JSON.
  const [result] = JSON.parse(raw.slice(raw.search(/^\[/m)));
  const rows = result.results ?? [];
  console.log(`\n${path.basename(file)} #${index + 1}  (${target.slice(2)}, ${rows.length} row${rows.length === 1 ? "" : "s"})`);
  if (rows.length) console.table(rows);
  else console.log("  (no rows)");
}
