"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import {
  attachmentService,
  projectService,
  replyService,
  suggestionService,
  userService,
} from "@/services";
import {
  brandCompanyId,
  requireDashboardUser,
  requireRole,
} from "@/lib/auth/guards";
import { canAccessSuggestion } from "@/lib/suggestions";
import { assertValidImages, readImageFiles, saveImages } from "@/lib/storage";
import { eventBus } from "@/events/eventBus";
import { DomainEventType } from "@/events/eventTypes";
import { broadcastEntityUpdate, liveRoom } from "@/realtime/liveReplies";

export type SuggestionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const createSchema = z.object({
  title: z.string().min(1),
  // Optional free-text body.
  details: z.string().optional(),
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

// Any signed-in staff member (privileged role) can submit a suggestion from the
// dashboard header. The author is taken from the session.
export async function createSuggestionAction(
  _prevState: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const me = await requireDashboardUser();

  // The suggestion is scoped to the company currently selected in the header.
  const companyId = await brandCompanyId();
  if (!companyId) {
    return { error: "Select a company first." };
  }

  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    details: formData.get("details") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // Optionally scope the suggestion to one of the selected company's projects.
  let projectId: number | undefined;
  const pid = Number(formData.get("projectId"));
  if (Number.isInteger(pid) && pid > 0) {
    const project = await projectService.findById(pid);
    if (!project || project.companyId !== companyId) {
      return { fieldErrors: { projectId: "Invalid project." } };
    }
    projectId = pid;
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
    createdById: me.id,
    companyId,
    projectId,
  });
  const paths = await saveImages(files);
  await attachmentService.attach("suggestion", suggestion.id, paths);

  eventBus.emit(DomainEventType.SUGGESTION_CREATED, {
    suggestionId: suggestion.id,
    companyId,
    actorId: me.id,
    title: parsed.data.title,
    projectId: suggestion.projectId ?? null,
  });

  revalidatePath("/[locale]/dashboard/suggestions", "page");
  return { ok: true };
}

function readId(formData: FormData, key = "id"): number | null {
  const n = Number(formData.get(key));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Refresh both the suggestions list and the open detail page, on the dashboard
// (admin/manager) and the user-facing surface (the author's own pages).
function revalidateSuggestions() {
  revalidatePath("/[locale]/dashboard/suggestions", "page");
  revalidatePath("/[locale]/dashboard/suggestions/[id]", "page");
  revalidatePath("/[locale]/suggestions", "page");
  revalidatePath("/[locale]/suggestions/[id]", "page");
}

// Admins delete a suggestion from the dashboard list. Its replies and
// attachments are removed alongside it (see suggestionService.delete).
export async function deleteSuggestionAction(
  _prevState: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  await requireRole("admin");

  const id = readId(formData);
  if (!id) return { error: "Invalid suggestion." };

  try {
    await suggestionService.delete(id);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete.",
    };
  }

  revalidateSuggestions();
  return { ok: true };
}

// A reply (conversation message) on a suggestion. The author and suggestion are
// resolved server-side; the form only carries the text and an optional thread
// parent.
const suggestionReplySchema = z.object({
  description: z.string().trim().min(1),
});

// The suggestion's author (a plain user, on their own suggestion) and the
// reviewing staff (admins / project managers) hold a two-way conversation from
// the detail page. The author is the session user (never the form). An optional
// `parentReplyId` threads the message under a top-level comment (validated to
// belong to this suggestion).
export async function postSuggestionReplyAction(
  _prevState: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const me = await userService.currentUser();
  if (!me) return { error: "You must be signed in." };

  const suggestionId = readId(formData, "suggestionId");
  if (!suggestionId) return { error: "Invalid suggestion." };

  const suggestion = await suggestionService.getDetail(suggestionId);
  if (!suggestion) return { error: "Suggestion not found." };

  if (!canAccessSuggestion(me, suggestion)) {
    return { error: "You can't reply to this suggestion." };
  }

  const parsed = suggestionReplySchema.safeParse({
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // Optional thread parent: any reply on this same suggestion (replies nest to
  // any depth), but never one from another entity.
  let parentReplyId: number | undefined;
  const parentRaw = Number(formData.get("parentReplyId"));
  if (Number.isInteger(parentRaw) && parentRaw > 0) {
    const ok = await replyService.isOnEntity(
      parentRaw,
      "suggestion",
      suggestionId,
    );
    if (!ok) return { error: "Invalid reply target." };
    parentReplyId = parentRaw;
  }

  await replyService.create({
    entityType: "suggestion",
    entityId: suggestionId,
    userId: me.id,
    description: parsed.data.description,
    parentReplyId,
  });

  revalidateSuggestions();
  await broadcastEntityUpdate(liveRoom("suggestion", suggestionId));
  return { ok: true };
}

// Deletes a reply (and, for a top-level comment, its thread) on a suggestion.
// Only the reply's own author or an admin may remove it; the reply is checked to
// belong to this suggestion before removal.
export async function deleteSuggestionReplyAction(
  _prevState: SuggestionState,
  formData: FormData,
): Promise<SuggestionState> {
  const me = await userService.currentUser();
  if (!me) return { error: "You must be signed in." };

  const replyId = readId(formData, "replyId");
  const suggestionId = readId(formData, "suggestionId");
  if (!replyId || !suggestionId) return { error: "Invalid reply." };

  const reply = await replyService.findById(replyId);
  if (
    !reply ||
    reply.entityType !== "suggestion" ||
    reply.entityId !== suggestionId
  ) {
    return { error: "Reply not found." };
  }

  if (reply.userId !== me.id && me.effectiveRole !== "admin") {
    return { error: "You can't delete this reply." };
  }

  try {
    await replyService.delete(replyId);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to delete.",
    };
  }

  revalidateSuggestions();
  await broadcastEntityUpdate(liveRoom("suggestion", suggestionId));
  return { ok: true };
}
