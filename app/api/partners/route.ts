import { NextResponse } from "next/server";
import { partnerService } from "@/services";
import { brandScope } from "@/lib/auth/guards";

// The partners seeded for the scope being browsed (the ECM+ scope by default): what the
// branding site's Partners menu and page list, so they follow the portal's data.
export const dynamic = "force-dynamic";

export async function GET() {
  const scope = await brandScope();
  const partners = scope ? await partnerService.forScope(scope.id) : [];
  return NextResponse.json(
    partners.map(({ id, name, logo, details }) => ({ id, name, logo, details })),
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
