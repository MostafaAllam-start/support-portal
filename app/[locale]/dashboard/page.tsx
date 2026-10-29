import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { dashboardHomeHref, requireDashboardAccess } from "@/lib/auth/guards";

// Every role's first screen is the KPIs overview, except system support, whose
// whole dashboard is the requests list.
export default async function DashboardIndex() {
  const user = await requireDashboardAccess();
  redirect({ href: dashboardHomeHref(user), locale: await getLocale() });
}
