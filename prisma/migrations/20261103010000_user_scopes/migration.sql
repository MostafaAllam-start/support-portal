-- Users hold one or more scopes (the implicit many-to-many "_ScopeToUser")
-- instead of the single users.scope_id, and scopes of several companies ("Both")
-- go away: a user who held one now holds the one-company scope of each of its
-- companies (Both -> CTC + ECM).
--
-- Safe to run more than once and on any database state, like the role upgrade:
-- the entrypoints run it with `prisma db execute` before `prisma db push`. It
-- does nothing unless users.scope_id still exists; everywhere else `db push`
-- creates "_ScopeToUser".

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'scope_id'
  ) THEN
    RETURN;
  END IF;

  -- The join table exactly as `db push` creates it.
  CREATE TABLE IF NOT EXISTS "_ScopeToUser" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_ScopeToUser_AB_pkey" PRIMARY KEY ("A", "B")
  );
  CREATE INDEX IF NOT EXISTS "_ScopeToUser_B_index" ON "_ScopeToUser"("B");
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ScopeToUser_A_fkey') THEN
    ALTER TABLE "_ScopeToUser" ADD CONSTRAINT "_ScopeToUser_A_fkey"
      FOREIGN KEY ("A") REFERENCES "scopes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '_ScopeToUser_B_fkey') THEN
    ALTER TABLE "_ScopeToUser" ADD CONSTRAINT "_ScopeToUser_B_fkey"
      FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- A scope of at most one company carries over as is. A scope of several is
  -- replaced by the one-company scope of each of its companies, or kept for a
  -- company that has none.
  WITH sizes AS (
    SELECT "B" AS scope_id, count(*) AS n FROM "_CompanyToScope" GROUP BY "B"
  ),
  single AS (
    SELECT DISTINCT ON (cs."A") cs."A" AS company_id, cs."B" AS scope_id
    FROM "_CompanyToScope" cs
    JOIN sizes s ON s.scope_id = cs."B" AND s.n = 1
    ORDER BY cs."A", cs."B"
  )
  INSERT INTO "_ScopeToUser" ("A", "B")
  SELECT u."scope_id", u."id"
  FROM "users" u
  LEFT JOIN sizes s ON s.scope_id = u."scope_id"
  WHERE u."scope_id" IS NOT NULL AND coalesce(s.n, 0) <= 1
  UNION
  SELECT coalesce(single.scope_id, u."scope_id"), u."id"
  FROM "users" u
  JOIN sizes s ON s.scope_id = u."scope_id" AND s.n > 1
  JOIN "_CompanyToScope" cs ON cs."B" = u."scope_id"
  LEFT JOIN single ON single.company_id = cs."A"
  ON CONFLICT DO NOTHING;

  -- The single-scope check and column (its index and foreign key go with it).
  ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_client_scope_check";
  ALTER TABLE "users" DROP COLUMN "scope_id";

  -- Scopes of several companies that nobody holds any more (Both).
  DELETE FROM "scopes" sc
  WHERE (SELECT count(*) FROM "_CompanyToScope" cs WHERE cs."B" = sc."id") > 1
    AND NOT EXISTS (SELECT 1 FROM "_ScopeToUser" su WHERE su."A" = sc."id");
END $$;
