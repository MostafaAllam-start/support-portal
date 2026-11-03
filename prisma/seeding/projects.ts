import type {
  Company,
  PrismaClient,
  Project,
  Role,
  User,
} from "../../app/generated/prisma/client";
import type { RoleName } from "./roles";

// Seeds a few projects: two under CTC (the project-scoped company) and one under
// ECM. The CTC projects get a manager and a set of members (reviewers and
// consultants) via the users_projects join. Returns the projects keyed by name.
export async function seedProjects(
  prisma: PrismaClient,
  companies: Record<string, Company>,
  users: Record<string, User>,
  roles: Record<RoleName, Role>,
): Promise<Record<string, Project>> {
  const specs = [
    {
      key: "sap-implementation",
      name: "SAP Implementation",
      location: "Riyadh",
      company: companies.ctc,
      managerUsername: "manager1",
      // Project members: each user assigned with a per-project role.
      members: [
        { username: "reviewer1", role: "reviewer" as RoleName },
        { username: "consultant1", role: "sap-consultant" as RoleName },
        { username: "engineer1", role: "software-engineer" as RoleName },
      ],
    },
    {
      key: "sap-support",
      name: "SAP Support",
      location: "Jeddah",
      company: companies.ctc,
      managerUsername: "manager1",
      members: [{ username: "consultant1", role: "sap-consultant" as RoleName }],
    },
    {
      key: "ecm-platform",
      name: "ECM Platform",
      location: "Amman",
      company: companies["ecm+"],
      managerUsername: undefined,
      // An ECM+ reviewer: sees every ECM+ ticket (they carry no project).
      members: [{ username: "reviewer2", role: "reviewer" as RoleName }],
    },
  ];

  const created: Record<string, Project> = {};

  for (const spec of specs) {
    if (!spec.company) continue;
    const managerId = spec.managerUsername
      ? (users[spec.managerUsername]?.id ?? null)
      : null;

    // No unique constraint on (name, companyId), so find-or-create to stay idempotent.
    const existing = await prisma.project.findFirst({
      where: { name: spec.name, companyId: spec.company.id },
    });
    const project = existing
      ? await prisma.project.update({
          where: { id: existing.id },
          data: { location: spec.location, managerId },
        })
      : await prisma.project.create({
          data: {
            name: spec.name,
            location: spec.location,
            companyId: spec.company.id,
            managerId,
          },
        });
    created[spec.key] = project;

    // Assign members (idempotent upsert on the composite key).
    for (const member of spec.members) {
      const user = users[member.username];
      if (!user) continue;
      await prisma.userProject.upsert({
        where: {
          userId_projectId: { userId: user.id, projectId: project.id },
        },
        create: {
          userId: user.id,
          projectId: project.id,
          roleId: roles[member.role].id,
        },
        update: { roleId: roles[member.role].id },
      });
    }
  }

  console.log(
    `✓ Seeded ${Object.keys(created).length} projects with managers and members.`,
  );
  return created;
}
