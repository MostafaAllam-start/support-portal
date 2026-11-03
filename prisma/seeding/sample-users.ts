import bcrypt from "bcryptjs";
import type {
  Company,
  PrismaClient,
  Scope,
  User,
} from "../../app/generated/prisma/client";
import type { UserRole } from "../../app/generated/prisma/enums";

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
  featured?: boolean;
  // The account type. Team members get their project roles from the project
  // seeder.
  role: UserRole;
  // A team member who works the branding-site requests.
  support?: boolean;
  // The user's main company (matches a key in the companies map).
  company?: "ECM+" | "CTC";
  // The companies they work with (default scope names); team members and
  // clients only.
  scopes?: ("CTC" | "ECM+")[];
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
    featured: true,
    role: "team_member",
    company: "CTC",
    // Engineers work ECM and SAP tickets alike.
    scopes: ["CTC", "ECM+"],
  },
  {
    name: "Erin Engineer",
    username: "engineer2",
    email: "engineer2@example.com",
    jobTitle: "Software Engineer",
    website: "https://erinengineer.dev",
    whatsapp: "+962790000012",
    role: "team_member",
    company: "CTC",
    scopes: ["CTC"],
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
    featured: true,
    role: "team_member",
    company: "CTC",
    scopes: ["CTC"],
  },
  {
    name: "Cara Consultant",
    username: "consultant1",
    email: "consultant1@example.com",
    jobTitle: "SAP Consultant",
    whatsapp: "+962790000041",
    featured: true,
    role: "team_member",
    company: "CTC",
    scopes: ["CTC"],
  },
  {
    name: "Mark Manager",
    username: "manager1",
    email: "manager1@example.com",
    jobTitle: "Project Manager",
    whatsapp: "+962790000051",
    contactCard: true,
    featured: true,
    role: "team_member",
    company: "CTC",
    scopes: ["CTC"],
  },
  {
    name: "Rami Reviewer",
    username: "reviewer2",
    email: "reviewer2@example.com",
    jobTitle: "QA Reviewer",
    role: "team_member",
    company: "ECM+",
    scopes: ["ECM+"],
  },
  {
    name: "Sara Support",
    username: "support1",
    email: "support1@example.com",
    jobTitle: "System Support",
    role: "team_member",
    support: true,
    company: "ECM+",
    scopes: ["ECM+"],
  },
  {
    name: "Uma User",
    username: "user1",
    email: "user1@example.com",
    whatsapp: "+962790000031",
    linkedin: "https://www.linkedin.com/in/uma-user",
    role: "client",
    company: "CTC",
    scopes: ["CTC"],
  },
  {
    name: "Sam Sample",
    username: "user2",
    email: "user2@example.com",
    website: "https://samsample.example.com",
    role: "client",
    company: "ECM+",
    // A client of both companies: switches between them in the header.
    scopes: ["CTC", "ECM+"],
  },
];

// Seeds demo accounts so the dashboard has data. All share the same dev password.
// Staff are team members whose project roles the project seeder grants
// (engineers/reviewers/consultants become project members; managers are set as
// the project's manager); user1/user2 are clients with no membership. Idempotent on `username`. `companies` maps company name (lowercased)
// -> Company, used to set each user's company so seeded accounts skip the
// company-select step.
export async function seedSampleUsers(
  prisma: PrismaClient,
  companies: Record<string, Company>,
  scopes: Record<string, Scope>,
): Promise<Record<string, User>> {
  const passwordHash = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
  const created: Record<string, User> = {};

  for (const spec of SAMPLES) {
    const companyId = spec.company
      ? (companies[spec.company.toLowerCase()]?.id ?? null)
      : null;
    const scopeIds = (spec.scopes ?? [])
      .map((name) => scopes[name.toLowerCase()]?.id)
      .filter((id): id is number => id != null);
    created[spec.username] = await prisma.user.upsert({
      where: { username: spec.username },
      // Backfill the contact fields on existing rows too, so re-seeding an older
      // database populates the columns added later.
      update: {
        website: spec.website ?? null,
        whatsapp: spec.whatsapp ?? null,
        linkedin: spec.linkedin ?? null,
        hasContactInfoCard: spec.contactCard ?? false,
        isFeatured: spec.featured ?? false,
        role: spec.role,
        isSupport: spec.support ?? false,
        companyId,
        scopes: { set: scopeIds.map((id) => ({ id })) },
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
        isFeatured: spec.featured ?? false,
        role: spec.role,
        isSupport: spec.support ?? false,
        companyId,
        scopes: { connect: scopeIds.map((id) => ({ id })) },
      },
    });
  }

  console.log(
    `✓ Seeded ${SAMPLES.length} sample users (password "${PASSWORD}"): ${SAMPLES.map((s) => s.username).join(", ")}`,
  );
  return created;
}
