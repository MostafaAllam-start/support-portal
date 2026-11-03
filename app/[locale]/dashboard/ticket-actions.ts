"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { attachmentService, ticketService } from "@/services";
import {
  canAccessDashboardTicket,
  canAssignTickets,
  canChangeTicketStatus,
  canManageTickets,
  requireDashboardUser,
  requireRole,
} from "@/lib/auth/guards";
import type { AuthUser } from "@/services";
import { ticketStatusValues } from "@/services/ticket-service/schemas";
import { assertValidImages, readImageFiles, saveReportImages } from "@/lib/storage";
import { eventBus } from "@/events/eventBus";
import { DomainEventType } from "@/events/eventTypes";

export type TicketActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
});

const updateSchema = createSchema.extend({
  status: z.enum(ticketStatusValues),
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

function readId(formData: FormData): number | null {
  const n = Number(formData.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Checked engineer ids from the assignment checkboxes.
function readAssigneeIds(formData: FormData): number[] {
  return formData
    .getAll("assigneeIds")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

// Tickets surface in both the admin Issues view and the reviewer Tickets view.
function revalidate() {
  revalidatePath("/[locale]/dashboard/issues", "page");
  revalidatePath("/[locale]/dashboard/tickets", "page");
  revalidatePath("/[locale]/dashboard", "layout");
}

// Also refresh the two ticket-detail pages (dashboard + reporter) after a change
// that shows there (close/reopen/report).
function revalidateDetail() {
  revalidatePath("/[locale]/dashboard/tickets/[id]", "page");
  revalidatePath("/[locale]/tickets/[id]", "page");
  revalidatePath("/[locale]/dashboard", "layout");
}

async function requireTicketForAction(
  ticketId: number,
  mode: "manage" | "assign" | "status",
): Promise<{ user: AuthUser; ticket: NonNullable<Awaited<ReturnType<typeof ticketService.getDetail>>> }> {
  const user = await requireDashboardUser();
  const ticket = await ticketService.getDetail(ticketId);
  if (!ticket) throw new Error("Ticket not found");

  const allowed =
    mode === "manage"
      ? canManageTickets(user.effectiveRole)
      : mode === "assign"
        ? canAssignTickets(user.effectiveRole)
        : canChangeTicketStatus(user.effectiveRole);
  if (!allowed) throw new Error("Forbidden");

  if (!canAccessDashboardTicket(user, ticket)) {
    throw new Error("Forbidden");
  }

  return { user, ticket };
}

export async function createTicketAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const me = await requireRole("admin", "manager");

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    // The creator is recorded as the reporter; new tickets start "open".
    await ticketService.create({
      ...parsed.data,
      userId: me.id,
      assigneeIds: readAssigneeIds(formData),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  revalidate();
  return { ok: true };
}

export async function updateTicketAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const id = readId(formData);
  if (!id) return { error: "Invalid ticket" };

  try {
    await requireTicketForAction(id, "manage");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forbidden",
    };
  }

  const parsed = updateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await ticketService.update(id, parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  revalidate();
  revalidateDetail();
  return { ok: true };
}

const statusSchema = z.object({
  status: z.enum(ticketStatusValues),
});

export async function updateTicketStatusAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const id = readId(formData);
  if (!id) return { error: "Invalid ticket" };

  let user: AuthUser;
  let ticket: NonNullable<Awaited<ReturnType<typeof ticketService.getDetail>>>;
  try {
    ({ user, ticket } = await requireTicketForAction(id, "status"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forbidden",
    };
  }

  const parsed = statusSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await ticketService.setStatus(id, parsed.data.status);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  eventBus.emit(DomainEventType.TICKET_STATUS_CHANGED, {
    ticketId: id,
    actorId: user.id,
    status: parsed.data.status,
    projectId: ticket.projectId ?? null,
  });

  revalidate();
  revalidateDetail();
  return { ok: true };
}

export async function assignTicketAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const id = readId(formData);
  if (!id) return { error: "Invalid ticket" };

  let user: AuthUser;
  let ticket: NonNullable<Awaited<ReturnType<typeof ticketService.getDetail>>>;
  try {
    ({ user, ticket } = await requireTicketForAction(id, "assign"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forbidden",
    };
  }

  const previousIds = ticket.assignees.map((assignee) => assignee.assignee.id);
  const nextIds = readAssigneeIds(formData);

  try {
    await ticketService.assign({
      ticketId: id,
      assigneeIds: nextIds,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to assign",
    };
  }

  eventBus.emit(DomainEventType.TICKET_ASSIGNMENT_UPDATED, {
    ticketId: id,
    actorId: user.id,
    projectId: ticket.projectId ?? null,
    previousAssigneeIds: previousIds,
    nextAssigneeIds: nextIds,
  });

  revalidate();
  return { ok: true };
}

export async function deleteTicketAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const id = readId(formData);
  if (!id) return { error: "Invalid ticket" };

  try {
    await requireTicketForAction(id, "manage");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forbidden",
    };
  }

  try {
    await ticketService.softDelete(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete",
    };
  }

  revalidate();
  return { ok: true };
}

const closeSchema = z.object({ comment: z.string().trim().min(1) });

// A reviewer/admin closes a ticket, recording themselves as the reviewer along
// with the time and their closing comment.
export async function closeTicketAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const id = readId(formData);
  if (!id) return { error: "Invalid ticket" };

  let me: AuthUser;
  try {
    ({ user: me } = await requireTicketForAction(id, "manage"));
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forbidden",
    };
  }

  const parsed = closeSchema.safeParse({ comment: formData.get("comment") });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await ticketService.close(id, me.id, parsed.data.comment);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to close" };
  }

  revalidate();
  revalidateDetail();
  return { ok: true };
}

// A reviewer/admin reopens a closed ticket, clearing the review stamp.
export async function reopenTicketAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const id = readId(formData);
  if (!id) return { error: "Invalid ticket" };

  try {
    await requireTicketForAction(id, "manage");
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Forbidden",
    };
  }

  try {
    await ticketService.reopen(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to reopen",
    };
  }

  revalidate();
  revalidateDetail();
  return { ok: true };
}

