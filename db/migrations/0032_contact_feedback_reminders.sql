-- Messages sent from the contact form, guests included (0032). support_tickets
-- needs an account, and most people who write in have none yet.
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  order_number TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', -- new | handled
  handled_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  handled_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages (status, created_at DESC);

-- "Was this helpful?" on help-centre answers (0032). One vote per question per
-- browser, kept by the visitor id; the question text is the key, so editing an
-- answer's wording keeps its votes and editing the question starts afresh.
CREATE TABLE IF NOT EXISTS faq_feedback (
  question TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  helpful INTEGER NOT NULL, -- 1 yes, 0 no
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (question, visitor_id)
);

-- "Remind me" on an upcoming flash sale (0032). notified_at is set when the
-- shopper's notification is written, once.
CREATE TABLE IF NOT EXISTS flash_sale_reminders (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  flash_sale_id TEXT NOT NULL REFERENCES flash_sales(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  notified_at TEXT,
  PRIMARY KEY (user_id, flash_sale_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_sale_reminders_due ON flash_sale_reminders (notified_at, flash_sale_id);

-- Codes made together in Admin > Coupons ("How many codes"), e.g. for one
-- influencer or one ad (0032). The batch is the shared prefix; the list shows
-- a batch as one row with a spreadsheet download instead of every code.
ALTER TABLE coupons ADD COLUMN batch TEXT;
CREATE INDEX IF NOT EXISTS idx_coupons_batch ON coupons (batch);

-- Real visitors' page speed (0032): a sample of page views reports its
-- Core Web Vitals. `page` is the kind of page (home, product, category...),
-- not the address, so a report groups like with like. Kept 30 days.
CREATE TABLE IF NOT EXISTS web_vitals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page TEXT NOT NULL,
  metric TEXT NOT NULL, -- LCP | CLS | INP | FCP | TTFB
  value REAL NOT NULL, -- ms, or unitless for CLS
  device TEXT NOT NULL DEFAULT 'mobile', -- mobile | desktop
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_report ON web_vitals (metric, page, created_at);
