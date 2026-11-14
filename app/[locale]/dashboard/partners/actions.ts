"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { partnerService } from "@/services";
import { requireRole } from "@/lib/auth/guards";
import { saveUserImage } from "@/lib/uploads";

export type ActionState = {
  ok?: boolean;
  id?: number; // the new partner's id and name, after a create
  name?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const fieldsSchema = z.object({
  name: z.string().min(1),
  logo: z.string().min(1),
  details: z.string().min(1),
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

// A freshly dropped logo is saved to storage and wins; otherwise the current one
// (carried in `currentLogo`) is kept. Throws a user-facing Error on a bad type or size.
async function resolveLogo(formData: FormData): Promise<string> {
  const file = formData.get("logoFile");
  if (file instanceof File && file.size > 0) return saveUserImage(file);
  const current = formData.get("currentLogo");
  return typeof current === "string" ? current : "";
}

function readId(formData: FormData): number | null {
  const n = Number(formData.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// The selected scope ids (checkbox group). Always returns an array so an empty
// selection clears the associations on update.
function readScopeIds(formData: FormData): number[] {
  return formData
    .getAll("scopeIds")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

// Revalidate both the admin list and the public landing page (partners section).
function revalidate() {
  revalidatePath("/[locale]/dashboard/partners", "page");
  revalidatePath("/[locale]", "page");
}

export async function createPartnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  let logo = "";
  try {
    logo = await resolveLogo(formData);
  } catch (error) {
    return { fieldErrors: { logo: error instanceof Error ? error.message : "Invalid image" } };
  }
  const parsed = fieldsSchema.safeParse({
    name: formData.get("name"),
    logo,
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  let createdId: number | undefined;
  try {
    const created = await partnerService.create({
      ...parsed.data,
      scopeIds: readScopeIds(formData),
    });
    createdId = created.id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  revalidate();
  return { ok: true, id: createdId, name: parsed.data.name };
}

export async function updatePartnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const id = readId(formData);
  if (!id) return { error: "Invalid partner" };

  let logo = "";
  try {
    logo = await resolveLogo(formData);
  } catch (error) {
    return { fieldErrors: { logo: error instanceof Error ? error.message : "Invalid image" } };
  }
  const parsed = fieldsSchema.safeParse({
    name: formData.get("name"),
    logo,
    details: formData.get("details"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  try {
    await partnerService.update(id, {
      ...parsed.data,
      scopeIds: readScopeIds(formData),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  revalidate();
  return { ok: true };
}

export async function deletePartnerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const id = readId(formData);
  if (!id) return { error: "Invalid partner" };

  try {
    await partnerService.delete(id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete" };
  }

  revalidate();
  return { ok: true };
}
