-- The ECM company and its scope are called ECM+ now. The seed finds companies by
-- name, so an existing database has to be renamed before it runs, or it would add
-- a second company.
--
-- Safe to run more than once and on any database state, like the other upgrades:
-- the entrypoints run it with `prisma db execute` before `prisma db push`.

DO $$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL THEN
    UPDATE "companies" SET "name" = 'ECM+' WHERE "name" = 'ECM';
  END IF;

  -- Nested, not "AND": the query is only planned once the table is known to exist.
  IF to_regclass('public.scopes') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM "scopes" WHERE "name" = 'ECM+') THEN
      UPDATE "scopes" SET "name" = 'ECM+' WHERE "name" = 'ECM';
    END IF;
  END IF;
END $$;
