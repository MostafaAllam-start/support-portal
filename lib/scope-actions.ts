"use server";

import { revalidatePath } from "next/cache";
import { chooseScope } from "@/lib/choose-scope";

// Controller for the in-header scope switcher: lets a visitor change the scope
// they're browsing as.
export async function changeScopeAction(formData: FormData): Promise<void> {
  if (!(await chooseScope(Number(formData.get("scopeId"))))) return;

  // Re-render every route under the new scope (header logo, landing copy, the
  // CTC-only project picker, etc.).
  revalidatePath("/", "layout");
}
