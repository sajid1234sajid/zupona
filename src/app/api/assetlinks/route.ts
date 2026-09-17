/** Digital Asset Links: the site vouching for the Android app.
 *
 * The APK built by `.github/workflows/android-apk.yml` is a Trusted Web
 * Activity -- Chrome running zupona.com without its address bar. Chrome only
 * drops the address bar if the site names the app's signing certificate here,
 * so an unlisted certificate leaves the app looking like a browser tab rather
 * than failing outright.
 *
 * Android fetches this from `/.well-known/assetlinks.json`; `src/proxy.ts`
 * maps that path onto this route, because a route handler is served on every
 * host the Worker answers for and a dot-prefixed folder in `public/` is not
 * reliably published.
 *
 * The fingerprints are read from KV rather than committed, because the APK
 * workflow writes them there at the moment it signs a build. That keeps the
 * two in step by construction: a key that has never signed anything is never
 * announced, and a new key takes effect without a deploy.
 */

import { getCache } from "@/lib/db";

const PACKAGE_NAME = "com.zupona.app";

/** Written by the APK workflow. A JSON array of SHA-256 certificate
 * fingerprints -- more than one is legitimate, since a key rotation lists the
 * old and the new one together until every install has moved over. */
export const FINGERPRINT_KEY = "android:signing-fingerprints";

async function readFingerprints(): Promise<string[]> {
  try {
    const kv = await getCache();
    const stored = await kv.get(FINGERPRINT_KEY, "json");
    if (!Array.isArray(stored)) return [];
    return stored.filter((entry): entry is string => typeof entry === "string");
  } catch {
    // No bindings, or KV is unreachable. Saying nothing is the safe answer:
    // Chrome then shows the address bar, which is a cosmetic loss, where a
    // wrong fingerprint would be a claim that is not true.
    return [];
  }
}

export async function GET() {
  const fingerprints = await readFingerprints();

  const statements = fingerprints.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: PACKAGE_NAME,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : [];

  return new Response(JSON.stringify(statements, null, 2), {
    headers: {
      "content-type": "application/json",
      // Android caches the statement; an hour is short enough that a newly
      // signed build is trusted the same day.
      "cache-control": "public, max-age=3600",
    },
  });
}
