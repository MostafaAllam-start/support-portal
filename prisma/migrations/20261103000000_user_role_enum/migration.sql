-- Replaces the is_admin / is_system_support / can_access_dashboard flags with one
-- "role" column (UserRole enum: admin, team_member, client) plus an is_support
-- option on team members, and renames the landing-page "Our Team" flag
-- is_team_member to is_featured so it no longer reads like the team_member role.
--
-- Written to be safe to run more than once and on any database state: the Docker
-- entrypoints run it with `prisma db execute` before `prisma db push`, so an
-- existing database keeps its users' access instead of `db push` dropping the old
-- columns. On a fresh database (no "users" table yet) it does nothing and
-- `db push` creates the schema. A database upgraded while "support" was still its
-- own account type is converted too.

DO $$
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_support" BOOLEAN NOT NULL DEFAULT false;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN
    CREATE TYPE "UserRole" AS ENUM ('admin', 'team_member', 'client');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'role'
  ) THEN
    ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'client';

    -- Most privileged first; each later step only touches rows still 'client'.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_admin'
    ) THEN
      UPDATE "users" SET "role" = 'admin' WHERE "is_admin" = true;
    END IF;

    -- System support is now a team member with the support option.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_system_support'
    ) THEN
      UPDATE "users" SET "role" = 'team_member', "is_support" = true
      WHERE "role" = 'client' AND "is_system_support" = true;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'can_access_dashboard'
    ) THEN
      UPDATE "users" SET "role" = 'team_member'
      WHERE "role" = 'client' AND "can_access_dashboard" = true;
    END IF;

    -- Anyone holding a project role or managing a project is staff.
    UPDATE "users" u SET "role" = 'team_member'
    WHERE u."role" = 'client' AND (
      EXISTS (SELECT 1 FROM "users_projects" up WHERE up."user_id" = u."id")
      OR EXISTS (SELECT 1 FROM "projects" p WHERE p."manager_id" = u."id")
    );
  END IF;

  -- "support" used to be its own account type: move those users to team members
  -- with the support option, then rebuild the enum without the value.
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'UserRole' AND e.enumlabel = 'support'
  ) THEN
    UPDATE "users" SET "is_support" = true, "role" = 'team_member'
    WHERE "role"::text = 'support';
    ALTER TYPE "UserRole" RENAME TO "UserRole_old";
    CREATE TYPE "UserRole" AS ENUM ('admin', 'team_member', 'client');
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "UserRole" USING "role"::text::"UserRole";
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'client';
    DROP TYPE "UserRole_old";
  END IF;

  ALTER TABLE "users" DROP COLUMN IF EXISTS "is_admin";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "is_system_support";
  ALTER TABLE "users" DROP COLUMN IF EXISTS "can_access_dashboard";

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'is_team_member'
  ) THEN
    ALTER TABLE "users" RENAME COLUMN "is_team_member" TO "is_featured";
  END IF;

  CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
END $$;
