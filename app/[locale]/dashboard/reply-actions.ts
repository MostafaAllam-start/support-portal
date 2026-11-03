"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  attachmentService,
  complaintService,
  replyService,
  ticketService,
  userService,
} from "@/services";
import type { AuthUser } from "@/services";
import { canReplyToComplaint, canReplyToReport, requireDashboardUser } from "@/lib/auth/guards";
import { eventBus } from "@/events/eventBus";
import { DomainEventType } from "@/events/eventTypes";
import { broadcastEntityUpdate, liveRoom } from "@/realtime/liveReplies";
import {
  assertValidImages,
  readImageFiles,
  saveReplyImages,
} from "@/lib/storage";

export type ReplyActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const replySchema = z.object({
  description: z.string().trim().min(1),
});

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

function revalidateComplaint(complaintId: number, ticketId: number) {
  revalidatePath("/[locale]/dashboard/complaints/[id]", "page");
  revalidatePath("/[locale]/dashboard/complaints", "page");
  revalidatePath("/[locale]/dashboard/tickets/[id]", "page");
  revalidatePath(`/[locale]/dashboard/complaints/${complaintId}`, "page");
  revalidatePath(`/[locale]/dashboard/tickets/${ticketId}`, "page");
  revalidatePath("/[locale]/dashboard", "layout");
}

function revalidateReport(ticketId: number) {
  revalidatePath("/[locale]/dashboard/tickets/[id]", "page");
  revalidatePath(`/[locale]/dashboard/tickets/${ticketId}`, "page");
  revalidatePath("/[locale]/dashboard", "layout");
}

function canModifyReply(user: AuthUser, reply: { userId: number }): boolean {
  return reply.userId === user.id || user.effectiveRole === "admin";
}

async function loadModifiableReply(
  formData: FormData,
  entityType: "complaint" | "ticket_report",
): Promise<
  | { ok: true; user: AuthUser; reply: { id: number; userId: number; entityId: number } }
  | { ok: false; state: ReplyActionState }
> {
  const user = await userService.currentUser();
  if (!user) return { ok: false, state: { error: "You must be signed in." } };

  const replyId = Number(formData.get("replyId"));
  if (!Number.isInteger(replyId) || replyId <= 0) {
    return { ok: false, state: { error: "Invalid reply" } };
  }

  const reply = await replyService.findById(replyId);
  if (!reply || reply.entityType !== entityType) {
    return { ok: false, state: { error: "Reply not found" } };
  }
  if (!canModifyReply(user, reply)) {
    return { ok: false, state: { error: "You can't modify this reply." } };
  }
  return { ok: true, user, reply };
}

