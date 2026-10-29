import type { NextRequest } from "next/server";

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

  // 302 so browsers don't cache the hop; a relative Location keeps it on
  // whatever host the visitor used.
  return new Response(null, {
    status: 302,
    headers: { Location: `/${locale}${route}` },
  });
}
