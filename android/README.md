# The Zupona Android app

The app is a **Trusted Web Activity**: an Android shell that opens
zupona.com full-screen, with the launcher icon and splash screen from
[`public/manifest.webmanifest`](../public/manifest.webmanifest). There is no
second codebase — shipping the site ships the app's contents too, and only a
change to the icon, the name or the colours needs a new APK.

`twa-manifest.json` is the whole configuration.
[`.github/workflows/android-apk.yml`](../.github/workflows/android-apk.yml)
builds it on a GitHub runner, so no Android SDK is needed on a laptop. Run it
from the repository's **Actions → Build Android app → Run workflow**; it
attaches `zupona.apk` to a GitHub release, and the newest one is always at

    https://github.com/<owner>/<repo>/releases/latest/download/zupona.apk

## The signing key, and why the address bar is still there

Chrome hides its address bar inside a TWA only when the site vouches for the
app's signing certificate at `/.well-known/assetlinks.json` — served by
[`src/app/api/assetlinks/route.ts`](../src/app/api/assetlinks/route.ts).

Until a keystore is stored as repository secrets the workflow generates a
throwaway one per run, so the fingerprint changes every build and cannot be
vouched for in advance. That APK installs and works; it just shows the URL for
a moment, and a new build must be installed over the old one by uninstalling
first, because Android refuses an update signed by a different key.

To fix both, add these repository secrets once (Settings → Secrets and
variables → Actions):

| Secret | What it holds |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | its store password |
| `ANDROID_KEY_PASSWORD` | the key password (often the same) |
| `ANDROID_KEY_ALIAS` | the alias, if not `zupona` |

The workflow prints the SHA-256 fingerprint of whatever key it used into the
run summary. Paste that into `CERT_FINGERPRINTS` in the assetlinks route and
push, and the address bar goes away for good.
