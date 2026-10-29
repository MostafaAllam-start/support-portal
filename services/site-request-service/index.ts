import { Service } from "../service";
import {
  createSiteRequestSchema,
  manualSiteRequestStatusSchema,
} from "./schemas";
import type { CreateSiteRequestInput, ManualSiteRequestStatus } from "./types";
import type { SiteRequest } from "@/app/generated/prisma/client";

const siteRequestInclude = {
  adminNotifiedBy: { select: { id: true, name: true } },
} as const;

export class SiteRequestService extends Service {
  // Stores a demo request submitted from the branding site.
  async create(input: CreateSiteRequestInput): Promise<SiteRequest> {
    const data = createSiteRequestSchema.parse(input);
    return this.prisma.siteRequest.create({ data });
  }

  // Every request, newest first, for the system-support dashboard. The id breaks
  // ties so rows keep their place when a status changes.
  list() {
    return this.prisma.siteRequest.findMany({
      include: siteRequestInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  findById(id: number) {
    return this.prisma.siteRequest.findUnique({
      where: { id },
      include: siteRequestInclude,
    });
  }

  async setStatus(id: number, status: ManualSiteRequestStatus): Promise<SiteRequest> {
    return this.prisma.siteRequest.update({
      where: { id },
      data: { status: manualSiteRequestStatusSchema.parse(status) },
    });
  }

  // Records that `actorId` asked the admins to create a support account for this
  // client.
  async markAdminNotified(id: number, actorId: number): Promise<SiteRequest> {
    return this.prisma.siteRequest.update({
      where: { id },
      data: {
        status: "admin_notified",
        adminNotifiedAt: new Date(),
        adminNotifiedById: actorId,
      },
    });
  }
}

export const siteRequestService = new SiteRequestService();

export * from "./schemas";
export * from "./types";
