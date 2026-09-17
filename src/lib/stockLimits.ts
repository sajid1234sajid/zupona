/** What availability says when a product does not count its units.
 *
 * A sentinel rather than an "unlimited" flag threaded beside every figure: the
 * cart already used this exact value for a line with no variant, and every
 * caller compares availability with `>` or `>=`, so one large number is
 * understood everywhere without a second branch.
 *
 * It lives in its own module because both sides need it -- the server read
 * models and the product page's client-side matching -- and `storefront.ts`
 * reaches for the database, which must not follow an import into the browser
 * bundle. */
export const UNLIMITED_STOCK = Number.MAX_SAFE_INTEGER;
