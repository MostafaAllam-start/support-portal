"use server";

import { z } from "zod";
import { getLocale } from "next-intl/server";
import { createContactRequestSchema, siteRequestService } from "@/services";
import { brandScopeId } from "@/lib/auth/guards";
import { eventBus } from "@/events/eventBus";
import { DomainEventType } from "@/events/eventTypes";

export type ContactState = {
  ok?: boolean;
  fieldErrors?: Record<string, string>;
};

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && out[key] === undefined) {
      out[key] = issue.message;
    }
  }
  return out;
}

// A message from the landing page goes to the Requests page, under the scope the
// visitor is browsing as, and notifies whoever works the requests.
export async function submitContact(
  _prevState: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const parsed = createContactRequestSchema.safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    subject: formData.get("subject") ?? "",
    message: formData.get("message") ?? "",
    locale: (await getLocale()) === "ar" ? "ar" : "en",
    scopeId: await brandScopeId(),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const created = await siteRequestService.createContact(parsed.data);
  eventBus.emit(DomainEventType.SITE_REQUEST_SUBMITTED, {
    requestId: created.id,
    name: created.name,
    organization: created.organization,
  });
  return { ok: true };
}
