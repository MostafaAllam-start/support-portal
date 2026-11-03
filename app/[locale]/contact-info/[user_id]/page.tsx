import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { userService } from "@/services";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { type ContactCard } from "../_components/contact-card";
import { ContactCardExperience } from "../_components/contact-card-experience";

// Deduped so generateMetadata and the page share a single DB read per request.
const getContact = cache((id: number) => userService.contactCard(id));

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; user_id: string }>;
}): Promise<Metadata> {
  const { user_id } = await params;
  const id = parseId(user_id);
  if (id === null) return {};
  const contact = await getContact(id);
  if (!contact) return {};
  return {
    title: `${contact.name} · ECM+ Support`,
    description: contact.jobTitle ?? undefined,
  };
}

export default async function ContactInfoPage({
  params,
}: {
  params: Promise<{ locale: string; user_id: string }>;
}) {
  const { locale, user_id } = await params;
  setRequestLocale(locale);

  const id = parseId(user_id);
  if (id === null) notFound();

  const user = await getContact(id);
  if (!user) notFound();

  const t = await getTranslations("ContactCard");

  const firstCompany = user.projectMemberships[0]?.project.company ?? null;
  const card: ContactCard = {
    id: user.id,
    name: user.name,
    position: user.jobTitle || "",
    image: user.image || "",
    email: user.email,
    jobTitle: user.jobTitle,
    website: user.website,
    whatsapp: user.whatsapp,
    linkedin: user.linkedin,
    company: firstCompany
      ? {
          name: firstCompany.name,
          logo: firstCompany.logo,
          websiteUrl: firstCompany.websiteUrl,
        }
      : null,
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-gradient-to-b from-background to-muted/40 md:h-dvh md:overflow-hidden">
      {/* Decorative, theme-aware background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 start-1/2 size-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl rtl:translate-x-1/2" />
        <div className="absolute bottom-0 end-0 size-64 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="z-10 flex shrink-0 items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/#team"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          {t("card.back")}
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </header>

      <main className="z-10 flex flex-1 items-center justify-center px-4 py-8 md:min-h-0 md:overflow-y-auto">
        <ContactCardExperience contact={card} />
      </main>

      {/* Animated footer (the original's decorative reveal, via tw-animate-css) */}
      <footer className="z-10 shrink-0 px-6 py-8">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="h-px w-12 animate-in fade-in fill-mode-both bg-gradient-to-r from-transparent to-primary/40 delay-300 duration-700" />
            <span className="flex size-8 animate-in fade-in zoom-in-50 spin-in-90 fill-mode-both items-center justify-center rounded-full bg-primary/10 duration-1000">
              <span className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-[9px] font-bold text-primary-foreground">
                ECM
              </span>
            </span>
            <span className="h-px w-12 animate-in fade-in fill-mode-both bg-gradient-to-l from-transparent to-primary/40 delay-300 duration-700" />
          </div>
          <p className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both text-center text-sm text-muted-foreground delay-500 duration-700">
            {t("footer.poweredBy")}{" "}
            <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text font-semibold text-transparent">
              {t("footer.team")}
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
