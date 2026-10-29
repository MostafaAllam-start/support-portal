import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/lib/auth/roles";
import { siteRequestService } from "@/services";
import { RequestsTable } from "./_components/requests-table";

// Every "Request a demo" submission from the branding site, for system support
// (and admins) to follow up. `?id=` (from a notification) opens that request.
export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(UserRole.SystemSupport, UserRole.Admin);
  const t = await getTranslations("Dashboard.requests");

  const [requests, { id }] = await Promise.all([
    siteRequestService.list(),
    searchParams,
  ]);
  const openId = Number(id);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>

      <RequestsTable
        initialOpenId={Number.isInteger(openId) && openId > 0 ? openId : null}
        requests={requests.map((request) => ({
          id: request.id,
          name: request.name,
          email: request.email,
          organization: request.organization,
          modules: request.modules,
          message: request.message,
          locale: request.locale,
          status: request.status,
          createdAt: request.createdAt.toISOString(),
          adminNotifiedAt: request.adminNotifiedAt?.toISOString() ?? null,
          adminNotifiedBy: request.adminNotifiedBy?.name ?? null,
        }))}
      />
    </div>
  );
}
