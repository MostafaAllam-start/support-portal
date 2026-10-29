import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { userService } from "@/services";
import { Button } from "@/components/ui/button";
import type { BrandKey } from "@/lib/companies";

export async function LandingHero({ brand }: { brand: BrandKey }) {
  const t = await getTranslations("Landing");
  // Signed-in visitors don't need the "sign in" / "contact us" CTAs.
  const me = await userService.currentUser();

  return (
    <section className="relative overflow-hidden border-b">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
      <div className="pointer-events-none absolute -top-32 start-1/2 -z-10 size-[36rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center md:py-32">
        <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          {t(`${brand}.heroTitle`)}
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground text-pretty">
          {t(`${brand}.heroSubtitle`)}
        </p>
        {!me && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">{t("hero.primary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#contact">{t("hero.secondary")}</a>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
