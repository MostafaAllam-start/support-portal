import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { companyService, userService } from "@/services";
import {
  brandCompanyId,
  brandScope,
  hasDashboardAccess,
} from "@/lib/auth/guards";
import { brandKeyForCompany } from "@/lib/companies";
import { LandingHeader } from "./_components/landing/landing-header";
import { LandingHero } from "./_components/landing/landing-hero";
import { LandingAbout } from "./_components/landing/landing-about";
import { LandingTeam } from "./_components/landing/landing-team";
import { Suspense } from "react";
import { PartnersSkeleton } from "@/components/page-skeletons";
import { LandingPartners } from "./_components/landing/landing-partners";
import { LandingContact } from "./_components/landing/landing-contact";
import { LandingFooter } from "./_components/landing/landing-footer";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Users with dashboard access get the dashboard; anonymous visitors and plain
  // customers see the public landing page.
  const user = await userService.currentUser();
  if (user && hasDashboardAccess(user)) {
    redirect({ href: "/dashboard", locale });
  }


  // Brand the landing for the selected scope and its company (the user's company,
  // else the scope's first).
  const scope = await brandScope();
  const companyId = await brandCompanyId();
  const company = companyId ? await companyService.findById(companyId) : null;
  const brand = brandKeyForCompany(company?.name);

  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader brand={brand} />
      <main className="flex-1">
        <LandingHero brand={brand} />
        <LandingAbout brand={brand} />
        <LandingTeam brand={brand} companyId={companyId} />
        <Suspense fallback={<section id="partners" className="scroll-mt-16 border-b py-20"><PartnersSkeleton /></section>}>
          <LandingPartners brand={brand} scopeId={scope?.id ?? null} />
        </Suspense>
        <LandingContact />
      </main>
      <LandingFooter brand={brand} logo={scope?.logo} logoAlt={scope?.name} />
    </div>
  );
}
