import nodemailer from "nodemailer";
import type { Mail, SendMailOptions } from "nodemailer";
import { getLocale } from "next-intl/server";
import { Service } from "../service";
import { routing } from "@/i18n/routing";
import { UserRole } from "@/lib/auth/roles";
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

// A positive integer from the environment, or the fallback.
function envInt(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

// Connection-level failures and the SMTP 4xx replies a server uses to say "try
// again later" (greylisting, rate limits, a busy mailbox). A 5xx reply or an
// authentication failure won't get better on retry, so those throw at once.
const TRANSIENT_CODES = new Set([
  "ECONNECTION",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ESOCKET",
  "EPIPE",
  "EDNS",
]);

function isTransient(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, responseCode } = error as {
    code?: string;
    responseCode?: number;
  };
  if (code === "EAUTH") return false;
  if (typeof responseCode === "number") {
    return responseCode >= 400 && responseCode < 500;
  }
  return code !== undefined && TRANSIENT_CODES.has(code);
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const { code, responseCode } = error as Error & {
    code?: string;
    responseCode?: number;
  };
  return [code, responseCode, error.message].filter(Boolean).join(" ");
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Outgoing mail through any SMTP provider (Gmail / Google Workspace, Microsoft
// 365, Amazon SES, Brevo, a company relay, …), configured with the SMTP_* /
// MAIL_* environment variables (see .env.example and the README). The transport
// keeps a small pool of connections, times out instead of hanging, checks the
// connection and credentials once on startup, and retries a message when the
// server says to try again later. Without SMTP_HOST, development prints each
// message to the server log instead of sending it, and production refuses to
// send.
export class EmailService extends Service {
  private transporter: Mail | null = null;
  private verification: Promise<boolean> | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.SMTP_HOST);
  }

  // Whether send() can deliver a message — over SMTP, or to the log in development.
  canSend(): boolean {
    return this.isConfigured() || process.env.NODE_ENV !== "production";
  }

  // Checks once that the SMTP server is reachable and accepts the credentials,
  // and logs the outcome, so a wrong host or password shows up in the logs at
  // startup rather than when the first user is created. Never throws.
  verifyConnection(): Promise<boolean> {
    if (!this.isConfigured()) return Promise.resolve(false);
    this.verification ??= this.transport()
      .verify()
      .then(() => {
        console.info(
          `[EmailService] SMTP ready: ${this.endpoint()}, sending as ${this.fromAddress() ?? "(no MAIL_FROM)"}.`,
        );
        return true;
      })
      .catch((error: unknown) => {
        console.error(
          `[EmailService] SMTP check failed for ${this.endpoint()}: ${describe(error)}`,
        );
        // Check again next time instead of caching the failure.
        this.verification = null;
        return false;
      });
    return this.verification;
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

    await this.sendWithRetry({
      from: this.fromAddress(),
      replyTo: process.env.MAIL_REPLY_TO || undefined,
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
        select: { email: true, name: true, role: true },
      });
      const locale = await currentLocale();

      const results = await Promise.allSettled(
        recipients.map(async (user) => {
          // Staff open the dashboard page; clients, such as a ticket's reporter,
          // open the customer one.
          const href =
            user.role !== UserRole.client
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

  // Closes the pooled connections (on shutdown).
  close(): void {
    this.transporter?.close();
    this.transporter = null;
    this.verification = null;
  }

  // Sends with up to MAIL_RETRY_ATTEMPTS tries (default 3), backing off 0.5 s,
  // 2 s, 8 s (with jitter) between them, but only for transient failures.
  private async sendWithRetry(mail: SendMailOptions): Promise<void> {
    const attempts = envInt("MAIL_RETRY_ATTEMPTS", 3);
    for (let attempt = 1; ; attempt++) {
      try {
        await this.transport().sendMail(mail);
        return;
      } catch (error) {
        if (attempt >= attempts || !isTransient(error)) throw error;
        const delay = 500 * 4 ** (attempt - 1) * (0.75 + Math.random() / 2);
        console.warn(
          `[EmailService] Send attempt ${attempt} of ${attempts} failed (${describe(error)}); retrying in ${Math.round(delay)} ms.`,
        );
        await sleep(delay);
      }
    }
  }

  private fromAddress(): string | undefined {
    return process.env.MAIL_FROM || process.env.SMTP_USER || undefined;
  }

  private port(): number {
    return envInt("SMTP_PORT", 587);
  }

  private secure(): boolean {
    // Implicit TLS (typically port 465); otherwise the connection is upgraded
    // with STARTTLS when the server offers it (or always, with SMTP_REQUIRE_TLS).
    return process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : this.port() === 465;
  }

  private endpoint(): string {
    const tls = this.secure()
      ? "TLS"
      : process.env.SMTP_REQUIRE_TLS === "true"
        ? "STARTTLS required"
        : "STARTTLS";
    return `${process.env.SMTP_HOST}:${this.port()} (${tls})`;
  }

  private auth() {
    const user = process.env.SMTP_USER;
    if (!user) return undefined;
    // OAuth2 (e.g. Microsoft 365, which is retiring password-based SMTP AUTH,
    // or Google Workspace without app passwords): nodemailer fetches and renews
    // the access token from the refresh token.
    if (process.env.SMTP_AUTH === "oauth2") {
      return {
        type: "OAuth2" as const,
        user,
        clientId: process.env.SMTP_OAUTH_CLIENT_ID,
        clientSecret: process.env.SMTP_OAUTH_CLIENT_SECRET,
        refreshToken: process.env.SMTP_OAUTH_REFRESH_TOKEN,
        accessUrl: process.env.SMTP_OAUTH_TOKEN_URL || undefined,
      };
    }
    return { user, pass: process.env.SMTP_PASSWORD };
  }

  private transport(): Mail {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: envInt("SMTP_POOL_MAX", 3),
        maxMessages: 100,
        host: process.env.SMTP_HOST,
        port: this.port(),
        secure: this.secure(),
        requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
        tls: {
          // Only turn off for a relay with a self-signed certificate.
          rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false",
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 30_000,
        auth: this.auth(),
        logger: process.env.MAIL_DEBUG === "true",
        debug: process.env.MAIL_DEBUG === "true",
      });
    }
    return this.transporter;
  }
}

export const emailService = new EmailService();

export * from "./types";
