"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { emailService, userService } from "@/services";
import type { SafeUser } from "@/services";
import { DEFAULT_ADMIN_USERNAME, requireRole } from "@/lib/auth/guards";
import { generatePassword } from "@/lib/auth/password";
import { saveUserImage } from "@/lib/uploads";

// Scoped translator for the inline form validation messages.
type ErrorTranslator = (key: string) => string;
function getErrorTranslations(): Promise<ErrorTranslator> {
  return getTranslations("Dashboard.users.form.errors");
}

export type ActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

// Shared identity fields. `password` is generated on create (and emailed to the
// user) and optional on edit (blank = keep current), so it's handled separately.
// The email is required: it's where the sign-in credentials are delivered.
// The global roles (`isAdmin`, `isSystemSupport`) are read off the form
// checkboxes separately; all other roles are granted per-project on the Projects
// page. Built per-request so the messages are translated to the caller's locale.
function identitySchema(t: ErrorTranslator) {
  return z.object({
    name: z.string().trim().min(1, t("nameRequired")),
    username: z
      .string()
      .trim()
      .min(3, t("usernameMin"))
      .regex(/^[a-zA-Z0-9._-]+$/, t("usernameFormat")),
    email: z
      .string()
      .trim()
      .min(1, t("emailRequired"))
      .pipe(z.email(t("emailInvalid"))),
  });
}

// Field-level message for a username/email that already belongs to another user.
function conflictMessage(t: ErrorTranslator, field: "username" | "email"): string {
  return field === "username" ? t("usernameTaken") : t("emailRegistered");
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

function readId(formData: FormData): number | null {
  const n = Number(formData.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// The company select is optional: a blank/missing value clears the user's
// company (null), otherwise it's the chosen company's id.
function readCompanyId(formData: FormData): number | null {
  const n = Number(formData.get("companyId"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// "" / missing -> undefined; otherwise the trimmed string.
function readOptional(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  return raw.trim();
}

// Resolve the user's avatar image. A freshly uploaded file (saved to
// /public/users-images) wins; otherwise fall back to the existing image carried
// in `currentImage` (edit mode). Returns null when neither is present — the user
// has no photo and the UI shows an initials avatar. May throw on bad type/size.
async function resolveImage(formData: FormData): Promise<string | null> {
  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) {
    return saveUserImage(file);
  }
  const current = formData.get("currentImage");
  return typeof current === "string" && current.trim() !== "" ? current : null;
}

function revalidate() {
  revalidatePath("/[locale]/dashboard/users", "page");
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const t = await getErrorTranslations();
  // The generated password is only ever delivered by email, so refuse up front
  // rather than create an account nobody can sign in to.
  if (!emailService.canSend()) {
    return { error: t("emailNotConfigured") };
  }

  const parsed = identitySchema(t).safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  // Reject a username/email already taken, surfaced on the offending field.
  const conflict = await userService.findConflict(
    parsed.data.username,
    parsed.data.email,
  );
  if (conflict) {
    return { fieldErrors: { [conflict]: conflictMessage(t, conflict) } };
  }

  let image: string | null;
  try {
    image = await resolveImage(formData);
  } catch (error) {
    return {
      fieldErrors: {
        image: error instanceof Error ? error.message : "Invalid image",
      },
    };
  }

  const isAdmin = formData.get("isAdmin") === "true";
  const isSystemSupport = formData.get("isSystemSupport") === "true";
  // Admins always have dashboard access, so an admin implies the flag.
  const canAccessDashboard =
    isAdmin || formData.get("canAccessDashboard") === "true";
  // Each account gets its own random password, emailed to the user below.
  const password = generatePassword();

  let created: SafeUser;
  try {
    created = await userService.create(
      {
        ...parsed.data,
        password,
        jobTitle: readOptional(formData, "jobTitle"),
        image: image ?? undefined,
      },
      {
        isAdmin,
        isSystemSupport,
        canAccessDashboard,
        companyId: readCompanyId(formData),
        website: readOptional(formData, "website") ?? null,
        whatsapp: readOptional(formData, "whatsapp") ?? null,
        linkedin: readOptional(formData, "linkedin") ?? null,
        isTeamMember: formData.get("isTeamMember") === "true",
        hasContactInfoCard: formData.get("hasContactInfoCard") === "true",
      },
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  try {
    await emailService.sendAccountCredentials({
      to: created.email,
      name: created.name,
      username: created.username,
      password,
      locale: await getLocale(),
    });
  } catch (error) {
    // Without the email the account is unusable, so undo it and let the admin
    // retry (e.g. after fixing the address).
    console.error("[createUserAction] Failed to email the new user's credentials:", error);
    await userService.hardDelete(created.id);
    return { error: t("credentialsEmailFailed") };
  }

  revalidate();
  return { ok: true };
}

export async function updateUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const id = readId(formData);
  if (!id) return { error: "Invalid user" };

  const existing = await userService.findWithRole(id);
  if (!existing) return { error: "Invalid user" };

  const t = await getErrorTranslations();
  const parsed = identitySchema(t).safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    email: formData.get("email"),
  });
  const password = readOptional(formData, "password"); // blank = keep current

  const fieldErrors: Record<string, string> = parsed.success
    ? {}
    : fieldErrorsFrom(parsed.error);
  if (password !== undefined && password.length < 8) {
    fieldErrors.password = t("passwordMin");
  }
  // Reject a username/email already taken by *another* user (ignore this one).
  if (parsed.success) {
    const conflict = await userService.findConflict(
      parsed.data.username,
      parsed.data.email,
      id,
    );
    if (conflict) {
      fieldErrors[conflict] = conflictMessage(t, conflict);
    }
  }
  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { fieldErrors };
  }

  let image: string | null;
  try {
    image = await resolveImage(formData);
  } catch (error) {
    return {
      fieldErrors: {
        image: error instanceof Error ? error.message : "Invalid image",
      },
    };
  }

  // The seeded default admin is locked to admin, even if a tampered request
  // submits otherwise.
  const isDefaultAdmin = existing.username === DEFAULT_ADMIN_USERNAME;
  const isAdmin = isDefaultAdmin ? true : formData.get("isAdmin") === "true";
  const isSystemSupport = formData.get("isSystemSupport") === "true";
  // Admins always have dashboard access, so an admin implies the flag.
  const canAccessDashboard =
    isAdmin || formData.get("canAccessDashboard") === "true";

  try {
    await userService.update(id, {
      ...parsed.data,
      isAdmin,
      isSystemSupport,
      canAccessDashboard,
      password,
      image,
      // A null clears the column; undefined would leave it unchanged.
      jobTitle: readOptional(formData, "jobTitle") ?? null,
      companyId: readCompanyId(formData),
      website: readOptional(formData, "website") ?? null,
      whatsapp: readOptional(formData, "whatsapp") ?? null,
      linkedin: readOptional(formData, "linkedin") ?? null,
      isTeamMember: formData.get("isTeamMember") === "true",
      hasContactInfoCard: formData.get("hasContactInfoCard") === "true",
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  revalidate();
  return { ok: true };
}

// Disables or re-enables an account based on the `disabled` flag. An admin cannot
// disable their own account (which would lock them out mid-session).
export async function setUserDisabledAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireRole("admin");

  const id = readId(formData);
  if (!id) return { error: "Invalid user" };

  const disabled = formData.get("disabled") === "true";
  if (disabled && id === admin.id) {
    return { error: "You cannot disable your own account." };
  }

  try {
    if (disabled) {
      await userService.disable(id);
    } else {
      await userService.enable(id);
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update" };
  }

  revalidate();
  return { ok: true };
}
