"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import {
  emailService,
  projectService,
  roleService,
  scopeService,
  userService,
} from "@/services";
import type { ProjectMembershipInput, SafeUser } from "@/services";
import { UserRole, isUserRole } from "@/lib/auth/roles";
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
// The account type, company and project roles are read by readAccess. Built
// per-request so the messages are translated to the caller's locale.
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
  // Project roles show on the Projects pages; the featured flag on the landing.
  revalidatePath("/[locale]/dashboard/projects", "layout");
  revalidatePath("/[locale]", "page");
}

type Access = {
  role: UserRole;
  // Team members only: also works the branding-site requests.
  isSupport: boolean;
  companyId: number | null;
  // The scopes (CTC, ECM, …) a team member or client holds; none for admins.
  scopeIds: number[];
  memberships: ProjectMembershipInput[];
};

// The distinct positive integer ids posted under one field name.
function readIdList(formData: FormData, key: string): number[] {
  return [
    ...new Set(
      formData
        .getAll(key)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
}

// Reads and checks the account type, the scope, the main company and a team
// member's project roles and support option. Team members and clients need one
// or more scopes (CTC, ECM, …: the companies they work with); admins have none.
// A team member also needs a main company among the scopes' companies. A client
// may pick the company they start in among them (optional): without one, or
// with one outside the scopes, they get the first of them. Each project-role row must
// name an existing project of a company in the scopes and an existing role, and
// a project may appear once.
async function readAccess(
  formData: FormData,
  t: ErrorTranslator,
  lockedRole?: UserRole,
): Promise<{ access?: Access; fieldErrors: Record<string, string> }> {
  const fieldErrors: Record<string, string> = {};
  const rawRole = lockedRole ?? formData.get("role");
  if (!isUserRole(rawRole)) {
    return { fieldErrors: { role: t("typeInvalid") } };
  }
  const role = rawRole;

  const scoped = role === UserRole.client || role === UserRole.team_member;
  const isSupport =
    role === UserRole.team_member && formData.get("isSupport") === "true";
  let companyId = role === UserRole.admin ? null : readCompanyId(formData);
  let scopeIds: number[] = [];
  let scopeCompanyIds: number[] = [];
  if (scoped) {
    const picked = readIdList(formData, "scopeIds");
    const scopes = (await scopeService.list()).filter((scope) =>
      picked.includes(scope.id),
    );
    if (scopes.length === 0 || scopes.length !== picked.length) {
      fieldErrors.scopeIds = t("scopeRequired");
    } else {
      scopeIds = scopes.map((scope) => scope.id);
      scopeCompanyIds = [
        ...new Set(scopes.flatMap((scope) => scope.companies.map((c) => c.id))),
      ];
      const inScope = companyId != null && scopeCompanyIds.includes(companyId);
      // With one company in the scopes it is the company, and a client whose
      // company is outside them gets the first; a team member must pick one.
      if (scopeCompanyIds.length === 1 || (role === UserRole.client && !inScope)) {
        companyId = scopeCompanyIds[0];
      } else if (!inScope) {
        fieldErrors.companyId = t("companyOutsideScope");
      }
    }
  }

  let memberships: ProjectMembershipInput[] = [];
  if (role === UserRole.team_member) {
    const projectIds = formData.getAll("membershipProjectId").map(Number);
    const roleIds = formData.getAll("membershipRoleId").map(Number);
    memberships = projectIds.map((projectId, index) => ({
      projectId,
      roleId: roleIds[index],
    }));
    const [projects, roles] = await Promise.all([
      projectService.list(),
      roleService.list(),
    ]);
    const projectCompany = new Map(projects.map((p) => [p.id, p.companyId]));
    const knownRoles = new Set(roles.map((r) => r.id));
    if (
      memberships.some(
        (m) => !projectCompany.has(m.projectId) || !knownRoles.has(m.roleId),
      )
    ) {
      fieldErrors.memberships = t("membershipInvalid");
    } else if (
      !fieldErrors.scopeIds &&
      memberships.some(
        (m) => !scopeCompanyIds.includes(projectCompany.get(m.projectId)!),
      )
    ) {
      fieldErrors.memberships = t("projectOutsideScope");
    } else if (
      new Set(memberships.map((m) => m.projectId)).size !== memberships.length
    ) {
      fieldErrors.memberships = t("membershipDuplicate");
    }
  }

  return Object.keys(fieldErrors).length > 0
    ? { fieldErrors }
    : { access: { role, isSupport, companyId, scopeIds, memberships }, fieldErrors };
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
  const { access, fieldErrors: accessErrors } = await readAccess(formData, t);
  if (!parsed.success || !access) {
    return {
      fieldErrors: {
        ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)),
        ...accessErrors,
      },
    };
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
        ...access,
        website: readOptional(formData, "website") ?? null,
        whatsapp: readOptional(formData, "whatsapp") ?? null,
        linkedin: readOptional(formData, "linkedin") ?? null,
        // Only team members are featured or get a contact card.
        isFeatured:
          access.role === UserRole.team_member && formData.get("isFeatured") === "true",
        hasContactInfoCard:
          access.role === UserRole.team_member &&
          formData.get("hasContactInfoCard") === "true",
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
  const admin = await requireRole("admin");

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

  // The seeded default admin stays an admin, and an admin can't change their own
  // type (and lock themselves out), even if a tampered request says otherwise.
  const lockedRole =
    existing.username === DEFAULT_ADMIN_USERNAME || id === admin.id
      ? existing.role
      : undefined;
  const { access, fieldErrors: accessErrors } = await readAccess(
    formData,
    t,
    lockedRole,
  );

  const fieldErrors: Record<string, string> = {
    ...(parsed.success ? {} : fieldErrorsFrom(parsed.error)),
    ...accessErrors,
  };
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
  if (!parsed.success || !access || Object.keys(fieldErrors).length > 0) {
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

  try {
    await userService.update(
      id,
      {
        ...parsed.data,
        role: access.role,
        isSupport: access.isSupport,
        password,
        image,
        // A null clears the column; undefined would leave it unchanged.
        jobTitle: readOptional(formData, "jobTitle") ?? null,
        companyId: access.companyId,
        scopeIds: access.scopeIds,
        website: readOptional(formData, "website") ?? null,
        whatsapp: readOptional(formData, "whatsapp") ?? null,
        linkedin: readOptional(formData, "linkedin") ?? null,
        // Only team members are featured or get a contact card.
        isFeatured:
          access.role === UserRole.team_member && formData.get("isFeatured") === "true",
        hasContactInfoCard:
          access.role === UserRole.team_member &&
          formData.get("hasContactInfoCard") === "true",
      },
      // Replaces a team member's project roles; other types hold none.
      access.role === UserRole.team_member ? access.memberships : undefined,
    );
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
