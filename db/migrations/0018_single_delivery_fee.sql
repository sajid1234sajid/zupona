-- One delivery charge, no tiers.
--
-- The shop used to offer Standard and Express at different prices. It now
-- charges a single fee, so the two old keys are replaced by `delivery_fee`.
-- Existing orders keep whatever `delivery_method` and `shipping_fee` they were
-- placed with; nothing is re-priced.

INSERT INTO site_settings (key, value)
VALUES ('delivery_fee', '130')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;

DELETE FROM site_settings WHERE key IN ('standard_shipping_fee', 'express_shipping_fee');

-- Free delivery over the threshold stays as it was; only the tiers are gone.
INSERT INTO site_settings (key, value)
VALUES ('free_shipping_threshold', '999')
ON CONFLICT(key) DO UPDATE SET value = excluded.value;
