import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireDashboardUser, ticketScopeForUser } from "@/lib/auth/guards";
import { ticketService } from "@/services";
import { KpiCards } from "../_components/kpi-cards";
import { KpiProjectBreakdown } from "../_components/kpi-project-breakdown";
import { KpiStatusChart } from "../_components/kpi-status-chart";
import { KpiTrendChart } from "../_components/kpi-trend-chart";

export default async function KpisPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireDashboardUser();
  const t = await getTranslations("Dashboard");

  const scope = ticketScopeForUser(user);
  const isGlobal = user.effectiveRole === "admin";
  const [stats, trend, projectGroups] = await Promise.all([
    ticketService.stats(scope),
    ticketService.createdTrend(scope, 30),
    ticketService.statsByCompanyAndProject(scope),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("kpis.title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("kpis.subtitle")}</p>
      </div>
      <KpiCards stats={stats} />
      <div className="grid gap-4 lg:grid-cols-3">
        <KpiStatusChart stats={stats} isGlobal={isGlobal} />
        <div className="lg:col-span-2">
          <KpiTrendChart data={trend} isGlobal={isGlobal} />
        </div>
      </div>
      <KpiProjectBreakdown groups={projectGroups} isGlobal={isGlobal} />
    </div>
  );
}
