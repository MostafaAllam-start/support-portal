import { getTranslations } from "next-intl/server";

type TicketNotificationMessages = {
  ticketCreated: (title: string) => { title: string; details: string };
  ticketReply: (name: string, ticketId: number) => { title: string; details: string };
  ticketStatusChanged: (ticketId: number, status: string) => { title: string; details: string };
  ticketAssigned: (ticketId: number) => { title: string; details: string };
  ticketAssignedToYou: (ticketId: number) => { title: string; details: string };
  ticketReportSubmitted: (ticketId: number) => { title: string; details: string };
  ticketReportReply: (ticketId: number) => { title: string; details: string };
  complaintSubmitted: (ticketId: number) => { title: string; details: string };
  suggestionCreated: (title: string) => { title: string; details: string };
  siteRequestSubmitted: (name: string, organization: string) => { title: string; details: string };
  accountRequested: (input: {
    actor: string;
    name: string;
    email: string;
    organization: string;
  }) => { title: string; details: string };
};

export async function ticketNotificationMessages(): Promise<TicketNotificationMessages> {
  const t = await getTranslations("Dashboard.notifications.events");

  return {
    ticketCreated: (title) => ({
      title: t("ticketCreated.title", { title }),
      details: t("ticketCreated.details", { title }),
    }),
    ticketReply: (name, ticketId) => ({
      title: t("ticketReply.title", { name, id: ticketId }),
      details: t("ticketReply.details", { name, id: ticketId }),
    }),
    ticketStatusChanged: (ticketId, status) => ({
      title: t("ticketStatusChanged.title", { id: ticketId }),
      details: t("ticketStatusChanged.details", { id: ticketId, status }),
    }),
    ticketAssigned: (ticketId) => ({
      title: t("ticketAssigned.title", { id: ticketId }),
      details: t("ticketAssigned.details", { id: ticketId }),
    }),
    ticketAssignedToYou: (ticketId) => ({
      title: t("ticketAssignedToYou.title", { id: ticketId }),
      details: t("ticketAssignedToYou.details", { id: ticketId }),
    }),
    ticketReportSubmitted: (ticketId) => ({
      title: t("ticketReportSubmitted.title", { id: ticketId }),
      details: t("ticketReportSubmitted.details", { id: ticketId }),
    }),
    ticketReportReply: (ticketId) => ({
      title: t("ticketReportReply.title", { id: ticketId }),
      details: t("ticketReportReply.details", { id: ticketId }),
    }),
    complaintSubmitted: (ticketId) => ({
      title: t("complaintSubmitted.title", { id: ticketId }),
      details: t("complaintSubmitted.details", { id: ticketId }),
    }),
    suggestionCreated: (title) => ({
      title: t("suggestionCreated.title", { title }),
      details: t("suggestionCreated.details", { title }),
    }),
    siteRequestSubmitted: (name, organization) => ({
      title: t("siteRequestSubmitted.title", { organization }),
      details: t("siteRequestSubmitted.details", { name, organization }),
    }),
    accountRequested: (input) => ({
      title: t("accountRequested.title", { organization: input.organization }),
      details: t("accountRequested.details", input),
    }),
  };
}
