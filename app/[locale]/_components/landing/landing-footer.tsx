import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import type { BrandKey } from "@/lib/companies";

export async function LandingFooter({
  brand,
  logo,
  logoAlt,
}: {
  brand: BrandKey;
  logo?: string | null;
  logoAlt?: string;
}) {
  const t = await getTranslations("Landing");

  return (
    <footer className="border-t py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:text-start">
        <div className="flex items-center gap-3">
          <Logo imageClassName="h-6" brand={brand} src={logo} alt={logoAlt} />
          <span className="text-sm text-muted-foreground">
            {t(`${brand}.footerTagline`)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(`${brand}.footerRights`)}
        </p>
      </div>
    </footer>
  );
}
