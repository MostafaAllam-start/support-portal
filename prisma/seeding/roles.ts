import type { PrismaClient, Role } from "../../app/generated/prisma/client";

// The roles that can be granted to a team member within a project (via
// UserProject). The account type (admin, support, team member, client) is the
// User.role enum, not a row here.
export const ROLE_NAMES = [
  "software-engineer",
  "reviewer",
  "sap-consultant",
  "manager",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

// Legacy role names that were renamed; mapped to their current name so existing
// databases migrate in place (preserving the role id and all FK references)
// instead of leaving an orphaned row behind.
const RENAMED_ROLES: Record<string, RoleName> = {
  engineer: "software-engineer",
};

// Upserts every role (idempotent on the unique `name`) and returns them keyed by
// name so other seeders can look up the role they need.
export async function seedRoles(
  prisma: PrismaClient,
): Promise<Record<RoleName, Role>> {
  // Rename legacy roles before upserting. Done in place so users still pointing
  // at the old role keep their assignment. Skipped if the new name already
  // exists (a prior run migrated it) to avoid a unique-constraint clash.
  for (const [oldName, newName] of Object.entries(RENAMED_ROLES)) {
    const [legacy, current] = await Promise.all([
      prisma.role.findUnique({ where: { name: oldName } }),
      prisma.role.findUnique({ where: { name: newName } }),
    ]);
    if (legacy && !current) {
      await prisma.role.update({
        where: { name: oldName },
        data: { name: newName },
      });
      console.log(`• Renamed role "${oldName}" → "${newName}".`);
    }
  }

  const roles = await Promise.all(
    ROLE_NAMES.map((name) =>
      prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ),
  );

  console.log(`✓ Seeded ${roles.length} roles: ${ROLE_NAMES.join(", ")}`);

  return Object.fromEntries(roles.map((role) => [role.name, role])) as Record<
    RoleName,
    Role
  >;
}
