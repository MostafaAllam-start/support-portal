import { Service } from "../service";
import { createSuggestionSchema } from "./schemas";
import type { CreateSuggestionInput } from "./types";
import type { Suggestion } from "@/app/generated/prisma/client";

// Author summary included for listings.
const suggestionInclude = {
  createdBy: { select: { id: true, name: true, username: true } },
} as const;

// The detail view additionally needs the company and (optional) project the
// suggestion is about.
const suggestionDetailInclude = {
  createdBy: { select: { id: true, name: true, username: true } },
  company: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} as const;

export class SuggestionService extends Service {
  // Every suggestion, newest first, with author summary (admin/manager view).
  list() {
    return this.prisma.suggestion.findMany({
      include: suggestionInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // A manager's view: the suggestions on the given projects, plus the
  // company-wide ones (no project) of the given companies.
  listForManager({
    projectIds,
    companyIds,
  }: {
    projectIds: number[];
    companyIds: number[];
  }) {
    if (projectIds.length === 0 && companyIds.length === 0) return [];
    return this.prisma.suggestion.findMany({
      where: {
        OR: [
          { projectId: { in: projectIds } },
          { projectId: null, companyId: { in: companyIds } },
        ],
      },
      include: suggestionInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  // A single user's own suggestions, newest first (the user "My suggestions" page).
  listForUser(createdById: number) {
    return this.prisma.suggestion.findMany({
      where: { createdById },
      orderBy: { createdAt: "desc" },
    });
  }

  getDetail(id: number) {
    return this.prisma.suggestion.findUnique({
      where: { id },
      include: suggestionDetailInclude,
    });
  }

  async create(input: CreateSuggestionInput): Promise<Suggestion> {
    const data = createSuggestionSchema.parse(input);
    return this.prisma.suggestion.create({ data });
  }

  // Hard-deletes a suggestion together with its polymorphic replies and
  // attachments (entity_type "suggestion"). Those have no foreign key to the
  // suggestion, so they can't cascade and are cleaned up here. Runs in one
  // transaction so nothing is left orphaned.
  async delete(id: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.reply.deleteMany({
        where: { entityType: "suggestion", entityId: id },
      }),
      this.prisma.attachment.deleteMany({
        where: { entityType: "suggestion", entityId: id },
      }),
      this.prisma.suggestion.delete({ where: { id } }),
    ]);
  }
}

export const suggestionService = new SuggestionService();

export * from "./schemas";
export * from "./types";
