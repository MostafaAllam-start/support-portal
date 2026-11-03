"use client";

import {
  BarChart3,
  Building2,
  ClipboardList,
  Contact,
  FolderKanban,
  Handshake,
  Inbox,
  Layers,
  Lightbulb,
  LogOut,
  MessageSquareWarning,
  Settings,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { logoutAction } from "../actions";

type NavItem = { href: string; key: string; icon: LucideIcon };

// Sidebar sections per effective role (account type, or a team member's project
// role). Each list matches what the pages let that role open; a support team
// member also gets the Requests page (see REQUESTS_ITEM).
const NAV: Record<string, NavItem[]> = {
  admin: [
    { href: "/dashboard/kpis", key: "kpis", icon: BarChart3 },
    { href: "/dashboard/companies", key: "companies", icon: Building2 },
    { href: "/dashboard/scopes", key: "scopes", icon: Layers },
    { href: "/dashboard/projects", key: "projects", icon: FolderKanban },
    { href: "/dashboard/users", key: "users", icon: Users },
    { href: "/dashboard/issues", key: "issues", icon: Inbox },
    {
      href: "/dashboard/complaints",
      key: "complaints",
      icon: MessageSquareWarning,
    },
    { href: "/dashboard/suggestions", key: "suggestions", icon: Lightbulb },
    { href: "/dashboard/requests", key: "requests", icon: ClipboardList },
    { href: "/dashboard/team-members", key: "teamMembers", icon: Contact },
    { href: "/dashboard/partners", key: "partners", icon: Handshake },
  ],
  // Engineers work the tickets assigned to them, in any company.
  "software-engineer": [
    { href: "/dashboard/kpis", key: "kpis", icon: BarChart3 },
    { href: "/dashboard/tickets", key: "myTickets", icon: Ticket },
  ],
  // Reviewers see every ticket of their company.
  reviewer: [
    { href: "/dashboard/kpis", key: "kpis", icon: BarChart3 },
    { href: "/dashboard/tickets", key: "companyTickets", icon: Ticket },
  ],
  // Consultants see their company's tickets and add diagnostic reports to the
  // ones assigned to them (no management actions).
  "sap-consultant": [
    { href: "/dashboard/kpis", key: "kpis", icon: BarChart3 },
    { href: "/dashboard/tickets", key: "companyTickets", icon: Ticket },
  ],
  // Managers run their projects: tickets, complaints, suggestions, and the
  // branding-site requests.
  manager: [
    { href: "/dashboard/kpis", key: "kpis", icon: BarChart3 },
    { href: "/dashboard/tickets", key: "projectTickets", icon: Ticket },
    {
      href: "/dashboard/complaints",
      key: "complaints",
      icon: MessageSquareWarning,
    },
    { href: "/dashboard/suggestions", key: "suggestions", icon: Lightbulb },
    { href: "/dashboard/requests", key: "requests", icon: ClipboardList },
  ],
  // A team member without a project role yet.
  "team-member": [{ href: "/dashboard/kpis", key: "kpis", icon: BarChart3 }],
};

const REQUESTS_ITEM: NavItem = {
  href: "/dashboard/requests",
  key: "requests",
  icon: ClipboardList,
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardSidebar({
  role,
  showsRequests = false,
  user,
  side = "left",
}: {
  role: string;
  // Whether the user works the branding-site requests (admins, managers, support).
  showsRequests?: boolean;
  user: { name: string; username: string; image: string | null };
  side?: "left" | "right";
}) {
  const t = useTranslations("Dashboard");
  const pathname = usePathname();
  const base = NAV[role] ?? [];
  const items =
    showsRequests && !base.some((item) => item.href === REQUESTS_ITEM.href)
      ? [...base, REQUESTS_ITEM]
      : base;

  return (
    <Sidebar side={side}>
      <SidebarHeader className="items-center p-3">
        {role === "admin" ? (
          // Admins oversee every company, so show both brands instead of a
          // single-company logo (and no company switcher).
          <div className="flex items-center gap-3">
            <Logo brand="ctc" imageClassName="h-10" />
            <span aria-hidden className="h-10 w-px bg-border" />
            <Logo brand="ecm" imageClassName="h-10" />
          </div>
        ) : (
          <Logo imageClassName="h-12" />
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{t(`nav.${item.key}`)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg">
                  <Avatar className="size-8 rounded-md">
                    {user.image && (
                      <AvatarImage
                        src={user.image}
                        alt={user.name}
                        className="rounded-md object-cover"
                      />
                    )}
                    <AvatarFallback className="rounded-md text-xs">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-start text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user.username}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
              >
                <DropdownMenuLabel>{t("account")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings">
                    <Settings className="size-4" />
                    {t("settings")}
                  </Link>
                </DropdownMenuItem>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <LogOut className="size-4" />
                    {t("logout")}
                  </button>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
