"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { projectService, userProjectService, userService } from "@/services";
import { requireRole } from "@/lib/auth/guards";

export type ProjectActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const createSchema = z.object({
  name: z.string().min(1),
  location: z.string().min(1),
  companyId: z.coerce.number().int().positive(),
  // 0 / empty means "no manager".
  managerId: z.coerce.number().int().nonnegative().optional(),
});

const updateSchema = createSchema.extend({
  id: z.coerce.number().int().positive(),
});

const memberSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
  roleId: z.coerce.number().int().positive(),
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

function revalidate() {
  revalidatePath("/[locale]/dashboard/projects", "page");
}

// Only team members whose scopes include the project's company manage it or
// hold a role on it. Returns the error to show otherwise (or null). The pickers
// list only those users, so this guards against stale or tampered input.
async function teamMemberError(
  userId: number,
  companyId: number,
): Promise<string | null> {
  const companyIds = await userService.teamMemberCompanyIds(userId);
  if (companyIds?.includes(companyId)) return null;
  const t = await getTranslations("Dashboard");
  return companyIds == null
    ? t("projects.teamMemberOnly")
    : t("projects.outsideScope");
}

export async function createProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireRole("admin");

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    location: formData.get("location"),
    companyId: formData.get("companyId"),
    managerId: formData.get("managerId") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  if (parsed.data.managerId) {
    const error = await teamMemberError(parsed.data.managerId, parsed.data.companyId);
    if (error) return { error };
  }

  try {
    const { managerId, ...data } = parsed.data;
    await projectService.create({
      ...data,
      managerId: managerId ? managerId : null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed" };
  }

  revalidate();
  return { ok: true };
}

export async function updateProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireRole("admin");

  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    location: formData.get("location"),
    companyId: formData.get("companyId"),
    managerId: formData.get("managerId") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  if (parsed.data.managerId) {
    const error = await teamMemberError(parsed.data.managerId, parsed.data.companyId);
    if (error) return { error };
  }

  try {
    const { id, managerId, ...data } = parsed.data;
    await projectService.update(id, {
      ...data,
      managerId: managerId ? managerId : null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed" };
  }

  revalidate();
  return { ok: true };
}

export async function deleteProjectAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireRole("admin");

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "Invalid project" };

  try {
    await projectService.delete(id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed" };
  }

  revalidate();
  return { ok: true };
}

// Adds (or re-roles) a team member on a project via the UserProject join.
export async function addProjectMemberAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireRole("admin");

  const parsed = memberSchema.safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId"),
    roleId: formData.get("roleId"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };
  const project = await projectService.findById(parsed.data.projectId);
  if (!project) return { error: "Invalid project" };
  const memberError = await teamMemberError(parsed.data.userId, project.companyId);
  if (memberError) return { error: memberError };

  try {
    await userProjectService.assign(parsed.data);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed" };
  }

  revalidate();
  return { ok: true };
}

export async function removeProjectMemberAction(
  _prev: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  await requireRole("admin");

  const projectId = Number(formData.get("projectId"));
  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(projectId) || !Number.isInteger(userId)) {
    return { error: "Invalid member" };
  }

  try {
    await userProjectService.remove(userId, projectId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed" };
  }

  revalidate();
  return { ok: true };
}