const reportSchema = z.object({
  issue: z.string().min(1),
  solution: z.string().min(1),
});

// Adds a diagnostic report (issue + solution, with optional image attachments) to
// a ticket. Only the assigned software-engineer(s) or a consultant may add one;
// the author is taken from the session.
export async function createReportAction(
  _prev: TicketActionState,
  formData: FormData,
): Promise<TicketActionState> {
  const user = await requireDashboardUser();

  const ticketId = readId(formData);
  if (!ticketId) return { error: "Invalid ticket" };

  const ticket = await ticketService.getDetail(ticketId);
  if (!ticket) return { error: "Ticket not found" };

  if (!canAccessDashboardTicket(user, ticket)) {
    return { error: "Ticket not found" };
  }

  // Authorize: an assigned engineer or an assigned consultant on this ticket.
  const role = user.effectiveRole;
  const isAssigned =
    (role === "software-engineer" || role === "sap-consultant") &&
    ticket.assignees.some((assignee) => assignee.assignee.id === user.id);
  if (!isAssigned) {
    return {
      error: "Only an assigned engineer or consultant can add reports.",
    };
  }

  const parsed = reportSchema.safeParse({
    issue: formData.get("issue"),
    solution: formData.get("solution"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // Validate attachments before creating the report so a bad upload doesn't leave
  // a report with broken attachments.
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

  try {
    const report = await ticketService.createReport({
      ticketId,
      userId: user.id,
      issue: parsed.data.issue,
      solution: parsed.data.solution,
    });
    const paths = await saveReportImages(report.id, files);
    await attachmentService.attach("ticket_report", report.id, paths);

    eventBus.emit(DomainEventType.TICKET_REPORT_SUBMITTED, {
      ticketId,
      actorId: user.id,
      projectId: ticket.projectId ?? null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  revalidateDetail();
  return { ok: true };
}
