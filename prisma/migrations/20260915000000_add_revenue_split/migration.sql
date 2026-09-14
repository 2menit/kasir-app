-- AlterTable: add revenue split columns to Event
ALTER TABLE "Event" ADD COLUMN "splitEnabled"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Event" ADD COLUMN "splitKitaPercent"    INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "Event" ADD COLUMN "splitPanitiaPercent" INTEGER NOT NULL DEFAULT 20;
