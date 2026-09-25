# Project history and current state

Git history records *what* changed. This file records *why*, and what exists
outside the repository — the Cloudflare and GitHub state a fresh session cannot
discover by reading code. Read it before changing anything about deployment,
hosting or accounts.

## Where everything lives

| Thing | Value |
| --- | --- |
| Storefront | https://zupona.com |
| Admin panel | https://admin.zupona.com (same Worker, routed by Host header) |
| Image Fit | https://fit.zupona.com — Worker `zupona-image-fit`, code in `apps/image-fit/` |
| GitHub repository | `sajid1234sajid/zupona` (**public**) |
| Cloudflare account | sajedaakter589@gmail.com |
| Worker | `zupona` |
| D1 database | `zupona-v3-db` |
| R2 bucket | `zupona-product-media` |
| KV namespace | `CACHE` |

Every app with its links is listed in [APPS.md](APPS.md). Resource IDs live in `wrangler.jsonc`; `npx wrangler d1 list`, `kv namespace
list` and `r2 bucket list` show what the account actually holds.

### Older things deliberately left alone

- **`zupona-db`** (created 2026-08-20) is an earlier build's database with an
  incompatible schema. Nothing is bound to it. It is kept as an archive.
- **The `asdf` Worker** previously served the apex domain. It is still deployed
  but bound to no hostname; re-pointing `zupona.com` at it is the rollback path
  of last resort.
- **`sajid123sajid/zupona-v3`** is a private duplicate of this repository,
  created by mistake before it was established which account owns the project
  (see below). It is redundant and can be deleted by its owner.

## How deployment works, and why it is built this way

Pushing to `main` builds and deploys the site through
`.github/workflows/deploy.yml`. Two details are load-bearing:

**The deploy command is `npx vinext-cloudflare deploy --config
dist/server/wrangler.json`, not `wrangler deploy`.** vinext generates its own
Worker config during the build; the repository's root `wrangler.jsonc` points
`main` at `vinext/server/fetch-handler`, which only resolves through vinext's
deploy wrapper. Using plain `wrangler deploy` produces a build that succeeds and
a Worker that is broken.

**Node is pinned to 24.19.0** in `.node-version` so CI builds on the version the
project is developed against rather than the runner default.

### Why GitHub Actions rather than Cloudflare's own Workers Builds

Cloudflare can watch a repository directly, which would need no secret at all.
That path was preferred and abandoned for a concrete reason: connecting it
installs the Cloudflare GitHub App, which is a browser sign-in that cannot be
automated, and the local wrangler credential returns `Authentication error` on
every `builds/*` API endpoint because its OAuth scopes do not include Workers
Builds. GitHub Actions was reachable instead, needing only repository write
access and a Cloudflare API token.

If Workers Builds is ever connected in the dashboard, **delete or disable this
workflow**, or one push will deploy twice.

### Why CI needs its own Cloudflare token

The local `wrangler` credential is a short-lived OAuth token — roughly an hour —
that wrangler silently refreshes in the background. Copying it into CI would
work for under an hour and then fail, so the pipeline uses a non-expiring API
token stored as the `CLOUDFLARE_API_TOKEN` repository secret. It was created
from the "Edit Cloudflare Workers" template, scoped to the account and the
`zupona.com` zone, with no client-IP filter — an IP filter would lock GitHub's
runners out.

## The account trap

`origin` is `sajid1234sajid/zupona`. The Git credential cached on the
development machine belongs to **`sajid123sajid`** — a different account, one
character apart, which also owns repositories named `zupona`, `zupona1` and
`zupona-v3`. Work was once pushed to the wrong account's repository because the
cached credential made it look correct.

`sajid123sajid` now has *write* access to `sajid1234sajid/zupona` as a
collaborator, which is enough to push and to manage Actions secrets. It is not
an admin, so changing the repository's visibility requires the owner.

## Timeline

- **2026-08-20** — `sajid1234sajid/zupona` created on GitHub, holding only a
  placeholder README.
- **2026-09-06** — `zupona-v3-db` created; the current Worker takes over the
  apex domain from `asdf`.
- **2026-09-10** — The working tree, which had never been under version control,
  was committed and pushed. The repository's original commit was **merged**
  rather than force-pushed over, so its history survives.
- **2026-09-10** — Fixed admin-uploaded product media rendering as broken
  thumbnails: the Next image optimizer answers 404 for `/api/media/` URLs, so
  those images now pass through `unoptimized`. Verified by rendering the two
  affected product pages against the live site.
- **2026-09-10** — Push-to-deploy pipeline added and verified end to end: a push
  reached zupona.com in under a minute, three times.
- **2026-09-10** — README, AGENTS.md and DATABASE.md rewritten so a session with
  no prior context can understand the project. The README had claimed Vercel
  deployment and a Geist font, neither of which was true.

## Open items

- **The Cloudflare API token was pasted into a chat transcript.** It should be
  rolled in the Cloudflare dashboard and the repository secret updated with the
  new value.
- **The repository is public.** All source, the database schema and the resource
  IDs in `wrangler.jsonc` are world-readable. Making it private requires the
  owner account.
- **Every push to `main` goes straight to the live store.** There is no review
  step and no staging branch. Pointing the pipeline at a `production` branch
  instead would allow experimenting on `main` safely.
- **`zupona-db` can be deleted** once its contents are confirmed unnecessary:
  `npx wrangler d1 delete zupona-db`.
