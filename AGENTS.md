<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Zupona project guide

A multi-vendor marketplace (platform and independent sellers both list;
orders split per seller) built as a Next.js app on [vinext](https://vinext.dev),
deployed as a **single Cloudflare Worker**. Read [README.md](README.md) for
setup and [DATABASE.md](DATABASE.md) for the data layer — that one is the real
reference, 51 tables with the reasoning behind them.

[HISTORY.md](HISTORY.md) covers what lives outside the repository — the
Cloudflare and GitHub state, why the deploy pipeline is shaped the way it is,
and the open items. Read it before touching deployment, hosting or accounts.

## Deploying: push to `main` and it ships

`.github/workflows/deploy.yml` builds on GitHub's runners and deploys to
Cloudflare using a `CLOUDFLARE_API_TOKEN` repository secret. A push reaches
zupona.com in about one to two minutes with no local machine involved, so
**committing and pushing is what "deployed" means here** — running
`npm run deploy` as well only duplicates the work.

Deploy by hand (`npm run build && npm run deploy`) only when a change must go
live without a commit, or when CI is broken.

A failing build deploys nothing and leaves the live site alone.

### Migrations do not ride along

CI deploys code only. A new `db/migrations/*.sql` file is **never** applied by
the pipeline. Shipping code that expects an unapplied migration produces server
errors on zupona.com — this is the single most common way to break production
here, because the local D1 has the migration and the remote one does not:

```bash
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/<file>.sql
```

Apply to `--local` and `--remote` both, or the two drift. Without a machine
logged in to Cloudflare, the manual **Apply D1 migration** workflow runs the
same command from a GitHub runner; **Sync Worker secrets** does the same for
`wrangler secret put`. Both are `workflow_dispatch` only.

## The GitHub remote is not the obvious account

`origin` is **`sajid1234sajid/zupona`** (note the `4`). The Git credential
stored on the development machine belongs to a different account,
`sajid123sajid`, which also owns similarly named repositories (`zupona`,
`zupona1`, `zupona-v3`). A plain `git push` goes to the right place; do not
"correct" the remote to the account whose token happens to be cached. That
repository is public, so nothing sensitive belongs in a commit.

## Things that will bite you

**Use the default scripts, not the `*-native` ones.** `npm run dev`, `build`,
`start`, `deploy` all go through vinext on workerd. `dev:next-native` runs plain
Next.js, where `cloudflare:workers` does not resolve and every database page
errors.

**Reach bindings through `src/lib/db.ts`** (`getDB()`, `getMedia()`,
`getCache()`), never by importing `cloudflare:workers` directly — the helpers
fail with a clear message outside the Workers runtime.

**The admin panel is the same Worker.** `src/proxy.ts` maps
`admin.zupona.com/products` onto the internal `/admin/products`. That file is
routing, not authorization; `requireAdmin()` in the admin layout and in every
server action is what actually guards access, because anything reaching the
origin another way bypasses a proxy check.

**Prices are whole Taka stored as integers.** There are no minor units to
divide by; match `formatPrice()` in `src/lib/format.ts`.

**Stock lives on variants, never on products,** and always changes through
`src/lib/inventory.ts` so `product_variants.stock_quantity` and the
`inventory_movements` ledger stay in agreement. A variant's `price` is `NULL`
when it inherits the product price — read `effectivePrice`, not `price`.

**Admin-uploaded media must not go through the Next image optimizer.** It
cannot fetch `/api/media/` URLs and answers 404, which renders uploaded imagery
as broken thumbnails. Pass `unoptimized` for those; see
`src/components/product/ProductGallery.tsx`.

**After changing `wrangler.jsonc` bindings,** run `npx wrangler types` to
refresh `worker-configuration.d.ts`.

## Before claiming the UI looks right

Render the page and look at it — Playwright is a devDependency for exactly
this. A build that compiles says nothing about whether the page renders, and
claims about appearance made without rendering have been wrong here before.
