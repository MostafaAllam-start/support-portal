import type { z } from "zod";
import type {
  SiteRequest,
  SiteRequestStatus,
} from "@/app/generated/prisma/client";
import type {
  createSiteRequestSchema,
  manualSiteRequestStatusSchema,
} from "./schemas";

export type CreateSiteRequestInput = z.input<typeof createSiteRequestSchema>;
export type ManualSiteRequestStatus = z.infer<typeof manualSiteRequestStatusSchema>;

export type { SiteRequest, SiteRequestStatus };
