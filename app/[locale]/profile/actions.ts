"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { userService } from "@/services";
import { requireSignedInUser } from "@/lib/auth/guards";
import { saveUserImage } from "@/lib/uploads";

export type ProfileState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

type ErrorTranslator = (key: string) => string;

// Built per request so the messages are in the caller's locale.
function profileSchema(t: ErrorTranslator) {
  return z.object({
    name: z.string().trim().min(1, t("nameRequired")),
    email: z
      .string()
      .trim()
      .min(1, t("emailRequired"))
      .pipe(z.email(t("emailInvalid"))),
    jobTitle: z.string().optional(),
    website: z.string().optional(),
    whatsapp: z.string().optional(),
    linkedin: z.string().optional(),
    // Optional new password; blank means "keep current".
    newPassword: z.string().min(8, t("passwordMin")).optional(),
    confirmPassword: z.string().optional(),
    currentPassword: z.string().optional(),
  });
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

function readText(formData: FormData, field: string): string | undefined {
  const raw = formData.get(field);
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

// Passwords are taken as typed (no trimming): spaces may be part of them.
function readSecret(formData: FormData, field: string): string | undefined {
  const raw = formData.get(field);
  return typeof raw === "string" && raw !== "" ? raw : undefined;
}

// Any signed-in user (customer, staff, system support, admin) edits their own
// account: name, email, password, photo and contact details. The id comes from
// the session, never the form, so a user can only update themselves. Changing the
// email or password requires the current password.
export async function updateProfileAction(
  _prevState: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireSignedInUser();
  const t = await getTranslations("Profile.errors");

  const parsed = profileSchema(t).safeParse({
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    jobTitle: readText(formData, "jobTitle"),
    website: readText(formData, "website"),
    whatsapp: readText(formData, "whatsapp"),
    linkedin: readText(formData, "linkedin"),
    newPassword: readSecret(formData, "newPassword"),
    confirmPassword: readSecret(formData, "confirmPassword"),
    currentPassword: readSecret(formData, "currentPassword"),
  });
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { email, newPassword, confirmPassword, currentPassword, ...rest } =
    parsed.data;
  const emailChanged = email !== user.email;
  const fieldErrors: Record<string, string> = {};

  if (newPassword && newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = t("passwordMismatch");
  }
  if (emailChanged && (await userService.findConflict(undefined, email, user.id))) {
    fieldErrors.email = t("emailTaken");
  }
  if (emailChanged || newPassword) {
    if (!currentPassword) {
      fieldErrors.currentPassword = t("currentPasswordRequired");
    } else if (!(await userService.verifyPassword(user.id, currentPassword))) {
      fieldErrors.currentPassword = t("currentPasswordWrong");
    }
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  // A freshly uploaded photo wins; otherwise keep the current one.
  let image: string | undefined;
  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) {
    try {
      image = await saveUserImage(file);
    } catch (error) {
      return {
        fieldErrors: {
          image: error instanceof Error ? error.message : "Invalid image",
        },
      };
    }
  }

  try {
    await userService.update(user.id, {
      name: rest.name,
      jobTitle: rest.jobTitle ?? null,
      website: rest.website ?? null,
      whatsapp: rest.whatsapp ?? null,
      linkedin: rest.linkedin ?? null,
      ...(emailChanged ? { email } : {}),
      ...(image ? { image } : {}),
      ...(newPassword ? { password: newPassword } : {}),
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to update profile",
    };
  }

  revalidatePath("/[locale]/profile", "page");
  // The dashboard shell shows the name and photo in its sidebar.
  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true };
}
