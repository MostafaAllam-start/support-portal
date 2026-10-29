import type { PrismaClient } from "../../app/generated/prisma/client";

// Demo requests as if sent from the branding site's "Request a demo" form, so the
// system-support Requests page has data. Skips seeding if any requests exist.
const REQUESTS = [
  {
    name: "Layla Haddad",
    email: "layla.haddad@example.org",
    organization: "Northwind Municipality",
    modules: ["documents", "correspondence"],
    message:
      "We are a new client and need support portal accounts for our records team (about 12 people).",
    locale: "en",
  },
  {
    name: "Omar Al-Khatib",
    email: "omar.khatib@example.org",
    organization: "Globex Health",
    modules: ["processes", "meetings"],
    message: "Looking for a demo of approval workflows. We currently use paper forms.",
    locale: "en",
  },
  {
    name: "نورة السالم",
    email: "noura.salem@example.org",
    organization: "هيئة المثال",
    modules: ["correspondence"],
    message: "نرغب في عرض تجريبي لنظام المراسلات الرسمية.",
    locale: "ar",
  },
];

export async function seedSiteRequests(prisma: PrismaClient): Promise<void> {
  if ((await prisma.siteRequest.count()) > 0) {
    console.log("✓ Site requests already present; skipped.");
    return;
  }
  await prisma.siteRequest.createMany({ data: REQUESTS });
  console.log(`✓ Seeded ${REQUESTS.length} sample site requests.`);
}
