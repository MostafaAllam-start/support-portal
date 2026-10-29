"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { siteRequestService, userService } from "@/services";
import { requireRole } from "@/lib/auth/guards";
import { UserRole } from "@/lib/auth/roles";
import { eventBus } from "@/events/eventBus";
import { DomainEventType } from "@/events/eventTypes";

export type RequestActionState = {
  ok?: boolean;
  error?: string;
};

// System support works the requests; admins can act on them too.
const REQUEST_ROLES = [UserRole.SystemSupport, UserRole.Admin];

function readId(formData: FormData): number | null {
  const n = Number(formData.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function revalidate() {
  revalidatePath("/[locale]/dashboard/requests", "page");
}

// Asks the admins to create a support account for the request's client: an
// in-app + real-time notification and an email to every active admin.
export async function notifyAdminAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  const user = await requireRole(...REQUEST_ROLES);
  const t = await getTranslations("Dashboard.requests.errors");

  const id = readId(formData);
  const request = id ? await siteRequestService.findById(id) : null;
  if (!request) return { error: t("notFound") };

  const admins = (await userService.activeAdminIds()).filter(
    (adminId) => adminId !== user.id,
  );
  if (admins.length === 0) return { error: t("noAdmins") };

  await siteRequestService.markAdminNotified(request.id, user.id);
  eventBus.emit(DomainEventType.SITE_REQUEST_ADMIN_NOTIFIED, {
    requestId: request.id,
    actorId: user.id,
    name: request.name,
    email: request.email,
    organization: request.organization,
  });

  revalidate();
  return { ok: true };
}

// Moves a request to new / contacted / closed.
export async function setRequestStatusAction(
  _prev: RequestActionState,
  formData: FormData,
): Promise<RequestActionState> {
  await requireRole(...REQUEST_ROLES);
  const t = await getTranslations("Dashboard.requests.errors");

  const id = readId(formData);
  const status = formData.get("status");
  if (!id || (status !== "new" && status !== "contacted" && status !== "closed")) {
    return { error: t("invalid") };
  }
  if (!(await siteRequestService.findById(id))) return { error: t("notFound") };

  await siteRequestService.setStatus(id, status);
  revalidate();
  return { ok: true };
}
