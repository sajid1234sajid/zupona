# Zupona database system

Zupona's data layer runs entirely on Cloudflare. It is built as a multi-vendor
marketplace — the Daraz/Alibaba/Amazon shape, where the platform and independent
sellers both list products, orders split across sellers, and money is settled
per seller — rather than as a single-shop storefront.

## Cloudflare resources

| Binding | Service | Resource | Used for |
| --- | --- | --- | --- |
| `DB` | D1 (SQLite) | `zupona-v3-db` | Everything relational: accounts, catalog, orders, payments, support |
| `MEDIA` | R2 | `zupona-product-media` | Product images, review photos, seller KYC documents |
| `CACHE` | KV | `CACHE` | Edge cache for hot catalog reads, OTP throttling, rate limiting |
| `IMAGES` | Images | — | Image resizing/optimization |

Bindings are declared in `wrangler.jsonc`. After changing them, run
`npx wrangler types` to refresh `worker-configuration.d.ts`.

Access them through `src/lib/db.ts` (`getDB()`, `getMedia()`, `getCache()`),
never by importing `cloudflare:workers` directly — those helpers give a clear
error when the app is run outside the Workers runtime.

### About the old `zupona-db`

An earlier Zupona build left a database called `zupona-db` holding an
incompatible schema (`users.password`, orders keyed by `user_email`, products
as JSON blobs) plus throwaway test rows. It is **untouched** and no longer
bound to the app. Delete it once you are satisfied nothing there is needed:

```bash
npx wrangler d1 delete zupona-db
```

## Applying the schema

`db/schema.sql` is the whole schema for a **fresh** database. `db/migrations/`
holds numbered, one-time upgrades for databases that already have data.

```bash
# Fresh database (local dev and production)
npx wrangler d1 execute zupona-v3-db --local  --file=./db/schema.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/schema.sql

# Seed the starter catalog
node db/generate-seed.mjs                      # regenerates db/seed.sql from src/data/*.ts
npx wrangler d1 execute zupona-v3-db --local  --file=./db/seed.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/seed.sql
```

Both files are re-runnable: schema uses `CREATE TABLE IF NOT EXISTS`, the seed
uses `INSERT OR IGNORE`, so neither overwrites rows you have since edited.

Migrations run once per existing database, in order:

```bash
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0003_marketplace_platform.sql
```

