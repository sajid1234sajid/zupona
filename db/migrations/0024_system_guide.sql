-- The Zupona System Guide, kept in the database rather than the repository.
--
-- The owner follows the whole system -- every feature, flow, table, rule and
-- a dated changelog -- through one guide, read at Admin > Settings > System
-- Guide. It lives here because the repository is public and the guide is the
-- shop's blueprint: rows are reached only through the admin panel, behind
-- requireAdmin(), and through `scripts/guide.mjs` with Cloudflare credentials.
--
-- One row per section, in reading order. `body_md` is Markdown; a ```svg
-- fence inside it is drawn as a picture (the architecture diagram). Nothing
-- in the shop reads these rows, so a malformed section can only spoil the
-- guide page itself.

CREATE TABLE IF NOT EXISTS system_guide_sections (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  body_md TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Who last wrote it: a person's name, or the session or agent that did.
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_guide_sections_position
  ON system_guide_sections (position);
