import type { AuthUser } from "@/services";
import { managedCompanyIds, managedProjectIds } from "@/lib/auth/guards";

// Who may open a suggestion's detail page and take part in its conversation:
// its author (a client reads/replies on their own suggestion), any admin, a
// manager/member of the project the suggestion is scoped to, or — for a
// company-wide suggestion (no project) — a manager of a project in that company.
// Shared by the detail pages and the suggestion reply server actions so the page
// gate and the action gate can never drift apart.
export function canAccessSuggestion(
  user: AuthUser,
  suggestion: {
    createdById: number;
    companyId: number | null;
    project: { id: number } | null;
  },
): boolean {
  if (suggestion.createdById === user.id) return true;
  if (user.effectiveRole === "admin") return true;
  if (suggestion.project == null) {
    return (
      suggestion.companyId != null &&
      managedCompanyIds(user).includes(suggestion.companyId)
    );
  }
  const projectIds = new Set([
    ...managedProjectIds(user),
    ...user.memberships.map((membership) => membership.projectId),
  ]);
  return projectIds.has(suggestion.project.id);
}
