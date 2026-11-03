import { useMemo } from "react";
import { createNavigation } from "next-intl/navigation";
import { announceNavigation } from "@/lib/navigation-events";
import { routing } from "./routing";

const navigation = createNavigation(routing);

// Locale-aware navigation APIs. Use these instead of next/navigation so links
// and redirects keep the active locale prefix (/en, /ar).
export const { Link, redirect, usePathname, getPathname } = navigation;

// The locale-aware router. `push` also announces the navigation, so the
// destination's skeleton shows right away (see components/navigation-skeleton.tsx);
// links are picked up from their clicks.
export function useRouter() {
  const router = navigation.useRouter();
  return useMemo(
    () => ({
      ...router,
      push(...args: Parameters<typeof router.push>) {
        const [href] = args;
        announceNavigation(typeof href === "string" ? href : (href.pathname ?? ""));
        router.push(...args);
      },
    }),
    [router],
  );
}
