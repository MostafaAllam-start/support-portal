import { getTranslations } from "next-intl/server";
import type { AccountCredentialsEmailInput, EmailMessage } from "./types";

const RTL_LOCALES = new Set(["ar"]);

// Absolute link into the portal (an email can't use relative URLs). APP_URL is
// read at runtime; NEXT_PUBLIC_APP_URL is only a fallback because Next inlines it
// at build time, where the Docker build has no .env. Null when neither is set,
// in which case the email simply omits the button.
export function portalUrl(locale: string, path: string): string | null {
  const origin = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) return null;
  return `${origin.replace(/\/+$/, "")}/${locale}${path}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Layout = {
  locale: string;
  appName: string;
  heading: string;
  paragraphs: string[];
  // Label/value pairs rendered as a highlighted block (e.g. login details).
  details?: [label: string, value: string][];
  action?: { label: string; href: string } | null;
  footer: string;
};

// Inline-styled, table-based markup: the lowest common denominator that renders
// consistently across mail clients.
function renderHtml(layout: Layout): string {
  const dir = RTL_LOCALES.has(layout.locale) ? "rtl" : "ltr";
  const align = dir === "rtl" ? "right" : "left";

  const paragraphs = layout.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${escapeHtml(text)}</p>`,
    )
    .join("");

  const details = layout.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f1f5f9;border-radius:8px;">${layout.details
        .map(
          ([label, value]) =>
            `<tr><td style="padding:10px 16px;font-size:13px;color:#64748b;width:40%;">${escapeHtml(label)}</td><td style="padding:10px 16px;font-size:15px;font-family:Consolas,Menlo,monospace;color:#0f172a;" dir="ltr">${escapeHtml(value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";

  const action = layout.action
    ? `<p style="margin:0 0 20px;"><a href="${escapeHtml(layout.action.href)}" style="display:inline-block;padding:10px 20px;border-radius:6px;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(layout.action.label)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="${layout.locale}" dir="${dir}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(layout.heading)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,'Segoe UI',Tahoma,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;text-align:${align};" dir="${dir}">
<tr><td style="padding:20px 28px;border-bottom:1px solid #e2e8f0;font-size:15px;font-weight:600;color:#0f172a;">${escapeHtml(layout.appName)}</td></tr>
<tr><td style="padding:28px;">
<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(layout.heading)}</h1>
${paragraphs}${details}${action}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#94a3b8;">${escapeHtml(layout.footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderText(layout: Layout): string {
  return [
    layout.heading,
    "",
    ...layout.paragraphs.flatMap((text) => [text, ""]),
    ...(layout.details?.length
      ? [...layout.details.map(([label, value]) => `${label}: ${value}`), ""]
      : []),
    ...(layout.action ? [`${layout.action.label}: ${layout.action.href}`, ""] : []),
    "--",
    layout.footer,
  ].join("\n");
}

function render(to: string, subject: string, layout: Layout): EmailMessage {
  return { to, subject, html: renderHtml(layout), text: renderText(layout) };
}

// Sent to a user an admin just created: their username and generated password.
export async function accountCredentialsEmail(
  input: AccountCredentialsEmailInput,
): Promise<EmailMessage> {
  const t = await getTranslations({ locale: input.locale, namespace: "Emails" });
  const href = portalUrl(input.locale, "/login");

  return render(input.to, t("accountCreated.subject"), {
    locale: input.locale,
    appName: t("appName"),
    heading: t("greeting", { name: input.name }),
    paragraphs: [t("accountCreated.intro"), t("accountCreated.changePassword")],
    details: [
      [t("accountCreated.username"), input.username],
      [t("accountCreated.password"), input.password],
    ],
    action: href ? { label: t("accountCreated.signIn"), href } : null,
    footer: t("footer"),
  });
}

// An in-app notification mirrored by email. `href` is the portal path the
// notification points at, or null when it has no page.
export async function notificationEmail(input: {
  to: string;
  name: string;
  title: string;
  details: string;
  href: string | null;
  locale: string;
}): Promise<EmailMessage> {
  const t = await getTranslations({ locale: input.locale, namespace: "Emails" });
  const url = input.href ? portalUrl(input.locale, input.href) : null;

  return render(input.to, input.title, {
    locale: input.locale,
    appName: t("appName"),
    heading: input.title,
    paragraphs: [t("greeting", { name: input.name }), input.details],
    action: url ? { label: t("notification.view"), href: url } : null,
    footer: t("notification.footer"),
  });
}
