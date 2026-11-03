import { z } from "zod";
import { Service } from "../service";
import type { Scope } from "@/app/generated/prisma/client";

export const scopeFieldsSchema = z.object({
  name: z.string().trim().min(1),
  logo: z.string().min(1),
  // At least one company: an empty scope would give its users no access.
  companyIds: z.array(z.number().int().positive()).min(1),
});

export type ScopeInput = z.infer<typeof scopeFieldsSchema>;

// A scope with its companies, as the forms and the Scopes page show it.
export type ScopeWithCompanies = Scope & {
  companies: { id: number; name: string }[];
};

const withCompanies = {
  companies: { select: { id: true, name: true }, orderBy: { name: "asc" } },
} as const;

// Scopes are named sets of companies (CTC, ECM, …); team members and clients
// hold one or more. The seed creates them; admins rename them, change their
// companies or delete unused ones on the dashboard's Scopes page.
export class ScopeService extends Service {
  list(): Promise<ScopeWithCompanies[]> {
    return this.prisma.scope.findMany({
      include: withCompanies,
      orderBy: { id: "asc" },
    });
  }

  // Every scope with how many (non-deleted) users hold it, for the Scopes page.
  async listWithUsage(): Promise<(ScopeWithCompanies & { userCount: number })[]> {
    const scopes = await this.prisma.scope.findMany({
      include: {
        ...withCompanies,
        _count: { select: { users: { where: { deletedAt: null } } } },
      },
      orderBy: { id: "asc" },
    });
    return scopes.map(({ _count, ...scope }) => ({
      ...scope,
      userCount: _count.users,
    }));
  }

  findById(id: number): Promise<ScopeWithCompanies | null> {
    return this.prisma.scope.findUnique({ where: { id }, include: withCompanies });
  }

  // Whether another scope already uses this name (names are unique).
  async nameTaken(name: string, excludeId?: number): Promise<boolean> {
    const existing = await this.prisma.scope.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });
    return existing != null;
  }

  // Changes a scope's name and logo and replaces its companies. The users holding it follow: a
  // user whose main company is no longer in any of their scopes is moved to the
  // first company their scopes still have.
  async update(id: number, input: ScopeInput): Promise<Scope> {
    const data = scopeFieldsSchema.parse(input);
    return this.prisma.$transaction(async (tx) => {
      const scope = await tx.scope.update({
        where: { id },
        data: {
          name: data.name,
          logo: data.logo,
          companies: { set: data.companyIds.map((companyId) => ({ id: companyId })) },
        },
      });
      const holders = await tx.user.findMany({
        where: { scopes: { some: { id } } },
        select: {
          id: true,
          companyId: true,
          scopes: { select: { companies: { select: { id: true } } } },
        },
      });
      for (const user of holders) {
        const allowed = [
          ...new Set(user.scopes.flatMap((s) => s.companies.map((c) => c.id))),
        ];
        if (user.companyId == null || !allowed.includes(user.companyId)) {
          await tx.user.update({
            where: { id: user.id },
            data: { companyId: allowed[0] ?? null },
          });
        }
      }
      return scope;
    });
  }

  // Deletes a scope nobody holds. Returns false (and deletes nothing) when users
  // still have it, so they never silently lose their access. Soft-deleted
  // accounts that still hold it simply lose it (the join rows cascade).
  async delete(id: number): Promise<boolean> {
    const inUse = await this.prisma.user.count({
      where: { scopes: { some: { id } }, deletedAt: null },
    });
    if (inUse > 0) return false;
    await this.prisma.scope.delete({ where: { id } });
    return true;
  }
}

export const scopeService = new ScopeService();
