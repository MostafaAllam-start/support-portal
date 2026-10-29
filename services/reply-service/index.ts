import { Service } from "../service";
import { createReplySchema } from "./schemas";
import { effectiveRoleName } from "@/lib/auth/roles";
import type { CreateReplyInput, ReplyWithAuthor } from "./types";
import type { Reply, ReplyEntityType } from "@/app/generated/prisma/client";

// Author summary loaded with every reply, so the conversation UI can show who
// wrote each message (image, name, position) and align it by author. The role is
// derived (roles are per-project + the admin flag), so the inputs are loaded and
// collapsed in app code (see toAuthor).
const authorSelect = {
  id: true,
  name: true,
  image: true,
  jobTitle: true,
  isAdmin: true,
  isSystemSupport: true,
  projectMemberships: { select: { role: { select: { name: true } } } },
  managedProjects: { select: { id: true } },
} as const;

// Replies use a polymorphic association (entity_type + entity_id) so the same
// thread model can hang off a ticket, complaint, or suggestion. Prisma can't
// model that with a real relation, so it is resolved here in app code (mirrors
// AttachmentService).
export class ReplyService extends Service {
  async create(input: CreateReplyInput): Promise<Reply> {
    const data = createReplySchema.parse(input);
    return this.prisma.reply.create({ data });
  }

  // A single reply by id (no author loaded) — used to authorize edits/deletes.
  findById(id: number): Promise<Reply | null> {
    return this.prisma.reply.findUnique({ where: { id } });
  }

  // Replaces a reply's text. Authorization (author or admin) is enforced by the
  // caller before this runs.
  update(id: number, description: string): Promise<Reply> {
    return this.prisma.reply.update({ where: { id }, data: { description } });
  }

  // Deletes a reply and its entire descendant subtree (replies can nest to any
  // depth). Descendants are collected breadth-first, then removed together in one
  // statement so no child is left orphaned by — or outliving — its parent.
  async delete(id: number): Promise<void> {
    const ids = [id];
    let frontier = [id];
    while (frontier.length > 0) {
      const children = await this.prisma.reply.findMany({
        where: { parentReplyId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((child) => child.id);
      ids.push(...frontier);
    }
    await this.prisma.reply.deleteMany({ where: { id: { in: ids } } });
  }

  // All replies for one entity, oldest first, each with its author loaded so the
  // view can render an attributed conversation thread.
  async forEntity(
    entityType: ReplyEntityType,
    entityId: number,
  ): Promise<ReplyWithAuthor[]> {
    const replies = await this.prisma.reply.findMany({
      where: { entityType, entityId },
      include: { user: { select: authorSelect } },
      orderBy: { id: "asc" },
    });
    return replies.map(({ user, ...reply }) => ({
      ...reply,
      user: {
        id: user.id,
        name: user.name,
        image: user.image,
        jobTitle: user.jobTitle,
        role: {
          name: effectiveRoleName({
            isAdmin: user.isAdmin,
            isSystemSupport: user.isSystemSupport,
            managesProject: user.managedProjects.length > 0,
            membershipRoleNames: user.projectMemberships.map((m) => m.role.name),
          }),
        },
      },
    }));
  }

  // Whether `replyId` is a reply on the given entity (at any depth). Used to
  // validate a threaded reply's target so a reply can't be grafted onto an
  // unrelated ticket/complaint/suggestion.
  async isOnEntity(
    replyId: number,
    entityType: ReplyEntityType,
    entityId: number,
  ): Promise<boolean> {
    const parent = await this.prisma.reply.findUnique({
      where: { id: replyId },
      select: { entityType: true, entityId: true },
    });
    return (
      !!parent && parent.entityType === entityType && parent.entityId === entityId
    );
  }

  // Distinct author user ids for all replies on an entity.
  async authorUserIdsOnEntity(
    entityType: ReplyEntityType,
    entityId: number,
  ): Promise<number[]> {
    const replies = await this.prisma.reply.findMany({
      where: { entityType, entityId },
      select: { userId: true },
      distinct: ["userId"],
    });
    return replies.map((reply) => reply.userId);
  }

  // Distinct author user ids for direct children of a parent reply on an entity.
  async authorUserIdsUnderParent(
    entityType: ReplyEntityType,
    entityId: number,
    parentReplyId: number,
  ): Promise<number[]> {
    const replies = await this.prisma.reply.findMany({
      where: { entityType, entityId, parentReplyId },
      select: { userId: true },
      distinct: ["userId"],
    });
    return replies.map((reply) => reply.userId);
  }

  // Reply counts for many entities of one type, returned as an id -> count map
  // (entities with no replies are absent). Used by list views.
  async countByEntity(
    entityType: ReplyEntityType,
    entityIds: number[],
  ): Promise<Map<number, number>> {
    if (entityIds.length === 0) return new Map();
    const grouped = await this.prisma.reply.groupBy({
      by: ["entityId"],
      where: { entityType, entityId: { in: entityIds } },
      _count: { _all: true },
    });
    return new Map(grouped.map((row) => [row.entityId, row._count._all]));
  }
}

export const replyService = new ReplyService();

export * from "./schemas";
export * from "./types";
