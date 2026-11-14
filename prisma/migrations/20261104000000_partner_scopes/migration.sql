-- Partners are featured on scopes instead of companies: the implicit many-to-many
-- "_CompanyToPartner" gives way to "_PartnerToScope". A partner that was shown for a
-- company is now shown on every scope holding that company.
--
-- Safe to run more than once and on any database state, like the other upgrades: the
-- entrypoints run it with `prisma db execute` before `prisma db push`. It does nothing
-- unless "_CompanyToPartner" still exists; everywhere else `db push` creates
-- "_PartnerToScope".

DO $$
BEGIN
  IF to_regclass('public."_CompanyToPartner"') IS NULL THEN
    RETURN;
  END IF;

  -- The join table exactly as `db push` creates it (A = partners, B = scopes).
  CREATE TABLE IF NOT EXISTS "_PartnerToScope" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_PartnerToScope_AB_pkey" PRIMARY KEY ("A", "B")
  );
  CREATE INDEX IF NOT EXISTS "_PartnerToScope_B_index" ON "_PartnerToScope"("B");
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_PartnerToScope_A_fkey') THEN
    ALTER TABLE "_PartnerToScope" ADD CONSTRAINT "_PartnerToScope_A_fkey"
      FOREIGN KEY ("A") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_PartnerToScope_B_fkey') THEN
    ALTER TABLE "_PartnerToScope" ADD CONSTRAINT "_PartnerToScope_B_fkey"
      FOREIGN KEY ("B") REFERENCES "scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- "_CompanyToPartner": A = companies, B = partners. "_CompanyToScope": A = companies, B = scopes.
  INSERT INTO "_PartnerToScope" ("A", "B")
  SELECT DISTINCT cp."B", cs."B"
  FROM "_CompanyToPartner" cp
  JOIN "_CompanyToScope" cs ON cs."A" = cp."A"
  ON CONFLICT DO NOTHING;

  DROP TABLE "_CompanyToPartner";
END
$$;
