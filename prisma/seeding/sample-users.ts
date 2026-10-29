import bcrypt from "bcryptjs";
import type {
  Company,
  PrismaClient,
  User,
} from "../../app/generated/prisma/client";

const BCRYPT_ROUNDS = 12;
const PASSWORD = "Password@123";

type SampleSpec = {
  name: string;
  username: string;
  email: string;
  jobTitle?: string;
  website?: string;
  whatsapp?: string;
  linkedin?: string;
  // Whether this user has a public /contact-info card (defaults to false).
  contactCard?: boolean;
  // Whether this user is featured on their company's landing-page team.
  teamMember?: boolean;
  // Whether this user can open the staff dashboard (staff = true; the plain
  // customer accounts default to false).
  canAccessDashboard?: boolean;
  // Whether this user is system support (works the branding-site requests).
  systemSupport?: boolean;
  // The company this user belongs to (matches a key in the companies map).
  company?: "ECM" | "CTC";
};

const SAMPLES: SampleSpec[] = [
  {
    name: "Evan Engineer",
    username: "engineer1",
    email: "engineer1@example.com",
    jobTitle: "Software Engineer",
    website: "https://evanengineer.dev",
    whatsapp: "+962790000011",
    linkedin: "https://www.linkedin.com/in/evan-engineer",
    contactCard: true,
    teamMember: true,
    canAccessDashboard: true,
    company: "CTC",
  },
  {
    name: "Erin Engineer",
    username: "engineer2",
    email: "engineer2@example.com",
    jobTitle: "Software Engineer",
    website: "https://erinengineer.dev",
    whatsapp: "+962790000012",
    canAccessDashboard: true,
    company: "CTC",
  },
  {
    name: "Rana Reviewer",
    username: "reviewer1",
    email: "reviewer1@example.com",
    jobTitle: "QA Reviewer",
    website: "https://ranareviewer.dev",
    whatsapp: "+962790000021",
    linkedin: "https://www.linkedin.com/in/rana-reviewer",
    contactCard: true,
    teamMember: true,
    canAccessDashboard: true,
    company: "CTC",
  },
  {
    name: "Cara Consultant",
    username: "consultant1",
    email: "consultant1@example.com",
    jobTitle: "SAP Consultant",
    whatsapp: "+962790000041",
    teamMember: true,
    canAccessDashboard: true,
    company: "CTC",
  },
  {
    name: "Mark Manager",
    username: "manager1",
    email: "manager1@example.com",
    jobTitle: "Project Manager",
    whatsapp: "+962790000051",
    contactCard: true,
    teamMember: true,
    canAccessDashboard: true,
    company: "CTC",
  },
  {
    name: "Sara Support",
    username: "support1",
    email: "support1@example.com",
    jobTitle: "System Support",
    systemSupport: true,
    company: "ECM",
  },
  {
    name: "Uma User",
    username: "user1",
    email: "user1@example.com",
    whatsapp: "+962790000031",
    linkedin: "https://www.linkedin.com/in/uma-user",
    company: "CTC",
  },
  {
    name: "Sam Sample",
    username: "user2",
    email: "user2@example.com",
    website: "https://samsample.example.com",
    teamMember: true,
    company: "ECM",
  },
];

// Seeds demo accounts so the dashboard has data. All share the same dev password.
// Roles are no longer global: the project seeder grants them per-project
// (engineers/reviewers/consultants become project members; managers are set as
// the project's manager), and user1/user2 stay plain customers with no
// membership. Idempotent on `username`. `companies` maps company name (lowercased)
// -> Company, used to set each user's company so seeded accounts skip the
// company-select step.
export async function seedSampleUsers(
  prisma: PrismaClient,
  companies: Record<string, Company>,
): Promise<Record<string, User>> {
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
  const created: Record<string, User> = {};

  for (const spec of SAMPLES) {
    const companyId = spec.company
      ? (companies[spec.company.toLowerCase()]?.id ?? null)
      : null;
    created[spec.username] = await prisma.user.upsert({
      where: { username: spec.username },
      // Backfill the contact fields on existing rows too, so re-seeding an older
      // database populates the columns added later.
      update: {
        website: spec.website ?? null,
        whatsapp: spec.whatsapp ?? null,
        linkedin: spec.linkedin ?? null,
        hasContactInfoCard: spec.contactCard ?? false,
        isTeamMember: spec.teamMember ?? false,
        canAccessDashboard: spec.canAccessDashboard ?? false,
        isSystemSupport: spec.systemSupport ?? false,
        companyId,
      },
      create: {
        name: spec.name,
        username: spec.username,
        email: spec.email,
        password: passwordHash,
        jobTitle: spec.jobTitle,
        website: spec.website,
        whatsapp: spec.whatsapp,
        linkedin: spec.linkedin,
        hasContactInfoCard: spec.contactCard ?? false,
        isTeamMember: spec.teamMember ?? false,
        canAccessDashboard: spec.canAccessDashboard ?? false,
        isSystemSupport: spec.systemSupport ?? false,
        companyId,
      },
    });
  }

  console.log(
    `✓ Seeded ${SAMPLES.length} sample users (password "${PASSWORD}"): ${SAMPLES.map((s) => s.username).join(", ")}`,
  );
  return created;
}
