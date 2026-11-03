import { Link } from "@/i18n/navigation";
import { scopeService, userService } from "@/services";
import { brandScope, switchableScopes } from "@/lib/auth/guards";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { UserMenu } from "@/components/user-menu";
import { ScopeSwitcher } from "@/components/scope-switcher";
import { MySuggestionsLink } from "@/components/my-suggestions-link";

// Top bar for the authenticated "user" surface (/tickets and ticket details).
// `nav` controls the cross-link button: on the suggestions page we point back
// to tickets instead of repeating the page the user is already on.
export async function TicketsHeader({
  nav = "suggestions",
}: {
  nav?: "suggestions" | "tickets";
} = {}) {
  const me = await userService.currentUser();
  // A signed-in client switches only between their own scopes.
  const scopes = switchableScopes(me, await scopeService.list());
  const current = await brandScope();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
        <Link href="/" aria-label={`${current?.name ?? "CTC"} Support`}>
          <Logo imageClassName="h-7" src={current?.logo} alt={current?.name} />
        </Link>
        <div className="ms-auto flex items-center gap-2">
          {scopes.length > 1 && (
            <ScopeSwitcher
              scopes={scopes.map((s) => ({ id: s.id, name: s.name, logo: s.logo }))}
              currentScopeId={current?.id ?? null}
            />
          )}
          {me && <MySuggestionsLink variant={nav} />}
          <ThemeToggle />
          <LocaleSwitcher />
          {me && (
            <UserMenu
              name={me.name}
              username={me.username}
              image={me.image}
            />
          )}
        </div>
      </div>
    </header>
  );
}
