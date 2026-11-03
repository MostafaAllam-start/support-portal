-- The landing page's contact form now creates requests (site_requests with source
-- "contact") instead of contact_messages, which nothing ever displayed: existing
-- messages move over, then the table goes.
--
-- Safe to run more than once and on any database state, like the other upgrades:
-- the entrypoints run it with `prisma db execute` before `prisma db push`. On a
-- fresh database (no site_requests yet) it does nothing and `db push` creates the
-- schema.

DO $$
BEGIN
  IF to_regclass('public.site_requests') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SiteRequestSource') THEN
    CREATE TYPE "SiteRequestSource" AS ENUM ('demo', 'contact');
  END IF;
  ALTER TABLE "site_requests"
    ADD COLUMN IF NOT EXISTS "source" "SiteRequestSource" NOT NULL DEFAULT 'demo';
  ALTER TABLE "site_requests" ADD COLUMN IF NOT EXISTS "subject" TEXT;
  ALTER TABLE "site_requests" ALTER COLUMN "organization" DROP NOT NULL;

  IF to_regclass('public.contact_messages') IS NOT NULL THEN
    INSERT INTO "site_requests"
      ("source", "name", "email", "subject", "message", "modules", "created_at", "updated_at")
    SELECT
      'contact'::"SiteRequestSource", "name", "email", "subject", "message",
      '{}'::text[], "created_at", "created_at"
    FROM "contact_messages";
    DROP TABLE "contact_messages";
  END IF;
END $$;
