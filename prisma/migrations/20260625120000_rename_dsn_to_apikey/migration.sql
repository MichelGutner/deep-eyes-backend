-- Add apiKey as nullable first
ALTER TABLE "applications" ADD COLUMN "apiKey" TEXT;

-- Populate existing rows with a new UUID
UPDATE "applications" SET "apiKey" = gen_random_uuid()::text WHERE "apiKey" IS NULL;

-- Make it NOT NULL and add unique constraint
ALTER TABLE "applications" ALTER COLUMN "apiKey" SET NOT NULL;
ALTER TABLE "applications" ADD CONSTRAINT "applications_apiKey_key" UNIQUE ("apiKey");

-- Drop old dsn column
ALTER TABLE "applications" DROP COLUMN IF EXISTS "dsn";
