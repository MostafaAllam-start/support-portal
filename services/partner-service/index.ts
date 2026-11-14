import { Service } from "../service";
import { createPartnerSchema, updatePartnerSchema } from "./schemas";
import type { CreatePartnerInput, UpdatePartnerInput } from "./types";
import type { Partner } from "@/app/generated/prisma/client";

// Associated companies, included so the admin table/form can show and preselect
// them.
const partnerInclude = {
  companies: { select: { id: true, name: true } },
} as const;

export class PartnerService extends Service {
  list() {
    return this.prisma.partner.findMany({
      include: partnerInclude,
      orderBy: { id: "asc" },
    });
  }

  // Partners featured on a given company's landing page.
  forCompany(companyId: number): Promise<Partner[]> {
    return this.prisma.partner.findMany({
      where: { companies: { some: { id: companyId } } },
      orderBy: { id: "asc" },
    });
  }

  // Partners featured on a scope: those of any company the scope holds.
  forScope(scopeId: number): Promise<Partner[]> {
    return this.prisma.partner.findMany({
      where: { companies: { some: { scopes: { some: { id: scopeId } } } } },
      orderBy: { id: "asc" },
    });
  }

  findById(id: number): Promise<Partner | null> {
    return this.prisma.partner.findUnique({ where: { id } });
  }

  async create(input: CreatePartnerInput): Promise<Partner> {
    const { companyIds, ...data } = createPartnerSchema.parse(input);
    return this.prisma.partner.create({
      data: {
        ...data,
        ...(companyIds
          ? { companies: { connect: companyIds.map((id) => ({ id })) } }
          : {}),
      },
    });
  }

  // Partial update of a partner's fields. When `companyIds` is provided it
  // replaces the full set of associated companies (so unchecking removes one).
  async update(id: number, input: UpdatePartnerInput): Promise<Partner> {
    const { companyIds, ...data } = updatePartnerSchema.parse(input);
    await this.assertExists(id);
    return this.prisma.partner.update({
      where: { id },
      data: {
        ...data,
        ...(companyIds
          ? { companies: { set: companyIds.map((id) => ({ id })) } }
          : {}),
      },
    });
  }

  async delete(id: number): Promise<Partner> {
    await this.assertExists(id);
    return this.prisma.partner.delete({ where: { id } });
  }

  // --- helpers ---

  private async assertExists(id: number): Promise<void> {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!partner) {
      throw new Error(`Partner ${id} not found`);
    }
  }
}

export const partnerService = new PartnerService();

export * from "./schemas";
export * from "./types";
