import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  canAccessDashboardTicket,
  canChangeTicketStatus,
  canReplyToReport,
  canReplyToTicket,
  requireDashboardUser,
} from "@/lib/auth/guards";
import { replyAttachmentsMap } from "@/lib/reply-attachments";
import { reportAttachmentsMap } from "@/lib/report-attachments";
import { attachmentService, replyService, ticketService } from "@/services";
import { Badge } from "@/components/ui/badge";
import { TicketReplies } from "../../../tickets/_components/ticket-replies";
import { TicketReports } from "../../../tickets/_components/ticket-reports";
import { TicketReviewSummary } from "../../../tickets/_components/ticket-review-summary";
import { ChangeStatusDialog } from "../../_components/ticket-row-actions";
import { ReportFormDialog } from "../../_components/report-form-dialog";
import { Button } from "@/components/ui/button";
import { LiveReplies } from "@/components/live-replies";
import { liveRoom } from "@/realtime/liveReplies";

function statusVariant(status: string): "secondary" | "default" | "outline" {
  if (status === "open") return "secondary";
  if (status === "in_progress") return "default";
  return "outline";
}

export default async function DashboardTicketDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await requireDashboardUser();

  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) notFound();

  const ticket = await ticketService.getDetail(ticketId);
  if (!ticket) notFound();

  if (!canAccessDashboardTicket(user, ticket)) {
    notFound();
  }

  const isEngineer = user.effectiveRole === "software-engineer";
  const isConsultant = user.effectiveRole === "sap-consultant";

  const t = await getTranslations("Tickets");
  const created = ticket.createdAt.toISOString().slice(0, 10);
  const [images, replies] = await Promise.all([
    attachmentService.forEntity("ticket", ticket.id),
    replyService.forEntity("ticket", ticket.id),
  ]);
  const attachmentsByReply = await replyAttachmentsMap(replies);
  const attachmentsByReport = await reportAttachmentsMap(ticket.reports);
  // Admins land here from the Issues queue; engineers/reviewers from Tickets.
  const backHref = user.effectiveRole === "admin" ? "/dashboard/issues" : "/dashboard/tickets";

  const canChangeStatus = canChangeTicketStatus(user.effectiveRole);
  const isAssigned = ticket.assignees.some(
    (assignee) => assignee.assignee.id === user.id,
  );
  const canAddReport = (isEngineer || isConsultant) && isAssigned;
  const canReply =
    !isEngineer && !isConsultant && canReplyToTicket(user, ticket);
  const canReplyToReports = canReplyToReport(user, ticket);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <LiveReplies room={liveRoom("ticket", ticket.id)} />
      <Link
        href={backHref}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
        {t("detail.backToTickets")}
      </Link>

      <article className="rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">#{ticket.id}</p>
            <h1 className="text-xl font-semibold tracking-tight">
              {ticket.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(ticket.status)}>
              {t(`status.${ticket.status}`)}
            </Badge>
            {canAddReport && <ReportFormDialog ticketId={ticket.id} />}
            {canChangeStatus && (
              <ChangeStatusDialog
                ticket={{ id: ticket.id, status: ticket.status }}
                trigger={
                  <Button size="sm" variant="outline">
                    {t("detail.changeStatus")}
                  </Button>
                }
              />
            )}
          </div>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("detail.created")}</dt>
            <dd className="tabular-nums">{created}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("detail.reporter")}</dt>
            <dd>{ticket.user?.name ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("detail.assignee")}</dt>
            <dd>
              {ticket.assignees.length > 0 ? (
                ticket.assignees.map((a) => a.assignee.name).join(", ")
              ) : (
                <span className="text-muted-foreground">
                  {t("detail.unassigned")}
                </span>
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-5 border-t pt-5">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            {t("detail.description")}
          </h2>
          <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {images.length > 0 && (
          <div className="mt-5 border-t pt-5">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {t("detail.attachments")} ({images.length})
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map((image) => (
                <li key={image.id}>
                  <a
                    href={image.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video overflow-hidden rounded-lg border transition-opacity hover:opacity-90"
                  >
                    <Image
                      src={image.url}
                      alt=""
                      width={320}
                      height={180}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      <TicketReviewSummary
        reviewerName={ticket.reviewer?.name ?? null}
        reviewedAt={ticket.reviewedAt}
        comment={ticket.reviewComment}
      />

      <TicketReplies
        ticketId={ticket.id}
        currentUserId={user.id}
        currentUserRole={user.effectiveRole}
        replies={replies}
        attachmentsByReply={attachmentsByReply}
        canReply={canReply}
      />

      <TicketReports
        ticketId={ticket.id}
        reports={ticket.reports}
        attachmentsByReport={attachmentsByReport}
        canReplyToReport={canReplyToReports}
        currentUserId={user.id}
        currentUserRole={user.effectiveRole}
      />
    </div>
  );
}
