import type { NotificationEntityType } from "@/app/generated/prisma/client";

// A fully rendered message, ready for the transport. `text` is the plain-text
// alternative shown by clients that don't render HTML.
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

// The welcome email sent when an admin creates an account.
export type AccountCredentialsEmailInput = {
  to: string;
  name: string;
  username: string;
  password: string;
  locale: string;
};

// An in-app notification mirrored by email.
export type NotificationEmailInput = {
  title: string;
  details: string;
  entityType?: NotificationEntityType | null;
  entityId?: number | null;
};
