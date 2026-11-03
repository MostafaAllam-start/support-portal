import { z } from "zod";

// The "Modules of interest" checkboxes on the branding site's demo form.
export const siteRequestModuleValues = [
  "documents",
  "correspondence",
  "processes",
  "meetings",
] as const;

export const siteRequestStatusValues = [
  "new",
  "contacted",
  "admin_notified",
  "closed",
] as const;

// What any public form posts. Lengths are capped because the forms are
// unauthenticated.
const visitorFields = {
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(320).pipe(z.email()),
  locale: z.enum(["en", "ar"]),
  // The scope the visitor was browsing as; not posted by the form itself.
  scopeId: z.number().int().positive().nullable().optional(),
};

// A demo request from the branding site.
export const createSiteRequestSchema = z.object({
  ...visitorFields,
  organization: z.string().trim().min(1).max(200),
  modules: z
    .array(z.enum(siteRequestModuleValues))
    .transform((modules) => [...new Set(modules)]),
  message: z
    .string()
    .trim()
    .max(5000)
    .transform((message) => message || null)
    .nullable(),
});

// A message from the landing page's contact form.
export const createContactRequestSchema = z.object({
  ...visitorFields,
  subject: z
    .string()
    .trim()
    .max(200)
    .transform((subject) => subject || null)
    .nullable(),
  message: z.string().trim().min(1).max(5000),
});

// Statuses system support can set by hand; admin_notified is only reached through
// the "notify admin" action.
export const manualSiteRequestStatusSchema = z.enum(["new", "contacted", "closed"]);
