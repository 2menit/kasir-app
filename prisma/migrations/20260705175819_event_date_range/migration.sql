-- Rename eventDate to eventDateStart and add eventDateEnd column
-- This is a non-destructive migration: existing data is preserved via column rename,
-- and eventDateEnd is populated with the same value as eventDateStart (single-day events).

-- Step 1: Rename the existing column
ALTER TABLE "Event" RENAME COLUMN "eventDate" TO "eventDateStart";

-- Step 2: Add the new end-date column (NOT NULL with a temporary default)
ALTER TABLE "Event" ADD COLUMN "eventDateEnd" TIMESTAMP(3) NOT NULL DEFAULT '1970-01-01 00:00:00';

-- Step 3: Populate eventDateEnd from eventDateStart for all existing rows
UPDATE "Event" SET "eventDateEnd" = "eventDateStart";

-- Step 4: Remove the temporary default now that all rows have real values
ALTER TABLE "Event" ALTER COLUMN "eventDateEnd" DROP DEFAULT;
