"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all";
const ROLES = ["admin", "team_member", "client", "partner"] as const;
const STATUSES = ["active", "disabled"] as const;

// Search box and scope filter of the Users page. Both live in the address (?q=, ?scope=),
// so the server renders the filtered list and the view can be shared or reloaded.
export function UserFilters({
  scopes,
  total,
  shown,
}: {
  scopes: { id: number; name: string }[];
  total: number;
  shown: number;
}) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const scope = params.get("scope") ?? ALL;
  const role = params.get("role") ?? ALL;
  const status = params.get("status") ?? ALL;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function update(next: { q?: string; scope?: string; role?: string; status?: string }) {
    const search = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) search.set(key, value);
      else search.delete(key);
    }
    const qs = search.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  // Search as you type, a moment after the last key.
  function onQuery(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update({ q: value.trim() }), 300);
  }
  useEffect(() => () => clearTimeout(timer.current), []);

  const active = Boolean(query.trim()) || scope !== ALL || role !== ALL || status !== ALL;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-busy={pending}>
      <div className="relative min-w-56 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={t("users.filters.search")}
          aria-label={t("users.filters.search")}
          className="ps-8"
        />
      </div>
      <Select
        value={scope}
        onValueChange={(value) => update({ scope: value === ALL ? "" : value })}
      >
        <SelectTrigger className="w-48" aria-label={t("users.filters.scope")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("users.filters.allScopes")}</SelectItem>
          {scopes.map((s) => (
            <SelectItem key={s.id} value={String(s.id)}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={role} onValueChange={(value) => update({ role: value === ALL ? "" : value })}>
        <SelectTrigger className="w-44" aria-label={t("users.filters.role")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("users.filters.allRoles")}</SelectItem>
          {ROLES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`users.types.${value}.label`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(value) => update({ status: value === ALL ? "" : value })}>
        <SelectTrigger className="w-40" aria-label={t("users.filters.status")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t("users.filters.allStatuses")}</SelectItem>
          {STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`users.filters.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {active && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            clearTimeout(timer.current);
            setQuery("");
            update({ q: "", scope: "", role: "", status: "" });
          }}
        >
          <X className="size-4" />
          {t("users.filters.clear")}
        </Button>
      )}
      <p className="ms-auto text-xs text-muted-foreground" role="status">
        {t("users.filters.count", { shown, total })}
      </p>
    </div>
  );
}
