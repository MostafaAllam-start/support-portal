import { scopeService, userService } from "@/services";
import { hasDashboardAccess, switchableScopes } from "@/lib/auth/guards";
import { setSelectedScopeCookie } from "@/lib/scope-selection";

// Records a visitor's choice of scope: in a cookie, so the public surfaces follow
// it before login, and for a signed-in client on their account too, which keeps a
// company of that scope (the one their new tickets go to). Staff accounts are left
// untouched. Must be called from a Server Action. Returns false when the scope
// doesn't exist or isn't theirs to choose.
export async function chooseScope(scopeId: number): Promise<boolean> {
  if (!Number.isInteger(scopeId) || scopeId <= 0) return false;
  const scope = await scopeService.findById(scopeId);
  if (!scope) return false;

  const user = await userService.currentUser();
  if (switchableScopes(user, [scope]).length === 0) return false;

  await setSelectedScopeCookie(scope.id);

  if (user && !hasDashboardAccess(user)) {
    const keepsCompany = scope.companies.some((company) => company.id === user.companyId);
    if (!keepsCompany && scope.companies.length > 0) {
      await userService.update(user.id, { companyId: scope.companies[0].id });
    }
  }
  return true;
}
