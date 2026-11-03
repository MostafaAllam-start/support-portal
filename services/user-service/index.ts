import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { Service } from "../service";
import {
  AUTH_COOKIE,
  TOKEN_MAX_AGE,
  signToken,
  verifyToken,
} from "@/lib/auth/jwt";
import { loginSchema, createUserSchema, updateUserSchema } from "./schemas";
import { UserRole, effectiveRoleName } from "@/lib/auth/roles";
import type { ProjectMembershipInput } from "@/services/user-project-service/types";
import type {
  LoginInput,
  CreateUserInput,
  UpdateUserInput,
  SafeUser,
  AuthUser,
  UserMembership,
} from "./types";
import type { User } from "@/app/generated/prisma/client";

const BCRYPT_ROUNDS = 12;
const ENGINEER_ROLE = "software-engineer";
const CONSULTANT_ROLE = "sap-consultant";
const ASSIGNABLE_ROLES = [ENGINEER_ROLE, CONSULTANT_ROLE] as const;

// Relations loaded to derive a user's effective role and per-project memberships
// (the account type is User.role; team members also hold project roles).
const authInclude = {
  projectMemberships: {
    select: {
      projectId: true,
      role: { select: { name: true } },
      project: { select: { companyId: true } },
    },
  },
  managedProjects: { select: { id: true, companyId: true } },
  scopes: { select: { id: true, companies: { select: { id: true } } } },
} as const;

// What's needed to tell which companies a user works with.
const teamMemberScopeSelect = {
  companyId: true,
  scopes: { select: { companies: { select: { id: true } } } },
} as const;

// The distinct companies of a user's scopes.
function companyIdsOfScopes(scopes: { companies: { id: number }[] }[]): number[] {
  return [...new Set(scopes.flatMap((scope) => scope.companies.map((c) => c.id)))];
}

// The companies a user works with: their scopes' companies, or their main
// company without a scope.
function scopeCompanyIdsOf(user: {
  companyId: number | null;
  scopes: { companies: { id: number }[] }[];
}): number[] {
  const ids = companyIdsOfScopes(user.scopes);
  if (ids.length > 0) return ids;
  return user.companyId != null ? [user.companyId] : [];
}

