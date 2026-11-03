import type { Company, PrismaClient, Scope } from "../../app/generated/prisma/client";

// The default scopes, one per company; a user who works with both companies
// holds both. Created once, when there are none, so an admin can rename or
// change them afterwards without the seed bringing them back.
const DEFAULTS = [
  { name: "CTC", logo: "/CTC.webp", companies: ["ctc"] },
  { name: "ECM+", logo: "/logo-filled.png", companies: ["ecm+"] },
] as const;

// Seeds the default scopes and gives every team member and client who has none
// (accounts from before scopes existed) the scope of their company, then makes
// the database require a scope on every client. Returns the scopes keyed by
// name (lowercased) for the sample-user seeder.
export async function seedScopes(
  prisma: PrismaClient,
  companies: Record<string, Company>,
): Promise<Record<string, Scope>> {
  if ((await prisma.scope.count()) === 0) {
    for (const spec of DEFAULTS) {
      const ids = spec.companies
        .map((key) => companies[key]?.id)
        .filter((id): id is number => id != null);
      await prisma.scope.create({
        data: {
          name: spec.name,
          logo: spec.logo,
          companies: { connect: ids.map((id) => ({ id })) },
        },
      });
    }
    console.log(`✓ Seeded ${DEFAULTS.length} scopes: CTC, ECM+`);
  }

  const scopes = await prisma.scope.findMany({
    include: { companies: { select: { id: true } } },
    orderBy: { id: "asc" },
  });

  // Per company, the smallest scope holding it: the scope of just that company
  // when there is one.
  const companyScope = new Map<number, number>();
  const bySize = [...scopes].sort(
    (a, b) => a.companies.length - b.companies.length || a.id - b.id,
  );
  for (const scope of bySize) {
    for (const { id } of scope.companies) {
      if (!companyScope.has(id)) companyScope.set(id, scope.id);
    }
  }

  const unscoped = await prisma.user.findMany({
    where: {
      scopes: { none: {} },
      role: { in: ["team_member", "client"] },
      companyId: { not: null },
    },
    select: { id: true, companyId: true },
  });
  let backfilled = 0;
  for (const user of unscoped) {
    const scopeId = companyScope.get(user.companyId!);
    if (scopeId == null) continue;
    await prisma.user.update({
      where: { id: user.id },
      data: { scopes: { connect: { id: scopeId } } },
    });
    backfilled++;
  }
  if (backfilled > 0) {
    console.log(`✓ Gave ${backfilled} existing users the scope of their company.`);
  }

  await requireClientScope(prisma);

  return Object.fromEntries(
    scopes.map(({ companies: _companies, ...scope }) => [
      scope.name.toLowerCase(),
      scope,
    ]),
  );
}

// Every live client must hold at least one scope (CTC, ECM, …). The Prisma
// schema can't express a rule across the _ScopeToUser join table, so it's a
// pair of deferred constraint triggers, checked when the transaction commits
// (creating a client and linking their scopes is one transaction). `db push`
// leaves functions and triggers alone. They are added once no live client is
// left without a scope; until then the seed warns on every start.
async function requireClientScope(prisma: PrismaClient) {
  const missing = await prisma.user.count({
    where: { role: "client", deletedAt: null, scopes: { none: {} } },
  });
  if (missing > 0) {
    console.warn(
      `⚠ ${missing} client(s) have no scope. Give each one a scope on Dashboard → Users; the database will then require it.`,
    );
    return;
  }
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION "users_client_scope_check"() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      checked_id integer;
    BEGIN
      IF TG_TABLE_NAME = 'users' THEN
        checked_id := NEW."id";
      ELSE
        checked_id := OLD."B";
      END IF;
      IF EXISTS (
        SELECT 1 FROM "users" u
        WHERE u."id" = checked_id AND u."role" = 'client' AND u."deleted_at" IS NULL
      ) AND NOT EXISTS (
        SELECT 1 FROM "_ScopeToUser" su WHERE su."B" = checked_id
      ) THEN
        RAISE EXCEPTION 'A client needs at least one scope (user %)', checked_id
          USING ERRCODE = 'check_violation';
      END IF;
      RETURN NULL;
    END $$;
  `);
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_client_scope') THEN
        CREATE CONSTRAINT TRIGGER "users_client_scope"
          AFTER INSERT OR UPDATE OF "role", "deleted_at" ON "users"
          DEFERRABLE INITIALLY DEFERRED
          FOR EACH ROW EXECUTE FUNCTION "users_client_scope_check"();
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'scope_users_client_scope') THEN
        CREATE CONSTRAINT TRIGGER "scope_users_client_scope"
          AFTER UPDATE OR DELETE ON "_ScopeToUser"
          DEFERRABLE INITIALLY DEFERRED
          FOR EACH ROW EXECUTE FUNCTION "users_client_scope_check"();
      END IF;
    END $$;
  `);
}
