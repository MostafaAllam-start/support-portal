import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { companyService, userService } from "@/services";
import { brandCompanyId } from "@/lib/auth/guards";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { CompanySwitcher } from "@/components/company-switcher";
import { MySuggestionsLink } from "@/components/my-suggestions-link";
import type { BrandKey } from "@/lib/companies";

export async function LandingHeader({ brand }: { brand: BrandKey }) {
  const t = await getTranslations("Landing");
  // Signed-in "user" visitors (privileged roles are redirected to the dashboard
  // before reaching the landing page) get a link to their tickets instead of the
  // sign-in CTA.
  const me = await userService.currentUser();
  const companies = await companyService.list();
  const currentCompanyId = await brandCompanyId();
  const nav = [
    { href: "#about", label: t("nav.about") },
    { href: "#team", label: t("nav.team") },
    { href: "#partners", label: t("nav.partners") },
    { href: "#contact", label: t("nav.contact") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Logo imageClassName="h-7" brand={brand} />
        <nav className="ms-6 hidden items-center gap-6 text-sm md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-2">
          <CompanySwitcher
            companies={companies.map((c) => ({ id: c.id, name: c.name }))}
            currentCompanyId={currentCompanyId}
          />
          <ThemeToggle />
          <LocaleSwitcher />
          {me ? (
            <>
              <MySuggestionsLink />
              <Button asChild size="sm">
                <Link href="/tickets">{t("cta.myTickets")}</Link>
              </Button>
              <UserMenu
                name={me.name}
                username={me.username}
                image={me.image}
              />
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">{t("cta.signIn")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
