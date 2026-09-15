# Migration rehearsal

The remote database is at the **0008** schema. Production runs the code on
`main`, and `main` carries migrations 0001 through 0008 only -- 0009 onwards
live on the development branch and have never been deployed, which is why
`product_option_groups` does not exist there. Seven migrations are pending:
0009, 0010, 0011, 0012, 0013, 0014, 0015.

Each runs against orders, variants, cart lines and stock that already exist, so
"it applied cleanly locally" says nothing: the local database was built from
`db/schema.sql`, which already has every column. This rehearses the upgrade the
remote database will actually go through.

```bash
node --experimental-sqlite db/rehearsal/build-baseline.mjs   # production's shape
node --experimental-sqlite db/rehearsal/rehearse.mjs         # 0009..0015, asserted
node --experimental-sqlite db/rehearsal/test-preflight.mjs   # prove db/preflight.sql
```

## The baseline

`build-baseline.mjs` does not reconstruct anything. It takes `db/schema.sql` as
of `origin/main` -- the schema belonging to the deployed code -- and asserts
that the `orders` table it produces matches, column for column and in order,
what the Cloudflare D1 console reports for production, and that the four tables
0009 creates are absent. If either assertion fails the baseline no longer
reflects production and nothing rehearsed on top of it means anything.

## The run

`rehearse.mjs` seeds data shaped like production at 0008: variants carrying
options in the two fixed `option1_*` / `option2_*` slots only, orders with no
suborders, cart lines predating the variant-aware cart, an order with no lines,
a variant with no options, and a group that is neither colour nor size. It then
applies each migration in its own transaction, mirroring how D1 applies a
`--file` atomically, and asserts between each what changed and -- more
importantly -- what did not: no money, no stock, no order row, no cart line.

0010 is the only migration that drops a table: it rebuilds `cart_items` to
replace `UNIQUE (user_id, product_id, color)` with two partial indexes, so the
rehearsal checks every line survives the copy value for value, that the scratch
table is gone, and that the new constraint allows two variants of one product
in a cart while still refusing a duplicate.

Two more scenarios run afterwards: 0013 on a catalog where the admin renamed an
option group after 0009, and 0013 on one that already holds two active variants
sharing a combination, which must fail and roll back whole rather than
half-apply.

## What this found

0013 section C minted a second option group whenever a product already had one
whose `key` no longer matched its `name` -- which the option builder produces
on any rename, since `slugifyOption` derives a key once and leaves it alone
(`src/lib/optionModel.ts`). The variant was then linked to both groups and its
signature read `color=..|colour=..`. Fixed by guarding C1 and C2 on the group
name.

## Preflight

`db/preflight.sql` is the read-only half: seven SELECTs to run against the
remote database before anything is applied. Q1 establishes which migration it
has reached, Q2 and Q3 which columns and indexes are pending, Q4 and Q5 how
many rows 0010 and 0012 will touch, and Q6 -- the one that decides -- whether
0013's unique index can be built, derived from the legacy option slots because
the canonical tables do not exist there yet.

`test-preflight.mjs` proves it rather than asserting it: every query is run
against the 0008 schema to confirm none of them touches a table 0009 creates,
and Q6 is checked against three different collisions -- a repeated colour, the
same pair with the option slots swapped, and a second variant with no options
at all -- each confirmed to stop 0013 for real.

These scripts read the migrations and never write to Cloudflare. Everything
they create lives in `.work/`, which is not committed.
