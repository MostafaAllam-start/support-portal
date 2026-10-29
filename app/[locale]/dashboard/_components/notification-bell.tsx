"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { useSocketNotification } from "@/hooks/useSocketNotification";
import {
  Bell,
  ClipboardList,
  Lightbulb,
  MessageSquareWarning,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { markNotificationReadAction } from "../notification-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { notificationHref } from "@/lib/notifications";
import type { NotificationEntityType } from "@/services";

export type NotificationItem = {
  id: number;
  title: string;
  details?: string;
  createdAt: string; // YYYY-MM-DD
  isRead: boolean;
  // The record this notification points at, used to deep-link to its detail page.
  entityType: NotificationEntityType;
  entityId: number;
};

// Each notification points at a kind of record (its entityType); show a matching
// icon before the title so the type is recognizable at a glance. Falls back to a
// generic bell for any future/unknown type.
const NOTIFICATION_ICONS: Record<
  NotificationEntityType,
  { Icon: LucideIcon; className: string }
> = {
  ticket: { Icon: Ticket, className: "text-blue-500" },
  suggestion: { Icon: Lightbulb, className: "text-amber-500" },
  complaint: { Icon: MessageSquareWarning, className: "text-destructive" },
  site_request: { Icon: ClipboardList, className: "text-emerald-600" },
};

function NotificationIcon({
  entityType,
}: {
  entityType: NotificationEntityType;
}) {
  const { Icon, className } = NOTIFICATION_ICONS[entityType] ?? {
    Icon: Bell,
    className: "text-muted-foreground",
  };
  return <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-hidden />;
}

// Bell button in the dashboard header. Clicking it opens a dropdown listing the
// most recent items; the count badge shows how many are unseen this session.
function NotificationLink({
  item,
  href,
  children,
}: {
  item: NotificationItem;
  href: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      className={cn(!item.isRead && "bg-accent/40")}
      onClick={(event) => {
        event.preventDefault();
        void (async () => {
          if (!item.isRead) {
            await markNotificationReadAction(item.id);
          }
          router.push(href);
        })();
      }}
    >
      {children}
    </Link>
  );
}

export function NotificationBell({
  notifications,
  unreadCount,
  viewAllHref,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
  viewAllHref: string;
}) {
  const t = useTranslations("Dashboard");
  const [localNotifications, setLocalNotifications] = useState<NotificationItem[]>(notifications);
  const [localUnreadCount, setLocalUnreadCount] = useState<number>(unreadCount);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    setLocalNotifications(notifications);
    setLocalUnreadCount(unreadCount);
  }, [notifications, unreadCount]);

  const handleNewNotification = useCallback((n: any) => {
    if (localNotifications.some((item) => item.id === n.id)) return;

    const newItem: NotificationItem = {
      id: n.id,
      title: n.title,
      details: n.details || undefined,
      createdAt: new Date(n.createdAt).toISOString().slice(0, 10),
      isRead: n.isRead,
      entityType: n.entityType,
      entityId: n.entityId,
    };

    setLocalNotifications((prev) => {
      const updated = [newItem, ...prev];
      return updated.slice(0, 5);
    });
    setLocalUnreadCount((prev) => prev + 1);

    setShouldAnimate(true);
    setTimeout(() => setShouldAnimate(false), 800);

    toast.success(n.title, {
      description: n.details || undefined,
    });
  }, [localNotifications]);

  useSocketNotification(handleNewNotification);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn("relative transition-all duration-300", shouldAnimate && "animate-ring-bell")}
          aria-label={t("notifications.title")}
        >
          <Bell className="size-4" />
          {localUnreadCount > 0 && (
            <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] leading-none font-medium text-primary-foreground">
              {localUnreadCount > 9 ? "9+" : localUnreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t("notifications.title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {localNotifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t("notifications.empty")}
          </p>
        ) : (
          <>
            {localNotifications.map((item) => {
              const href =
                notificationHref(item.entityType, item.entityId) ?? viewAllHref;
              return (
                <DropdownMenuItem
                  key={item.id}
                  asChild
                  className={cn(!item.isRead && "bg-accent/40")}
                >
                  <NotificationLink item={item} href={href}>
                    <div className="flex w-full min-w-0 items-start gap-2">
                      <NotificationIcon entityType={item.entityType} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={cn(
                            "truncate",
                            !item.isRead && "font-semibold",
                          )}
                        >
                          {item.title}
                        </span>
                        {item.details && (
                          <span className="line-clamp-2 text-xs text-muted-foreground">
                            {item.details}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {item.createdAt}
                        </span>
                      </div>
                    </div>
                  </NotificationLink>
                </DropdownMenuItem>
              );
            })}
            {/* <DropdownMenuSeparator /> */}
            {/* <DropdownMenuItem asChild>
              <Link
                href={viewAllHref}
                className="justify-center font-medium text-primary"
              >
                {t("notifications.viewAll")}
              </Link>
            </DropdownMenuItem> */}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
