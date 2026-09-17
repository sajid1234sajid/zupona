-- Stock tracking becomes a per-product choice.
--
-- Until now every product counted its units, so listing anything meant filling
-- in the Variants & Stock grid before it could be sold. A shop that does not
-- hold countable inventory -- made to order, printed on demand, a service --
-- had no way to say so, and a product left at zero simply read "Out of Stock".
--
-- `track_inventory = 0` means the product sells without a ceiling: the
-- storefront never calls it out of stock, checkout never refuses it for want of
-- units, and no reservation is weighed against a count. `stock_quantity` is
-- still moved by a sale, so `inventory_movements` and the column stay in
-- agreement and an admin who later switches tracking on sees an honest history
-- rather than a gap -- an untracked variant simply goes negative, which reads
-- as "sold this many of something we were not counting".
--
-- New products default to untracked, because that is the form with nothing to
-- fill in. Every product that exists today is switched on explicitly, so
-- nothing already listed changes what it says or what it will sell.

ALTER TABLE products ADD COLUMN track_inventory INTEGER NOT NULL DEFAULT 0;

UPDATE products SET track_inventory = 1;
