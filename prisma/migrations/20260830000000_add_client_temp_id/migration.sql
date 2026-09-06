-- AlterTable
-- Adds nullable `clientTempId` column (UUID v4 generated client-side) to
-- serve as an idempotency key for offline transaction sync.
-- Nullable so existing rows are unaffected; a partial unique index allows
-- multiple NULLs (standard SQL behavior in Postgres) while enforcing
-- uniqueness among non-NULL values.

ALTER TABLE "Transaction" ADD COLUMN "clientTempId" TEXT;

CREATE UNIQUE INDEX "Transaction_clientTempId_key" ON "Transaction"("clientTempId") WHERE "clientTempId" IS NOT NULL;
