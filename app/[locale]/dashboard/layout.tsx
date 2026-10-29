import { setRequestLocale } from "next-intl/server";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { isSystemSupport, requireDashboardAccess } from "@/lib/auth/guards";
import { notificationService } from "@/services";
import { DashboardSidebar } from "./_components/dashboard-sidebar";
import {
  NotificationBell,
  type NotificationItem,
} from "./_components/notification-bell";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireDashboardAccess();

  // The sidebar is pinned with physical left/right, which don't flip under
  // dir="rtl", so place it on the right for the RTL (Arabic) locale.
  const side = locale === "ar" ? "right" : "left";

  const [notifications, unreadCount] = await Promise.all([
    notificationService.listForUser(user.id, { limit: 5 }),
    notificationService.unreadCount(user.id),
  ]);

  const notificationItems: NotificationItem[] = notifications
    .filter(
      (item): item is typeof item & { entityType: NonNullable<typeof item.entityType>; entityId: number } =>
        item.entityType != null && item.entityId != null,
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      details: item.details,
      createdAt: item.createdAt.toISOString().slice(0, 10),
      entityType: item.entityType,
      entityId: item.entityId,
      isRead: item.isRead,
    }));

  const notificationsHref = user.isAdmin
    ? "/dashboard/issues"
    : isSystemSupport(user)
      ? "/dashboard/requests"
      : "/dashboard/tickets";

  return (
    <SidebarProvider>
      <DashboardSidebar
        role={user.role.name}
        side={side}
        user={{ name: user.name, username: user.username, image: user.image }}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <div className="ms-auto flex items-center gap-2">
            <NotificationBell
              notifications={notificationItems}
              unreadCount={unreadCount}
              viewAllHref={notificationsHref}
            />
            <ThemeToggle />
            <LocaleSwitcher />
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
