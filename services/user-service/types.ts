import type { z } from "zod";
import type { User } from "@/app/generated/prisma/client";
import type { UserRole } from "@/lib/auth/roles";
import type { loginSchema, createUserSchema, updateUserSchema } from "./schemas";

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// A user with the password field stripped — the shape returned by every service
// method that exposes a user.
export type SafeUser = Omit<User, "password">;

// One per-project role grant (from the UserProject join), carrying the project
// and its company so visibility checks can be scoped per company/project.
export type UserMembership = {
  projectId: number;
  companyId: number;
  roleName: string;
};

// A safe user enriched with everything role/visibility decisions need: the global
// admin flag (`isAdmin`, already on User), the per-project memberships, the ids of
// the projects the user manages, and a single derived `role` — the effective role
// collapsed from those inputs (see effectiveRoleName) — kept for the surfaces that
// still reason about one role name.
export type AuthUser = SafeUser & {
  userRole: UserRole;
  role: { name: string };
  memberships: UserMembership[];
  managedProjectIds: number[];
};
