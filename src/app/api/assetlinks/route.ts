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
 * The fingerprint below is printed by the APK workflow's job summary. It only
 * changes if the signing keystore changes -- which, while the workflow still
 * generates a keystore per run, means it changes on every build. */

const PACKAGE_NAME = "com.zupona.app";

/** SHA-256 fingerprints of every signing certificate allowed to claim the
 * site. More than one is legitimate: a key rotation lists both for a while. */
const CERT_FINGERPRINTS: string[] = [];

export function GET() {
  const statements = CERT_FINGERPRINTS.length
    ? [
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: PACKAGE_NAME,
            sha256_cert_fingerprints: CERT_FINGERPRINTS,
          },
        },
      ]
    : [];

  return new Response(JSON.stringify(statements, null, 2), {
    headers: {
      "content-type": "application/json",
      // Android caches the statement; an hour is short enough that adding a
      // fingerprint takes effect the same day.
      "cache-control": "public, max-age=3600",
    },
  });
}
