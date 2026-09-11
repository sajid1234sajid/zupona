-- Bangladesh addresses are division -> district -> upazila/thana. The checkout
-- stored only the first and the last, so an order from Cumilla arrived looking
-- like it came from "Chattogram / Kotwali" -- Chattogram city's own thana, not
-- the customer's. Sixty-three of the sixty-four districts had no way to be
-- recorded at all.
--
-- Nullable on purpose: orders placed before this migration genuinely do not
-- have a district, and inventing one would be worse than leaving it empty. The
-- admin screens show "Not recorded" for those rather than a guess.

ALTER TABLE orders ADD COLUMN address_district TEXT;
ALTER TABLE addresses ADD COLUMN district TEXT;
