# Applying 0009..0015 to the remote database

The remote database is at the **0008** schema. `main` carries migrations 0001
through 0008; 0009 onwards have lived on a development branch and were never
deployed, which is why `product_option_groups` does not exist there. Seven
migrations are pending, and nine files under `src/` read the columns and tables
they add.

CI deploys code only -- `.github/workflows/deploy.yml` has no D1 step -- so the
order is not negotiable:

> **migrations first, then merge to `main`.**

Merging first puts code on zupona.com that queries tables the database does not
have. Applying the migrations first is the lesser risk, but it is not free, so
keep the window between step 4 and step 6 to minutes:

- The 0008 code's admin "add product" and "add variant" actions insert variants
  without an `option_signature`. Once 0013 has built `idx_variant_combination`,
  a second variant on the same product collides on the empty signature and the
  save fails. **Do not add products or variants in the admin panel between
  applying 0013 and the deploy finishing.**
- Shopping, cart, checkout and the order list are unaffected: the old code
  reads nothing the migrations remove, and its inserts into `orders` and
  `cart_items` satisfy the new defaults and indexes.

Have the merged branch built and checked locally **before** step 4, so that the
deploy can follow the last migration immediately.

## Reading query results

`wrangler d1 execute --file` runs a file through D1's import path, which
returns no rows -- only `Total queries executed`. That is right for the
migrations, which return nothing, and useless for the checks, whose rows are
the point. Run every check through `db/run-query.mjs`, which sends each SELECT
through `--command` and prints the rows, and refuses anything that is not a
SELECT. The D1 dashboard's Console tab shows rows too.

## 1. Census, before anything

```bash
node db/run-query.mjs db/census.sql
```

Keep the numbers. They are what the backup is checked against, and what proves
at the end that no row was lost.

## 2. Backup

```bash
npx wrangler d1 export zupona-v3-db --remote --output=./backup-0008.sql
node --experimental-sqlite db/rehearsal/check-backup.mjs ./backup-0008.sql
```

A file that exists is not a backup. `check-backup.mjs` loads the export into a
throwaway database -- which only succeeds if the SQL is complete -- and prints
the same census, so the two can be compared row for row. It exits non-zero on a
truncated or empty export. Do not continue until it prints PASS and the counts
match step 1.

D1 Time Travel is the second line of defence: note the current UTC time before
starting; the database can be restored to any point in the last 30 days.

Keep `backup-0008.sql` out of the repository. It contains customer names,
phones and addresses, and `sajid1234sajid/zupona` is public.

## 3. Preflight

```bash
node db/run-query.mjs db/preflight.sql
```

Q1 must show 0009's four tables MISSING and everything earlier present. **Q6
must return no rows** -- each row it returns is two active variants of one
product sharing a combination, which stops 0013 and rolls it back.

## 4. The seven, one at a time, in this order

```bash
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0009_dynamic_options.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0010_variant_cart.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0011_order_integrity.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0012_order_suborders.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0013_option_builder.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0014_address_district.sql
npx wrangler d1 execute zupona-v3-db --remote --file=./db/migrations/0015_payment_and_scale.sql
```

The order is a dependency, not a preference: 0009 creates `buy_now_sessions`,
which 0011 alters, and the three option tables, which 0013 rewrites.

D1 applies a `--file` atomically, so a failure leaves the database exactly as it
was. If one fails, **stop there** -- do not run the next -- and read the error.

What each one does, and what to watch:

| | risk | what it does |
|---|---|---|
| 0009 | low | creates the four option tables and `buy_now_sessions`, adds seven columns, builds option groups and values out of the legacy `option1_*`/`option2_*` slots |
| **0010** | **highest** | the only one that drops a table: copies `cart_items` into a new shape, drops the original, renames. Replaces `UNIQUE (user_id, product_id, color)` with two partial indexes |
| 0011 | low | adds `idempotency_key`, `stock_state`, `consumed_at` and four indexes |
| 0012 | medium | writes one suborder per order that has none, attaches lines, stamps sellers |
| 0013 | medium | adds `is_active` and `option_signature`, then makes `(product_id, option_signature)` unique over active variants |
| 0014 | low | two nullable columns |
| 0015 | low | five payment columns and ten indexes |

## 5. Verify

```bash
node db/run-query.mjs db/verify-schema.sql
node db/run-query.mjs db/census.sql
```

`verify-schema.sql` is 50 checks; every row must come back `ok = 1`. The census
must match step 1 exactly for every table except `suborders`, which grows by
the number 0012 reported -- one per order that had none.

## 6. Then deploy

Merge the branch into `main` and push. CI builds and ships to zupona.com in
one to two minutes. Then open the site: a product page with options, the cart,
checkout through to Order Confirmed, and the admin order list.

## If something fails

Restore is Time Travel first (fastest, and the database is live again in
seconds) and `backup-0008.sql` second. The migrations do not need undoing one
by one; the backup is the 0008 database entire.

Rehearsed in `db/rehearsal`: 124 assertions across the seven migrations from a
baseline built out of `origin/main`'s own `db/schema.sql`, plus 26 on the
preflight queries. That is not a guarantee about your data -- which is what
steps 1 to 3 are for -- but no migration here has gone untested.
