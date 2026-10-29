import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { projectService, userService } from "@/services";
import type { AuthUser, TicketScope } from "@/services";
import { UserRole } from "@/lib/auth/roles";
import { getSelectedCompanyIdFromCookie } from "@/lib/company-selection";

// The seeded default admin (same env fallback the seeder uses). This account's
// role is locked — it must always remain an admin so the system can't be left
// without one.
export const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";

// Full ticket management: create, edit, delete. Managers and admins only —
// reviewers may assign, reply, and change status but not edit ticket content.
const TICKET_MANAGERS = ["admin", "manager"] as const;

// Roles that may assign a ticket to engineers or consultants.
const TICKET_ASSIGNERS = ["admin", "manager", "reviewer"] as const;

// Roles that may change a ticket's workflow status (open / in progress / closed).
const TICKET_STATUS_EDITORS = ["admin", "manager", "reviewer"] as const;

// Whether a user may open the staff dashboard (vs. the public/customer surface).
// Admins always can; everyone else can if they are explicitly granted
// dashboard access or they are assigned a role on any project.
export function canViewDashboard(user: {
  isAdmin: boolean;
  canAccessDashboard: boolean;
}): boolean {
  return user.isAdmin || user.canAccessDashboard;
}

export function hasDashboardAccess(user: {
  isAdmin: boolean;
  canAccessDashboard: boolean;
}): boolean {
  return canViewDashboard(user);
}

// The ids of the projects a manager manages, used to scope their dashboard views
// (tickets/complaints) to just those projects.
export function managedProjectIds(user: AuthUser): Promise<number[]> {
  return projectService.managedBy(user.id);
}

// The company whose brand a public surface should use: a signed-in user's company
// takes precedence, otherwise the company picked into the cookie. Null if none.
export async function brandCompanyId(): Promise<number | null> {
  const user = await userService.currentUser();
  if (user?.companyId) return user.companyId;
  return getSelectedCompanyIdFromCookie();
}

// Entry gate for the public surfaces (landing + auth): an anonymous visitor must
// pick a company first. Signed-in users pass through (their company is handled by
// requireUser / login).
export async function requireCompanySelection(): Promise<void> {
  const user = await userService.currentUser();
  if (user) return;
  const cookieId = await getSelectedCompanyIdFromCookie();
  if (cookieId == null) {
    redirect({ href: "/company-select", locale: await getLocale() });
  }
}

// Whether a role may fully manage tickets (create/edit/delete/close). Used to
// gate UI; matching server actions re-check with requireRole("admin", "manager").
export function canManageTickets(role: string): boolean {
  return (TICKET_MANAGERS as readonly string[]).includes(role);
}

// Whether a role may assign tickets to engineers or consultants.
export function canAssignTickets(role: string): boolean {
  return (TICKET_ASSIGNERS as readonly string[]).includes(role);
}

// Whether a role may change ticket status (open / in progress / closed).
export function canChangeTicketStatus(role: string): boolean {
  return (TICKET_STATUS_EDITORS as readonly string[]).includes(role);
}

// Project ids from the user's memberships (any project role).
export function memberProjectIds(user: AuthUser): number[] {
  return [...new Set(user.memberships.map((membership) => membership.projectId))];
}

// Every project a dashboard user may see KPIs/tickets for: managed + member projects.
export function accessibleProjectIds(user: AuthUser): number[] {
  return [
    ...new Set([...user.managedProjectIds, ...memberProjectIds(user)]),
  ];
}

// Ticket KPI scope: admins see the whole system; everyone else is limited to
// tickets in projects they manage or belong to.
export function ticketScopeForUser(user: AuthUser): TicketScope {
  if (user.userRole === UserRole.Admin) {
    return { kind: "all" };
  }
  return { kind: "projects", projectIds: accessibleProjectIds(user) };
}

// Whether a dashboard user may open a ticket detail page.
export async function canAccessDashboardTicket(
  user: AuthUser,
  ticket: {
    projectId: number | null;
    assignees: { assignee: { id: number } }[];
  },
): Promise<boolean> {
  const role = user.role.name;
  if (role === "admin") return true;
  if (role === "software-engineer" || role === "sap-consultant") {
    return ticket.assignees.some((assignee) => assignee.assignee.id === user.id);
  }
  if (role === "manager") {
    if (ticket.projectId == null) return false;
    const ids = await managedProjectIds(user);
    return ids.includes(ticket.projectId);
  }
  if (role === "reviewer") {
    if (ticket.projectId == null) return false;
    return memberProjectIds(user).includes(ticket.projectId);
  }
  return false;
}

