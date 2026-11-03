import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { scopeService, userService } from "@/services";
import type { AuthUser, ScopeWithCompanies, TicketScope } from "@/services";
import { ProjectRole, UserRole } from "@/lib/auth/roles";
import { getSelectedScopeIdFromCookie } from "@/lib/scope-selection";

// The seeded default admin (same env fallback the seeder uses). This account's
// type is locked — it must always remain an admin so the system can't be left
// without one.
export const DEFAULT_ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";

// Full ticket management: create, edit, delete. Managers and admins only —
// reviewers may assign, reply, and change status but not edit ticket content.
const TICKET_MANAGERS = ["admin", "manager"] as const;

// Roles that may assign a ticket to engineers or consultants.
const TICKET_ASSIGNERS = ["admin", "manager", "reviewer"] as const;

// Roles that may change a ticket's workflow status (open / in progress / closed).
const TICKET_STATUS_EDITORS = ["admin", "manager", "reviewer"] as const;


// Whether a user may open the staff dashboard: every account type except client.
export function hasDashboardAccess(user: { role: UserRole }): boolean {
  return user.role !== UserRole.client;
}

// The ids of the projects a manager manages: the projects they are set as
// manager of, plus any where they hold the "manager" project role.
export function managedProjectIds(user: AuthUser): number[] {
  return [
    ...new Set([
      ...user.managedProjects.map((project) => project.id),
      ...user.memberships
        .filter((membership) => membership.roleName === ProjectRole.Manager)
        .map((membership) => membership.projectId),
    ]),
  ];
}

// The companies of the projects a manager manages (for company-wide items, such
// as a suggestion not tied to a project).
export function managedCompanyIds(user: AuthUser): number[] {
  return [
    ...new Set([
      ...user.managedProjects.map((project) => project.companyId),
      ...user.memberships
        .filter((membership) => membership.roleName === ProjectRole.Manager)
        .map((membership) => membership.companyId),
    ]),
  ];
}

// The companies a user works with: their scopes' companies (CTC, ECM or both),
// falling back to their main company when they have no scope.
export function scopeCompanyIds(user: AuthUser): number[] {
  if (user.scopeCompanyIds.length > 0) return user.scopeCompanyIds;
  return user.companyId != null ? [user.companyId] : [];
}

// The scopes a visitor may choose between: a signed-in client's own, or every scope
// for anyone else (anonymous visitors pick freely).
export function switchableScopes<T extends { id: number }>(
  user: AuthUser | null,
  scopes: T[],
): T[] {
  if (!user || hasDashboardAccess(user) || user.scopeIds.length === 0) return scopes;
  return scopes.filter((scope) => user.scopeIds.includes(scope.id));
}

// The scope a visitor is browsing as: the one they picked (kept in a cookie), as
// long as it is theirs to pick. Without that, a signed-in user gets the scope of
// their company, and a client failing that their first scope. Null if there's none.
export async function brandScope(): Promise<ScopeWithCompanies | null> {
  const user = await userService.currentUser();
  const pickedId = await getSelectedScopeIdFromCookie();
  const picked = pickedId != null ? await scopeService.findById(pickedId) : null;
  if (picked && switchableScopes(user, [picked]).length > 0) return picked;
  if (!user) return null;

  const scopes = switchableScopes(user, await scopeService.list());
  const ofCompany = scopes.find((scope) =>
    scope.companies.some((company) => company.id === user.companyId),
  );
  if (ofCompany) return ofCompany;
  return hasDashboardAccess(user) ? null : (scopes[0] ?? null);
}

export async function brandScopeId(): Promise<number | null> {
  return (await brandScope())?.id ?? null;
}

// The company a public surface works with: a signed-in user's company takes
// precedence, otherwise the first company of the scope picked into the cookie.
// Null if none.
export async function brandCompanyId(): Promise<number | null> {
  const user = await userService.currentUser();
  if (user?.companyId) return user.companyId;
  return (await brandScope())?.companies[0]?.id ?? null;
}

