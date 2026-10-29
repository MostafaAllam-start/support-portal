import { createSiteRequestSchema, siteRequestService } from "@/services";
import { eventBus } from "@/events/eventBus";
import { DomainEventType } from "@/events/eventTypes";

// Receives the branding site's "Request a demo" form (a plain HTML POST from
// public/site), stores it for system support, and sends the visitor back to the
// form, where public/site/portal.js shows the outcome.
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return back("en", "invalid");
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
  if (!parsed.success) return back(locale, "invalid");

  const created = await siteRequestService.create(parsed.data);
  eventBus.emit(DomainEventType.SITE_REQUEST_SUBMITTED, {
    requestId: created.id,
    name: created.name,
    organization: created.organization,
  });
  return back(locale, "sent");
}

// 303 so the browser follows with a GET; the target is fixed, never taken from
// the request.
function back(locale: "en" | "ar", outcome: "sent" | "invalid"): Response {
  const page = locale === "ar" ? "/site/ar" : "/site";
  return new Response(null, {
    status: 303,
    headers: { Location: `${page}?request=${outcome}#contact` },
  });
}