export class UserService extends Service {
  // Verifies credentials, sets the JWT as an httpOnly cookie, and returns both
  // the token and the (password-stripped) user. Must be called from a Server
  // Action or Route Handler so the cookie can be written.
  async login(input: LoginInput): Promise<{ token: string; user: SafeUser }> {
    const { identifier, password } = loginSchema.parse(input);

    const user = await this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username: identifier }, { email: identifier }],
      },
    });

    // Use a single generic error for all failure modes so the response does not
    // reveal whether the account exists or is disabled.
    if (
      !user ||
      user.isDisabled ||
      !(await bcrypt.compare(password, user.password))
    ) {
      throw new Error("Invalid credentials");
    }

    const token = await signToken({
      sub: String(user.id),
      username: user.username,
    });

    await this.setAuthCookie(token);
    return { token, user: this.sanitize(user) };
  }

  // Whether `password` is the active user's current password. Used to confirm
  // sensitive self-service changes (email, password).
  async verifyPassword(id: number, password: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, isDisabled: false },
      select: { password: true },
    });
    return Boolean(user && (await bcrypt.compare(password, user.password)));
  }

  // Expires the auth cookie. Must be called from a Server Action or Route Handler.
  async logout(): Promise<void> {
    const store = await cookies();
    store.set(AUTH_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  }

  // Resolves the authenticated user from the auth cookie. Unlike the stateless
  // verifyToken(), this re-reads the user from the database, so an account that
  // was disabled or soft-deleted after its token was issued is rejected
  // immediately instead of staying valid until the token expires. Returns null
  // when there is no valid session.
  async currentUser(): Promise<AuthUser | null> {
    const store = await cookies();
    const token = store.get(AUTH_COOKIE)?.value;
    if (!token) return null;

    let sub: string;
    try {
      sub = (await verifyToken(token)).sub;
    } catch {
      return null;
    }

    const user = await this.prisma.user.findFirst({
      where: { id: Number(sub), deletedAt: null, isDisabled: false },
      include: authInclude,
    });
    return user ? this.toAuthUser(user) : null;
  }

  // A single active user enriched with their effective role + memberships. Returns
  // null if missing/deleted. Used by admin actions that must inspect the current
  // role/admin status/username (e.g. the default-admin lock).
  async findWithRole(id: number): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: authInclude,
    });
    return user ? this.toAuthUser(user) : null;
  }

  // Active software-engineers, for ticket-assignment pickers. Returns just the
  // fields a selector needs.
  async engineers(): Promise<{ id: number; name: string; username: string }[]> {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isDisabled: false,
        projectMemberships: { some: { role: { name: ENGINEER_ROLE } } },
      },
      select: { id: true, name: true, username: true },
      orderBy: { name: "asc" },
    });
  }

  // Active global admin user ids (for notification fan-out).
  async activeAdminIds(): Promise<number[]> {
    const admins = await this.prisma.user.findMany({
      where: { deletedAt: null, isDisabled: false, role: UserRole.admin },
      select: { id: true },
    });
    return admins.map((user) => user.id);
  }

  // The companies an active team member works with (their scopes' companies, or
  // their main company without a scope), or null when the user isn't an active
  // team member — the only account type that can manage a project or hold a
  // project role.
  async teamMemberCompanyIds(id: number): Promise<number[] | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, isDisabled: false, role: UserRole.team_member },
      select: teamMemberScopeSelect,
    });
    return user ? scopeCompanyIdsOf(user) : null;
  }

  // Active reviewers who work a company's tickets: team members with a reviewer
  // project role whose scopes include that company (mirrors the reviewer scope
  // in ticketScopeForUser).
  async reviewerIdsForCompany(companyId: number): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isDisabled: false,
        role: UserRole.team_member,
        projectMemberships: { some: { role: { name: "reviewer" } } },
        OR: [
          { scopes: { some: { companies: { some: { id: companyId } } } } },
          { scopes: { none: {} }, companyId },
        ],
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  // Active team members with the companies they work with, for the project
  // manager and member pickers.
  async teamMemberOptions(): Promise<
    { id: number; name: string; companyIds: number[] }[]
  > {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, isDisabled: false, role: UserRole.team_member },
      select: { id: true, name: true, ...teamMemberScopeSelect },
      orderBy: { name: "asc" },
    });
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      companyIds: scopeCompanyIdsOf(user),
    }));
  }

  // Active support team member ids (for branding-site request notifications).
  async activeSupportIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isDisabled: false,
        role: UserRole.team_member,
        isSupport: true,
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  // From the given ids, returns only those who are active engineers or consultants.
  async fieldStaffIds(userIds: number[]): Promise<number[]> {
    if (userIds.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        deletedAt: null,
        isDisabled: false,
        role: UserRole.team_member,
        projectMemberships: {
          some: { role: { name: { in: [...ASSIGNABLE_ROLES] } } },
        },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  // Engineers and SAP consultants eligible for ticket assignment.
  async assignableStaff(): Promise<
    { id: number; name: string; username: string; role: string }[]
  > {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isDisabled: false,
        role: UserRole.team_member,
        projectMemberships: {
          some: { role: { name: { in: [...ASSIGNABLE_ROLES] } } },
        },
      },
      select: {
        id: true,
        name: true,
        username: true,
        projectMemberships: {
          where: { role: { name: { in: [...ASSIGNABLE_ROLES] } } },
          select: { role: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.projectMemberships[0]?.role.name ?? ENGINEER_ROLE,
    }));
  }

  // Public-facing contact details for a single person, for the
  // /contact-info/[user_id] business card page.
  //
  // SECURITY/PRIVACY: limited to users who have explicitly opted in via
  // `hasContactInfoCard`, so an arbitrary account's email/contact info can't be
  // harvested by walking ids — anyone without the flag 404s. Returns the first
  // company the user belongs to (via project membership) for the card's company
  // section.
  async contactCard(id: number) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        isDisabled: false,
        hasContactInfoCard: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        jobTitle: true,
        website: true,
        whatsapp: true,
        linkedin: true,
        projectMemberships: {
          take: 1,
          select: {
            project: {
              select: {
                company: {
                  select: {
                    id: true,
                    name: true,
                    logo: true,
                    websiteUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Null when the id doesn't exist or hasn't opted in (the WHERE filters it
    // out) — the page turns this into a 404 either way, so the flag isn't leaked.
    return user;
  }

  // Users featured on a company's public landing-page "Our Team" section: active,
  // flagged as featured, and belonging to that company. Each carries the contact
  // details needed to render (and optionally open) its card.
  featuredForCompany(companyId: number) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isDisabled: false,
        isFeatured: true,
        companyId,
      },
      select: {
        id: true,
        name: true,
        image: true,
        jobTitle: true,
        email: true,
        website: true,
        whatsapp: true,
        linkedin: true,
        hasContactInfoCard: true,
        company: { select: { name: true, logo: true, websiteUrl: true } },
      },
      orderBy: { id: "asc" },
    });
  }

  // All users featured on the landing-page team, with their company, for the
  // admin "Our Team" page.
  featured() {
    return this.prisma.user.findMany({
      where: { deletedAt: null, isFeatured: true },
      select: {
        id: true,
        name: true,
        username: true,
        image: true,
        jobTitle: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: { id: "asc" },
    });
  }

  // Active users with their role, for the admin Users table.
  async list(): Promise<AuthUser[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: authInclude,
      orderBy: { id: "asc" },
    });
    return users.map((user) => this.toAuthUser(user));
  }

  // Active users with their role and the distinct set of companies they are
  // connected to — their own company plus the companies of the projects they
  // belong to or manage. Powers the admin Users table (companies column + the
  // double-click details panel).
  async listDetailed() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        company: { select: { id: true, name: true } },
        scopes: {
          select: {
            id: true,
            name: true,
            companies: { select: { id: true, name: true } },
          },
          orderBy: { name: "asc" },
        },
        projectMemberships: {
          select: {
            projectId: true,
            roleId: true,
            role: { select: { name: true } },
            project: { select: { company: { select: { id: true, name: true } } } },
          },
        },
        managedProjects: {
          select: { id: true, company: { select: { id: true, name: true } } },
        },
      },
      orderBy: { id: "asc" },
    });

    return users.map((user) => {
      const companies = new Map<number, string>();
      if (user.company) companies.set(user.company.id, user.company.name);
      for (const c of user.scopes.flatMap((s) => s.companies)) {
        companies.set(c.id, c.name);
      }
      for (const m of user.projectMemberships) {
        companies.set(m.project.company.id, m.project.company.name);
      }
      for (const p of user.managedProjects) {
        companies.set(p.company.id, p.company.name);
      }

      const membershipRoleNames = user.projectMemberships.map((m) => m.role.name);
      const effectiveRole = effectiveRoleName({
        role: user.role,
        managesProject: user.managedProjects.length > 0,
        membershipRoleNames,
      });

      const {
        password: _password,
        projectMemberships,
        managedProjects: _managed,
        company: _company,
        scopes,
        ...safe
      } = user;
      return {
        ...safe,
        effectiveRole,
        // The scopes (CTC, ECM, …) a team member or client holds.
        scopeIds: scopes.map((s) => s.id),
        scopeNames: scopes.map((s) => s.name),
        // The distinct project roles a team member holds ("manager" also when
        // they manage a project), for the Users table.
        projectRoles: [
          ...new Set([
            ...(user.managedProjects.length > 0 ? ["manager"] : []),
            ...membershipRoleNames,
          ]),
        ],
        memberships: projectMemberships.map((m) => ({
          projectId: m.projectId,
          roleId: m.roleId,
        })),
        companies: [...companies].map(([id, name]) => ({ id, name })),
      };
    });
  }

  // Creates a new user with a hashed password. Newly created accounts are clients
  // by default; pass `role` for another account type. A team member's project
  // roles (`memberships`) are created in the same write, so the account and its
  // access land together; they are ignored for any other type.
  //
  // SECURITY: account creation is admin-only. Gate this call behind an admin
  // check in the caller — the service does not enforce who may create accounts
  // or which type they get.
  async create(
    input: CreateUserInput,
    opts: {
      role?: UserRole;
      isSupport?: boolean;
      companyId?: number | null;
      scopeIds?: number[];
      website?: string | null;
      whatsapp?: string | null;
      linkedin?: string | null;
      isFeatured?: boolean;
      hasContactInfoCard?: boolean;
      memberships?: ProjectMembershipInput[];
    } = {},
  ): Promise<SafeUser> {
    const role = opts.role ?? UserRole.client;
    const data = createUserSchema.parse(input);
    await this.assertUnique(data.username, data.email);

    const user = await this.prisma.user.create({
      data: {
        name: data.name,
        username: data.username,
        email: data.email,
        password: await bcrypt.hash(data.password, BCRYPT_ROUNDS),
        jobTitle: data.jobTitle,
        image: data.image,
        role,
        isSupport: role === UserRole.team_member && (opts.isSupport ?? false),
        companyId: opts.companyId ?? null,
        ...(opts.scopeIds?.length
          ? { scopes: { connect: opts.scopeIds.map((id) => ({ id })) } }
          : {}),
        website: opts.website ?? null,
        whatsapp: opts.whatsapp ?? null,
        linkedin: opts.linkedin ?? null,
        isFeatured: opts.isFeatured ?? false,
        hasContactInfoCard: opts.hasContactInfoCard ?? false,
        ...(role === UserRole.team_member && opts.memberships?.length
          ? { projectMemberships: { create: opts.memberships } }
          : {}),
      },
    });
    return this.sanitize(user);
  }

  // Updates user data. Any field is optional; password is re-hashed when given.
  // `memberships`, when given, replaces the user's project roles. Only team
  // members hold project roles: changing a user to any other type also removes
  // their memberships and unsets them as manager of any project.
  //
  // SECURITY: changing `role` is privileged — gate this call behind an
  // authorization check in the caller; the service does not enforce who may
  // grant which account type.
  async update(
    id: number,
    input: UpdateUserInput,
    memberships?: ProjectMembershipInput[],
  ): Promise<SafeUser> {
    const { password, scopeIds, ...rest } = updateUserSchema.parse(input);
    await this.assertExists(id);

    if (rest.username || rest.email) {
      await this.assertUnique(rest.username, rest.email, id);
    }

    const leavesTeam = rest.role !== undefined && rest.role !== UserRole.team_member;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(password
          ? { password: await bcrypt.hash(password, BCRYPT_ROUNDS) }
          : {}),
        // Replaces the user's scopes when given.
        ...(scopeIds
          ? { scopes: { set: scopeIds.map((scopeId) => ({ id: scopeId })) } }
          : {}),
        ...(leavesTeam
          ? {
              projectMemberships: { deleteMany: {} },
              managedProjects: { set: [] },
            }
          : memberships
            ? {
                projectMemberships: { deleteMany: {}, create: memberships },
              }
            : {}),
      },
    });
    return this.sanitize(user);
  }

  // Disables (or re-enables) a user account.
  async disable(id: number, isDisabled = true): Promise<SafeUser> {
    await this.assertExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { isDisabled },
    });
    return this.sanitize(user);
  }

  enable(id: number): Promise<SafeUser> {
    return this.disable(id, false);
  }

  // Soft-deletes a user: stamps `deletedAt` and disables the account so it can no
  // longer authenticate, while preserving the row for referential integrity.
  async softDelete(id: number): Promise<SafeUser> {
    await this.assertExists(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isDisabled: true },
    });
    return this.sanitize(user);
  }

  // Permanently removes a just-created account. Only for rolling back a creation
  // whose follow-up step failed (e.g. the credentials email could not be sent);
  // an account with any activity must be soft-deleted instead.
  async hardDelete(id: number): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  // Returns which identity field ("username" or "email") already belongs to
  // another user, or null when both are free. Unlike assertUnique it doesn't
  // throw, so callers (e.g. forms) can map the clash to a field-level error.
  // Pass `excludeId` to ignore the user being edited. The uniqueness applies
  // across all rows, including soft-deleted ones.
  async findConflict(
    username?: string,
    email?: string,
    excludeId?: number,
  ): Promise<"username" | "email" | null> {
    const conditions: Array<{ username: string } | { email: string }> = [];
    if (username) conditions.push({ username });
    if (email) conditions.push({ email });
    if (conditions.length === 0) return null;

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: conditions,
        ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
      },
      select: { username: true, email: true },
    });
    if (!existing) return null;
    return username && existing.username === username ? "username" : "email";
  }

  // --- helpers ---

  // Enriches a raw user (loaded with the authInclude relations) into an AuthUser:
  // strips the password, maps the per-project memberships, records the managed
  // projects, and derives the single effective role.
  private toAuthUser(
    user: User & {
      projectMemberships: {
        projectId: number;
        role: { name: string };
        project: { companyId: number };
      }[];
      managedProjects: { id: number; companyId: number }[];
      scopes: { id: number; companies: { id: number }[] }[];
    },
  ): AuthUser {
    const {
      password: _password,
      projectMemberships,
      managedProjects,
      scopes,
      ...safe
    } = user;
    const memberships: UserMembership[] = projectMemberships.map((m) => ({
      projectId: m.projectId,
      companyId: m.project.companyId,
      roleName: m.role.name,
    }));
    return {
      ...safe,
      memberships,
      managedProjects,
      scopeIds: scopes.map((scope) => scope.id),
      scopeCompanyIds: companyIdsOfScopes(scopes),
      effectiveRole: effectiveRoleName({
        role: safe.role,
        managesProject: managedProjects.length > 0,
        membershipRoleNames: memberships.map((m) => m.roleName),
      }),
    };
  }

  private async assertExists(id: number): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
  }

  // Enforces the username/email unique constraints with a friendly error before
  // hitting the DB. A backstop for callers that don't pre-check via findConflict.
  private async assertUnique(
    username?: string,
    email?: string,
    excludeId?: number,
  ): Promise<void> {
    const field = await this.findConflict(username, email, excludeId);
    if (field) {
      throw new Error(`A user with this ${field} already exists`);
    }
  }

  private async setAuthCookie(token: string): Promise<void> {
    const store = await cookies();
    store.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: TOKEN_MAX_AGE,
    });
  }

  private sanitize<T extends { password: string }>(
    user: T,
  ): Omit<T, "password"> {
    const { password: _password, ...safe } = user;
    return safe;
  }
}

export const userService = new UserService();

export * from "./schemas";
export * from "./types";
