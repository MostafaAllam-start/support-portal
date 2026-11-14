import { getTranslations } from "next-intl/server";
import { partnerService } from "@/services";
import { Card, CardContent } from "@/components/ui/card";
import type { BrandKey } from "@/lib/companies";

export async function LandingPartners({
  brand,
  scopeId,
}: {
  brand: BrandKey;
  scopeId: number | null;
}) {
  const t = await getTranslations("Landing");
  // The partners of the scope being browsed (those of its companies).
  const partners = scopeId ? await partnerService.forScope(scopeId) : [];

  return (
    <section id="partners" className="scroll-mt-16 border-b py-20">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          {t("partners.title")}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t(`${brand}.partnersSubtitle`)}
        </p>

        {partners.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            {t("partners.empty")}
          </p>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {partners.map((partner) => (
              <Card key={partner.id} className="text-start">
                <CardContent className="flex items-start gap-4 pt-6">
                  {/* Plain <img> so any logo URL works without next/image config. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={partner.logo}
                    alt={partner.name}
                    className="h-12 w-12 shrink-0 rounded-md object-contain"
                  />
                  <div className="min-w-0">
                    <div className="font-medium">{partner.name}</div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {partner.details}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
