import { getTranslations } from "next-intl/server";
import { userService } from "@/services";
import type { BrandKey } from "@/lib/companies";
import { type ContactCard } from "../../contact-info/_components/contact-card";
import { TeamMemberCard, type TeamContact } from "./team-member-card";

export async function LandingTeam({
  brand,
  companyId,
}: {
  brand: BrandKey;
  companyId: number | null;
}) {
  const t = await getTranslations("Landing");
  // The users featured as team members for the company being branded. No company
  // resolved (shouldn't happen — the landing is gated) means no members.
  const members = companyId
    ? await userService.featuredForCompany(companyId)
    : [];

  // For each member, the always-shown display info and — only when the user opted
  // in (hasContactInfoCard) — a full contact object that powers the click-to-open
  // contact modal.
  const cards = members.map((user) => {
    const display: TeamContact = {
      id: user.id,
      name: user.name,
      position: user.jobTitle ?? "",
      image: user.image ?? "",
    };
    const contact: ContactCard | null = user.hasContactInfoCard
      ? {
          id: user.id,
          name: user.name,
          position: user.jobTitle ?? "",
          image: user.image ?? "",
          email: user.email,
          jobTitle: user.jobTitle,
          website: user.website,
          whatsapp: user.whatsapp,
          linkedin: user.linkedin,
          company: user.company
            ? {
                name: user.company.name,
                logo: user.company.logo,
                websiteUrl: user.company.websiteUrl,
              }
            : null,
        }
      : null;
    return { display, contact };
  });

  return (
    <section id="team" className="scroll-mt-16 border-b py-20">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight">
            {t("team.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t(`${brand}.teamSubtitle`)}
          </p>
        </div>

        {cards.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            {t("team.empty")}
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ display, contact }) => (
              <TeamMemberCard
                key={display.id}
                member={display}
                contact={contact}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
