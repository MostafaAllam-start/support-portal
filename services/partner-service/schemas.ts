import { z } from "zod";

export const createPartnerSchema = z.object({
  name: z.string().min(1),
  logo: z.string().min(1),
  details: z.string().min(1),
  // The scopes whose landing page features this partner.
  scopeIds: z.array(z.number().int().positive()).optional(),
});

// Every field optional for partial updates.
export const updatePartnerSchema = z.object({
  name: z.string().min(1).optional(),
  logo: z.string().min(1).optional(),
  details: z.string().min(1).optional(),
  scopeIds: z.array(z.number().int().positive()).optional(),
});
