"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { scopeService } from "@/services";
import { requireRole } from "@/lib/auth/guards";
import { saveUserImage } from "@/lib/uploads";

export type ScopeActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function readId(formData: FormData): number | null {
  const n = Number(formData.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

function revalidate() {
  revalidatePath("/[locale]/dashboard/scopes", "page");
  // The Users page shows each user's scopes; the public pages show their logos.
  revalidatePath("/[locale]/dashboard/users", "page");
  revalidatePath("/", "layout");
}

// A freshly uploaded logo (saved to /public/users-images) wins; otherwise the
// existing one carried in `currentLogo`. May throw if the upload is an invalid
// type or size.
async function resolveLogo(formData: FormData): Promise<string> {
  const file = formData.get("logoFile");
  if (file instanceof File && file.size > 0) return saveUserImage(file);
  const current = formData.get("currentLogo");
  return typeof current === "string" ? current : "";
}

// Reads and checks the name (required, unique), the logo (required) and the
// companies (at least one).
async function readFields(formData: FormData, excludeId?: number) {
  const t = await getTranslations("Dashboard.scopes.form.errors");
  const name = String(formData.get("name") ?? "").trim();
  const companyIds = formData
    .getAll("companyIds")
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = t("nameRequired");
  else if (await scopeService.nameTaken(name, excludeId)) {
    fieldErrors.name = t("nameTaken");
  }
  if (companyIds.length === 0) fieldErrors.companyIds = t("companiesRequired");

  let logo = "";
  try {
    logo = await resolveLogo(formData);
    if (!logo) fieldErrors.logo = t("logoRequired");
  } catch (error) {
    fieldErrors.logo = error instanceof Error ? error.message : t("logoRequired");
  }

  return { name, logo, companyIds: [...new Set(companyIds)], fieldErrors };
}

export async function updateScopeAction(
  _prev: ScopeActionState,
  formData: FormData,
): Promise<ScopeActionState> {
  await requireRole("admin");

  const id = readId(formData);
  if (!id || !(await scopeService.findById(id))) return { error: "Invalid scope" };

  const { name, logo, companyIds, fieldErrors } = await readFields(formData, id);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  try {
    await scopeService.update(id, { name, logo, companyIds });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  revalidate();
  return { ok: true };
}

export async function deleteScopeAction(
  _prev: ScopeActionState,
  formData: FormData,
): Promise<ScopeActionState> {
  await requireRole("admin");

  const id = readId(formData);
  if (!id) return { error: "Invalid scope" };

  try {
    // Refused while users still hold the scope, so nobody loses access silently.
    if (!(await scopeService.delete(id))) {
      const t = await getTranslations("Dashboard.scopes");
      return { error: t("inUse") };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete" };
  }

  revalidate();
  return { ok: true };
}
