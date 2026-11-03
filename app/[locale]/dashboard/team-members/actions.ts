"use server";

import { revalidatePath } from "next/cache";
import { userService } from "@/services";
import { requireRole } from "@/lib/auth/guards";

export type ActionState = {
  ok?: boolean;
  error?: string;
};

function readUserId(formData: FormData): number | null {
  const n = Number(formData.get("userId"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Revalidate both the admin list and the public landing page (which renders the
// team section) so changes show up in both places.
function revalidate() {
  revalidatePath("/[locale]/dashboard/team-members", "page");
  revalidatePath("/[locale]", "page");
}

// Feature an existing user on their company's landing-page team.
export async function addTeamMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const userId = readUserId(formData);
  if (!userId) return { error: "Invalid user" };

  try {
    await userService.update(userId, { isFeatured: true });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save" };
  }

  revalidate();
  return { ok: true };
}

// Remove a user from the landing-page team (their account is untouched).
export async function removeTeamMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const userId = readUserId(formData);
  if (!userId) return { error: "Invalid user" };

  try {
    await userService.update(userId, { isFeatured: false });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Failed to remove",
    };
  }

  revalidate();
  return { ok: true };
}
