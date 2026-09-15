# Migration rehearsal

Migrations 0011 to 0015 have not been applied to the production database. Each
one runs against orders, variants and stock that already exist, so "it applied
cleanly locally" says nothing: the local database was built from `schema.sql`
and already had every column. This rehearses the upgrade the remote database
will actually go through.

```bash
node --experimental-sqlite db/rehearsal/build-baseline.mjs   # build the pre-0011 shape
node --experimental-sqlite db/rehearsal/rehearse.mjs         # apply 0011..0015 and assert
```

`build-baseline.mjs` creates the full schema, reads the CREATE statements back
out of `sqlite_master`, and removes -- line by line -- every column and index
that 0011 through 0015 add. It then asserts that the resulting `orders` table
matches, column for column and in order, what the Cloudflare D1 console reports
for production today. If that assertion fails, the baseline no longer reflects
production and nothing below it means anything.

`rehearse.mjs` seeds data shaped like production before these migrations --
orders with no suborders, variants in the old `option1_*`/`option2_*` form,
variants in the canonical form with no legacy columns, a variant with no
options, and an order with no lines at all -- then applies each migration in
its own transaction, mirroring how D1 applies a `--file` atomically. Between
each it asserts what changed and, more importantly, what did not: no money, no
stock, no order row.

It also runs 0013 against a database that already holds two active variants
sharing a combination, to prove the failure rolls back rather than half-applies.

What this found: 0013 section C minted a second option group whenever a
product already had one whose `key` no longer matched its `name` -- which the
option builder produces on any rename, since `slugifyOption` derives a key once
and leaves it alone (`src/lib/optionModel.ts`). The variant was then linked to
both groups and its signature read `color=..|colour=..`. Fixed by guarding C1
and C2 on the group name.

These scripts read the migrations and never write to Cloudflare. Everything
they create lives in `.work/`, which is not committed.
