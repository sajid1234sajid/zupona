#!/usr/bin/env node
/** Screenshot a page for the owner, or to check a change by looking at it.
 *
 *   node scripts/agent-task/shot.mjs <url> <name.png> [--desktop] [--full] [--version <id>]
 *
 * Phone size (390px, the shop's main audience) unless --desktop. With
 * --version, requests to zupona.com get the Worker version staged by
 * preview.mjs instead of the live one: the change, with real data, before it
 * goes live. The file lands in $AGENT_OUT, from where the agent-task workflow
 * can send it to the owner's WhatsApp. Analytics and ad pixels are blocked,
 * so screenshots never count as visits. */

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const args = process.argv.slice(2);
const versionAt = args.indexOf("--version");
const version = versionAt >= 0 ? args.splice(versionAt, 2)[1] : null;
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [url, name] = args.filter((a) => !a.startsWith("--"));
if (!url || !name || !/^https?:\/\//.test(url) || (versionAt >= 0 && !/^[0-9a-f-]{36}$/i.test(version ?? ""))) {
  console.error("usage: node scripts/agent-task/shot.mjs <https://...> <name.png> [--desktop] [--full] [--version <id>]");
  process.exit(2);
}
const out = process.env.AGENT_OUT;
if (!out) {
  console.error("AGENT_OUT is not set");
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const file = path.join(out, path.basename(name).replace(/[^\w.-]/g, "_").replace(/(\.png)?$/i, ".png"));

const TRACKERS = /(facebook\.(net|com)\/(tr|signals)|connect\.facebook\.net|google-analytics\.com|googletagmanager\.com|analytics\.tiktok\.com|clarity\.ms|doubleclick\.net)/;

const browser = await chromium.launch();
try {
  const context = await browser.newContext(
    flags.has("--desktop")
      ? { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 }
      : { ...devices["iPhone 13"], viewport: { width: 390, height: 844 } },
  );
  await context.route(TRACKERS, (route) => route.abort());
  if (version) {
    // Only the shop's own hosts get the override; other origins never see the header.
    await context.route(/^https:\/\/([a-z0-9-]+\.)?zupona\.com\//, (route) =>
      route.continue({ headers: { ...route.request().headers(), "cloudflare-workers-version-overrides": `zupona="${version}"` } }),
    );
  }
  const page = await context.newPage();
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 }).catch(() => page.goto(url, { waitUntil: "load", timeout: 45_000 }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: file, fullPage: flags.has("--full") });
  console.log(`saved ${file} (HTTP ${res?.status() ?? "?"}${version ? `, version ${version}` : ""})`);
} finally {
  await browser.close();
}
