# The Zupona Android app

The app is a **Trusted Web Activity**: an Android shell that opens
zupona.com full-screen, with the launcher icon, the shortcuts and the splash
screen from [`public/manifest.webmanifest`](../public/manifest.webmanifest).
There is no second codebase — shipping the site ships the app's contents too,
so only a change to the icon, the name or the colours needs a new APK.

`twa-manifest.json` is the whole configuration.
[`.github/workflows/android-apk.yml`](../.github/workflows/android-apk.yml)
builds it on a GitHub runner, so no Android SDK is needed on a laptop. Run it
from the repository's **Actions → Build Android app → Run workflow**; it
attaches `zupona.apk` to a GitHub release, and the newest one is always at

    https://github.com/<owner>/<repo>/releases/latest/download/zupona.apk

## The signing key lives in KV, not in the repository

Android installs an update only over an app signed by the **same key**. A key
generated per build would make every release a fresh install: uninstall the old
app, lose the session, start again. So the key has to outlive the run that made
it — and this repository is public, which rules out keeping it here.

It is kept instead in the Worker's KV namespace, under `android:signing-key`,
written and read with the `CLOUDFLARE_API_TOKEN` the repository already holds
in order to deploy. The first build generates the keystore and a random
password and saves both; every later build fetches them. Nothing about the app
needs a credential that deploying did not already need.

Repository secrets take precedence if they are ever set, which is how to move
the key somewhere else later:

| Secret | What it holds |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | its store password |
| `ANDROID_KEY_PASSWORD` | the key password (often the same) |
| `ANDROID_KEY_ALIAS` | the alias, if not `zupona` |

## Why the address bar goes away

Chrome hides its address bar inside a TWA only when the site vouches for the
app's signing certificate at `/.well-known/assetlinks.json`, served by
[`src/app/api/assetlinks/route.ts`](../src/app/api/assetlinks/route.ts).

That route reads the fingerprints from KV (`android:signing-fingerprints`),
and the workflow writes them there straight after signing. The statement is
therefore made by the build that actually signed the APK, and a new key takes
effect without a deploy. Up to three fingerprints are kept, so a phone still
running a previously signed build keeps its full-screen app through a rotation.

Android caches the statement, so a newly published fingerprint can take up to
an hour, or a reinstall, to take effect on a phone that already checked.

## Offline

[`public/sw.js`](../public/sw.js) is a deliberately small service worker: it
caches the hashed build assets, and serves [`/offline`](../src/app/offline)
when a page cannot be reached. It does not cache pages — prices, stock and
carts are exactly the things that must not come from yesterday.
