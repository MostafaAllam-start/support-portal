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

// A demo request as posted by the public form. Lengths are capped because the
// endpoint is unauthenticated.
export const createSiteRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(320).pipe(z.email()),
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
  locale: z.enum(["en", "ar"]),
});

// Statuses system support can set by hand; admin_notified is only reached through
// the "notify admin" action.
export const manualSiteRequestStatusSchema = z.enum(["new", "contacted", "closed"]);
