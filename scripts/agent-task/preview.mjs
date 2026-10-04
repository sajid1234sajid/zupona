#!/usr/bin/env node
/** Put the working tree on zupona.com at 0% traffic, so it can be seen with
 * real data before the owner taps 🚀.
 *
 *   node scripts/agent-task/preview.mjs           build, upload, stage at 0%; prints the version id
 *   node scripts/agent-task/preview.mjs --clear   drop a staged 0% version again
 *
 * Customers keep getting the version that serves 100% of traffic. A request
 * carrying `Cloudflare-Workers-Version-Overrides: zupona="<id>"` gets the new
 * one instead -- `shot.mjs --version <id>` sends exactly that, so a screenshot
 * shows the change on the real domain with the real database. The same
 * mechanism vinext uses to warm a version before promoting it.
 *
 * The next real deploy (deploy.yml, after 🚀) replaces the staged version;
 * `--clear` is for when the owner taps ❌ instead. */

import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  runWranglerDeploymentStatus,
  runWranglerVersionDeploy,
  runWranglerVersionUpload,
} from "@vinext/cloudflare/internal/version-deploy";

const root = path.resolve(import.meta.dirname, "..", "..");
// The built config once there is a build; --clear also runs without one (the Worker's name is the same).
const options = () => ({ config: existsSync(path.join(root, "dist/server/wrangler.json")) ? "dist/server/wrangler.json" : "wrangler.jsonc" });

function servingVersion() {
  const status = runWranglerDeploymentStatus(root, options());
  return { serving: status.versions.filter((v) => v.percentage > 0), all: status.versions };
}

if (process.argv.includes("--clear")) {
  const { serving, all } = servingVersion();
  if (serving.length === 1 && serving[0].percentage === 100 && all.length > 1) {
    runWranglerVersionDeploy(root, [serving[0]], options(), "promote-uploaded");
    console.log(`Cleared: only ${serving[0].versionId} is deployed again.`);
  } else {
    console.log("Nothing staged.");
  }
  process.exit(0);
}

// npm is a .cmd on Windows, which only a shell can start.
const build =
  process.platform === "win32"
    ? spawnSync("npm run build", { cwd: root, stdio: "inherit", shell: true })
    : spawnSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) {
  console.error("The build failed: fix it before previewing.");
  process.exit(1);
}

const { serving } = servingVersion();
if (serving.length !== 1 || serving[0].percentage !== 100) {
  console.error("zupona.com is in the middle of a gradual deployment; a preview cannot be staged next to it right now.");
  process.exit(1);
}
const uploaded = runWranglerVersionUpload(root, options());
runWranglerVersionDeploy(root, [serving[0], { versionId: uploaded.versionId, percentage: 0 }], options(), "stage");
writeFileSync(path.join(process.env.AGENT_WORK || os.tmpdir(), "preview-version"), uploaded.versionId);
console.log(`
Preview version ${uploaded.versionId} is on zupona.com at 0% (customers do not see it).
Look at it: node scripts/agent-task/shot.mjs https://zupona.com/<path> <name>.png --version ${uploaded.versionId}
It can take up to a minute before every edge serves it; if a screenshot still shows the old page, wait and take it again.`);
