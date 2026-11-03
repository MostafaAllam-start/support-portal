import { Service } from "../service";
import {
  assignTicketSchema,
  createReportSchema,
  createTicketSchema,
  updateTicketSchema,
} from "./schemas";
import type {
  AssignTicketInput,
  CompanyTicketStats,
  CreateReportInput,
  CreateTicketInput,
  ProjectTicketStats,
  TicketScope,
  TicketStats,
  TicketTrendPoint,
  UpdateTicketInput,
} from "./types";
import type { Prisma, Ticket, TicketReport, TicketStatus } from "@/app/generated/prisma/client";

const ENGINEER_ROLE = "software-engineer";
const CONSULTANT_ROLE = "sap-consultant";
const ASSIGNABLE_ROLES = [ENGINEER_ROLE, CONSULTANT_ROLE] as const;

// The reviewer/admin who closed a ticket, for the detail views.
const reviewerSelect = {
  reviewer: { select: { id: true, name: true } },
} as const;

// Reporter summary + the assigned engineers (through the join table), for table
// display. Each assignment row carries the engineer's user summary.
const assigneesInclude = {
  include: {
    assignee: { select: { id: true, name: true, username: true } },
  },
} as const;

const ticketInclude = {
  user: { select: { id: true, name: true, username: true } },
  assignees: assigneesInclude,
  project: { select: { id: true, name: true } },
} as const;