export async function postComplaintReplyAction(
  _prev: ReplyActionState,
  formData: FormData,
): Promise<ReplyActionState> {
  const user = await requireDashboardUser();

  const complaintId = Number(formData.get("entityId"));
  if (!Number.isInteger(complaintId) || complaintId <= 0) {
    return { error: "Invalid complaint" };
  }

  const complaint = await complaintService.getDetail(complaintId);
  if (!complaint) return { error: "Complaint not found" };

  const ticket = await ticketService.getDetail(complaint.ticketId);
  if (!ticket) return { error: "Ticket not found" };

  if (!canReplyToComplaint(user, ticket)) {
    return { error: "You can't reply to this complaint." };
  }

  const parsed = replySchema.safeParse({
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  let parentReplyId: number | undefined;
  const parentRaw = Number(formData.get("parentReplyId"));
  if (Number.isInteger(parentRaw) && parentRaw > 0) {
    const ok = await replyService.isOnEntity(parentRaw, "complaint", complaintId);
    if (!ok) return { error: "Invalid reply target" };
    parentReplyId = parentRaw;
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

  const reply = await replyService.create({
    entityType: "complaint",
    entityId: complaintId,
    userId: user.id,
    description: parsed.data.description,
    parentReplyId,
  });
  const paths = await saveReplyImages(reply.id, files);
  await attachmentService.attach("reply", reply.id, paths);

  revalidateComplaint(complaintId, complaint.ticketId);
  await broadcastEntityUpdate(liveRoom("complaint", complaintId));
  return { ok: true };
}

export async function updateComplaintReplyAction(
  _prev: ReplyActionState,
  formData: FormData,
): Promise<ReplyActionState> {
  const auth = await loadModifiableReply(formData, "complaint");
  if (!auth.ok) return auth.state;

  const parsed = replySchema.safeParse({
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await replyService.update(auth.reply.id, parsed.data.description);
  revalidatePath("/[locale]/dashboard/complaints/[id]", "page");
  revalidatePath("/[locale]/dashboard", "layout");
  await broadcastEntityUpdate(liveRoom("complaint", auth.reply.entityId));
  return { ok: true };
}

export async function deleteComplaintReplyAction(
  _prev: ReplyActionState,
  formData: FormData,
): Promise<ReplyActionState> {
  const auth = await loadModifiableReply(formData, "complaint");
  if (!auth.ok) return auth.state;

  await replyService.delete(auth.reply.id);
  revalidatePath("/[locale]/dashboard/complaints/[id]", "page");
  revalidatePath("/[locale]/dashboard", "layout");
  await broadcastEntityUpdate(liveRoom("complaint", auth.reply.entityId));
  return { ok: true };
}

export async function postReportReplyAction(
  _prev: ReplyActionState,
  formData: FormData,
): Promise<ReplyActionState> {
  const user = await requireDashboardUser();

  const reportId = Number(formData.get("entityId"));
  const ticketId = Number(formData.get("ticketId"));
  if (
    !Number.isInteger(reportId) ||
    reportId <= 0 ||
    !Number.isInteger(ticketId) ||
    ticketId <= 0
  ) {
    return { error: "Invalid report" };
  }

  const ticket = await ticketService.getDetail(ticketId);
  if (!ticket) return { error: "Ticket not found" };

  const report = ticket.reports.find((item) => item.id === reportId);
  if (!report) return { error: "Report not found" };

  if (!canReplyToReport(user, ticket)) {
    return { error: "You can't reply to this report." };
  }

  const parsed = replySchema.safeParse({
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  let parentReplyId: number | undefined;
  const parentRaw = Number(formData.get("parentReplyId"));
  if (Number.isInteger(parentRaw) && parentRaw > 0) {
    const ok = await replyService.isOnEntity(
      parentRaw,
      "ticket_report",
      reportId,
    );
    if (!ok) return { error: "Invalid reply target" };
    parentReplyId = parentRaw;
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

  const reply = await replyService.create({
    entityType: "ticket_report",
    entityId: reportId,
    userId: user.id,
    description: parsed.data.description,
    parentReplyId,
  });
  const paths = await saveReplyImages(reply.id, files);
  await attachmentService.attach("reply", reply.id, paths);

  eventBus.emit(DomainEventType.TICKET_REPORT_REPLY_ADDED, {
    ticketId,
    reportId,
    actorId: user.id,
    projectId: ticket.projectId ?? null,
    parentReplyId,
  });

  revalidateReport(ticketId);
  // Report replies render on the ticket detail page, so broadcast to its room.
  await broadcastEntityUpdate(liveRoom("ticket", ticketId));
  return { ok: true };
}

export async function updateReportReplyAction(
  _prev: ReplyActionState,
  formData: FormData,
): Promise<ReplyActionState> {
  const auth = await loadModifiableReply(formData, "ticket_report");
  if (!auth.ok) return auth.state;

  const parsed = replySchema.safeParse({
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  await replyService.update(auth.reply.id, parsed.data.description);
  revalidatePath("/[locale]/dashboard/tickets/[id]", "page");
  revalidatePath("/[locale]/dashboard", "layout");
  // auth.reply.entityId is the report id; the room is keyed by its ticket.
  const ticketId = await ticketService.reportTicketId(auth.reply.entityId);
  if (ticketId != null) await broadcastEntityUpdate(liveRoom("ticket", ticketId));
  return { ok: true };
}

export async function deleteReportReplyAction(
  _prev: ReplyActionState,
  formData: FormData,
): Promise<ReplyActionState> {
  const auth = await loadModifiableReply(formData, "ticket_report");
  if (!auth.ok) return auth.state;

  // Resolve the ticket before the reply (and possibly its report) is gone.
  const ticketId = await ticketService.reportTicketId(auth.reply.entityId);
  await replyService.delete(auth.reply.id);
  revalidatePath("/[locale]/dashboard/tickets/[id]", "page");
  revalidatePath("/[locale]/dashboard", "layout");
  if (ticketId != null) await broadcastEntityUpdate(liveRoom("ticket", ticketId));
  return { ok: true };
}
