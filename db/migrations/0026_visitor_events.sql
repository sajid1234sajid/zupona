-- What shoppers do on the storefront, one row per thing they did.
--
-- The owner asked to see who looked at what, who added it to a cart and who
-- bought, in the admin panel, without depending on Meta's dashboard. The pixel
-- tells Meta; this tells the shop. Read by Admin -> Activity
-- (src/app/admin/(panel)/activity) and written by src/lib/activity.ts.
--
-- A visitor is a browser, named by the `zv` cookie the storefront sets on the
-- first page it shows. That is what strings a guest's visits together before
-- they have a name: a phone number arrives with the first order, and every
-- earlier row of the same browser then reads as that person.
--
-- Browsing (page_view, product_view, cart_view, checkout) is reported by the
-- browser in a beacon after the page is idle. Adding to the cart, Buy Now and
-- the purchase are written by the server actions that do them, so a tracking
-- blocker cannot hide a sale and a crafted request cannot invent one.
--
-- No foreign keys on purpose: guest accounts are deleted after 31 days and
-- when a guest signs in, and a product can be deleted. The history of what was
-- done should outlive both, and an insert here must never fail because a row it
-- points at has gone. Rows older than 120 days are pruned by the ingest route.

CREATE TABLE IF NOT EXISTS visitor_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_id TEXT NOT NULL,          -- the `zv` cookie; 'u:<user id>' when a server action ran without one
  user_id TEXT,                      -- the session's user (guest or customer) when there was one
  event TEXT NOT NULL,               -- page_view|product_view|cart_view|checkout|add_to_cart|buy_now|purchase
  path TEXT,                         -- pathname only, no query string
  product_id TEXT,
  order_id TEXT,
  quantity INTEGER,
  value INTEGER,                     -- whole Taka: line value on add_to_cart/buy_now, order total on purchase
  source TEXT,                       -- on a visit's first page only: facebook_ad|facebook|instagram|google|youtube|tiktok|whatsapp|messenger|direct|other
  campaign TEXT,                     -- utm_campaign, when the link carried one
  referrer TEXT,                     -- the referring host, when it was another site
  device TEXT,                       -- mobile|tablet|desktop
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visitor_events_created ON visitor_events (created_at);
CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor ON visitor_events (visitor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_visitor_events_event ON visitor_events (event, created_at);
CREATE INDEX IF NOT EXISTS idx_visitor_events_product ON visitor_events (product_id, event);
CREATE INDEX IF NOT EXISTS idx_visitor_events_user ON visitor_events (user_id);
