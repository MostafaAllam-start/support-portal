import type { Company, PrismaClient } from "../../app/generated/prisma/client";

// The two companies in the system. ECM+ keeps the original behavior; CTC is the
// primary, project-scoped company (SAP project support). Logos point at assets in
// public/. Idempotent on the company name.
const COMPANIES = [
  { name: "ECM+", logo: "/logo-filled.png", websiteUrl: "https://ecm.example.com" },
  { name: "CTC", logo: "/CTC.webp", websiteUrl: "https://ctc.example.com" },
] as const;

// Seeds ECM+ and CTC and returns them keyed by name (lowercased) so other seeders
// can look up the company they need.
export async function seedCompanies(
  prisma: PrismaClient,
): Promise<Record<string, Company>> {
  const created: Record<string, Company> = {};

  for (const spec of COMPANIES) {
    // No unique constraint on name, so find-or-create by name to stay idempotent.
    const existing = await prisma.company.findFirst({ where: { name: spec.name } });
    created[spec.name.toLowerCase()] = existing
      ? await prisma.company.update({
          where: { id: existing.id },
          data: { logo: spec.logo, websiteUrl: spec.websiteUrl },
        })
      : await prisma.company.create({ data: spec });
  }

  console.log(`✓ Seeded ${COMPANIES.length} companies: ECM+, CTC`);
  return created;
}
