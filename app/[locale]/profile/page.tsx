import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { hasDashboardAccess, requireSignedInUser } from "@/lib/auth/guards";
import { TicketsHeader } from "../tickets/_components/tickets-header";
import { ProfileForm } from "./_components/profile-form";
import { toProfileValues } from "./profile-values";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireSignedInUser();
  // Staff (system support included) manage their account inside the dashboard.
  if (hasDashboardAccess(user)) {
    redirect({ href: "/dashboard/settings", locale });
  }
  const t = await getTranslations("Profile");

  return (
    <div className="flex min-h-dvh flex-col">
      <TicketsHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ProfileForm user={toProfileValues(user)} />
      </main>
    </div>
  );
}
