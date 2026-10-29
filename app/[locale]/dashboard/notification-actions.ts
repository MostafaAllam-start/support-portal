"use server";

import { revalidatePath } from "next/cache";
import { requireDashboardAccess } from "@/lib/auth/guards";
import { notificationService } from "@/services";

export async function markNotificationReadAction(
  notificationId: number,
): Promise<{ ok: boolean }> {
  const user = await requireDashboardAccess();
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return { ok: false };
  }

  await notificationService.markRead(notificationId, user.id);
  revalidatePath("/[locale]/dashboard", "layout");
  return { ok: true };
}
