import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { managedProjectIds, requireRole } from "@/lib/auth/guards";
import { complaintService } from "@/services";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ComplaintRow } from "./_components/complaint-row";

export default async function ComplaintsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole("admin", "manager");
  const t = await getTranslations("Dashboard");

  // Admin sees every complaint; a manager only sees complaints on tickets that
  // belong to the project(s) they manage.
  const complaints =
    user.effectiveRole === "admin"
      ? await complaintService.list()
      : await complaintService.forProjects(managedProjectIds(user));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("complaints.heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("complaints.subtitle")}
        </p>
      </div>

      {complaints.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("complaints.empty")}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">{t("complaints.id")}</TableHead>
                <TableHead>{t("complaints.titleLabel")}</TableHead>
                <TableHead>{t("complaints.detailsLabel")}</TableHead>
                <TableHead>{t("complaints.ticket")}</TableHead>
                <TableHead>{t("complaints.author")}</TableHead>
                <TableHead>{t("complaints.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {complaints.map((complaint) => (
                <ComplaintRow
                  key={complaint.id}
                  id={complaint.id}
                  label={complaint.title}
                >
                  <TableCell className="text-muted-foreground">
                    <Link
                      href={`/dashboard/complaints/${complaint.id}`}
                      className="hover:underline"
                    >
                      #{complaint.id}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/complaints/${complaint.id}`}
                      className="hover:underline"
                    >
                      {complaint.title}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">
                    {complaint.details}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/tickets/${complaint.ticketId}`}
                      className="text-primary hover:underline"
                    >
                      #{complaint.ticketId} {complaint.ticket.title}
                    </Link>
                  </TableCell>
                  <TableCell>{complaint.createdBy.name}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {complaint.createdAt.toISOString().slice(0, 10)}
                  </TableCell>
                </ComplaintRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
