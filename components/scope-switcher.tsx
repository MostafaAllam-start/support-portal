"use client";

import { Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { changeScopeAction } from "@/lib/scope-actions";

type ScopeOption = { id: number; name: string; logo: string };

// Header control letting a visitor switch the scope they're browsing as. The
// trigger shows the current scope's logo; the menu lists the scopes they can pick
// and submits the change to the server controller.
export function ScopeSwitcher({
  scopes,
  currentScopeId,
}: {
  scopes: ScopeOption[];
  currentScopeId: number | null;
}) {
  const t = useTranslations("CompanySelect");
  const current = scopes.find((scope) => scope.id === currentScopeId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("switch")}
          className="inline-flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors hover:bg-accent"
        >
          {current?.logo ? (
            <Logo src={current.logo} alt={current.name} imageClassName="h-5" />
          ) : (
            <span className="text-sm text-muted-foreground">
              {current?.name ?? t("switch")}
            </span>
          )}
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("switch")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {scopes.map((scope) => (
          <form key={scope.id} action={changeScopeAction}>
            <input type="hidden" name="scopeId" value={scope.id} />
            <button
              type="submit"
              className="relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground"
            >
              {scope.logo && <Logo src={scope.logo} imageClassName="h-4" />}
              <span className="flex-1 text-start">{scope.name}</span>
              {scope.id === currentScopeId && <Check className="size-4 text-primary" />}
            </button>
          </form>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
