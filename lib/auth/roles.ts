import { UserRole } from "@/app/generated/prisma/enums";

// The account type lives on User.role (the UserRole enum): admin, team_member
// or client. Team members also hold per-project roles (the UserProject join),
// may manage projects, and may be support (User.isSupport, the Requests page);
// what they see on the dashboard follows from those. These helpers collapse a user's account type and project
// roles into the single "effective role" name the dashboard surfaces reason about.

export { UserRole };

export const USER_ROLES = [
  UserRole.admin,
  UserRole.team_member,
  UserRole.client,
] as const;

// Whether a value is one of the account types (for form input).
export function isUserRole(value: unknown): value is UserRole {
  return (USER_ROLES as readonly unknown[]).includes(value);
}

// The role names that can be granted to a team member within a project.
export const PROJECT_ROLES = [
  "manager",
  "reviewer",
  "sap-consultant",
  "software-engineer",
] as const;

export enum ProjectRole {
  Manager = "manager",
  Reviewer = "reviewer",
  SapConsultant = "sap-consultant",
  SoftwareEngineer = "software-engineer",
}

// What a user is treated as on the dashboard: their account type, or for a team
// member their most privileged project role ("team-member" when they hold none).
export type EffectiveRole =
  | "admin"
  | "client"
  | "team-member"
  | `${ProjectRole}`;

// Inputs needed to derive a user's effective role.
export type RoleDerivation = {
  role: UserRole;
  // True when the user manages at least one project (Project.managerId).
  managesProject: boolean;
  // The role names from the user's project memberships (UserProject).
  membershipRoleNames: readonly string[];
};

// Collapses the inputs to one role name. Admin and client map 1:1. A
// team member takes their most privileged project role: manager > reviewer >
// sap-consultant > software-engineer, else "team-member".
export function effectiveRoleName(input: RoleDerivation): EffectiveRole {
  switch (input.role) {
    case UserRole.admin:
      return "admin";
    case UserRole.client:
      return "client";
  }
  if (input.managesProject || input.membershipRoleNames.includes("manager")) {
    return ProjectRole.Manager;
  }
  if (input.membershipRoleNames.includes("reviewer")) {
    return ProjectRole.Reviewer;
  }
  if (input.membershipRoleNames.includes("sap-consultant")) {
    return ProjectRole.SapConsultant;
  }
  if (input.membershipRoleNames.includes("software-engineer")) {
    return ProjectRole.SoftwareEngineer;
  }
  return "team-member";
}
