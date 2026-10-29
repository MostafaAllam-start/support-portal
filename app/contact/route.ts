import { createSiteRequestSchema, siteRequestService } from "@/services";
import { eventBus } from "@/events/eventBus";
import { DomainEventType } from "@/events/eventTypes";

type Outcome = "sent" | "invalid";

// Receives the branding site's "Request a demo" form (public/site) and stores it
// for system support. The site's main.js sends the form in the background and
// asks for JSON, then shows the outcome as a toast; a plain form post (no
// JavaScript) is redirected back to the form instead. This is the /contact
// contract documented in the templates repo's README.
export async function POST(request: Request) {
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(wantsJson, "en", "invalid");
  }

  const locale = form.get("lang") === "ar" ? "ar" : "en";
  const parsed = createSiteRequestSchema.safeParse({
    name: form.get("name") ?? "",
    email: form.get("email") ?? "",
    organization: form.get("organization") ?? "",
    modules: form.getAll("modules"),
    message: form.get("message") ?? "",
    locale,
  });
  if (!parsed.success) return reply(wantsJson, locale, "invalid");

  const created = await siteRequestService.create(parsed.data);
  eventBus.emit(DomainEventType.SITE_REQUEST_SUBMITTED, {
    requestId: created.id,
    name: created.name,
    organization: created.organization,
  });
  return reply(wantsJson, locale, "sent");
}

function reply(wantsJson: boolean, locale: "en" | "ar", outcome: Outcome): Response {
  if (wantsJson) {
    return Response.json({ ok: outcome === "sent" }, { status: outcome === "sent" ? 200 : 400 });
  }
  // 303 so the browser follows with a GET; the target is fixed, never taken from
  // the request.
  const page = locale === "ar" ? "/site/ar" : "/site";
  return new Response(null, {
    status: 303,
    headers: { Location: `${page}?request=${outcome}#contact` },
  });
}
