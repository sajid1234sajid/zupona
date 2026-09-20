/** Digital Asset Links: each host vouching for its own Android app.
 *
 * The APKs built by `.github/workflows/android-apk.yml` are Trusted Web
 * Activities -- Chrome running zupona.com, or the panel on admin.zupona.com,
 * without its address bar. Chrome only drops the address bar if the site names
 * the app's signing certificate here, so an unlisted certificate leaves the
 * app looking like a browser tab rather than failing outright.
 *
 * Android fetches this from `/.well-known/assetlinks.json`; `src/proxy.ts`
 * maps that path onto this route, because a route handler is served on every
 * host the Worker answers for and a dot-prefixed folder in `public/` is not
 * reliably published. One Worker answers for both hosts, so which app is named
 * is decided here by the Host header -- the same way the panel itself is.
 *
 * The fingerprints come from `src/lib/androidSigning.ts`, which the APK
 * workflow rewrites and commits whenever it signs with a new certificate.
 */

import {
  ANDROID_ADMIN_PACKAGE_NAME,
  ANDROID_CERT_FINGERPRINTS,
  ANDROID_PACKAGE_NAME,
} from "@/lib/androidSigning";

export function GET(request: Request) {
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const packageName = host.startsWith("admin.")
    ? ANDROID_ADMIN_PACKAGE_NAME
    : ANDROID_PACKAGE_NAME;

  // An empty list is the honest answer before the first stably signed build:
  // Chrome then shows the address bar, which is a cosmetic loss, where a wrong
  // fingerprint would be a claim that is not true.
  const statements = ANDROID_CERT_FINGERPRINTS.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: packageName,
            sha256_cert_fingerprints: ANDROID_CERT_FINGERPRINTS,
          },
        },
      ]
    : [];

  return new Response(JSON.stringify(statements, null, 2), {
    headers: {
      "content-type": "application/json",
      // Android caches the statement; an hour is short enough that a newly
      // published fingerprint is trusted the same day.
      "cache-control": "public, max-age=3600",
      // The answer differs per host, and both hosts are one Worker.
      vary: "host",
    },
  });
}
