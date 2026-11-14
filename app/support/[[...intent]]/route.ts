import type { NextRequest } from "next/server";
import { isEcmScope, switchableScopes } from "@/lib/auth/guards";
import { setSelectedScopeCookie } from "@/lib/scope-selection";
import { scopeService, userService } from "@/services";

// The branding site never hard-codes portal URLs: its support links point at
// /support/<intent>?lang=ar|en, and this route sends them to the matching portal
// page. Only these fixed targets are reachable (never one from the query string),
// so it can't be used as an open redirect.
const ROUTES: Record<string, string> = {
  "": "",
  login: "/login",
  tickets: "/tickets",
  "tickets/new": "/tickets",
  suggestions: "/suggestions",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ intent?: string[] }> },
) {
  const { intent = [] } = await params;
  const locale = request.nextUrl.searchParams.get("lang") === "ar" ? "ar" : "en";
  const route = ROUTES[intent.join("/")] ?? "";

  // The branding site is ECM+: arriving from it, browse the portal as the ECM+ scope
  // (overriding an earlier pick), unless this signed-in user may not switch to it.
  const user = await userService.currentUser();
  const ecm = (await scopeService.list()).find(isEcmScope);
  if (ecm && switchableScopes(user, [ecm]).length > 0) {
    await setSelectedScopeCookie(ecm.id);
  }

  // 302 so browsers don't cache the hop; a relative Location keeps it on
  // whatever host the visitor used.
  return new Response(null, {
    status: 302,
    headers: { Location: `/${locale}${route}` },
  });
}
