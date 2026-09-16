-- A real SMS gateway behind checkout's phone verification.
--
-- Until now the one-time code was written to `phone_verifications` and never
-- sent anywhere: the only way to complete a checkout was to turn on demo mode,
-- which prints the code in the page. That made the verification decorative --
-- anyone could "confirm" any number by reading the response.
--
-- Sending costs money per message and fails in ways nobody sees from the
-- outside (an expired key, an unapproved sender mask, a gateway that is down),
-- so every attempt is recorded. The message body is deliberately NOT stored: a
-- verification text *is* its one-time code, and this table is readable by every
-- admin.
CREATE TABLE IF NOT EXISTS sms_messages (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,                           -- +8801XXXXXXXXX
  purpose TEXT NOT NULL DEFAULT 'otp',           -- otp|order|test
  provider TEXT NOT NULL,                        -- smsnetbd|bulksmsbd|mimsms|custom
  status TEXT NOT NULL,                          -- sent|failed
  provider_ref TEXT,                             -- the gateway's own request id
  error TEXT,                                    -- why it was refused, when it was
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_created ON sms_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_phone ON sms_messages (phone, created_at DESC);

-- The sender mask the gateway has approved for this shop. A setting rather
-- than a secret: it is printed on every message that arrives, and a shop that
-- gets a new mask approved should not need a redeploy to start using it. The
-- API key stays a Worker secret.
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('sms_sender_id', '');

-- `otp_demo_mode` is deliberately left alone. It is only honoured when the
-- shop has no gateway configured, so connecting one closes the hole on its
-- own -- and a migration that turned it off before the API key was set would
-- break checkout for the window in between.
