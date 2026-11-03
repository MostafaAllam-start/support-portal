import type { z } from "zod";
import type { UserProject } from "@/app/generated/prisma/client";
import type { userProjectSchema } from "./schemas";

export type UserProjectInput = z.infer<typeof userProjectSchema>;

// One project role to grant a team member (project + role ids), as set on the
// user form.
export type ProjectMembershipInput = { projectId: number; roleId: number };

export type { UserProject };
