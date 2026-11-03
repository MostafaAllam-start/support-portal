import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireDashboardUser, ticketScopeForUser } from "@/lib/auth/guards";
import { ticketService, userService } from "@/services";
import { TicketsTable } from "../_components/tickets-table";
import { AddTicketButton } from "../_components/ticket-row-actions";

export default async function TicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireDashboardUser();
  const t = await getTranslations("Dashboard");

  const isManager = user.effectiveRole === "manager";
  const isReviewer = user.effectiveRole === "reviewer";
  const isConsultant = user.effectiveRole === "sap-consultant";
  const isAdmin = user.effectiveRole === "admin";

  // Managers see their projects' tickets, reviewers and consultants their
  // company's, engineers the ones assigned to them (see ticketScopeForUser).
  const tickets = await ticketService.forScope(ticketScopeForUser(user));

  const canAddTicket = isAdmin || isManager;
  const canEditTicket = isAdmin || isManager;
  const canDeleteTicket = isAdmin || isManager;
  const canAssignTicket = isAdmin || isManager || isReviewer;
  const canChangeStatus = isAdmin || isManager || isReviewer;
  const assignees = canAssignTicket
    ? await userService.assignableStaff()
    : [];

  const title = isAdmin
    ? t("tickets.title")
    : isManager
      ? t("nav.projectTickets")
      : isReviewer || isConsultant
        ? t("nav.companyTickets")
        : t("nav.myTickets");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {t("tickets.subtitle")}
          </p>
        </div>
        {canAddTicket && <AddTicketButton assignees={assignees} />}
      </div>
      <TicketsTable
        tickets={tickets}
        canEdit={canEditTicket}
        canAssign={canAssignTicket}
        canDelete={canDeleteTicket}
        canChangeStatus={canChangeStatus}
        assignees={assignees}
      />
    </div>
  );
}
