import type { Company, PrismaClient } from "../../app/generated/prisma/client";

// Demo partners shown on the landing "Partners" section. Logos point at a
// placeholder image service — swap for real logo URLs/paths later. Each partner
// is associated with one or both companies (many-to-many) so the landing page
// can show the right partners per brand. Skips seeding if any partners exist.
const PARTNERS = [
  {
    name: "Northwind",
    logo: "https://placehold.co/240x120?text=Northwind",
    details: "Document management integrations for the enterprise.",
    companyKeys: ["ecm+", "ctc"],
  },
  {
    name: "Acme Corp",
    logo: "https://placehold.co/240x120?text=Acme+Corp",
    details: "Workflow automation and approval pipelines.",
    companyKeys: ["ctc"],
  },
  {
    name: "Globex",
    logo: "https://placehold.co/240x120?text=Globex",
    details: "Secure cloud storage and content delivery.",
    companyKeys: ["ecm+"],
  },
  {
    name: "Initech",
    logo: "https://placehold.co/240x120?text=Initech",
    details: "Reporting and analytics for support teams.",
    companyKeys: ["ctc"],
  },
  {
    name: "Umbrella",
    logo: "https://placehold.co/240x120?text=Umbrella",
    details: "Identity and single sign-on services.",
    companyKeys: ["ecm+", "ctc"],
  },
  {
    name: "Soylent",
    logo: "https://placehold.co/240x120?text=Soylent",
    details: "Full-text search and indexing infrastructure.",
    companyKeys: ["ctc"],
  },
];

export async function seedPartners(
  prisma: PrismaClient,
  companies: Record<string, Company>,
): Promise<void> {
  const existing = await prisma.partner.count();
  if (existing > 0) {
    console.log(`• Partners already present (${existing}); skipping partner seed.`);
    return;
  }

  for (const { companyKeys, ...partner } of PARTNERS) {
    const connect = companyKeys
      .map((key) => companies[key])
      .filter((company): company is Company => Boolean(company))
      .map((company) => ({ id: company.id }));

    await prisma.partner.create({
      data: { ...partner, companies: { connect } },
    });
  }

  console.log(`✓ Seeded ${PARTNERS.length} partners.`);
}
