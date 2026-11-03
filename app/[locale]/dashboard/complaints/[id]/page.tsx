import Image from "next/image";
import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  canReplyToComplaint,
  managedProjectIds,
  requireDashboardUser,
} from "@/lib/auth/guards";
import { replyAttachmentsMap } from "@/lib/reply-attachments";
import { attachmentService, complaintService, replyService } from "@/services";
import { TicketReplies } from "../../../tickets/_components/ticket-replies";
import { LiveReplies } from "@/components/live-replies";
import { liveRoom } from "@/realtime/liveReplies";
import {
  deleteComplaintReplyAction,
  postComplaintReplyAction,
  updateComplaintReplyAction,
} from "../../reply-actions";

const complaintReplyActions = {
  post: postComplaintReplyAction,
  update: updateComplaintReplyAction,
  delete: deleteComplaintReplyAction,
};

export default async function ComplaintDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await requireDashboardUser();

  const complaintId = Number(id);
  if (!Number.isInteger(complaintId)) notFound();

  const complaint = await complaintService.getDetail(complaintId);
  if (!complaint) notFound();

  const isAdmin = user.effectiveRole === "admin";
  if (!isAdmin) {
    const projectId = complaint.ticket.projectId;
    if (projectId == null) notFound();
    if (!managedProjectIds(user).includes(projectId)) notFound();
  }

  const canReply = canReplyToComplaint(user, complaint.ticket);
  const [attachments, replies] = await Promise.all([
    attachmentService.forEntity("complaint", complaint.id),
    replyService.forEntity("complaint", complaint.id),
  ]);
  const attachmentsByReply = await replyAttachmentsMap(replies);
  const t = await getTranslations("Dashboard");
  const created = complaint.createdAt.toISOString().slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <LiveReplies room={liveRoom("complaint", complaint.id)} />
      <Link
        href="/dashboard/complaints"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
        {t("complaints.backToList")}
      </Link>

      <article className="rounded-xl border p-6">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">#{complaint.id}</p>
          <h1 className="text-xl font-semibold tracking-tight">
            {complaint.title}
          </h1>
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("complaints.author")}</dt>
            <dd>{complaint.createdBy.name}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{t("complaints.created")}</dt>
            <dd className="tabular-nums">{created}</dd>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <dt className="text-muted-foreground">{t("complaints.ticket")}</dt>
            <dd>
              <Link
                href={`/dashboard/tickets/${complaint.ticketId}`}
                className="text-primary hover:underline"
              >
                #{complaint.ticketId} {complaint.ticket.title}
              </Link>
            </dd>
          </div>
        </dl>

        <div className="mt-5 border-t pt-5">
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">
            {t("complaints.detailsLabel")}
          </h2>
          <p className="text-sm whitespace-pre-wrap">{complaint.details}</p>
        </div>

        {attachments.length > 0 && (
          <div className="mt-5 border-t pt-5">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {t("complaints.attachments")} ({attachments.length})
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {attachments.map((image) => (
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

      <TicketReplies
        entityForm={{ entityField: "entityId", entityId: complaint.id }}
        actions={complaintReplyActions}
        currentUserId={user.id}
        currentUserRole={user.effectiveRole}
        replies={replies}
        attachmentsByReply={attachmentsByReply}
        canReply={canReply}
      />
    </div>
  );
}
