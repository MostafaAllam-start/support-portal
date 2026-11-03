"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  attachmentService,
  companyService,
  complaintService,
  projectService,
  replyService,
  suggestionService,
  ticketService,
  userService,
} from "@/services";
import type { AuthUser } from "@/services";
import { canReplyToTicket, requireUser } from "@/lib/auth/guards";
import { companyRequiresProject } from "@/lib/companies";
import { eventBus } from "@/events/eventBus";
import { DomainEventType } from "@/events/eventTypes";
import { broadcastEntityUpdate, liveRoom } from "@/realtime/liveReplies";
import {
  assertValidImages,
  readImageFiles,
  saveImages,
  saveReplyImages,
} from "@/lib/storage";

export type ReportState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

// The reporter (userId) is taken from the session, never the form, so a user can
// only file tickets as themselves. A reporter may set the title/description but
// never the status or the assigned engineers. `projectId` is optional and only
// honored for project-scoped companies (CTC).
const reportSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

// A complaint a reporter files about one of their own tickets.
const complaintSchema = z.object({
  title: z.string().min(1),
  details: z.string().min(1),
});

// An improvement idea a user submits.
const suggestionSchema = z.object({
  title: z.string().min(1),
  details: z.string().optional(),
});

function readId(formData: FormData): number | null {
  const n = Number(formData.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function revalidateTickets() {
  revalidatePath("/[locale]/tickets", "page");
  revalidatePath("/[locale]/tickets/[id]", "page");
  revalidatePath("/[locale]/dashboard", "layout");
}

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

export async function reportIssue(
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await userService.currentUser();
  if (!user) {
    return { error: "You must be signed in to report an issue." };
  }

  const parsed = reportSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // Resolve the project scope. For project-scoped companies (CTC) the reporter
  // must pick one of their company's projects; for ECM it stays unset.
  let projectId: number | undefined;
  if (user.companyId) {
    const company = await companyService.findById(user.companyId);
    if (company && companyRequiresProject(company.name)) {
      const pid = Number(formData.get("projectId"));
      if (!Number.isInteger(pid) || pid <= 0) {
        return { fieldErrors: { projectId: "Please choose a project." } };
      }
      const project = await projectService.findById(pid);
      if (!project || project.companyId !== user.companyId) {
        return { fieldErrors: { projectId: "Invalid project." } };
      }
      projectId = pid;
    }
  }

  // Validate attachments before creating the ticket so a bad upload doesn't leave
  // a half-created record.
  const files = readImageFiles(formData);
  try {
    assertValidImages(files);
  } catch (error) {
    return {
      fieldErrors: {
        images: error instanceof Error ? error.message : "Invalid images",
      },
    };
  }

  const ticket = await ticketService.create({
    ...parsed.data,
    userId: user.id,
    // Record the reporter's company on the ticket (ECM or CTC).
    companyId: user.companyId ?? undefined,
    projectId,
  });
  const paths = await saveImages(files);
  await attachmentService.attach("ticket", ticket.id, paths);

  eventBus.emit(DomainEventType.TICKET_CREATED, {
    ticketId: ticket.id,
    actorId: user.id,
    title: parsed.data.title,
    projectId: ticket.projectId ?? null,
  });

  // Refresh the list so the new ticket shows up once the dialog closes.
  revalidateTickets();
  return { ok: true };
}

// A reporter files a complaint about how one of their own tickets was handled
// (e.g. the reviewer did not answer properly). Ownership is enforced by scoping
// the ticket lookup to the current user. Attachments are optional.
export async function reportAnIssueAction(
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await requireUser();

  const ticketId = readId(formData);
  if (!ticketId) return { error: "Invalid ticket" };

  // Confirm the current user owns this ticket before accepting a complaint.
  const ticket = await ticketService.getForReporter(ticketId, user.id);
  if (!ticket) return { error: "Ticket not found" };

  const parsed = complaintSchema.safeParse({
    title: formData.get("title"),
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const files = readImageFiles(formData);
  try {
    assertValidImages(files);
  } catch (error) {
    return {
      fieldErrors: {
        images: error instanceof Error ? error.message : "Invalid images",
      },
    };
  }

  const complaint = await complaintService.create({
    ...parsed.data,
    ticketId,
    createdById: user.id,
  });
  const paths = await saveImages(files);
  await attachmentService.attach("complaint", complaint.id, paths);

  eventBus.emit(DomainEventType.COMPLAINT_SUBMITTED, {
    complaintId: complaint.id,
    ticketId,
    actorId: user.id,
    projectId: ticket.projectId ?? null,
  });

  revalidateTickets();
  return { ok: true };
}

// A user submits a suggestion (improvement idea). Only the "user" role reaches
// this surface; the author is taken from the session. Admins review suggestions
// from the dashboard. Attachments are optional.
export async function submitSuggestionAction(
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await requireUser();

  // A suggestion is always scoped to the author's company. requireUser guarantees
  // a plain "user" has picked one, so this should always be set.
  if (!user.companyId) {
    return { error: "You must select a company first." };
  }

  const parsed = suggestionSchema.safeParse({
    title: formData.get("title"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // Optionally scope the suggestion to one of the company's projects. Only
  // project-scoped companies (CTC) offer a project picker; unlike a ticket, the
  // project is optional here (a suggestion may be general to the company).
  let projectId: number | undefined;
  const company = await companyService.findById(user.companyId);
  if (company && companyRequiresProject(company.name)) {
    const pid = Number(formData.get("projectId"));
    if (Number.isInteger(pid) && pid > 0) {
      const project = await projectService.findById(pid);
      if (!project || project.companyId !== user.companyId) {
        return { fieldErrors: { projectId: "Invalid project." } };
      }
      projectId = pid;
    }
  }

  const files = readImageFiles(formData);
  try {
    assertValidImages(files);
  } catch (error) {
    return {
      fieldErrors: {
        images: error instanceof Error ? error.message : "Invalid images",
      },
    };
  }

  const suggestion = await suggestionService.create({
    title: parsed.data.title,
    details: parsed.data.details,
    createdById: user.id,
    companyId: user.companyId,
    projectId,
  });
  const paths = await saveImages(files);
  await attachmentService.attach("suggestion", suggestion.id, paths);

  eventBus.emit(DomainEventType.SUGGESTION_CREATED, {
    suggestionId: suggestion.id,
    companyId: user.companyId,
    actorId: user.id,
    title: parsed.data.title,
    projectId: suggestion.projectId ?? null,
  });

  // Refresh the admin suggestions list so the new suggestion shows up there.
  revalidatePath("/[locale]/dashboard/suggestions", "page");
  return { ok: true };
}

// A reporter edits one of their own tickets (title/description only). Ownership is
// enforced by scoping the lookup to the current user's id.
export async function updateMyTicketAction(
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await requireUser();

  const id = readId(formData);
  if (!id) return { error: "Invalid ticket" };

  const ticket = await ticketService.getForReporter(id, user.id);
  if (!ticket) return { error: "Ticket not found" };

  const parsed = reportSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await ticketService.update(id, parsed.data);
  revalidateTickets();
  return { ok: true };
}

// A reporter deletes (soft) one of their own tickets.
export async function deleteMyTicketAction(
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await requireUser();

  const id = readId(formData);
  if (!id) return { error: "Invalid ticket" };

  const ticket = await ticketService.getForReporter(id, user.id);
  if (!ticket) return { error: "Ticket not found" };

  await ticketService.softDelete(id);
  revalidatePath("/[locale]/tickets", "page");
  return { ok: true };
}

// A reply (conversation message) on a ticket. The author and ticket are resolved
// server-side; the form only carries the text.
const ticketReplySchema = z.object({
  description: z.string().trim().min(1),
});

// Posts a reply to a ticket's conversation. Shared by the reporter view and the
// dashboard: the author is the session user (never the form) and access is
// authorized per canReplyToTicket. An optional `parentReplyId` threads the
// message under a top-level comment (validated to belong to the same ticket).
export async function postTicketReplyAction(
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const user = await userService.currentUser();
  if (!user) return { error: "You must be signed in to reply." };

  const ticketId = Number(formData.get("ticketId"));
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return { error: "Invalid ticket" };
  }

  const ticket = await ticketService.getDetail(ticketId);
  if (!ticket) return { error: "Ticket not found" };

  if (!canReplyToTicket(user, ticket)) {
    return { error: "You can't reply to this ticket." };
  }

  const parsed = ticketReplySchema.safeParse({
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // Optional thread parent: any reply on this same ticket (replies nest to any
  // depth), but never one from another entity.
  let parentReplyId: number | undefined;
  const parentRaw = Number(formData.get("parentReplyId"));
  if (Number.isInteger(parentRaw) && parentRaw > 0) {
    const ok = await replyService.isOnEntity(parentRaw, "ticket", ticketId);
    if (!ok) return { error: "Invalid reply target" };
    parentReplyId = parentRaw;
  }

  // Validate any attached images before creating the reply so a bad upload
  // doesn't leave a message with no — or broken — attachments behind.
  const files = readImageFiles(formData);
  try {
    assertValidImages(files);
  } catch (error) {
    return {
      fieldErrors: {
        images: error instanceof Error ? error.message : "Invalid images",
      },
    };
  }

  const reply = await replyService.create({
    entityType: "ticket",
    entityId: ticketId,
    userId: user.id,
    description: parsed.data.description,
    parentReplyId,
  });

  // Attachments are stored per reply under public/replies/<id>/ and linked
  // polymorphically (entity_type "reply").
  const paths = await saveReplyImages(reply.id, files);
  await attachmentService.attach("reply", reply.id, paths);

  eventBus.emit(DomainEventType.TICKET_REPLY_ADDED, {
    ticketId,
    actorId: user.id,
    parentReplyId,
    description: parsed.data.description,
  });

  // Refresh whichever detail page the author is on (staff land on the dashboard
  // view, reporters on their own); revalidating both is cheap and keeps them in
  // sync.
  revalidatePath("/[locale]/tickets/[id]", "page");
  revalidatePath("/[locale]/dashboard/tickets/[id]", "page");
  revalidatePath("/[locale]/dashboard", "layout");
  // Live-refresh every other open ticket detail page (reporter + staff).
  await broadcastEntityUpdate(liveRoom("ticket", ticketId));
  return { ok: true };
}

// Edits and deletes are restricted to the reply's author or an admin.
function canModifyReply(user: AuthUser, reply: { userId: number }): boolean {
  return reply.userId === user.id || user.effectiveRole === "admin";
}

// Loads a ticket reply and authorizes the session user to modify it. Returns the
// reply on success, or a ReportState error to return to the caller.
async function loadModifiableReply(
  formData: FormData,
): Promise<
  | { ok: true; user: AuthUser; reply: { id: number; userId: number; entityId: number } }
  | { ok: false; state: ReportState }
> {
  const user = await userService.currentUser();
  if (!user) return { ok: false, state: { error: "You must be signed in." } };

  const replyId = Number(formData.get("replyId"));
  if (!Number.isInteger(replyId) || replyId <= 0) {
    return { ok: false, state: { error: "Invalid reply" } };
  }

  const reply = await replyService.findById(replyId);
  if (!reply || reply.entityType !== "ticket") {
    return { ok: false, state: { error: "Reply not found" } };
  }
  if (!canModifyReply(user, reply)) {
    return { ok: false, state: { error: "You can't modify this reply." } };
  }
  return { ok: true, user, reply };
}

// Edits a reply's text. Only the author or an admin may edit.
export async function updateTicketReplyAction(
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const auth = await loadModifiableReply(formData);
  if (!auth.ok) return auth.state;

  const parsed = ticketReplySchema.safeParse({
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await replyService.update(auth.reply.id, parsed.data.description);

  revalidatePath("/[locale]/tickets/[id]", "page");
  revalidatePath("/[locale]/dashboard/tickets/[id]", "page");
  await broadcastEntityUpdate(liveRoom("ticket", auth.reply.entityId));
  return { ok: true };
}

// Deletes a reply (and any threaded children). Only the author or an admin.
export async function deleteTicketReplyAction(
  _prevState: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const auth = await loadModifiableReply(formData);
  if (!auth.ok) return auth.state;

  await replyService.delete(auth.reply.id);

  revalidatePath("/[locale]/tickets/[id]", "page");
  revalidatePath("/[locale]/dashboard/tickets/[id]", "page");
  await broadcastEntityUpdate(liveRoom("ticket", auth.reply.entityId));
  return { ok: true };
}

export async function signOutAction() {
  await userService.logout();
  redirect({ href: "/login", locale: await getLocale() });
}
