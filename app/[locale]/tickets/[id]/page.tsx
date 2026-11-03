import { Suspense } from "react";
import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/guards";
import { replyAttachmentsMap } from "@/lib/reply-attachments";
import { reportAttachmentsMap } from "@/lib/report-attachments";
import { attachmentService, replyService, ticketService } from "@/services";
import { TicketReports } from "../_components/ticket-reports";
import { Badge } from "@/components/ui/badge";
import { TicketsHeader } from "../_components/tickets-header";
import { ReportAnIssueDialog } from "../_components/report-an-issue-dialog";
import { TicketDetailSkeleton } from "../_components/tickets-skeletons";
import { TicketReplies } from "../_components/ticket-replies";
import { TicketReviewSummary } from "../_components/ticket-review-summary";
import { LiveReplies } from "@/components/live-replies";
import { liveRoom } from "@/realtime/liveReplies";

function statusVariant(status: string): "secondary" | "default" | "outline" {
  if (status === "open") return "secondary";
  if (status === "in_progress") return "default";
  return "outline";
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await requireUser();

  const ticketId = Number(id);
  if (!Number.isInteger(ticketId)) notFound();

  const t = await getTranslations("Tickets");

  return (
    <div className="flex min-h-screen flex-col">
      <TicketsHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Link
          href="/tickets"
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          {t("detail.back")}
        </Link>

        {/* Back link + header stay; the ticket body streams in with a skeleton. */}
        <Suspense fallback={<TicketDetailSkeleton />}>
          <TicketDetail
            ticketId={ticketId}
            userId={user.id}
            userRole={user.effectiveRole}
          />
        </Suspense>
      </main>
    </div>
  );
}

async function TicketDetail({
  ticketId,
  userId,
  userRole,
}: {
  ticketId: number;
  userId: number;
  userRole: string;
}) {
  // Scoped to the current user, so opening someone else's (or a missing) ticket
  // 404s rather than leaking it.
  const ticket = await ticketService.getForReporter(ticketId, userId);
  if (!ticket) notFound();

  const t = await getTranslations("Tickets");
  const created = ticket.createdAt.toISOString().slice(0, 10);
  const [images, replies] = await Promise.all([
    attachmentService.forEntity("ticket", ticket.id),
    replyService.forEntity("ticket", ticket.id),
  ]);
  const attachmentsByReply = await replyAttachmentsMap(replies);
  const attachmentsByReport = await reportAttachmentsMap(ticket.reports);

  return (
    <>
      <LiveReplies room={liveRoom("ticket", ticket.id)} />
      <article className="rounded-xl border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">#{ticket.id}</p>
            <h1 className="text-xl font-semibold tracking-tight">
              {ticket.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(ticket.status)}>
              {t(`status.${ticket.status}`)}
            </Badge>
            <ReportAnIssueDialog ticketId={ticket.id} />
          </div>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("detail.created")}</dt>
            <dd className="tabular-nums">{created}</dd>
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
        currentUserId={userId}
        currentUserRole={userRole}
        replies={replies}
        attachmentsByReply={attachmentsByReply}
      />

      <TicketReports
        ticketId={ticket.id}
        reports={ticket.reports}
        attachmentsByReport={attachmentsByReport}
        canReplyToReport={false}
        currentUserId={userId}
        currentUserRole={userRole}
      />
    </>
  );
}
