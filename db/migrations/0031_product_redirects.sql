-- Old product addresses that now live on another product (0031).
--
-- When products are merged -- three colour listings of one shirt becoming one
-- shirt with a Color option -- the retired listings' links (ads, shares,
-- search results) must keep working and open the right colour. The target is
-- held by product id, not slug, so renaming the target later does not break
-- the redirect; `query` is what to open it on, e.g. "color=grey".
CREATE TABLE IF NOT EXISTS product_redirects (
  from_slug TEXT PRIMARY KEY,
  from_id TEXT,
  to_product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  query TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_redirects_from_id ON product_redirects (from_id);
