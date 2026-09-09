# Zupona

A multi-vendor marketplace — the Daraz/Amazon shape, where the platform and
independent sellers both list products, orders split across sellers, and money
settles per seller. It is a [Next.js](https://nextjs.org) app running on
[vinext](https://vinext.dev), which deploys it natively to Cloudflare Workers
with D1, R2 and KV.

The storefront and the admin panel are **one Worker**. Which one a request gets
is decided by the Host header in `src/proxy.ts`: `zupona.com` serves the shop,
`admin.zupona.com/products` is rewritten internally to `/admin/products`. That
is routing only — `requireAdmin()` in the admin layout and in every server
action decides who may actually see the panel.

| | |
| --- | --- |
| Live storefront | https://zupona.com |
| Admin panel | https://admin.zupona.com |
| Repository | https://github.com/sajid1234sajid/zupona |

## Getting started

```bash
npm install
npm run dev      # http://localhost:3001
```

This runs the app through vinext on workerd (the Cloudflare Workers runtime),
which is required for D1, R2 and KV bindings to resolve. Start editing at
`src/app/page.tsx`; the page auto-updates as you save.

A plain Next.js (Turbopack) dev server exists as `npm run dev:next-native`, but
any page that touches the database will error under it — `cloudflare:workers`
only resolves inside the vinext/Cloudflare runtime. Prefer the default scripts.

Fonts are [Poppins and Playfair Display](https://fonts.google.com) loaded
through `next/font/google` in `src/app/layout.tsx`.

## Deployment

**Pushing to `main` deploys the site.** `.github/workflows/deploy.yml` builds
the Worker on GitHub's runners and deploys it to Cloudflare, authenticating with
a `CLOUDFLARE_API_TOKEN` repository secret. A push reaches zupona.com in roughly
one to two minutes, with no local machine involved.

```bash
git push origin main     # builds and deploys
```

If the build fails, nothing is deployed and the live site is left alone — check
the run under the repository's Actions tab.

Deploying by hand is still possible and is what to use when a change must go
live without a commit, or when CI is broken:

```bash
npm run build
npm run deploy
```

### Database migrations are **not** automatic

CI deploys code only. A new file in `db/migrations/` is never applied by the
pipeline, and shipping code that expects a migration which has not run produces
server errors on the live site. Apply it explicitly, before or right after the
deploy that needs it:

```bash
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/<file>.sql
```

## Database & Cloudflare services

Zupona runs on four Cloudflare bindings, declared in `wrangler.jsonc`:

- **`DB`** — a [D1](https://developers.cloudflare.com/d1/) database
  (`zupona-v3-db`) holding accounts, the marketplace catalog, orders and
  payments.
- **`MEDIA`** — an R2 bucket (`zupona-product-media`) for product images,
  review photos and seller documents.
- **`CACHE`** — a KV namespace used to cache hot catalog reads and to rate-limit
  one-time codes.
- **`IMAGES`** — Cloudflare Images, for resizing and optimization.

They are reached through `src/lib/db.ts` (`getDB()`, `getMedia()`, `getCache()`)
rather than by importing `cloudflare:workers` directly, so that running outside
the Workers runtime gives a clear error instead of a confusing one.

**[DATABASE.md](DATABASE.md) is the full reference** — schema map, design
decisions, the data-access modules and day-to-day operations. In short:

```bash
# Schema (fresh database)
npx wrangler d1 execute zupona-v3-db --local  --file=./db/schema.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/schema.sql

# Starter catalog
npx wrangler d1 execute zupona-v3-db --local  --file=./db/seed.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/seed.sql
```

Numbered files in `db/migrations/` upgrade databases that already hold data;
new installs only need `db/schema.sql`.

## Accounts and secrets

- Passwords are hashed with PBKDF2 (Web Crypto), never stored in plaintext.
  Sessions are opaque IDs in a `sessions` table, referenced by an `httpOnly`
  cookie, and suspended or banned accounts are signed out on their next request.
- "Continue with Google" needs a Google OAuth client. Copy `.dev.vars.example`
  to `.dev.vars` and fill in `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` for local
  dev; in production set them with `wrangler secret put`. Until configured, the
  button shows a friendly "not set up yet" message instead of erroring.
  These are Worker secrets, so deploys never touch them.
- After changing `wrangler.jsonc` bindings, run `npx wrangler types` to refresh
  `worker-configuration.d.ts`.

## Layout

```
src/app/         routes — storefront, /admin/*, /api/*
src/components/  UI, grouped by feature (admin/, product/, checkout/, ...)
src/lib/         data access and domain logic; db.ts holds the bindings
src/data/        static catalog data used to generate the seed
src/proxy.ts     Host-header routing for admin.zupona.com
db/              schema.sql, seed.sql, migrations/
design/          design references
```
