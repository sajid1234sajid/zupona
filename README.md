This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app), running on [vinext](https://vinext.dev) so it deploys natively to Cloudflare Workers with a D1 database.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result. This runs the app through vinext on workerd (the Cloudflare Workers runtime), which is required for the account system's database access (`cloudflare:workers` / D1) to work — see [Authentication & database](#authentication--database-cloudflare) below.

A plain Next.js (Turbopack) dev server is also available as `npm run dev:next-native`, but pages that touch the database (`/account`, `/account/login`) will error under it — `cloudflare:workers` only resolves inside the vinext/Cloudflare runtime.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Database & Cloudflare services

Zupona runs on three Cloudflare bindings, declared in `wrangler.jsonc`:

- **`DB`** — a [D1](https://developers.cloudflare.com/d1/) database
  (`zupona-v3-db`) holding accounts, the marketplace catalog, orders and
  payments.
- **`MEDIA`** — an R2 bucket (`zupona-product-media`) for product images,
  review photos and seller documents.
- **`CACHE`** — a KV namespace used to cache hot catalog reads and to rate-limit
  one-time codes.

They are reached through `src/lib/db.ts` and only exist inside the **vinext +
Cloudflare Workers** runtime, so use the default `dev`/`build`/`start`/`deploy`
scripts rather than the `*-native` ones:

```bash
npm run dev      # http://localhost:3001 — runs on workerd, bindings available
npm run build
npm run deploy   # deploy to Cloudflare Workers
```

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

- Passwords are hashed with PBKDF2 (Web Crypto), never stored in plaintext.
  Sessions are opaque IDs in a `sessions` table, referenced by an `httpOnly`
  cookie, and suspended or banned accounts are signed out on their next request.
- "Continue with Google" needs a Google OAuth client. Copy `.dev.vars.example`
  to `.dev.vars` and fill in `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` for local
  dev; in production set them with `wrangler secret put`. Until configured, the
  button shows a friendly "not set up yet" message instead of erroring.
- After changing `wrangler.jsonc` bindings, run `npx wrangler types` to refresh
  `worker-configuration.d.ts`.
