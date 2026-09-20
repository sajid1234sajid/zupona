# The Zupona Android apps

There are two, and both are **Trusted Web Activities**: an Android shell that
opens a Zupona address full-screen, with the launcher icon, the shortcuts and
the splash screen taken from a web manifest. There is no second codebase —
shipping the site ships both apps' contents too, so only a change to an icon,
a name or the colours needs a new APK.

| App | Opens | Configuration | Web manifest | APK |
| --- | --- | --- | --- | --- |
| Zupona | zupona.com | [`twa-manifest.json`](twa-manifest.json) | [`public/manifest.webmanifest`](../public/manifest.webmanifest) | `zupona.apk` |
| Zupona Admin | admin.zupona.com | [`admin/twa-manifest.json`](admin/twa-manifest.json) | [`public/admin.webmanifest`](../public/admin.webmanifest) | `zupona-admin.apk` |

The admin app is the panel, not the shop: it starts at the dashboard, asks for
the usual admin sign-in, and its shortcuts are Orders, Products and Add
product. It wears the sidebar's dark green so the two launcher icons are told
apart at a glance on a phone that has both installed. It is not a second way
in — `requireAdmin()` guards every page and every server action exactly as it
does in a browser, so the APK on a stranger's phone can do no more than the
login screen lets it.

[`.github/workflows/android-apk.yml`](../.github/workflows/android-apk.yml)
builds both on a GitHub runner, one after the other, so no Android SDK is
needed on a laptop. Run it from the repository's **Actions → Build Android app
→ Run workflow**; it attaches both APKs to a single GitHub release, so the
newest of each is always at

    https://github.com/<owner>/<repo>/releases/latest/download/zupona.apk
    https://github.com/<owner>/<repo>/releases/latest/download/zupona-admin.apk

One release holds both on purpose: GitHub's `latest` is a single release, so
publishing one release per app would make whichever finished second the latest
one and leave the other's download link answering 404.

## The signing key lives in R2, not in the repository

Android installs an update only over an app signed by the **same key**. A key
generated per build would make every release a fresh install: uninstall the old
app, lose the session, start again. So the key has to outlive the run that made
it — and this repository is public, which rules out keeping it here.

It is kept instead in a private R2 bucket, `zupona-app-signing`, written and
read with the `CLOUDFLARE_API_TOKEN` this repository already holds in order to
deploy. Nothing in the Worker binds that bucket, so no route can hand the key
out the way `/api/media` hands out everything in the media bucket. The first
build creates the keystore and a random password and saves both; every later
build fetches them.

KV was the obvious home and was tried first. Its free plan allows a thousand
writes a day, the shop's own caching spends them, and the write that saves the
key came back refused with a quota error — so the vault moved to R2, whose
limits are monthly and nowhere near.

Repository secrets take precedence if they are ever set, which is how to move
the key somewhere else later:

| Secret | What it holds |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the keystore file, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | its store password |
| `ANDROID_KEY_PASSWORD` | the key password (often the same) |
| `ANDROID_KEY_ALIAS` | the alias, if not `zupona` |

`CLOUDFLARE_R2_TOKEN` is used in place of the deploy token when it exists, so
reaching the vault never forces that one credential to be widened.

## Why the address bar goes away

Chrome hides its address bar inside a TWA only when the site vouches for the
app's signing certificate at `/.well-known/assetlinks.json`, served by
[`src/app/api/assetlinks/route.ts`](../src/app/api/assetlinks/route.ts).

That route reads the fingerprints from
[`src/lib/androidSigning.ts`](../src/lib/androidSigning.ts), which the workflow
rewrites and commits when it signs with a certificate the file does not already
name — and then asks for a deploy by name, because a push made with
`GITHUB_TOKEN` deliberately starts no workflows of its own. Up to three
fingerprints are kept, so a phone still running a previously signed build keeps
its full-screen app through a rotation.

Android caches the statement, so a newly published fingerprint can take up to
an hour, or a reinstall, to take effect on a phone that already checked.

One keystore signs both apps, so there is one fingerprint list; only the
application id differs, and the route picks it from the Host header —
`com.zupona.admin` on admin.zupona.com, `com.zupona.app` everywhere else. Each
host therefore vouches for its own app and no other, and only the shop's build
job commits the fingerprint, since the admin job would be writing the same one
again.

## Offline

[`public/sw.js`](../public/sw.js) is a deliberately small service worker: it
caches the hashed build assets, and serves [`/offline`](../src/app/offline)
when a page cannot be reached. It does not cache pages — prices, stock and
carts are exactly the things that must not come from yesterday.
