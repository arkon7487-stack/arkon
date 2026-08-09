-- Convert integer-appropriate columns from numeric to integer.
-- These columns store whole-number counts (visits, quantities), not
-- fractional values. Using numeric caused UI step/decimal confusion.
-- Existing data is preserved: any fractional values are rounded to nearest int.

-- packages.visits_per_week: count of visits per week (e.g. 3, not 3.5)
ALTER TABLE packages ALTER COLUMN visits_per_week TYPE integer
  USING COALESCE(ROUND(visits_per_week), 0);

-- inventory_items.quantity: stock count
ALTER TABLE inventory_items ALTER COLUMN quantity TYPE integer
  USING COALESCE(ROUND(quantity), 0);

-- inventory_items.min_quantity: reorder threshold count
ALTER TABLE inventory_items ALTER COLUMN min_quantity TYPE integer
  USING COALESCE(ROUND(min_quantity), 0);

-- inventory_movements.quantity: movement count
ALTER TABLE inventory_movements ALTER COLUMN quantity TYPE integer
  USING COALESCE(ROUND(quantity), 0);
