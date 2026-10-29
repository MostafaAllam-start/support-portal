import { notificationRepository } from "./notificationRepository";
import { Notification, NotificationEntityType } from "@/app/generated/prisma/client";
import { emailService } from "@/services/email-service";

// In Docker container environment, the Socket.IO server will be accessible at http://realtime:3001
const SOCKET_SERVER_URL = process.env.SOCKET_INTERNAL_URL || "http://localhost:3001";

export class NotificationService {
  async create(data: {
    userId: number;
    type: string;
    title: string;
    details: string;
    entityType?: NotificationEntityType | null;
    entityId?: number | null;
  }): Promise<Notification> {
    const notification = await notificationRepository.create(data);
    await this.pushRealtime([data.userId], notification);
    await emailService.sendNotification([data.userId], data);
    return notification;
  }

  async notifyMany(
    userIds: number[],
    body: {
      type: string;
      title: string;
      details: string;
      entityType?: NotificationEntityType | null;
      entityId?: number | null;
    },
    // `forceEmail` sends the email copy even when MAIL_NOTIFICATIONS=false, for
    // notifications whose whole point is to reach the recipient's inbox.
    options: { forceEmail?: boolean } = {},
  ): Promise<number> {
    if (userIds.length === 0) return 0;
    const notifications = await notificationRepository.createMany(userIds, body);

    // Group by user and push to each
    for (const n of notifications) {
      await this.pushRealtime([n.userId], n);
    }

    // Mirror by email (no-op unless SMTP is configured; never throws).
    await emailService.sendNotification(
      notifications.map((n) => n.userId),
      body,
      { force: options.forceEmail },
    );

    return notifications.length;
  }

  async listForUser(userId: number, options?: { unreadOnly?: boolean; limit?: number }) {
    return notificationRepository.listForUser(userId, options);
  }

  async unreadCount(userId: number) {
    return notificationRepository.unreadCount(userId);
  }

  async markRead(id: number, userId: number) {
    return notificationRepository.markRead(id, userId);
  }

  async markAllRead(userId: number) {
    return notificationRepository.markAllRead(userId);
  }

  async delete(id: number, userId: number) {
    return notificationRepository.delete(id, userId);
  }

  async pushRealtime(userIds: number[], notification: any): Promise<void> {
    try {
      console.log(`[NotificationService] Pushing real-time notification to users ${userIds} via socket server at ${SOCKET_SERVER_URL}`);
      const response = await fetch(`${SOCKET_SERVER_URL}/api/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userIds, notification }),
      });
      if (!response.ok) {
        console.error(`[NotificationService] Failed to push realtime notification, status: ${response.status}`);
      }
    } catch (err) {
      console.error("[NotificationService] Error pushing realtime notification:", err);
    }
  }
}

export const notificationService = new NotificationService();
export * from "./notificationEvents";
