import nodemailer from "nodemailer";
import type { Mail } from "nodemailer";
import { getLocale } from "next-intl/server";
import { Service } from "../service";
import { routing } from "@/i18n/routing";
import { customerNotificationHref, notificationHref } from "@/lib/notifications";
import { accountCredentialsEmail, notificationEmail } from "./templates";
import type {
  AccountCredentialsEmailInput,
  EmailMessage,
  NotificationEmailInput,
} from "./types";

// The locale of the current request (so an email matches the language of the
// in-app text it accompanies), falling back to the default outside a request.
async function currentLocale(): Promise<string> {
  try {
    return await getLocale();
  } catch {
    return routing.defaultLocale;
  }
}

// Outgoing mail over SMTP, configured through the SMTP_* / MAIL_* environment
// variables (see the README). Without SMTP_HOST, development prints each message
// to the server log instead of sending it, and production refuses to send.
export class EmailService extends Service {
  private transporter: Mail | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  // Whether send() can deliver a message — over SMTP, or to the log in development.
  canSend(): boolean {
    return this.isConfigured() || process.env.NODE_ENV !== "production";
  }

  // Sends one message. Throws when delivery fails, so callers that depend on the
  // email arriving (e.g. account credentials) can react.
  async send(message: EmailMessage): Promise<void> {
    if (!this.isConfigured()) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("Email is not configured (SMTP_HOST is unset).");
      }
      // Development only: the text may hold credentials, so this never runs in
      // production.
      console.info(
        `[EmailService] SMTP_HOST is unset; logging the email instead of sending it.\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}`,
      );
      return;
    }

    await this.transport().sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      ...message,
    });
  }

  // Emails a newly created user their username and initial password.
  async sendAccountCredentials(input: AccountCredentialsEmailInput): Promise<void> {
    await this.send(await accountCredentialsEmail(input));
  }

  // Mirrors an in-app notification by email to each active recipient. Only runs
  // when SMTP is configured; MAIL_NOTIFICATIONS=false turns it off unless `force`
  // is set. Never throws: a mail failure must not break the in-app notification
  // that triggered it.
  async sendNotification(
    userIds: number[],
    notification: NotificationEmailInput,
    { force = false }: { force?: boolean } = {},
  ): Promise<void> {
    if (!this.isConfigured()) return;
    if (!force && process.env.MAIL_NOTIFICATIONS === "false") return;
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return;

    try {
      const recipients = await this.prisma.user.findMany({
        where: { id: { in: ids }, deletedAt: null, isDisabled: false },
        select: {
          email: true,
          name: true,
          isAdmin: true,
          canAccessDashboard: true,
          _count: { select: { projectMemberships: true, managedProjects: true } },
        },
      });
      const locale = await currentLocale();

      const results = await Promise.allSettled(
        recipients.map(async (user) => {
          // Staff (same rule as UserService.toAuthUser) open the dashboard page;
          // customers, such as a ticket's reporter, open the public one.
          const isStaff =
            user.isAdmin ||
            user.canAccessDashboard ||
            user._count.projectMemberships > 0 ||
            user._count.managedProjects > 0;
          const href = isStaff
            ? notificationHref(notification.entityType, notification.entityId)
            : customerNotificationHref(notification.entityType, notification.entityId);

          await this.send(
            await notificationEmail({
              to: user.email,
              name: user.name,
              title: notification.title,
              details: notification.details,
              href,
              locale,
            }),
          );
        }),
      );
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("[EmailService] Failed to send a notification email:", result.reason);
        }
      }
    } catch (error) {
      console.error("[EmailService] Failed to send notification emails:", error);
    }
  }

  private transport(): Mail {
    if (!this.transporter) {
      const port = Number(process.env.SMTP_PORT) || 587;
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        // Implicit TLS (typically port 465); otherwise the connection is
        // upgraded with STARTTLS when the server offers it.
        secure: process.env.SMTP_SECURE
          ? process.env.SMTP_SECURE === "true"
          : port === 465,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
          : undefined,
      });
    }
    return this.transporter;
  }
}

export const emailService = new EmailService();

export * from "./types";