// Entry gate for the public surfaces (landing + auth): an anonymous visitor must
// pick a scope first. Signed-in users pass through (their scope is handled by
// requireUser / login).
export async function requireScopeSelection(): Promise<void> {
  const user = await userService.currentUser();
  if (user) return;
  if ((await brandScope()) == null) {
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

// The tickets a dashboard user works, used for the ticket list, the KPIs and the
// detail-page check alike:
// - admin: every ticket
// - manager: tickets in the projects they manage
// - reviewer: every ticket of the companies in their scopes (ECM tickets carry
//   no project)
// - SAP consultant: every ticket of the companies in their scopes, plus any
//   assigned to them
// - software engineer: the tickets assigned to them, in any company
// - anyone else: none
export function ticketScopeForUser(user: AuthUser): TicketScope {
  switch (user.effectiveRole) {
    case "admin":
      return { kind: "all" };
    case ProjectRole.Manager:
      return { kind: "filter", projectIds: managedProjectIds(user) };
    case ProjectRole.Reviewer:
      return {
        kind: "filter",
        companyIds: scopeCompanyIds(user),
      };
    case ProjectRole.SapConsultant:
      return {
        kind: "filter",
        companyIds: scopeCompanyIds(user),
        assigneeId: user.id,
      };
    case ProjectRole.SoftwareEngineer:
      return { kind: "filter", assigneeId: user.id };
    default:
      return { kind: "filter" };
  }
}

type ScopedTicket = {
  projectId: number | null;
  companyId: number | null;
  assignees: { assignee: { id: number } }[];
};

// Whether one ticket falls inside a scope: the in-memory mirror of the ticket
// service's query filter.
export function ticketInScope(scope: TicketScope, ticket: ScopedTicket): boolean {
  if (scope.kind === "all") return true;
  if (
    ticket.projectId != null &&
    scope.projectIds?.includes(ticket.projectId)
  ) {
    return true;
  }
  if (
    ticket.companyId != null &&
    scope.companyIds?.includes(ticket.companyId)
  ) {
    return true;
  }
  return (
    scope.assigneeId !== undefined &&
    ticket.assignees.some((assignee) => assignee.assignee.id === scope.assigneeId)
  );
}

// Whether a dashboard user may open a ticket detail page.
export function canAccessDashboardTicket(
  user: AuthUser,
  ticket: ScopedTicket,
): boolean {
  return ticketInScope(ticketScopeForUser(user), ticket);
}

function isAssigned(user: AuthUser, ticket: ScopedTicket): boolean {
  return ticket.assignees.some((assignee) => assignee.assignee.id === user.id);
}

// Whether a user may post replies on a ticket. Engineers and consultants may
// only add reports on assigned tickets — not conversation replies.
export function canReplyToTicket(
  user: AuthUser,
  ticket: ScopedTicket & { userId: number },
): boolean {
  const role = user.effectiveRole;
  if (role === ProjectRole.SapConsultant || role === ProjectRole.SoftwareEngineer) {
    return false;
  }
  if (ticket.userId === user.id) return true;
  if (role === "admin" || role === ProjectRole.Manager || role === ProjectRole.Reviewer) {
    return canAccessDashboardTicket(user, ticket);
  }
  return false;
}

// Manager or admin may reply to a complaint on a ticket.
export function canReplyToComplaint(
  user: AuthUser,
  ticket: { projectId: number | null },
): boolean {
  if (user.effectiveRole === "admin") return true;
  if (user.effectiveRole === ProjectRole.Manager) {
    return (
      ticket.projectId != null &&
      managedProjectIds(user).includes(ticket.projectId)
    );
  }
  return false;
}

// Reviewer, manager, admin (within their scope), or an assigned engineer or
// consultant may reply on a report.
export function canReplyToReport(user: AuthUser, ticket: ScopedTicket): boolean {
  const role = user.effectiveRole;
  if (role === ProjectRole.SapConsultant || role === ProjectRole.SoftwareEngineer) {
    return isAssigned(user, ticket);
  }
  if (role === "admin" || role === ProjectRole.Manager || role === ProjectRole.Reviewer) {
    return canAccessDashboardTicket(user, ticket);
  }
  return false;
}

// A team member with the support option: they work the branding-site requests.
export function isSupport(user: { role: UserRole; isSupport: boolean }): boolean {
  return user.role === UserRole.team_member && user.isSupport;
}

// Who works the branding-site requests: admins, project managers, and support
// team members.
export function canWorkRequests(user: AuthUser): boolean {
  return (
    user.effectiveRole === "admin" ||
    user.effectiveRole === ProjectRole.Manager ||
    isSupport(user)
  );
}

// Where a dashboard user lands when they open /dashboard: a support team member
// without a project role starts on the requests, everyone else on the KPIs.
export function dashboardHomeHref(user: AuthUser): string {
  return isSupport(user) && user.effectiveRole === "team-member"
    ? "/dashboard/requests"
    : "/dashboard/kpis";
}

// Gate for the dashboard shell itself (layout, notifications, own settings):
// anonymous -> /login, client -> landing, any other account type -> returns the
// authenticated user. `redirect()` throws, so the
// trailing throw is unreachable — it only satisfies the return type.
export async function requireDashboardAccess(): Promise<AuthUser> {
  const user = await userService.currentUser();
  if (user && hasDashboardAccess(user)) {
    return user;
  }
  const locale = await getLocale();
  redirect({ href: user ? "/" : "/login", locale });
  throw new Error("unreachable");
}

// Gate for the staff dashboard surfaces (KPIs, tickets, …). Call at the top of
// dashboard server components and actions.
export async function requireDashboardUser(): Promise<AuthUser> {
  return requireDashboardAccess();
}

// Gate for the Requests page and its actions (see canWorkRequests). Anyone else
// is sent to their dashboard home.
export async function requireRequestsAccess(): Promise<AuthUser> {
  const user = await requireDashboardAccess();
  if (canWorkRequests(user)) return user;
  redirect({ href: "/dashboard", locale: await getLocale() });
  throw new Error("unreachable");
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

// Gate for the client surface (e.g. /tickets): anonymous -> /login, staff ->
// their dashboard, client -> returns the user.
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
  // A client must pick their company (ECM/CTC) before using the surface.
  if (user.companyId == null) {
    redirect({ href: "/company-select", locale });
    throw new Error("unreachable");
  }
  return user;
}

// Page-level gate for routes restricted to specific roles (e.g. admin-only),
// matched against the account type or the effective role. Anyone else is sent
// to their dashboard home.
export async function requireRole(...roles: string[]): Promise<AuthUser> {
  const user = await requireDashboardAccess();
  if (roles.includes(user.role) || roles.includes(user.effectiveRole)) {
    return user;
  }
  redirect({ href: "/dashboard", locale: await getLocale() });
  throw new Error("unreachable");
}
