import type { z } from "zod";
import type {
  Ticket,
  TicketReport,
  TicketStatus,
} from "@/app/generated/prisma/client";
import type {
  assignTicketSchema,
  createReportSchema,
  createTicketSchema,
  updateTicketSchema,
} from "./schemas";

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AssignTicketInput = z.infer<typeof assignTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;

// KPI shape, computed from ticket status counts (there is no KPI table).
export type TicketStats = {
  total: number;
  open: number;
  in_progress: number;
  closed: number;
};

export type ProjectTicketStats = {
  projectId: number | null;
  projectName: string;
  stats: TicketStats;
};

export type CompanyTicketStats = {
  companyId: number | null;
  companyName: string;
  stats: TicketStats;
  projects: ProjectTicketStats[];
};

// One day on the "tickets created over time" chart: how many tickets were created
// that day, split by their current status. `date` is an ISO calendar day
// (YYYY-MM-DD, UTC). Days with no tickets are still present (zero-filled) so the
// x-axis is continuous.
export type TicketTrendPoint = {
  date: string;
  open: number;
  in_progress: number;
  closed: number;
};

// Scope for role-based KPI/listing queries and detail-page checks:
// - "all": admin (every ticket)
// - "filter": tickets matching ANY of the given clauses — in one of the projects,
//   belonging to one of the companies, or assigned to the user. A filter with no
//   clauses matches nothing.
export type TicketScope =
  | { kind: "all" }
  | {
      kind: "filter";
      projectIds?: number[];
      companyIds?: number[];
      assigneeId?: number;
    };

export type { Ticket, TicketReport, TicketStatus };