// Whether a user may post replies on a ticket. Engineers and consultants may
// only add reports on assigned tickets — not conversation replies.
export async function canReplyToTicket(
  user: AuthUser,
  ticket: {
    userId: number;
    projectId: number | null;
    assignees: { assignee: { id: number } }[];
  },
): Promise<boolean> {
  if (
    user.role.name === "sap-consultant" ||
    user.role.name === "software-engineer"
  ) {
    return false;
  }
  if (ticket.userId === user.id) return true;
  if (user.role.name === "admin") return true;
  if (user.role.name === "manager") {
    if (ticket.projectId == null) return false;
    const ids = await managedProjectIds(user);
    return ids.includes(ticket.projectId);
  }
  if (user.role.name === "reviewer") {
    if (ticket.projectId == null) return false;
    return memberProjectIds(user).includes(ticket.projectId);
  }
  return false;
}

// Manager or admin may reply to a complaint on a ticket.
export async function canReplyToComplaint(
  user: AuthUser,
  ticket: { projectId: number | null },
): Promise<boolean> {
  if (user.role.name === "admin") return true;
  if (user.role.name === "manager") {
    if (ticket.projectId == null) return false;
    const ids = await managedProjectIds(user);
    return ids.includes(ticket.projectId);
  }
  return false;
}

// Reviewer, manager, admin, or assigned engineer/consultant may reply on a report.
export async function canReplyToReport(
  user: AuthUser,
  ticket: {
    projectId: number | null;
    assignees: { assignee: { id: number } }[];
  },
): Promise<boolean> {
  if (user.role.name === "admin") return true;
  if (user.role.name === "manager") {
    if (ticket.projectId == null) return false;
    const ids = await managedProjectIds(user);
    return ids.includes(ticket.projectId);
  }
  if (user.role.name === "reviewer") {
    if (ticket.projectId == null) return false;
    return memberProjectIds(user).includes(ticket.projectId);
  }
  if (
    user.role.name === "software-engineer" ||
    user.role.name === "sap-consultant"
  ) {
    return ticket.assignees.some((assignee) => assignee.assignee.id === user.id);
  }
  return false;
}

// System support only works the branding-site requests; every other dashboard
// surface sends them back to that page.
export function isSystemSupport(user: AuthUser): boolean {
  return user.role.name === UserRole.SystemSupport;
}

// Where a dashboard user lands when they open /dashboard.
export function dashboardHomeHref(user: AuthUser): string {
  return isSystemSupport(user) ? "/dashboard/requests" : "/dashboard/kpis";
}

// Gate for the dashboard shell itself (layout, notifications, own settings):
// anonymous -> /login, plain "user" -> landing, anyone with dashboard access
// (system support included) -> returns the authenticated user. `redirect()`
// throws, so the trailing throw is unreachable — it only satisfies the return type.
export async function requireDashboardAccess(): Promise<AuthUser> {
  const user = await userService.currentUser();
  if (user && hasDashboardAccess(user)) {
    return user;
  }
  const locale = await getLocale();
  redirect({ href: user ? "/" : "/login", locale });
  throw new Error("unreachable");
}

// Gate for the staff dashboard surfaces (KPIs, tickets, …). Like
// requireDashboardAccess, but system support is sent to the requests page. Call
// at the top of dashboard server components and actions.
export async function requireDashboardUser(): Promise<AuthUser> {
  const user = await requireDashboardAccess();
  if (isSystemSupport(user)) {
    redirect({ href: "/dashboard/requests", locale: await getLocale() });
    throw new Error("unreachable");
  }
  return user;
}

// Gate for pages any signed-in user may open, whatever their role (their own
// account settings): anonymous -> /login, otherwise returns the user.
export async function requireSignedInUser(): Promise<AuthUser> {
  const user = await userService.currentUser();
  if (!user) {
    redirect({ href: "/login", locale: await getLocale() });
    throw new Error("unreachable");
  }
  return user;
}

// Gate for the authenticated "user" surface (e.g. /tickets): anonymous -> /login,
// privileged roles -> their dashboard, plain "user" -> returns the user.
export async function requireUser(): Promise<AuthUser> {
  const user = await userService.currentUser();
  const locale = await getLocale();
  if (!user) {
    redirect({ href: "/login", locale });
    throw new Error("unreachable");
  }
  if (hasDashboardAccess(user)) {
    redirect({ href: "/dashboard", locale });
    throw new Error("unreachable");
  }
  // A plain "user" must pick their company (ECM/CTC) before using the surface.
  if (user.companyId == null) {
    redirect({ href: "/company-select", locale });
    throw new Error("unreachable");
  }
  return user;
}

// Page-level gate for routes restricted to specific roles (e.g. admin-only).
// Anyone else is sent to their dashboard home.
export async function requireRole(...roles: string[]): Promise<AuthUser> {
  const user = await requireDashboardAccess();
  if (roles.includes(user.userRole) || roles.includes(user.role.name)) {
    return user;
  }
  redirect({ href: "/dashboard", locale: await getLocale() });
  throw new Error("unreachable");
}
