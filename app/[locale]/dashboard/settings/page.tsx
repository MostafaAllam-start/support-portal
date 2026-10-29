import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireDashboardAccess } from "@/lib/auth/guards";
import { ProfileForm } from "../../profile/_components/profile-form";
import { toProfileValues } from "../../profile/profile-values";

// Account settings for every dashboard user (system support included): the same
// form customers get on /profile, inside the dashboard shell.
export default async function DashboardSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireDashboardAccess();
  const t = await getTranslations("Profile");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <ProfileForm user={toProfileValues(user)} />
    </div>
  );
}
