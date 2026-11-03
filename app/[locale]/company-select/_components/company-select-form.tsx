"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn, keepInputOnError } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { selectScopeAction, type ScopeSelectState } from "../actions";

type ScopeCard = { id: number; name: string; logo: string };

export function CompanySelectForm({ scopes }: { scopes: ScopeCard[] }) {
  const t = useTranslations("CompanySelect");
  const [selected, setSelected] = useState<number | null>(null);
  const [state, action, pending] = useActionState<ScopeSelectState, FormData>(
    selectScopeAction,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} onReset={keepInputOnError(state)} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {scopes.map((scope) => {
          const active = selected === scope.id;
          return (
            <button
              type="button"
              key={scope.id}
              onClick={() => setSelected(scope.id)}
              aria-pressed={active}
              className={cn(
                "relative flex flex-col items-center gap-4 rounded-xl border p-8 text-center transition-colors hover:bg-accent",
                active && "border-primary ring-2 ring-primary/40",
              )}
            >
              {active && (
                <span className="absolute end-3 top-3 inline-flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-4" />
                </span>
              )}
              {scope.logo && (
                // Plain <img> so any logo URL works without next/image config.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={scope.logo}
                  alt=""
                  className="h-16 w-auto rounded-md bg-white object-contain p-2"
                />
              )}
              <span className="text-lg font-medium">{scope.name}</span>
            </button>
          );
        })}
      </div>

      <input type="hidden" name="scopeId" value={selected ?? ""} />

      <div className="flex justify-center">
        <Button type="submit" disabled={pending || selected === null}>
          {pending && <Loader2 className="animate-spin" />}
          {t("confirm")}
        </Button>
      </div>
    </form>
  );
}
