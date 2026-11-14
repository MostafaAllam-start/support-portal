import type { PrismaClient, Scope } from "../../app/generated/prisma/client";

// The partners shown on the landing "Partners" section of the ECM+ scope. Logos are
// served from public/partners. Each partner is linked to the ECM+ scope, and the
// landing page reads a scope's partners from the scope itself. Seeded by
// name, so re-running the seed neither duplicates them nor undoes an admin's edits to
// a partner's logo or details.
const PARTNERS = [
  {
    name: "CTC MENA",
    logo: "/partners/ctc.png",
    details: "Exclusive agent of ECM+ in the Middle East and North Africa, and responsible for its Arabic localization.",
  },
  {
    name: "SPI Digital UK",
    logo: "/partners/spi-digital.png",
    details: "Technology partner behind the ECM+ platform.",
  },
  {
    name: "CMZ (Content Management Zone)",
    logo: "/partners/cmz.png",
    details: "Content management partner.",
  },
  {
    name: "Electrical Transmission & Distribution Partnership",
    logo: "/partners/etdp.png",
    details: "Industry partner for the electrical transmission and distribution sector.",
  },
  {
    name: "SAP",
    logo: "/partners/sap.svg",
    details: "ERP partner: ECM+ exchanges data with SAP as workflows run.",
  },
  {
    name: "Odoo",
    logo: "/partners/odoo.svg",
    details: "ERP partner: ECM+ exchanges data with Odoo as workflows run.",
  },
] as const;

// Demo partners from earlier versions of the seed (placeholder logos). They are
// removed when they are still untouched, so the ECM+ scope shows only real partners.
const DEMO_PARTNERS = ["Northwind", "Acme Corp", "Globex", "Initech", "Umbrella", "Soylent"];

export async function seedPartners(
  prisma: PrismaClient,
  scopes: Record<string, Scope>,
): Promise<void> {
  const ecm = scopes["ecm+"];
  if (!ecm) {
    console.log("• ECM+ scope not found; skipping partner seed.");
    return;
  }

  const removed = await prisma.partner.deleteMany({
    where: { name: { in: DEMO_PARTNERS }, logo: { startsWith: "https://placehold.co/" } },
  });

  let created = 0;
  for (const partner of PARTNERS) {
    const existing = await prisma.partner.findFirst({
      where: { name: partner.name },
      select: { id: true },
    });
    if (existing) {
      // Make sure it is shown on the ECM+ scope, without touching its other scopes.
      await prisma.partner.update({
        where: { id: existing.id },
        data: { scopes: { connect: { id: ecm.id } } },
      });
      continue;
    }
    await prisma.partner.create({
      data: { ...partner, scopes: { connect: { id: ecm.id } } },
    });
    created++;
  }

  console.log(
    `✓ Partners: ${created} created for the ECM+ scope, ${PARTNERS.length - created} already present` +
      (removed.count ? `, ${removed.count} demo partners removed.` : "."),
  );
}
