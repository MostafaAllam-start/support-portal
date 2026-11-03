import type { z } from "zod";
import type { User } from "@/app/generated/prisma/client";
import type { EffectiveRole } from "@/lib/auth/roles";
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

// One project the user manages (Project.managerId), with its company.
export type ManagedProject = { id: number; companyId: number };

// A safe user enriched with everything role/visibility decisions need: the account
// type (`role`, already on User), the per-project memberships, the projects the
// user manages, and the single `effectiveRole` collapsed from those (see
// effectiveRoleName) for the surfaces that reason about one role name.
export type AuthUser = SafeUser & {
  effectiveRole: EffectiveRole;
  memberships: UserMembership[];
  managedProjects: ManagedProject[];
  // The ids of the user's scopes, and of the companies in them (empty without one).
  scopeIds: number[];
  scopeCompanyIds: number[];
};
