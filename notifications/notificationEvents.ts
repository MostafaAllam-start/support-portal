import { z } from "zod";
import type {
  Notification,
  NotificationEntityType,
} from "@/app/generated/prisma/client";

export const notificationEntityTypeValues = [
  "ticket",
  "suggestion",
  "complaint",
  "site_request",
] as const;

export const createNotificationSchema = z.object({
  userId: z.number().int().positive(),
  type: z.string().min(1),
  title: z.string().min(1),
  details: z.string().min(1),
  entityType: z.enum(notificationEntityTypeValues).nullable().optional(),
  entityId: z.number().int().positive().nullable().optional(),
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type NotificationBody = Omit<CreateNotificationInput, "userId">;
export type { Notification, NotificationEntityType };
