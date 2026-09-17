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

## Speed is a constraint on every change, not a task

The shop is served to phones on mobile data in Bangladesh, and the speed it has
was won by measuring rather than guessing. Treat a regression here the way you
would treat a broken build: it applies to every change, not only to work whose
stated purpose is performance. Four things quietly undo it, and each has a
place it is already solved:

**Every picture goes through `StoreImage`** (`src/components/ui/StoreImage.tsx`),
never `next/image` directly. Handed a remote URL with `fill`, `next/image` on
this stack emits a bare `<img>` with no `srcSet` at all, and `/_next/image`
refuses an `/api/media/` path outright -- so an upload went down the wire at its
full size, half a megabyte behind a 170px tile. `StoreImage` asks the source
itself for the width the layout draws, and the media route resizes through the
Images binding when given `?w=`. Local files under `public/` are the exception
and stay on `next/image`, which handles them properly.

**A grid mounts a page at a time.** Every `ProductCard` is a client component
with its own state, so a grid that renders the whole catalog blocks the main
thread while it hydrates and the tab bar will not answer a tap. See
`FeaturedProducts` for the shape: the full catalog still crosses to the client
so search and the chips filter instantly, and only the number on screen grows.

**A link inside a long list does not prefetch.** `prefetch={false}` on product
tiles. Dozens of them each cost an RSC round trip for a page nobody asked for,
and they compete with the navigation the shopper actually wants.

**Independent reads start together.** D1 lives in Singapore, so every `await`
that could have run alongside another is a whole round trip spent. Read the
session and anything that does not depend on it in one `Promise.all`.

Media responses are kept in the colo cache (`caches.default`) because
Cloudflare does not cache a Worker's response on its own; without it every
thumbnail re-ran the R2 read and the transform.

### Measure it, do not reason about it

Claims about speed made from reasoning have been wrong here before, in both
directions -- a change predicted to save hundreds of milliseconds saved about a
hundred, and a page assumed to be slow turned out to be fast. Render the page
with Playwright and read real numbers: FCP, load, transferred bytes, request
count, and for anything about responsiveness the long-task total under CPU
throttling (`Emulation.setCPUThrottlingRate`), which is what a mid-range
Android actually feels.

## Before claiming the UI looks right

Render the page and look at it — Playwright is a devDependency for exactly
this. A build that compiles says nothing about whether the page renders, and
claims about appearance made without rendering have been wrong here before.
