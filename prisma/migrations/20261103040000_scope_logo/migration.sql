-- Scopes have their own logo now, which the public pages show. Existing scopes start
-- with the logo of their first company; admins can change it on the Scopes page.
--
-- Safe to run more than once and on any database state, like the other upgrades:
-- the entrypoints run it with `prisma db execute` before `prisma db push`. Without a
-- scopes table it does nothing and `db push` creates it with the column.

DO $$
BEGIN
  IF to_regclass('public.scopes') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'scopes' AND column_name = 'logo'
  ) THEN
    ALTER TABLE "scopes" ADD COLUMN "logo" TEXT NOT NULL DEFAULT '';
    UPDATE "scopes" s SET "logo" = coalesce((
      SELECT c."logo"
      FROM "_CompanyToScope" cs
      JOIN "companies" c ON c."id" = cs."A"
      WHERE cs."B" = s."id"
      ORDER BY c."id"
      LIMIT 1
    ), '');
  END IF;
END $$;
