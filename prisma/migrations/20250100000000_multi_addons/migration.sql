-- Migration: add addOns (Event) and addOnItems (Transaction) JSON columns
-- for multi add-on support. Legacy single addOn* fields are kept for
-- backward compatibility — old rows are migrated on read via normalizeAddOns().

ALTER TABLE "Event" ADD COLUMN "addOns" JSONB;
ALTER TABLE "Transaction" ADD COLUMN "addOnItems" JSONB;

-- Backfill existing single add-on rows into the new JSON columns so that
-- the new code path can read from addOns / addOnItems exclusively.
UPDATE "Event"
SET "addOns" = jsonb_build_array(jsonb_build_object('name', "addOnName", 'price', "addOnPrice"))
WHERE "addOnEnabled" = true AND "addOnName" IS NOT NULL;

UPDATE "Transaction"
SET "addOnItems" = jsonb_build_array(jsonb_build_object('name', '', 'qty', "addOnQty", 'unitPrice', "addOnUnitPrice"))
WHERE "addOnQty" > 0;
