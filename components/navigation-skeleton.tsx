"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  CustomerPageSkeleton,
  DetailPageSkeleton,
  FormPageSkeleton,
  KpisPageSkeleton,
  ListPageSkeleton,
} from "@/components/page-skeletons";
import { routing } from "@/i18n/routing";
import { NAVIGATION_START } from "@/lib/navigation-events";

// Next.js shows a route's loading.tsx skeleton the moment a link is clicked
// only when it has prefetched the route, which it does in production. In
// development nothing is prefetched and each page is compiled on its first
// visit, so until the server answers, the old page stays on screen with no sign
// that anything is happening. This shows the destination's skeleton (the same
// ones the loading.tsx files render) from the click until the router commits
// the new page, which then shows its own loading.tsx while its data streams in.

type Area = "dashboard" | "customer";

const LOCALE_PREFIX = new RegExp(`^/(?:${routing.locales.join("|")})(?=/|$)`);

// "/en/dashboard/users?page=2" -> "/dashboard/users"
function withoutLocale(href: string): string {
  return href.split(/[?#]/)[0].replace(LOCALE_PREFIX, "") || "/";
}

// Where a path's skeleton goes: the dashboard's content area, or the whole
// page for the customer pages. Null for paths without one (the landing page,
// sign-in, files, …).
function areaOf(path: string): Area | null {
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "dashboard";
  if (path === "/profile" || /^\/(?:tickets|suggestions)(?:\/[^/]+)?$/.test(path)) {
    return "customer";
  }
  return null;
}

// The destination's skeleton. Mirrors the loading.tsx files.
function RouteSkeleton({ path }: { path: string }) {
  const detail = /^(?:\/dashboard)?\/(?:tickets|complaints|suggestions|projects)\/[^/]+$/.test(
    path,
  );
  if (areaOf(path) === "dashboard") {
    if (path === "/dashboard/kpis") return <KpisPageSkeleton />;
    if (path === "/dashboard/users") return <ListPageSkeleton avatar />;
    if (path === "/dashboard/settings") return <FormPageSkeleton />;
    return detail ? <DetailPageSkeleton /> : <ListPageSkeleton />;
  }
  if (path === "/profile") {
    return (
      <CustomerPageSkeleton width="2xl">
        <FormPageSkeleton />
      </CustomerPageSkeleton>
    );
  }
  return detail ? (
    <CustomerPageSkeleton width="3xl">
      <DetailPageSkeleton />
    </CustomerPageSkeleton>
  ) : (
    <CustomerPageSkeleton width="5xl">
      <ListPageSkeleton />
    </CustomerPageSkeleton>
  );
}

const PendingPath = createContext<string | null>(null);

// Wraps the app: notices a navigation as it starts (a link click, or an
// announced router.push) and holds its destination until the router commits
// the new page.
export function NavigationSkeletonProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The new page is on screen: it takes over (with its own loading.tsx).
  const [shownPathname, setShownPathname] = useState(pathname);
  if (shownPathname !== pathname) {
    setShownPathname(pathname);
    setPending(null);
  }

  useEffect(() => {
    const clear = () => {
      clearTimeout(timer.current);
      setPending(null);
    };
    const start = (href: string) => {
      const path = withoutLocale(href);
      if (areaOf(path) == null || path === withoutLocale(window.location.pathname)) {
        return;
      }
      setPending(path);
      // Never stay stuck on a navigation that didn't happen.
      clearTimeout(timer.current);
      timer.current = setTimeout(clear, 60_000);
    };

    const onClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor =
        event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) {
        return;
      }
      const url = new URL(anchor.href);
      if (url.origin === window.location.origin) start(url.pathname);
    };
    const onAnnounced = (event: Event) => start((event as CustomEvent<string>).detail);

    // The router writes the history entry when it commits the new page. That
    // also ends a navigation that lands back on the current path (a redirect),
    // which leaves the pathname unchanged. Deferred, as it runs inside React's
    // commit.
    const { history } = window;
    const pushState = history.pushState;
    const replaceState = history.replaceState;
    const patchedPush = function (this: History, ...args: Parameters<History["pushState"]>) {
      setTimeout(clear);
      return pushState.apply(this, args);
    };
    const patchedReplace = function (
      this: History,
      ...args: Parameters<History["replaceState"]>
    ) {
      setTimeout(clear);
      return replaceState.apply(this, args);
    };
    history.pushState = patchedPush;
    history.replaceState = patchedReplace;

    document.addEventListener("click", onClick, true);
    window.addEventListener(NAVIGATION_START, onAnnounced);
    window.addEventListener("popstate", clear);
    return () => {
      if (history.pushState === patchedPush) history.pushState = pushState;
      if (history.replaceState === patchedReplace) history.replaceState = replaceState;
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(NAVIGATION_START, onAnnounced);
      window.removeEventListener("popstate", clear);
      clearTimeout(timer.current);
    };
  }, []);

  return <PendingPath.Provider value={pending}>{children}</PendingPath.Provider>;
}

// Shows the pending destination's skeleton in place of `children` when that
// destination belongs to this area. The current page stays mounted, only
// hidden, so it is back as it was if the navigation doesn't happen.
export function PendingSkeleton({ area, children }: { area: Area; children: ReactNode }) {
  const path = useContext(PendingPath);
  const showing = path != null && areaOf(path) === area;
  return (
    <>
      {showing && <RouteSkeleton path={path} />}
      <div className="contents" hidden={showing}>
        {children}
      </div>
    </>
  );
}
