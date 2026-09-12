# Zupona — Product Requirements Document

| | |
| --- | --- |
| **Product** | Zupona — multi-vendor marketplace for Bangladesh |
| **Document version** | 1.0 |
| **Date** | 12 September 2026 |
| **Status** | Baseline — describes the product as built, and what it must become |
| **Source of truth** | `sajid1234sajid/zupona` @ `d8e6088` (167 TS/TSX files, 26,387 lines) |
| **Live** | Storefront https://zupona.com · Admin https://admin.zupona.com |
| **Related** | [README.md](../README.md) · [DATABASE.md](../DATABASE.md) · [HISTORY.md](../HISTORY.md) · [AGENTS.md](../AGENTS.md) |

### How to read this document

Zupona is already live. This is not a greenfield spec — it is a baseline PRD that
states what the product is for, records what is actually built, and names the work
between here and a functioning marketplace. Every requirement carries a status
derived from reading the code, not from the roadmap:

| Status | Meaning |
| --- | --- |
| **Live** | Built, wired to UI, working in production |
| **Partial** | Built but incomplete, unenforced, or missing a dependency |
| **Schema only** | Tables and/or domain functions exist; no path reaches them |
| **Planned** | Neither built nor scaffolded |

Priorities are **P0** (blocks correct commerce), **P1** (blocks growth), **P2** (valuable, deferrable).

---

## 1. Executive summary

