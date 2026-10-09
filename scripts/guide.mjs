#!/usr/bin/env node
/** Read and write the Zupona System Guide in the database.
 *
 *   node scripts/guide.mjs pull [--local]           sections -> .guide/NN-slug.md
 *   node scripts/guide.mjs push [--local] [slug...]  .guide/*.md -> sections
 *   node scripts/guide.mjs sync-point [--local]      prints "Synced through ..."
 *
 * The guide lives in `system_guide_sections` (migration 0024) and is read at
 * Admin > Settings > System Guide. It is kept out of the repository because
 * the repository is public, so `.guide/` is gitignored: edit the files there,
 * push them back, and never commit them.
 *
 * Each file's first line is `# <Section title>`; the rest is that section's
 * Markdown. The number in the file name is the section's position, so
 * renaming `07-data-model.md` to `05-data-model.md` moves the section. A
 * ```svg fence is drawn as a picture on the page.
 *
 * Who wrote a change is recorded from GUIDE_AUTHOR (default "Claude").
 *
 * With GUIDE_API_URL and GUIDE_SYNC_TOKEN set (the Update System Guide
 * workflow), it talks to the live Worker's /api/internal/guide instead of
 * D1, because no GitHub token can reach D1 directly. --local is ignored then. */

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const dir = path.join(root, ".guide");
const args = process.argv.slice(2);
const command = args.shift();
const local = args.includes("--local");
const slugs = args.filter((arg) => !arg.startsWith("--"));
const author = process.env.GUIDE_AUTHOR || "Claude";

// wrangler's own entry point, not npx: the same on a GitHub runner and on
// Windows, with no shell in between to re-quote the SQL.
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");

function d1(extra) {
  const r = spawnSync(
    process.execPath,
    [wrangler, "d1", "execute", "zupona-v3-db", local ? "--local" : "--remote", "--json", ...extra],
    {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    }
  );
  if (r.status !== 0) {
    console.error((r.stderr || r.stdout || String(r.error ?? "wrangler failed")).slice(-3000));
    process.exit(1);
  }
  try {
    // A remote --file run prints upload progress before its JSON; the JSON is
    // the array that starts on a line of its own.
    const start = r.stdout.startsWith("[") ? 0 : r.stdout.indexOf("\n[") + 1;
    return JSON.parse(r.stdout.slice(start))[0]?.results ?? [];
  } catch {
    console.error(r.stdout.slice(-3000));
    process.exit(1);
  }
}

const api = process.env.GUIDE_API_URL;
const apiToken = process.env.GUIDE_SYNC_TOKEN;

async function callApi(method, body) {
  const response = await fetch(api, {
    method,
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`${method} ${api} -> HTTP ${response.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  return JSON.parse(text);
}

async function readSections() {
  if (api) return (await callApi("GET")).sections;
  return d1([
    "--command",
    "SELECT slug, title, position, body_md, updated_at, updated_by FROM system_guide_sections ORDER BY position",
  ]);
}

const sql = (text) => `'${String(text).replace(/'/g, "''")}'`;

if (command === "pull") {
  const rows = await readSections();
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const row of rows) {
    const name = `${String(row.position).padStart(2, "0")}-${row.slug}.md`;
    writeFileSync(path.join(dir, name), `# ${row.title}\n\n${row.body_md.trim()}\n`);
  }
  console.log(`pulled ${rows.length} sections into .guide/`);
} else if (command === "push") {
  const files = readdirSync(dir).filter((name) => /^\d+-[a-z0-9-]+\.md$/.test(name));
  const chosen = files.filter((name) => slugs.length === 0 || slugs.includes(name.replace(/^\d+-|\.md$/g, "")));
  if (chosen.length === 0) {
    console.error("nothing to push: no matching .guide/NN-slug.md files");
    process.exit(2);
  }
  const sections = chosen.map((name) => {
    const [, position, slug] = name.match(/^(\d+)-([a-z0-9-]+)\.md$/);
    const text = readFileSync(path.join(dir, name), "utf8").replace(/\r\n/g, "\n");
    const title = text.match(/^# (.+)$/m)?.[1]?.trim();
    if (!title) {
      console.error(`${name}: the first line must be "# <Section title>"`);
      process.exit(2);
    }
    return { slug, title, position: Number(position), body_md: text.replace(/^# .+\n+/, "").trim() };
  });
  if (api) {
    await callApi("PUT", { sections, author });
  } else {
    const statements = sections.map(
      ({ slug, title, position, body_md }) =>
        `INSERT INTO system_guide_sections (slug, title, position, body_md, updated_at, updated_by) ` +
        `VALUES (${sql(slug)}, ${sql(title)}, ${position}, ${sql(body_md)}, datetime('now'), ${sql(author)}) ` +
        `ON CONFLICT(slug) DO UPDATE SET title = excluded.title, position = excluded.position, ` +
        `body_md = excluded.body_md, updated_at = excluded.updated_at, updated_by = excluded.updated_by ` +
        `WHERE system_guide_sections.body_md IS NOT excluded.body_md ` +
        `OR system_guide_sections.title IS NOT excluded.title ` +
        `OR system_guide_sections.position IS NOT excluded.position;`
    );
    const file = path.join(os.tmpdir(), `zupona-guide-${process.pid}.sql`);
    writeFileSync(file, statements.join("\n"));
    try {
      d1(["--file", file]);
    } finally {
      rmSync(file, { force: true });
    }
  }
  console.log(`pushed ${chosen.length} section(s) to the ${api ? "live (API)" : local ? "local" : "live"} guide`);
} else if (command === "sync-point") {
  const text = (await readSections()).map((row) => row.body_md).join("\n");
  console.log(text.match(/Synced through commit `?([0-9a-f]{7,40})`?[^\n]*/)?.[0] ?? "no sync point recorded");
} else {
  console.error("usage: node scripts/guide.mjs pull|push|sync-point [--local] [slug...]");
  process.exit(2);
}