export class TicketService extends Service {
  // Admin: every (non-deleted) ticket.
  listAll() {
    return this.prisma.ticket.findMany({
      where: { deletedAt: null },
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // The dashboard ticket list for a role scope (see ticketScopeForUser): the same
  // filter the KPIs and the detail-page check use, so they can't disagree.
  forScope(scope: TicketScope) {
    return this.prisma.ticket.findMany({
      where: this.scopeWhere(scope),
      include: ticketInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // A user's own submitted tickets (the "user" role surface), with a reply count
  // for the list and the engineers it is assigned to. Replies are polymorphic
  // (no ticket relation), so counts are aggregated separately and merged in.
  async reportedBy(userId: number) {
    const tickets = await this.prisma.ticket.findMany({
      where: { deletedAt: null, userId },
      include: { assignees: assigneesInclude },
      orderBy: { createdAt: "desc" },
    });

    const counts = await this.replyCounts(tickets.map((t) => t.id));
    return tickets.map((ticket) => ({
      ...ticket,
      replyCount: counts.get(ticket.id) ?? 0,
    }));
  }

  // A single ticket the given user reported, with its assigned engineers and
  // diagnostic reports (newest first, each carrying its author's summary). Scoped
  // to `userId` so a user can only open their own tickets. Replies are fetched
  // separately via replyService (they are polymorphic). Returns null when no
  // such ticket exists.
  getForReporter(id: number, userId: number) {
    return this.prisma.ticket.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        ...reviewerSelect,
        assignees: assigneesInclude,
        project: { select: { id: true, name: true } },
        reports: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  // Full detail for a single ticket — reporter, assigned engineers, and
  // diagnostic reports (newest first, each carrying its author's summary).
  // The company a ticket belongs to (null for a staff-created ticket without one).
  async companyIdOf(ticketId: number): Promise<number | null> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { companyId: true },
    });
    return ticket?.companyId ?? null;
  }

  // Unscoped: intended for staff (dashboard) surfaces that may open tickets they
  // did not report. Replies are fetched separately via replyService (they are
  // polymorphic). Returns null when no such ticket exists.
  // The reporter's user id for a non-deleted ticket.
  async reporterUserId(ticketId: number): Promise<number | null> {
    const ticket = await this.prisma.ticket.findFirst({
      where: { id: ticketId, deletedAt: null },
      select: { userId: true },
    });
    return ticket?.userId ?? null;
  }

  getDetail(id: number) {
    return this.prisma.ticket.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...reviewerSelect,
        user: { select: { id: true, name: true, username: true } },
        assignees: assigneesInclude,
        project: { select: { id: true, name: true } },
        reports: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  // Role-scoped KPI counts, computed from ticket status.
  async stats(scope: TicketScope): Promise<TicketStats> {
    const grouped = await this.prisma.ticket.groupBy({
      by: ["status"],
      where: this.scopeWhere(scope),
      _count: { _all: true },
    });

    const stats: TicketStats = { total: 0, open: 0, in_progress: 0, closed: 0 };
    for (const row of grouped) {
      stats[row.status] = row._count._all;
      stats.total += row._count._all;
    }
    return stats;
  }

  // Daily count of tickets created over the last `days` days (inclusive of today),
  // within `scope`, split by their current status. Buckets are computed in
  // application code by UTC calendar day and zero-filled so the chart x-axis is a
  // continuous run of days even when nothing was created.
  async createdTrend(
    scope: TicketScope,
    days = 30,
  ): Promise<TicketTrendPoint[]> {
    // Window start: midnight UTC, (days - 1) days before today.
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const tickets = await this.prisma.ticket.findMany({
      where: { ...this.scopeWhere(scope), createdAt: { gte: start } },
      select: { createdAt: true, status: true },
    });

    // Seed an ordered, zero-filled bucket for every day in the window, keyed by
    // YYYY-MM-DD for O(1) lookups while aggregating.
    const buckets = new Map<string, TicketTrendPoint>();
    for (let i = 0; i < days; i++) {
      const day = new Date(start);
      day.setUTCDate(start.getUTCDate() + i);
      const key = day.toISOString().slice(0, 10);
      buckets.set(key, { date: key, open: 0, in_progress: 0, closed: 0 });
    }

    for (const ticket of tickets) {
      const bucket = buckets.get(ticket.createdAt.toISOString().slice(0, 10));
      if (bucket) bucket[ticket.status] += 1;
    }

    return [...buckets.values()];
  }

  // Ticket status counts grouped by company and project within `scope`.
  async statsByCompanyAndProject(
    scope: TicketScope,
  ): Promise<CompanyTicketStats[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: this.scopeWhere(scope),
      select: {
        status: true,
        companyId: true,
        company: { select: { id: true, name: true } },
        projectId: true,
        project: {
          select: {
            id: true,
            name: true,
            company: { select: { id: true, name: true } },
          },
        },
      },
    });

    const companies = new Map<number | null, CompanyTicketStats>();
    const projectsByCompany = new Map<
      number | null,
      Map<number | null, ProjectTicketStats>
    >();

    const ensureCompany = (
      companyId: number | null,
      companyName: string,
    ): CompanyTicketStats => {
      let company = companies.get(companyId);
      if (!company) {
        company = {
          companyId,
          companyName,
          stats: this.emptyStats(),
          projects: [],
        };
        companies.set(companyId, company);
        projectsByCompany.set(companyId, new Map());
      }
      return company;
    };

    const ensureProject = (
      companyId: number | null,
      companyName: string,
      projectId: number | null,
      projectName: string,
    ): ProjectTicketStats => {
      ensureCompany(companyId, companyName);
      const projectMap = projectsByCompany.get(companyId)!;
      let project = projectMap.get(projectId);
      if (!project) {
        project = { projectId, projectName, stats: this.emptyStats() };
        projectMap.set(projectId, project);
      }
      return project;
    };

    // A manager's projects are listed even before they have any tickets.
    if (scope.kind === "filter" && scope.projectIds?.length) {
      const scopedProjects = await this.prisma.project.findMany({
        where: { id: { in: scope.projectIds } },
        select: {
          id: true,
          name: true,
          company: { select: { id: true, name: true } },
        },
        orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
      });
      for (const project of scopedProjects) {
        ensureProject(
          project.company.id,
          project.company.name,
          project.id,
          project.name,
        );
      }
    }

    for (const ticket of tickets) {
      const companyId = ticket.project?.company.id ?? ticket.company?.id ?? null;
      const companyName =
        ticket.project?.company.name ?? ticket.company?.name ?? "—";
      const projectId = ticket.projectId;
      const projectName = ticket.project?.name ?? "—";

      this.bumpStats(ensureCompany(companyId, companyName).stats, ticket.status);
      this.bumpStats(
        ensureProject(companyId, companyName, projectId, projectName).stats,
        ticket.status,
      );
    }

    return [...companies.values()]
      .map((company) => {
        const projectMap = projectsByCompany.get(company.companyId)!;
        company.projects = [...projectMap.values()].sort((a, b) =>
          a.projectName.localeCompare(b.projectName),
        );
        return company;
      })
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }

  private emptyStats(): TicketStats {
    return { total: 0, open: 0, in_progress: 0, closed: 0 };
  }

  private bumpStats(stats: TicketStats, status: TicketStatus): void {
    stats[status] += 1;
    stats.total += 1;
  }

  // Set the full list of engineers/consultants assigned to a ticket. The given
  // list replaces any existing assignment (pass [] to clear).
  async assign(input: AssignTicketInput): Promise<Ticket> {
    const { ticketId, assigneeIds } = assignTicketSchema.parse(input);
    const ids = [...new Set(assigneeIds)];
    await this.assertAssignableStaff(ids);

    return this.prisma.$transaction(async (tx) => {
      await tx.ticketAssignment.deleteMany({ where: { ticketId } });
      if (ids.length > 0) {
        await tx.ticketAssignment.createMany({
          data: ids.map((assigneeId) => ({ ticketId, assigneeId })),
          skipDuplicates: true,
        });
      }
      return tx.ticket.findUniqueOrThrow({ where: { id: ticketId } });
    });
  }

  async create(input: CreateTicketInput): Promise<Ticket> {
    const { assigneeIds, ...data } = createTicketSchema.parse(input);
    const ids = assigneeIds ? [...new Set(assigneeIds)] : [];
    await this.assertAssignableStaff(ids);

    return this.prisma.ticket.create({
      data: {
        ...data,
        assignees: { create: ids.map((assigneeId) => ({ assigneeId })) },
      },
    });
  }

  // Reply counts for the given ticket ids, as an id -> count map (tickets with no
  // replies are absent). Replies are polymorphic, so this aggregates on the
  // ("ticket", id) entity key rather than a relation.
  private async replyCounts(ticketIds: number[]): Promise<Map<number, number>> {
    if (ticketIds.length === 0) return new Map();
    const grouped = await this.prisma.reply.groupBy({
      by: ["entityId"],
      where: { entityType: "ticket", entityId: { in: ticketIds } },
      _count: { _all: true },
    });
    return new Map(grouped.map((row) => [row.entityId, row._count._all]));
  }

  // Updates a ticket's editable fields (title/description/status). Only fields
  // present in `input` are changed.
  async update(id: number, input: UpdateTicketInput): Promise<Ticket> {
    const data = updateTicketSchema.parse(input);
    return this.prisma.ticket.update({ where: { id }, data });
  }

  // Sets workflow status and clears the review stamp when moving off "closed".
  async setStatus(id: number, status: Ticket["status"]): Promise<Ticket> {
    const current = await this.prisma.ticket.findFirstOrThrow({
      where: { id, deletedAt: null },
    });
    if (status === "open" && current.status === "closed") {
      return this.reopen(id);
    }
    const data: {
      status: Ticket["status"];
      reviewerId?: null;
      reviewedAt?: null;
      reviewComment?: null;
    } = { status };
    if (status !== "closed" && current.status === "closed") {
      data.reviewerId = null;
      data.reviewedAt = null;
      data.reviewComment = null;
    }
    return this.prisma.ticket.update({ where: { id }, data });
  }

  // Soft-deletes a ticket: stamps `deletedAt` so it drops out of every listing
  // (which all filter on `deletedAt: null`) while preserving its replies and
  // assignment history.
  async softDelete(id: number): Promise<Ticket> {
    return this.prisma.ticket.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Closes a ticket as part of a review: sets the status to "closed" and stamps
  // the reviewer, the time, and their closing comment. Authorization (admin or
  // reviewer) is enforced by the caller.
  async close(id: number, reviewerId: number, comment: string): Promise<Ticket> {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: "closed",
        reviewerId,
        reviewedAt: new Date(),
        reviewComment: comment,
      },
    });
  }

  // Reopens a closed ticket: clears the review stamp and sets the status back to
  // "open".
  async reopen(id: number): Promise<Ticket> {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: "open",
        reviewerId: null,
        reviewedAt: null,
        reviewComment: null,
      },
    });
  }

  // Adds a diagnostic report (issue + solution) to a ticket. Authorization (the
  // assigned engineer or a consultant) is enforced by the caller.
  async createReport(input: CreateReportInput): Promise<TicketReport> {
    const data = createReportSchema.parse(input);
    return this.prisma.ticketReport.create({ data });
  }

  // The ticket a report belongs to. Used to live-refresh the ticket detail page
  // (where report replies render) when a report reply is edited or deleted — the
  // edit/delete form only carries the reply id, not the ticket.
  async reportTicketId(reportId: number): Promise<number | null> {
    const report = await this.prisma.ticketReport.findUnique({
      where: { id: reportId },
      select: { ticketId: true },
    });
    return report?.ticketId ?? null;
  }

  // The engineer / consultant who authored a report. They are the report's
  // "owner" and so a recipient of every reply on it (notifications).
  async reportAuthorId(reportId: number): Promise<number | null> {
    const report = await this.prisma.ticketReport.findUnique({
      where: { id: reportId },
      select: { userId: true },
    });
    return report?.userId ?? null;
  }

  private scopeWhere(scope: TicketScope): Prisma.TicketWhereInput {
    if (scope.kind === "all") return { deletedAt: null };
    const any: Prisma.TicketWhereInput[] = [];
    if (scope.projectIds?.length) {
      any.push({ projectId: { in: scope.projectIds } });
    }
    if (scope.companyIds?.length) {
      any.push({ companyId: { in: scope.companyIds } });
    }
    if (scope.assigneeId !== undefined) {
      any.push({ assignees: { some: { assigneeId: scope.assigneeId } } });
    }
    // No clause: the scope matches nothing.
    return any.length > 0
      ? { deletedAt: null, OR: any }
      : { deletedAt: null, id: { in: [] } };
  }

  // Every assignee must be an existing engineer or SAP consultant.
  private async assertAssignableStaff(assigneeIds: number[]): Promise<void> {
    if (assigneeIds.length === 0) return;
    const found = await this.prisma.user.count({
      where: {
        id: { in: assigneeIds },
        deletedAt: null,
        projectMemberships: {
          some: { role: { name: { in: [...ASSIGNABLE_ROLES] } } },
        },
      },
    });
    if (found !== assigneeIds.length) {
      throw new Error(
        "All assignees must be existing software-engineers or consultants",
      );
    }
  }
}

export const ticketService = new TicketService();

export * from "./schemas";
export * from "./types";
