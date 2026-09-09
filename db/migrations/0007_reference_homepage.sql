-- Aligns the catalog with the Zupona homepage reference design.
--
-- Three things move from code into data here, so the home page can keep
-- reading everything it renders from D1 rather than hardcoding it:
--
--  1. Department names and subtitles. The home page prints the subtitle
--     under each category tile, so the wording had to become the copy the
--     design calls for ("Style for every you" rather than the old
--     "Style with Comfort"). "Baby Products" is renamed "Baby Accessories"
--     to match; the id stays `baby-products` so every product, order line
--     and saved link that points at it keeps working.
--
--  2. The featured flag. The home page's Featured Products grid now asks
--     for `is_featured = 1` instead of the whole catalog, which is what
--     makes the grid curatable from the admin panel. Exactly the two
--     products in the design are flagged; ticking "Featured" on any other
--     product adds it to the grid with no code change.
--
--  3. The two featured products' own numbers, so the card prints the
--     rating, review count and old price the design specifies.

-- 1. Department names and subtitles -----------------------------------------
UPDATE categories SET subtitle = 'Style for every you'          WHERE id = 'mens-fashion';
UPDATE categories SET subtitle = 'Trendy & Traditional'         WHERE id = 'womens-fashion';
UPDATE categories SET subtitle = 'Upgrade Your Style'           WHERE id = 'mens-accessories';
UPDATE categories SET subtitle = 'Elegance in Details'          WHERE id = 'womens-accessories';
UPDATE categories SET name = 'Baby Accessories',
                      subtitle = 'Everything for Little Ones'   WHERE id = 'baby-products';
UPDATE categories SET subtitle = 'Care Today, Glow Tomorrow'    WHERE id = 'health-beauty';
UPDATE categories SET subtitle = 'Smart Choices, Smarter Life'  WHERE id = 'electronics';
UPDATE categories SET subtitle = 'Refresh, Rejuvenate, Repeat.' WHERE id = 'body-bath';

-- 2. Curate the featured grid ------------------------------------------------
UPDATE products SET is_featured = 0;
UPDATE products SET is_featured = 1 WHERE id IN ('smart-watch-7', 'white-sneaker');

-- 3. Featured product figures ------------------------------------------------
UPDATE products
   SET rating_avg = 4.8, rating_count = 120
 WHERE id = 'smart-watch-7';

UPDATE products
   SET old_price = 2099, rating_avg = 4.7, rating_count = 88
 WHERE id = 'white-sneaker';

-- 4. Artwork ------------------------------------------------------------------
-- Department tiles and the sneaker's card photo, brought in line with the
-- design. Every statement is an idempotent UPDATE, so re-running this file is
-- safe.
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=200&q=70' WHERE id = 'womens-fashion';
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=200&q=70' WHERE id = 'womens-accessories';
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=200&q=70' WHERE id = 'health-beauty';
UPDATE categories SET image_url = 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&w=200&q=70' WHERE id = 'body-bath';

-- The catalog photo was a white sneaker on a black ground; the design shows it
-- on a light one, which also sits better next to the other card.
UPDATE product_images
   SET url = 'https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?auto=format&fit=crop&w=600&q=75'
 WHERE product_id = 'white-sneaker' AND is_primary = 1;

UPDATE categories
   SET image_url = 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=200&q=70'
 WHERE id = 'electronics';

-- A clean product shot of the watch rather than a lit-up watch face, which
-- read as a photograph of a screen at card size.
UPDATE product_images
   SET url = 'https://images.unsplash.com/photo-1544117519-31a4b719223d?auto=format&fit=crop&w=600&q=75'
 WHERE product_id = 'smart-watch-7' AND is_primary = 1;

-- The desk shot left the headphones tiny once cropped to a 34px tile.
UPDATE categories
   SET image_url = 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=200&q=70'
 WHERE id = 'electronics';