Zupona is a mobile-first online marketplace for Bangladesh, built in the
Daraz/Amazon shape: the platform and independent sellers both list products, a
single customer order splits into one suborder per seller, and money settles per
seller against a commission rate. It is a Next.js 16 application running on
[vinext](https://vinext.dev) and deployed as **one Cloudflare Worker** that serves
both the storefront and the admin panel, backed by D1 (SQLite), R2 (media) and KV
(edge cache).

**The product today is a well-built single-operator store with a marketplace
skeleton underneath it.** The 46-table schema, the commission model, the suborder
split, the stock ledger, the reservation mechanism, the payout tables and the KYC
flow are all designed and in place. What is missing is the wiring: checkout does
not reserve or decrement stock, does not create suborders, does not apply coupons
and does not record a payment transaction; there is no seller-facing surface at
all; and reviews, returns, shipments, Q&A and support exist as tables with no code
path. The marketplace domain logic that *is* written (`sellers.ts`, `reviews.ts`,
`coupons.ts`, `inventory.ts`) is reachable only from the admin panel.

The strategic consequence: Zupona can take an order today, but it cannot yet be
trusted to take two orders for the last unit in stock. **Section 12 (transactional
integrity) is the gate on everything else in this document.**

---

## 2. Vision and strategy

### 2.1 Vision

> Give any Bangladeshi seller — from a Mirpur boutique to a national brand — a
> storefront that loads instantly on a cheap phone over a slow network, and give
> shoppers a place where cash on delivery, a real address, and a tracked parcel
> all work the way they expect.

### 2.2 Strategic bet

Three choices define the product and should not be casually reversed:

1. **Edge-native, not server-native.** One Worker, D1/R2/KV, no origin server, no
   container, no ops rota. Push to `main` and it is live in 60–120 seconds. The
   entire platform runs inside Cloudflare's free and near-free tiers at current
   volume — which is what makes a marketplace viable before it has GMV.
2. **Marketplace-shaped from day one.** Even while operating as a 1P store, every
   product row carries a nullable `seller_id` (NULL = platform-owned), every order
   is designed to split into suborders, and commission is a per-seller rate. The
   3P transition is a wiring exercise, not a migration.
3. **Bangladesh-specific, not localised-later.** Prices are whole Taka integers
   with no minor unit. Addresses are Division → Area, not postcodes. Cash on
   delivery is the default payment path, and phone-number possession is the
   primary identity. These are modelled into the schema, not bolted on.

### 2.3 Phasing

| Phase | Name | Definition of done |
| --- | --- | --- |
| **P1** | Transactional integrity | An order cannot oversell, coupons apply, payments are recorded, suborders exist |
| **P2** | Trust and retention | Verified-purchase reviews, real order tracking, returns, redeemable points |
| **P3** | Marketplace activation | Seller self-onboarding, seller portal, KYC review queue, per-seller fulfilment |
| **P4** | Settlement and scale | Automated payouts, payment gateway, SMS gateway, paid-tier infrastructure |

Zupona is in **P1**.

---

## 3. Market context and problem statement

### 3.1 The market

Bangladesh e-commerce has four characteristics that dictate product design:

| Reality | Product consequence |
| --- | --- |
| Cash on delivery dominates; card penetration is low | COD must be a first-class path, not a fallback. Order value is at risk until delivery, so phone verification matters more than payment capture |
| Mobile financial services (bKash, Nagad) are the digital rails | Payment method model carries `bkash`/`nagad` alongside `card`; payout methods likewise |
| Addresses are informal — no reliable postcode system | Address = Division + Area + free-text detail. A rider needs landmarks, not a ZIP |
| Traffic is overwhelmingly mobile, often on constrained networks | The storefront is designed at a 448px (`max-w-md`) column with a bottom tab bar — a phone app rendered as a website |

### 3.2 Problems Zupona exists to solve

- **PS-1 — Shoppers cannot tell who they are buying from.** Trust in Bangladeshi
  online retail is the binding constraint. Verified-purchase reviews, per-seller
  ratings, real tracking and a working returns path are the product's answer.
- **PS-2 — Small sellers have no route to online demand** that does not require
  building and operating their own shop.
- **PS-3 — Operators drown in manual work.** A one-person team runs catalog,
  orders, customers, pricing and campaigns. The admin panel exists so a campaign,
  a price change or a new department ships without a deploy.
- **PS-4 — Infrastructure cost kills marketplaces before they find product-market
  fit.** Edge-native architecture keeps fixed cost near zero.

---

## 4. Goals and non-goals

### 4.1 Goals

| ID | Goal |
| --- | --- |
| **G1** | A shopper can find, evaluate and buy a product on a phone in under three minutes, paying cash on delivery |
| **G2** | Every order is financially and physically correct: stock is real, totals are reproducible, money is attributable to a seller |
| **G3** | An independent seller can onboard, list, fulfil and get paid without the platform team touching a database |
| **G4** | An operator can run the entire commercial surface — catalog, pricing, campaigns, orders, moderation — from the admin panel, without a deploy |
| **G5** | The platform stays inside its infrastructure budget at 10× current traffic |
| **G6** | Any engineer, human or agent, can understand the system from the repository alone |

### 4.2 Non-goals

| ID | Non-goal | Reason |
| --- | --- | --- |
| **NG1** | Native iOS/Android apps | The web storefront is already built as a phone app; a native shell is a distribution decision, not a product one |
| **NG2** | Multi-currency / cross-border | Whole-Taka integers are baked into the schema and every formatter. International is a different product |
| **NG3** | Owned logistics or a rider network | Couriers are integrated, not operated |
| **NG4** | Seller-hosted custom domains | Sellers get a storefront page under zupona.com |
| **NG5** | Real-time chat between shopper and seller | Product Q&A and support tickets cover the need at this stage |
| **NG6** | A staging environment as a product feature | Recorded as an operational risk (§14), not a deliverable here |

---

## 5. Users

### 5.1 Shopper — "Rumana", 26, Dhanmondi

Browses on a mid-range Android over mobile data. Pays cash on delivery. Will
abandon a checkout that asks for a card. Judges a listing by its photos, its
rating count and whether the price looks like a real discount. Wants to know
where her parcel is without calling anyone.

**Needs:** instant search, honest prices, COD, a tracked order, a way to return.

### 5.2 Distributor / Seller — "Arif", runs a three-person electronics importer

Wants demand without building a shop. Will not complete an onboarding flow that
requires a laptop and an accountant. Needs to know what he is owed and when it
arrives.

**Needs:** self-serve onboarding, KYC upload, listing tools, order queue, earnings.
**Status: none of this exists.** Sellers today are records an admin creates.

### 5.3 Platform operator / Admin — the owner

One person running catalog, pricing, campaigns, order status, customer issues and
seller approval. Uses `admin.zupona.com` on a laptop, sometimes on a phone.

**Needs:** everything editable without a deploy, an audit trail, numbers that can be
trusted, alerts when something needs attention.

### 5.4 Support agent

A `support` role exists and reaches the admin panel with reduced rights. Has no
ticketing surface — `support_tickets` and `support_messages` are unused tables.

### 5.5 Engineer / agent maintainer

Often an AI session with no prior context. The repository's documentation
(`README.md`, `DATABASE.md`, `HISTORY.md`, `AGENTS.md`) is a deliberate product
surface for this user, and is treated as such (**G6**).

---

## 6. Success metrics

### 6.1 North star

**Weekly delivered GMV** — order value that actually reached a customer. Chosen
over placed GMV because COD makes placement cheap and delivery the real event.

### 6.2 Supporting metrics

| Layer | Metric | Why |
| --- | --- | --- |
| Acquisition | Weekly active shoppers; catalog pages per session | Demand |
| Conversion | Cart → order completion rate; step-3 OTP completion | The checkout funnel is where COD leaks |
| Value | Average order value; free-delivery threshold attach rate (৳999) | The threshold is the AOV lever already built |
| Retention | 30-day repeat purchase rate; points balance growth | Points are earned but not yet redeemable — they measure nothing until §12.8 |
| Trust | Reviews per delivered order; % orders with a return request | Cannot be measured until reviews ship |
| Supply | Approved sellers; % GMV from 3P; seller time-to-first-listing | The marketplace thesis |
| Operations | **D1 rows read per day**; p75 TTFB; deploy success rate | See §11.4 — this metric has already taken the site down once |

### 6.3 Launch criteria for Phase 1

No new customer-facing feature ships until: zero oversell incidents across 100
consecutive orders; coupon discount appearing on the order equals the discount
shown at checkout in 100% of cases; every order has exactly one
`payment_transactions` row and one `suborders` row per distinct seller.

---

## 7. Scope at a glance

| # | Capability area | Status | Detail |
| --- | --- | --- | --- |
| 1 | Identity and access | **Live** | §8.1 |
| 2 | Catalog and discovery | **Live** | §8.2 |
| 3 | Product detail | **Live** | §8.3 |
| 4 | Cart | **Live** | §8.4 |
| 5 | Checkout and order placement | **Partial** | §8.5 |
| 6 | Orders and tracking | **Partial** | §8.6 |
| 7 | Wishlist | **Live** | §8.7 |
| 8 | Offers, coupons, flash sales | **Partial** | §8.8 |
| 9 | Loyalty points | **Partial** | §8.9 |
| 10 | Reviews and Q&A | **Schema only** | §8.10 |
| 11 | Marketplace and sellers | **Schema only** | §8.11 |
| 12 | Admin panel | **Live** | §8.12 |
| 13 | Media | **Live** | §8.13 |
| 14 | Notifications and support | **Partial** | §8.14 |

---

## 8. Functional requirements

### 8.1 Identity and access — `FR-ID`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-ID-01 | Sign up with name + email + password; password hashed with PBKDF2 via Web Crypto, never stored in plaintext | P0 | Live |
| FR-ID-02 | Log in with email + password; failures return a mapped, human-readable message | P0 | Live |
| FR-ID-03 | "Continue with Google" OAuth sign-in with CSRF `state` cookie; degrades to a "not set up yet" message when `GOOGLE_CLIENT_ID` is unset rather than erroring | P1 | Live |
| FR-ID-04 | Sign in by mobile number at checkout: a 6-digit code, 5-minute TTL, 30-second resend throttle. The account is created on first use | P0 | Partial — no SMS gateway; the code is returned to the browser as `demoCode` |
| FR-ID-05 | Sessions are opaque IDs in a `sessions` table referenced by an `httpOnly` cookie; the row records IP and user agent | P0 | Live |
| FR-ID-06 | A `suspended` or `banned` account is treated as signed out on its next request | P0 | Live |
| FR-ID-07 | Roles are `customer` / `seller` / `admin` / `support`. There is no self-service path to `admin` | P0 | Live |
| FR-ID-08 | Authorization is enforced in server actions (`requireAdmin`, `requireStaff`, `requireSellerOwnership`, `requireProductOwnership`), never by hiding UI | P0 | Live |
| FR-ID-09 | Save, edit, delete and default delivery addresses | P1 | Live |
| FR-ID-10 | Save payment methods holding masked details only — never a full card number or CVV | P1 | Live |
| FR-ID-11 | Change password from the account security page | P1 | Live |
| FR-ID-12 | Record every login attempt in `login_attempts` for lockout and the security page's activity list | P1 | Partial — only the **admin** login writes this table; storefront logins do not |
| FR-ID-13 | Lock an account after N failed attempts | P1 | Planned — table exists, no lockout logic |
| FR-ID-14 | Multi-provider identities via `oauth_accounts` (Facebook, Apple) | P2 | Schema only — the `users.google_id` fast path is what runs |
| FR-ID-15 | Account deletion and data export | P2 | Planned |

### 8.2 Catalog and discovery — `FR-CAT`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-CAT-01 | Home page: hero banner, department grid, promo banners, featured products — all read from D1, none hardcoded | P0 | Live |
| FR-CAT-02 | The featured grid is curated by the `is_featured` flag, tickable per product in the admin panel | P1 | Live |
| FR-CAT-03 | Header search filters the catalog instantly in the browser; the full shoppable catalog is fetched once per page load rather than round-tripping per keystroke | P0 | Live |
| FR-CAT-04 | The search box stays on screen while scrolling, with the department row pinned beneath it | P1 | Live |
| FR-CAT-05 | `/categories` — a two-pane department browser (rail + panel) that scrolls independently | P1 | Live |
| FR-CAT-06 | `/category/[slug]` — category and subcategory listings with sort options and a product count | P0 | Live |
| FR-CAT-07 | Categories self-reference for a two-level tree; renaming a department must not break existing product, order and link references (ids are stable) | P1 | Live |
| FR-CAT-08 | Product lifecycle: `draft` → `pending_review` → `active` / `rejected` → `archived`. Only `active` products appear on the storefront | P0 | Live |
| FR-CAT-09 | Archiving is a soft delete — order lines and reviews survive it | P0 | Live |
| FR-CAT-10 | Brands, with brand creation from the admin product form | P2 | Live |
| FR-CAT-11 | Catalog list and category reads are cached in KV and invalidated on any catalog write (`invalidateCatalog()`) | P0 | Live |
| FR-CAT-12 | Server-side search with query logging to `search_queries`, and a trending-terms surface | P2 | Schema only — `searchProducts()` and `topSearchTerms()` exist but nothing calls them; search is client-side |
| FR-CAT-13 | "Recently viewed" rail on the storefront | P2 | Schema only — `recordProductView()` / `getRecentlyViewed()` exist, unwired |
| FR-CAT-14 | Personalised or behavioural recommendations | P2 | Planned |

### 8.3 Product detail — `FR-PDP`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-PDP-01 | Product page rendered on demand, not pre-listed at build time, so a product added this afternoon works without a redeploy | P0 | Live |
| FR-PDP-02 | Full-width auto-advancing gallery carousel over product images | P1 | Live |
| FR-PDP-03 | Product video playback from R2, with HTTP range requests honoured so the timeline is seekable and Safari will play it | P1 | Live |
| FR-PDP-04 | Admin-uploaded media bypasses the Next image optimizer (`unoptimized`) — the optimizer answers 404 for `/api/media/` URLs and renders uploads as broken thumbnails | P0 | Live |
| FR-PDP-05 | Colour/size variant selection with swatches; a variant's `price` is `NULL` when it inherits the product price, and the UI reads `effectivePrice` | P0 | Live |
| FR-PDP-06 | Spec sheet (`product_attributes`) and feature badges (`product_features`, lucide icon names resolved client-side) | P1 | Live |
| FR-PDP-07 | Rating average and review count displayed on the card and the page | P1 | Live — values are denormalized aggregates |
| FR-PDP-08 | Trust badges (delivery, returns, authenticity) | P2 | Live |
| FR-PDP-09 | Per-product SEO metadata generated from the product row | P1 | Live |
| FR-PDP-10 | Review list with rating breakdown and photos on the product page | P0 | Schema only — see §8.10 |
| FR-PDP-11 | Live stock state ("Only 2 left", "Out of stock") on the purchase panel | P0 | Planned — the panel reads no stock |
| FR-PDP-12 | Seller attribution — store name, seller rating, link to storefront | P1 | Planned |
| FR-PDP-13 | Price history chart from `price_history` | P2 | Schema only |
| FR-PDP-14 | Related products | P2 | Schema only — `getRelatedProducts()` exists, unwired |

### 8.4 Cart — `FR-CART`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-CART-01 | Add to cart with colour and quantity; the cart is server-side per user, uniquely keyed on (user, product, colour) | P0 | Live |
| FR-CART-02 | Update quantity and remove items | P0 | Live |
| FR-CART-03 | Cart shows subtotal, delivery fee and total, with the delivery fee read from shop settings | P0 | Live |
| FR-CART-04 | Cart count badge in the header and bottom nav | P1 | Live |
| FR-CART-05 | Apply a coupon code in the cart | P0 | Planned — `validateCoupon()` exists and is never called from the cart or checkout |
| FR-CART-06 | Warn when a cart item has gone out of stock or changed price | P0 | Planned |
| FR-CART-07 | Guest cart that survives sign-in and merges | P2 | Planned — the cart requires a signed-in user |

### 8.5 Checkout and order placement — `FR-CHK`

The three-step wizard (details → delivery → payment) is the most complete flow in
the product **and** the one carrying the most severe correctness gaps.

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-CHK-01 | Three-step wizard: delivery details, delivery method, payment and confirmation | P0 | Live |
| FR-CHK-02 | A signed-out shopper is offered mobile-number sign-in **inside** step 1 rather than being bounced to a login page | P0 | Live |
| FR-CHK-03 | Address is Division → Area → free-text detail, validated against the served-locations list (8 divisions, 43 areas) | P0 | Live |
| FR-CHK-04 | Bangladeshi mobile numbers normalised to `+8801XXXXXXXXX` | P0 | Live |
| FR-CHK-05 | The delivery number must be confirmed by code before a COD order is accepted, unless this browser already confirmed that exact number. Verification state lives server-side, keyed by an `httpOnly` cookie, so it cannot be forged | P0 | Live |
| FR-CHK-06 | Delivery methods (standard / express) with fees from shop settings, and free delivery above the threshold (default ৳999) | P0 | Live |
| FR-CHK-07 | One function decides the shipping fee, so cart, checkout summary and the order total can never quote three different numbers | P0 | Live |
| FR-CHK-08 | Payment options: cash on delivery, online, bank | P0 | Partial — the choice is recorded as a **label string** on the order; no gateway, no capture |
| FR-CHK-09 | Placing an order snapshots name, phone, address and prices onto the order and its items, so later edits to a product or address do not rewrite history | P0 | Live |
| FR-CHK-10 | The shopper's default address is updated in place after checkout so repeat orders do not pile up duplicates | P1 | Live |
| FR-CHK-11 | The cart is cleared and an order notification is written on success | P0 | Live |
| FR-CHK-12 | **Stock must be reserved at checkout and committed on order placement**, so two shoppers cannot both buy the last unit | P0 | **Planned — critical.** `reserveStock()` / `commitSale()` are written and never called. Orders do not touch inventory |
| FR-CHK-13 | **A coupon entered at checkout must validate, discount the total, write `discount_total` + `coupon_code` to the order, and record a redemption** | P0 | **Planned — critical.** No coupon path exists in checkout |
| FR-CHK-14 | **Every order must create one `suborders` row per distinct seller, with that seller's subtotal, shipping and commission** | P0 | **Planned — critical.** Checkout writes `orders` + `order_items` only; `order_items.seller_id` and `suborder_id` are left null |
| FR-CHK-15 | **Every order must write a `payment_transactions` row** recording provider, amount and status | P0 | **Planned — critical.** Nothing writes this table |
| FR-CHK-16 | Honour the `guest_checkout_enabled` setting | P1 | **Partial — the setting is editable in the admin panel and read by nothing.** Checkout always requires a phone sign-in |
| FR-CHK-17 | Online payment via bKash / Nagad / card gateway | P1 | Planned |
| FR-CHK-18 | Order confirmation page with number, items, total and estimated delivery | P0 | Live |

### 8.6 Orders and tracking — `FR-ORD`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-ORD-01 | Order history at `/account/orders`, with per-order detail | P0 | Live |
| FR-ORD-02 | Human order numbers (`ZUP#######`) | P1 | Live |
| FR-ORD-03 | A visual progress tracker: Placed → Confirmed → Shipped → Out for Delivery → Delivered | P0 | Partial — **the timeline is simulated from elapsed time since `placed_at`**, not driven by real fulfilment events |
| FR-ORD-04 | Admin can set order status, payment status and courier tracking, propagating to every suborder and writing an `order_status_history` entry | P0 | Live |
| FR-ORD-05 | The customer tracker must reflect the status an operator actually set, and show courier and tracking number | P0 | Planned |
| FR-ORD-06 | Cancel an order from the account | P1 | Planned |
| FR-ORD-07 | Request a return or refund | P1 | Schema only — `returns_refunds` unused |
| FR-ORD-08 | Per-suborder shipments with courier, tracking and estimated delivery | P1 | Schema only — `shipments` unused |
| FR-ORD-09 | Order status change notifications to the customer | P1 | Partial — only the "order placed" notification is written |
| FR-ORD-10 | Re-order from a past order | P2 | Planned |

### 8.7 Wishlist — `FR-WL`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-WL-01 | Toggle wishlist from any product card or page | P1 | Live |
| FR-WL-02 | Wishlist page with sorting, multi-select removal and clear-all | P1 | Live |
| FR-WL-03 | Move a wishlist item to the cart | P1 | Live |
| FR-WL-04 | Record the price at the moment of saving (`saved_price`, written once, never updated) and show a price-drop badge against today's price | P1 | Live |
| FR-WL-05 | Show total wishlist value and total savings available | P2 | Live |
| FR-WL-06 | Notify on price drop or back-in-stock | P2 | Planned |

### 8.8 Offers, coupons and flash sales — `FR-OFF`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-OFF-01 | `/offers` page: live flash sale, countdown timer, collectible coupons, deal tabs (all / under ৳1000 / biggest / bestseller) | P1 | Live |
| FR-OFF-02 | Free-delivery progress against the shopper's current cart subtotal | P1 | Live |
| FR-OFF-03 | Headline discount and total savings available, computed from the live catalog | P2 | Live |
| FR-OFF-04 | Coupon model: percent / fixed / free shipping, minimum order, max discount cap, usage limit, per-user limit, scope (all / category / product / seller), validity window | P1 | Live (model + admin CRUD) |
| FR-OFF-05 | Admin creates, toggles and deletes coupons and sees redemption counts | P1 | Live |
| FR-OFF-06 | **A shopper can actually redeem a coupon** | P0 | **Planned — the whole coupon feature is display-only.** See FR-CHK-13 |
| FR-OFF-07 | Flash sales with per-item sale price, stock limit and sold count; created from the admin marketing page | P1 | Partial — created and displayed; the sale price is not applied at checkout |
| FR-OFF-08 | Homepage banners (hero / promo / discover placements) editable from the admin panel without a deploy | P1 | Live |
| FR-OFF-09 | Broadcast a promotional notification to customers | P2 | Live |

### 8.9 Loyalty points — `FR-LOY`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-LOY-01 | Earn 1 point per ৳50 spent, credited on order placement, minimum 1 point | P2 | Live |
| FR-LOY-02 | Points balance and earning history at `/account/points` | P2 | Live |
| FR-LOY-03 | Admin can adjust a customer's points balance | P2 | Live |
| FR-LOY-04 | **Redeem points against an order** | P1 | **Planned — points are earned and can never be spent.** The feature is currently a liability accruing with no mechanism to discharge it |
| FR-LOY-05 | Points expiry and a redemption ledger | P2 | Planned |
| FR-LOY-06 | Referral programme (`users.referral_code`, `referred_by`) | P2 | Schema only |

### 8.10 Reviews and Q&A — `FR-REV`

The most valuable missing feature relative to build cost. `src/lib/reviews.ts` is
complete — creation, rating breakdown, moderation, seller replies, helpful counts,
and aggregate recalculation inside the same batch as every review write so a
listing can sort by rating without a join and can never show a stale average. Only
the admin moderation half is wired.

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-REV-01 | Admin review queue: filter, approve, reject, mark spam, bulk action, delete | P1 | Live |
| FR-REV-02 | Seller/operator reply to a review | P1 | Live (admin only) |
| FR-REV-03 | `products.rating_avg` / `rating_count` recomputed from `reviews` on every write, never hand-set | P0 | Live |
| FR-REV-04 | **A customer can write a review** with rating, title, body and photos | P0 | **Schema only — there is no path for a customer to submit a review** |
| FR-REV-05 | Reviews linked to an `order_item_id` are badged "verified purchase" | P0 | Schema only |
| FR-REV-06 | Review list with a 1–5 star breakdown on the product page | P0 | Schema only |
| FR-REV-07 | Honour the `reviews_need_approval` setting | P1 | **Partial — the setting is editable and read by nothing** |
| FR-REV-08 | Mark a review helpful | P2 | Schema only |
| FR-REV-09 | Product questions and answers | P2 | Schema only — `product_questions` / `product_answers` unused |

### 8.11 Marketplace and sellers — `FR-MKT`

This is the product's stated identity and its largest gap. Everything below the
admin line exists as a table and, in several cases, as a written function with no caller.

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-MKT-01 | Admin "Distributors" page: list sellers, filter by status, approve / reject / suspend, set per-seller commission rate | P1 | Live |
| FR-MKT-02 | Products carry a nullable `seller_id`; NULL means platform-owned (1P) | P0 | Live |
| FR-MKT-03 | Commission is a per-seller percentage rate with a platform default | P1 | Live (model + admin) |
| FR-MKT-04 | Ownership guards prevent one seller editing another's listings by guessing an id; admins pass both | P0 | Live |
| FR-MKT-05 | **Seller self-service application and onboarding** | P1 | **Schema only — `applyAsSeller()` is written and has no caller** |
| FR-MKT-06 | **Seller portal**: dashboard, listings, order queue, stock, earnings | P1 | **Planned — no seller-facing surface of any kind exists** |
| FR-MKT-07 | KYC document upload to R2 (national ID, trade licence, TIN, bank statement) with a staff-only review queue. The media route already gates `kyc/` to staff | P1 | Partial — storage and gating exist; no upload UI, no review queue |
| FR-MKT-08 | Public seller storefront page with store name, banner, rating and listings | P1 | Schema only — `getSellerBySlug()` exists, no route |
| FR-MKT-09 | Per-seller fulfilment: a seller sees and ships only their own suborders | P1 | Planned — depends on FR-CHK-14 |
| FR-MKT-10 | Seller earnings and statement (`getSellerStats()`) | P1 | Schema only |
| FR-MKT-11 | Payout runs: period, gross sales, commission, net payout, line items per suborder | P1 | Schema only — `seller_payouts` / `payout_line_items` unused |
| FR-MKT-12 | Seller performance ratings from buyer reviews | P2 | Schema only |

### 8.12 Admin panel — `FR-ADM`

Served by the same Worker, chosen by Host header. This is the most complete part
of the product.

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-ADM-01 | `admin.zupona.com` is routed by Host header onto internal `/admin/*` paths; the internal prefix never reaches the address bar. A storefront path reached on the admin host redirects to the main domain | P0 | Live |
| FR-ADM-02 | Routing is not authorization: the panel layout **and** every server action call `requireAdmin()` / `requireStaff()` independently | P0 | Live |
| FR-ADM-03 | A signed-in shopper reaching an admin URL is sent to the login screen, not told "forbidden" — the panel does not confirm its own existence | P1 | Live |
| FR-ADM-04 | Dashboard: revenue/orders/customers trend cards over selectable ranges, sales chart, order-status donut, top products, recent activity, staff alerts | P1 | Live |
| FR-ADM-05 | Products: paginated list with filters, create, edit, variants, images, videos, attributes, features, status changes, bulk actions, archive | P0 | Live |
| FR-ADM-06 | Per-variant stock editing that writes through the ledger, with low-stock highlighting | P0 | Live |
| FR-ADM-07 | Price changes recorded to `price_history` | P1 | Live |
| FR-ADM-08 | Categories: full two-level tree management — create, edit, reorder, toggle, delete | P1 | Live |
| FR-ADM-09 | Orders: list with filters and counts, detail view, status / payment-status / tracking updates | P0 | Live |
| FR-ADM-10 | Customers: list, detail, status (active/suspended/banned), role, points adjustment | P1 | Live |
| FR-ADM-11 | Coupons: create, toggle, delete, redemption counts | P1 | Live |
| FR-ADM-12 | Marketing: banners, flash sales, customer broadcast | P1 | Live |
| FR-ADM-13 | Reports: sales series, revenue by payment method, orders by city, top categories, top customers, top products | P1 | Live |
| FR-ADM-14 | Settings: store identity, support contacts, currency symbol, shipping fees, free-shipping threshold, default commission, low-stock threshold, and three feature flags. Writes are whitelisted by key and type so an unexpected field cannot quietly create a setting nothing reads | P1 | Live |
| FR-ADM-15 | Cross-entity search over products, orders and customers | P2 | Live |
| FR-ADM-16 | Every privileged action writes an `admin_audit_log` entry with actor, action, entity and before/after JSON | P0 | Live |
| FR-ADM-17 | Audit log viewer in the panel | P2 | Planned — `listAuditLog()` exists, no page |
| FR-ADM-18 | Honour `maintenance_mode` — take the storefront down for a deploy or a data fix | P1 | **Partial — the flag is editable and read by nothing** |
| FR-ADM-19 | Support ticket queue for the `support` role | P2 | Schema only |

### 8.13 Media — `FR-MED`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-MED-01 | Image upload to R2 with type and size validation, foldered by purpose (products / videos / reviews / sellers / avatars / kyc) | P0 | Live |
| FR-MED-02 | Video upload **streamed** to R2 rather than parsed in the Worker — `formData()` buffers the whole upload and a phone video exhausts the request's CPU allowance before it returns | P0 | Live |
| FR-MED-03 | The R2 bucket stays closed to the internet; everything is served through `/api/media/[...key]`, so private folders can be gated. `kyc/` is staff-only | P0 | Live |
| FR-MED-04 | HTTP range requests honoured for video seeking | P1 | Live |
| FR-MED-05 | Upload endpoint verifies the caller itself and rate-limits per admin (120/min) rather than trusting the proxy | P0 | Live |
| FR-MED-06 | Cloudflare Images resizing on the `IMAGES` binding | P2 | Planned — binding declared, unused |

### 8.14 Notifications and support — `FR-NOT`

| ID | Requirement | Pri | Status |
| --- | --- | --- | --- |
| FR-NOT-01 | In-app notifications with unread count, mark-read and mark-all-read | P1 | Live |
| FR-NOT-02 | Order-placed notification written on checkout | P1 | Live |
| FR-NOT-03 | Admin broadcast to all customers | P2 | Live |
| FR-NOT-04 | Notifications on status change, shipment, delivery, refund | P1 | Planned |
| FR-NOT-05 | SMS notifications | P1 | Planned — no gateway (see FR-ID-04) |
| FR-NOT-06 | Email notifications | P2 | Planned |
| FR-NOT-07 | Support tickets with threaded messages, priority and assignment | P2 | Schema only |

---

## 9. Non-functional requirements

| ID | Requirement | Target |
| --- | --- | --- |
| **NFR-PERF-01** | Storefront pages render at the edge with no origin round trip | p75 TTFB < 400 ms in Bangladesh |
| **NFR-PERF-02** | **Catalog pages stay inside the D1 daily row-read budget.** This is a hard operational limit, not an optimisation target — see §11.4 | Category listing ≤ 300 rows read per call |
| **NFR-PERF-03** | Hot, slow-changing reads (catalog listings, category list, settings) are served from KV; cart contents, stock counts and order status are **never** cached, because KV is eventually consistent | — |
| **NFR-PERF-04** | A KV failure never takes down a page — the loader runs and returns uncached | — |
| **NFR-SEC-01** | Passwords hashed with PBKDF2 (Web Crypto); no plaintext, ever | — |
| **NFR-SEC-02** | Sessions are opaque server-side IDs in `httpOnly` cookies; no client-readable auth state | — |
| **NFR-SEC-03** | Authorization enforced in server actions, not by hidden UI | — |
| **NFR-SEC-04** | Full card numbers and CVVs are never persisted; payout details hold account identifiers only | — |
| **NFR-SEC-05** | Phone verification state lives server-side, keyed by an `httpOnly` cookie, so a shopper cannot forge a verified state | — |
| **NFR-SEC-06** | Rate limiting on OTP issuance (30 s) and admin uploads (120/min) | — |
| **NFR-SEC-07** | Every privileged mutation is attributable through `admin_audit_log` | — |
| **NFR-REL-01** | A failing build deploys nothing and leaves the live site alone | — |
| **NFR-REL-02** | D1 applies a migration file atomically; a failing statement rolls the whole file back | — |
| **NFR-REL-03** | Rollback path: re-point `zupona.com` at the retired `asdf` Worker | — |
| **NFR-UX-01** | Mobile-first, designed at a 448 px column with a fixed bottom tab bar; nothing spills sideways | — |
| **NFR-UX-02** | All commercial configuration is editable from the admin panel without a deploy | — |
| **NFR-UX-03** | Prices render as whole Taka with the ৳ symbol through one formatter | — |
| **NFR-A11Y-01** | Visible keyboard focus, labelled controls, honoured `prefers-reduced-motion` | WCAG 2.1 AA |
| **NFR-DOC-01** | The repository must be sufficient for a session with no prior context to work safely — including what lives outside the repo | — |

---

## 10. Data model

46 tables in `db/schema.sql`, grouped by concern. (`DATABASE.md` says 44; it predates
`product_videos` and `banners`.)

| Group | Tables |
| --- | --- |
| Identity and access | `users`, `sessions`, `oauth_accounts`, `login_attempts`, `addresses`, `payment_methods` |
| Sellers | `sellers`, `seller_documents` |
| Catalog | `categories`, `brands`, `products`, `product_images`, `product_videos`, `product_variants`, `product_attributes`, `product_features`, `inventory_movements`, `price_history` |
| Shopping | `cart_items`, `wishlist_items`, `recently_viewed`, `search_queries` |
| Merchandising | `coupons`, `coupon_redemptions`, `flash_sales`, `flash_sale_items`, `banners` |
| Social proof | `reviews`, `review_images`, `product_questions`, `product_answers` |
| Orders | `orders`, `order_items`, `suborders`, `order_status_history`, `shipments`, `returns_refunds`, `phone_verifications` |
| Money | `payment_transactions`, `seller_payouts`, `payout_line_items` |
| Service and platform | `notifications`, `support_tickets`, `support_messages`, `admin_audit_log`, `site_settings` |

### 10.1 Invariants

These are product rules, not implementation details. Breaking one is a defect.

1. **Prices are whole Taka integers.** There is no minor unit to divide by. All
   money formatting goes through `formatPrice()`.
2. **Stock lives on variants, never on products.** Every product has at least one
   variant row even with no visible options, because that row carries stock, SKU
   and any price override. `price IS NULL` means "inherit the product price" —
   read `effectivePrice`.
3. **Stock has a ledger.** `product_variants.stock_quantity` is the fast current
   value; `inventory_movements` is the append-only audit trail behind it. Stock
   changes only through `src/lib/inventory.ts` so the two agree.
4. **Reservations separate held stock from sold stock.**
   `available = stock_quantity − reserved_quantity`. `reserveStock()` does the check
   and the hold in one conditional `UPDATE`, so two shoppers cannot both claim the
   last item. *(Written; not yet called — see FR-CHK-12.)*
5. **Orders split into suborders**, one per seller. Fulfilment, commission and
   payouts all key off the suborder.
6. **Aggregates are denormalized and recomputed, never hand-set.**
   `rating_avg` / `rating_count` are refreshed inside the same batch as every
   review write.
7. **Deletes are soft where history matters.** Archiving a product keeps its order
   lines and reviews; a hard delete would cascade them away.
8. **Orders snapshot their inputs.** Address, names, prices and images are copied
   onto the order, so later edits never rewrite history.

### 10.2 Data-access layer

| Module | Responsibility | Reached from |
| --- | --- | --- |
| `db.ts` | D1 / R2 / KV binding accessors | everywhere |
| `storefront.ts` | Customer-facing catalog reads | storefront (12 importers) |
| `categories.ts` | Department browsing and counts | storefront |
| `catalog.ts` | Product CRUD, variants, search, browsing signals | **admin only** |
| `adminData.ts` | Every admin list, filter, stat and report (2,049 lines) | admin (19 importers) |
| `inventory.ts` | Stock, ledger, reservations, low stock | **admin only** |
| `sellers.ts` | Onboarding, approval, storefronts, earnings | **admin only** |
| `reviews.ts` | Reviews, breakdown, moderation, replies | **admin only** |
| `coupons.ts` | Validation and redemption | **admin only (CRUD)** |
| `admin.ts` | Role guards, audit log, settings, platform stats | admin |
| `media.ts` | R2 uploads with validation | upload route, media route |
| `cache.ts` | KV read-through cache and rate limiting | 10 importers |

**The pattern worth naming:** the marketplace domain modules are all written and
all reachable only from the admin side. The customer-facing half of each feature
is the missing work.

---

## 11. Architecture and technical constraints

### 11.1 Runtime

One Cloudflare Worker serves both sites. Next.js 16.3.4 / React 19.2.8 on
[vinext](https://vinext.dev), Tailwind 4, Node pinned to 24.19.0, TypeScript
strict. Fonts are Poppins and Playfair Display via `next/font/google`.

| Binding | Service | Resource | Used for |
| --- | --- | --- | --- |
| `DB` | D1 (SQLite) | `zupona-v3-db` | Everything relational |
| `MEDIA` | R2 | `zupona-product-media` | Product images, video, review photos, KYC |
| `CACHE` | KV | `CACHE` | Edge cache, OTP throttling, rate limiting |
| `IMAGES` | Cloudflare Images | — | Declared, not yet used |

Bindings are reached through `src/lib/db.ts` (`getDB()`, `getMedia()`, `getCache()`),
never by importing `cloudflare:workers` directly, so running outside the Workers
runtime fails with a clear message. After changing bindings, run `npx wrangler types`.

### 11.2 Deployment

Push to `main` → GitHub Actions builds and deploys → live in 60–120 seconds.
**Committing and pushing is what "deployed" means here.** Two details are
load-bearing: the deploy command is `vinext-cloudflare deploy`, not `wrangler deploy`
(vinext generates its own Worker config; plain wrangler produces a build that
succeeds and a Worker that is broken); and Node is pinned in `.node-version`.

### 11.3 Migrations do not ride along

**CI deploys code only.** A new `db/migrations/*.sql` file is never applied by the
pipeline. Shipping code that expects an unapplied migration produces server errors
on zupona.com — and because local D1 usually *does* have the migration, the page
looks perfectly fine in `npm run dev`. This is the single most common way to break
production. Apply to `--local` and `--remote` both, and treat the remote run as
part of shipping the change.

### 11.4 The D1 row-read budget is a product constraint

On 12 September 2026 zupona.com answered 500 on every catalog page: D1 refused the
reads because the account had exceeded the free tier's daily row-read limit.
Nothing was wrong with the rendering code. One query — the category listing,
counting each category's products with a correlated `COUNT(*)` that re-scanned the
products table — accounted for 3.5 million rows read in a day, 2,823 rows per call
against a 40-product catalog. Rewritten as a grouped join it reads 243.

**This is why NFR-PERF-02 exists.** At this scale a single careless query is an
outage, not a slow page. Every new catalog query needs a row-count check
(`wrangler d1 insights`), and KV caching is a correctness measure as much as a
performance one.

### 11.5 Environment and secrets

Google OAuth credentials are Worker secrets (`wrangler secret put`), so deploys
never touch them. CI authenticates with a non-expiring `CLOUDFLARE_API_TOKEN`
repository secret — the local wrangler OAuth credential is short-lived and would
fail in CI within the hour.

---

## 12. Critical gaps

Ranked by risk. Items 1–5 are the Phase 1 gate.

| # | Gap | Impact | Requirement |
| --- | --- | --- | --- |
| **1** | **Orders never touch inventory.** No reservation at checkout, no decrement on placement. `reserveStock()` and `commitSale()` are written and never called | Guaranteed oversell. Stock figures in the admin panel are fiction the moment an order is placed. This is the single most serious defect in the product | FR-CHK-12 |
| **2** | **Coupons cannot be redeemed.** They can be created, scoped, capped, displayed in a wallet on `/offers` — and never applied. `validateCoupon()` has no caller | Every promotion the business runs is a false promise to the customer | FR-CHK-13, FR-OFF-06 |
| **3** | **Checkout creates no suborders.** `order_items.seller_id` and `suborder_id` are left null | The marketplace cannot function: no per-seller fulfilment, no commission calculation, no payouts. The multi-vendor thesis is unreachable until this is wired | FR-CHK-14 |
| **4** | **No payment transaction is recorded.** The payment method is stored as a display label | No reconciliation, no refunds, no gateway integration path | FR-CHK-15 |
| **5** | **Order tracking is simulated from elapsed time**, not driven by fulfilment. An operator can set a status; the customer's tracker ignores it | The customer is shown a delivery timeline that is not true. Directly undermines PS-1, the trust problem the product exists to solve | FR-ORD-03, FR-ORD-05 |
| **6** | **No customer can write a review.** The entire review system is built and only the moderation half is reachable | No social proof, no verified purchase signal, no seller accountability | FR-REV-04/05/06 |
| **7** | **No seller-facing surface exists.** No application, no portal, no KYC upload, no order queue, no earnings | The product is a marketplace in schema only | FR-MKT-05/06/07 |
| **8** | **Points accrue and cannot be spent** | An unbounded liability with no discharge mechanism | FR-LOY-04 |
| **9** | **Three admin settings are read by nothing** — `guest_checkout_enabled`, `maintenance_mode`, `reviews_need_approval` | An operator toggles a switch and believes the store changed. Silently untrue | FR-CHK-16, FR-ADM-18, FR-REV-07 |
| **10** | **OTP codes are returned to the browser** (`demoCode`) because no SMS gateway is connected | Phone verification is decorative: anyone can "verify" any number | FR-ID-04 |
| **11** | **Storefront logins are not recorded** in `login_attempts`; no lockout exists | No brute-force protection on customer accounts; the security page's activity list is incomplete | FR-ID-12/13 |
| **12** | **Returns, shipments, Q&A and support tickets are schema only** | Post-purchase service has no product surface | FR-ORD-07/08, FR-REV-09, FR-NOT-07 |

---

## 13. Roadmap

### Phase 1 — Transactional integrity *(gate on everything else)*

Reserve stock at checkout and commit on placement (FR-CHK-12). Apply coupons end
to end (FR-CHK-13). Create suborders with commission (FR-CHK-14). Write payment
transactions (FR-CHK-15). Drive the customer tracker from real order status
(FR-ORD-05). Make the three dead settings live (FR-CHK-16, FR-ADM-18, FR-REV-07).
Show live stock on the product page (FR-PDP-11).

*Exit criteria: §6.3.*

### Phase 2 — Trust and retention

Customer review submission with photos and verified-purchase badging
(FR-REV-04/05/06). Review list and rating breakdown on the PDP. Order cancellation
and returns (FR-ORD-06/07). Status-change notifications (FR-NOT-04). Points
redemption (FR-LOY-04). Cart coupon entry (FR-CART-05) and out-of-stock warnings
(FR-CART-06).

### Phase 3 — Marketplace activation

Seller application and onboarding (FR-MKT-05). Seller portal: listings, orders,
stock, earnings (FR-MKT-06). KYC upload and staff review queue (FR-MKT-07). Public
seller storefronts (FR-MKT-08). Seller attribution on the PDP (FR-PDP-12).
Per-seller fulfilment and shipments (FR-MKT-09, FR-ORD-08).

### Phase 4 — Settlement and scale

Payout runs (FR-MKT-11). Payment gateway for bKash/Nagad/card (FR-CHK-17). SMS
gateway (FR-ID-04, FR-NOT-05). Server-side search with trending terms (FR-CAT-12).
Recommendations (FR-CAT-14). Support ticketing (FR-NOT-07). Paid D1/Workers tiers.

---

## 14. Risks

| ID | Risk | Severity | Mitigation |
| --- | --- | --- | --- |
| **R1** | Oversell damages customer trust and seller relationships before Phase 1 lands | High | Ship FR-CHK-12 first; until then, keep buffer stock and reconcile manually |
| **R2** | D1 free-tier row reads exhausted again by a new query | High | NFR-PERF-02; row-count review on every catalog query; KV caching; budget for the paid tier |
| **R3** | A migration ships in code but not to the remote database | High | §11.3; treat the `--remote` run as part of shipping, not a follow-up |
| **R4** | **Every push to `main` goes straight to the live store.** No review step, no staging branch | High | Point the pipeline at a `production` branch so `main` is safe to experiment on |
| **R5** | **The Cloudflare API token was pasted into a chat transcript** | High | Roll it in the Cloudflare dashboard and update the repository secret |
| **R6** | **The repository is public** — all source, the schema and resource IDs are world-readable | Medium | Making it private requires the owner account |
| **R7** | The wrong-account trap: the cached Git credential belongs to `sajid123sajid`, one character from the real owner `sajid1234sajid`, which owns similarly named repositories. Work has already been pushed to the wrong repository once | Medium | Documented in HISTORY.md; never "correct" the remote to the cached credential's account |
| **R8** | vinext is a beta dependency (`1.0.0-beta.9`) carrying the whole deployment | Medium | Pin exact versions; the retired `asdf` Worker is the rollback path |
| **R9** | If Cloudflare Workers Builds is ever connected in the dashboard, one push deploys twice | Low | Delete or disable the GitHub Actions workflow at that point |
| **R10** | Two parallel catalog read paths (`storefront.ts` and `catalog.ts`) can drift in what "shoppable" means | Low | Consolidate when seller listings arrive |

---

## 15. Open questions

1. **Commission model** — is the default 10% flat, or per-category? The schema
   supports per-seller only.
2. **Who owns delivery?** Per-seller couriers, or one platform courier account
   with sellers handing off? This decides the shape of FR-MKT-09.
3. **COD risk** — who absorbs a refused delivery: platform or seller? This must be
   settled before payouts (FR-MKT-11) can be specified.
4. **Points economics** — what is a point worth at redemption, and does it come out
   of platform margin or seller margin?
5. **Return window and who pays return shipping** — needed before FR-ORD-07.
6. **Payment gateway** — bKash direct, or an aggregator? Affects FR-CHK-17 timeline.
7. **1P/3P competition** — may the platform list a product a seller already lists,
   and does platform stock rank above seller stock?

---

## Appendix A — Route map

**Storefront**
`/` · `/categories` · `/category/[slug]` · `/product/[id]` · `/cart` · `/checkout` ·
`/checkout/confirmed/[id]` · `/offers` · `/wishlist`

**Account**
`/account` · `/account/login` · `/account/edit` · `/account/security` ·
`/account/addresses` · `/account/payment-methods` · `/account/orders` ·
`/account/orders/[id]` · `/account/notifications` · `/account/points`

**Admin** (served at `admin.zupona.com` without the `/admin` prefix)
`/admin` · `/admin/login` · `/admin/products` · `/admin/products/new` ·
`/admin/products/[id]` · `/admin/products/reviews` · `/admin/categories` ·
`/admin/orders` · `/admin/orders/[id]` · `/admin/customers` ·
`/admin/customers/[id]` · `/admin/distributors` · `/admin/coupons` ·
`/admin/marketing` · `/admin/reports` · `/admin/settings` · `/admin/search`

**API**
`/api/media/[...key]` · `/api/admin/upload` · `/api/auth/google` ·
`/api/auth/google/callback`

## Appendix B — Current data volume

Seed catalog: 33 products, 36 categories, 5 brands, 61 variants, 77 feature badges,
9 site settings. Delivery coverage: 8 divisions, 43 areas. Migrations applied:
`0001`–`0008`.

## Appendix C — Glossary

| Term | Meaning |
| --- | --- |
| **1P / 3P** | First-party (platform-owned, `seller_id IS NULL`) / third-party (seller-listed) |
| **Distributor** | The admin panel's name for a seller |
| **Suborder** | The slice of a customer order belonging to one seller; the unit of fulfilment, commission and payout |
| **Variant** | A sellable configuration of a product. Carries stock, SKU and any price override |
| **Effective price** | `variant.price ?? product.price` |
| **Reserved quantity** | Stock held by an in-flight checkout but not yet sold |
| **Taka (৳)** | Bangladeshi currency. Stored as whole-number integers |
| **vinext** | The framework that runs Next.js natively on Cloudflare Workers |
| **Binding** | A Cloudflare resource handle available to the Worker (`DB`, `MEDIA`, `CACHE`, `IMAGES`) |
