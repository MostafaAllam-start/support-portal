import { z } from "zod";

export const loginSchema = z.object({
  // Accepts either the username or the email.
  identifier: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
});

// Accounts are only created by an admin. The email is required: the new user's
// sign-in credentials are delivered there.
export const createUserSchema = z.object({
  name: z.string().min(1),
  username: z.string().min(3),
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  jobTitle: z.string().optional(),
  image: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  username: z.string().min(3).optional(),
  email: z.email().optional(),
  password: z.string().min(8).optional(),
  jobTitle: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  // Contact fields the user can manage from their own profile.
  website: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  // The global roles (every other role is per-project): admin, and system
  // support, which works the branding-site requests.
  isAdmin: z.boolean().optional(),
  isSystemSupport: z.boolean().optional(),
  // Whether the user may open the staff dashboard.
  canAccessDashboard: z.boolean().optional(),
  // The company the user belongs to (ECM/CTC).
  companyId: z.number().int().positive().nullable().optional(),
  // Whether the user is featured on their company's public landing-page team.
  isTeamMember: z.boolean().optional(),
  // Whether the user has a public contact card at /contact-info/[id].
  hasContactInfoCard: z.boolean().optional(),
});
