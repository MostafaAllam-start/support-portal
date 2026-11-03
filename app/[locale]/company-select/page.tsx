import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { scopeService, userService } from "@/services";
import {
  brandScope,
  hasDashboardAccess,
  switchableScopes,
} from "@/lib/auth/guards";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Logo } from "@/components/logo";
import { CompanySelectForm } from "./_components/company-select-form";

export default async function CompanySelectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Anyone (including anonymous visitors) reaches this entry step, where they
  // choose their scope. Dashboard users skip it; if one is already chosen move on.
  const user = await userService.currentUser();
  if (user && hasDashboardAccess(user)) redirect({ href: "/dashboard", locale });
  if ((await brandScope()) != null) redirect({ href: "/", locale });

  const t = await getTranslations("CompanySelect");
  // A signed-in client picks one of their scopes.
  const scopes = switchableScopes(user, await scopeService.list());

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Logo imageClassName="h-9" />
        <div className="ms-auto flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12">
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <CompanySelectForm
          scopes={scopes.map((scope) => ({
            id: scope.id,
            name: scope.name,
            logo: scope.logo,
          }))}
        />
      </main>
    </div>
  );
}
