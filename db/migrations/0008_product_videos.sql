-- Product videos.
--
-- Video lives in its own table rather than as a row in `product_images` with
-- a type column: every catalog query in the app selects a URL out of
-- product_images and hands it straight to <Image>, so a video row in there
-- would silently become a broken listing thumbnail. A separate table means
-- the existing queries keep meaning exactly what they meant before.
--
-- The bytes go to the same R2 bucket as imagery, under a `videos/` prefix,
-- and `url` stores the /api/media/... path the same way image rows do.
-- `poster_url` is optional and points at a still frame the admin uploaded
-- (or that the browser grabbed from the video) so the gallery has something
-- to show before playback starts.

CREATE TABLE IF NOT EXISTS product_videos (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  poster_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_videos_product_id ON product_videos (product_id);