**Deploying does not apply migrations.** Pushing to `main` builds and
deploys the Worker (see [README.md](README.md#deployment)), but the pipeline
never touches D1. Code that expects an unapplied migration returns server
errors on zupona.com, and because the local database usually *does* have the
migration the page looks perfectly fine in `npm run dev`. Run the file against
`--local` and `--remote` both, and treat the remote run as part of shipping
the change rather than a follow-up task.

Two notes carried from building `0003`:

- SQLite rejects `ALTER TABLE ... ADD COLUMN` with a non-constant default, so
  `updated_at` columns are added nullable and backfilled. A migrated database
  therefore has a nullable `updated_at` where a fresh one has
  `NOT NULL DEFAULT (datetime('now'))`. That is the only intended drift.
- D1 applies a `--file` atomically. A failing statement rolls the whole file
  back, so a half-applied migration is not something you need to unpick.

## Schema map

45 tables, grouped by concern.

**Identity and access** — `users` (with `role`, `status`, verification flags,
referral fields), `sessions` (with device metadata), `oauth_accounts` for
multi-provider sign-in, `login_attempts` for lockout and the security page,
`addresses`, `payment_methods` (masked details only, never a full card number).

**Sellers** — `sellers` (store, approval state, commission rate, payout
details) and `seller_documents` for KYC paperwork held in R2.

**Catalog** — `categories` (self-referencing, three levels), `brands`,
`products`, `product_categories` (cross-listing), `product_images`,
`product_variants`, `product_attributes` (spec sheet), `product_features`
(badge icons), `inventory_movements` (the stock ledger) and `price_history`.

**Shopping** — `cart_items`, `wishlist_items`, `recently_viewed`,
`search_queries`.

**Merchandising** — `coupons`, `coupon_redemptions`, `flash_sales`,
`flash_sale_items`.

**Social proof** — `reviews`, `review_images`, `product_questions`,
`product_answers`.

**Orders** — `orders`, `order_items`, `suborders` (one per seller in an order),
`order_status_history`, `shipments`, `returns_refunds`, `phone_verifications`.

**Money** — `payment_transactions`, `seller_payouts`, `payout_line_items`.

**Service and platform** — `notifications`, `support_tickets`,
`support_messages`, `admin_audit_log`, `site_settings`.

### Design decisions worth knowing

**Prices are whole Taka**, stored as integers, matching `formatPrice()` in
`src/lib/format.ts`. There are no minor units to divide by.

**Stock lives on variants, never on products.** Every product has at least one
variant row even when it has no visible options, because that is what carries
stock, SKU and any price override. A variant's `price` is `NULL` when it
inherits the product price — read `effectivePrice`, not `price`.

**Stock has a ledger.** `product_variants.stock_quantity` is the fast current
value and `inventory_movements` is the append-only audit trail behind it.
Always change stock through `src/lib/inventory.ts` so the two agree.

**Reservations separate held stock from sold stock.**
`available = stock_quantity - reserved_quantity`, so a checkout in flight can
hold stock without deducting it. `reserveStock` does the check and the hold in
one conditional `UPDATE`, so two shoppers cannot both claim the last item.

**Orders split into suborders.** A single customer order becomes one `suborders`
row per seller, which is what fulfillment, commission and payouts key off.

**Aggregates are denormalized and recomputed, never hand-set.**
`products.rating_avg` / `rating_count` are refreshed from the `reviews` table
inside the same batch as every review write, so listing pages can sort by
rating without a join and can never show a stale average.

**Categories are three levels and no more.** Department → section → type.
The limit, the ban on a category becoming its own descendant, slug uniqueness
and what makes a category safe to delete all live in
`src/lib/categoryService.ts`, which is the only module that writes the table —
so a rule added there holds for the admin panel and for anything built on it
later. The tree and every product count come back in one grouped query, cached
in KV and cleared by every mutation.

**A product has one primary category and any number of cross-listings.**
`products.category_id` stays the primary one — it is what the product page, the
admin form and every order report read — and `product_categories` records the
rest, with a partial unique index keeping exactly one `is_primary` row per
product. Deleting a category never deletes a product: the service refuses while
products are filed there unless the caller names where they move to, and
cross-listing rows simply un-file the product from that category.

**Category URLs are slug paths, never ids.** `/category/electronics/mobiles`
is built from the slug chain; an id (a UUID for anything created in the admin
panel) still resolves and redirects to the canonical path, as does the right
slug reached by the wrong ancestry. One address per category is what the
canonical tag promises.

**Deletes are soft where history matters.** Archiving a product keeps its order
lines and reviews; a hard `DELETE` would cascade them away.

## The data-access layer

| Module | Responsibility |
| --- | --- |
| `src/lib/db.ts` | Binding accessors for D1, R2 and KV |
| `src/lib/catalog.ts` | Products, brands, variants, search, browsing signals |
| `src/lib/categoryService.ts` | The category tree, its lookups and its validated mutations |
| `src/lib/inventory.ts` | Stock levels, ledger, reservations, low-stock reporting |
| `src/lib/sellers.ts` | Seller onboarding, approval, storefronts, earnings |
| `src/lib/reviews.ts` | Reviews, rating breakdown, moderation, seller replies |
| `src/lib/coupons.ts` | Coupon validation and redemption |
| `src/lib/admin.ts` | Role guards, audit log, settings, dashboard figures |
| `src/lib/media.ts` | R2 uploads with type/size validation |
| `src/lib/cache.ts` | KV read-through cache and rate limiting |

The existing account modules (`session`, `orders`, `cart`, `wishlist`,
`addresses`, `paymentMethods`, `notifications`, `verification`) are unchanged
apart from `session.ts`, which now records device details and login times and
treats suspended or banned accounts as signed out.

### Authorization

Role checks belong in server actions, not in the UI. A hidden button is not a
security boundary; `requireAdmin()` throwing before a query runs is.

```ts
import { requireAdmin, requireProductOwnership, logAdminAction } from "@/lib/admin";

export async function approveProduct(productId: string) {
  const admin = await requireAdmin();
  await setProductStatus(productId, "active");
  await logAdminAction(admin.id, "product.approve", "product", productId);
}
```

`requireSellerOwnership()` and `requireProductOwnership()` stop one seller from
editing another's listings by guessing an id. Admins pass both.

### Caching

KV is eventually consistent, so cache only what may briefly lag: catalog
listings and category lists. Never cart contents, stock counts or order status.
Call `invalidateCatalog()` after any catalog write.

```ts
const categories = await cached(CacheKeys.categories(), () => listCategories(), 3600);
```

## Common operations

Promote an account to admin (there is no self-service path, by design):

```bash
npx wrangler d1 execute zupona-v3-db --remote \
  --command "UPDATE users SET role = 'admin' WHERE email = 'you@example.com'"
```

Inspect production data:

```bash
npx wrangler d1 execute zupona-v3-db --remote --command "SELECT COUNT(*) FROM orders"
```

Back up before anything destructive:

```bash
npx wrangler d1 export zupona-v3-db --remote --output ./backup.sql
```

## Extending it

The schema already carries columns for work that is not yet wired to UI —
flash sales, product Q&A, returns, shipments, payouts, support tickets. Those
tables are ready to build against without another migration.

When you do need a migration, add `db/migrations/000N_name.sql` **and** fold
the same change into `db/schema.sql` so fresh installs and upgraded databases
stay identical. The two were verified to match by building both and diffing
their table and column sets.
