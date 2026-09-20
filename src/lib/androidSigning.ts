/** SHA-256 fingerprints of the certificates that sign the Android apps.
 *
 * Rewritten by `.github/workflows/android-apk.yml` when it signs a build with
 * a certificate this file does not already name, and committed from the run,
 * so a deploy publishes it. That is the whole reason this is a committed file
 * rather than a value in KV: the namespace's free write quota is spent by the
 * shop's own caching most days, and a fingerprint that cannot be written is a
 * full-screen app that stays a browser tab.
 *
 * Nothing here is secret. A signing certificate's fingerprint is published on
 * purpose -- it is what `/.well-known/assetlinks.json` exists to state.
 *
 * Newest first, and at most three: a key rotation needs the old fingerprint
 * until every phone has the new build, and no longer.
 *
 * One list covers both apps, because both are signed with the same keystore --
 * the one in the R2 vault. Only the application id differs between them.
 */
export const ANDROID_CERT_FINGERPRINTS: string[] = [
  "36:DE:0A:88:9F:5B:C9:2A:BE:A8:6D:69:A1:09:34:95:9F:4D:08:50:45:57:82:71:8C:01:15:6A:65:89:EB:FE",
];

/** The application ids the fingerprints belong to, as declared in
 * `android/twa-manifest.json` and `android/admin/twa-manifest.json`.
 *
 * The shop app is trusted for zupona.com and the admin app for
 * admin.zupona.com; each host vouches only for its own, so neither app can
 * open the other's pages without Chrome's address bar. */
export const ANDROID_PACKAGE_NAME = "com.zupona.app";
export const ANDROID_ADMIN_PACKAGE_NAME = "com.zupona.admin";
