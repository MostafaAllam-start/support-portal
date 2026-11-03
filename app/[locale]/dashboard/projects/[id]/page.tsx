import { ChevronLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { projectService } from "@/services";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function statusVariant(status: string): "secondary" | "default" | "outline" {
  if (status === "open") return "secondary";
  if (status === "in_progress") return "default";
  return "outline";
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("admin");

  const projectId = Number(id);
  if (!Number.isInteger(projectId)) notFound();

  const project = await projectService.getDetail(projectId);
  if (!project) notFound();

  const t = await getTranslations("Dashboard");

  const overview = [
    { label: t("projects.company"), value: project.company.name },
    { label: t("projects.location"), value: project.location },
    {
      label: t("projects.manager"),
      value: project.manager?.name ?? t("projects.noManager"),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4 rtl:rotate-180" />
        {t("projects.detail.back")}
      </Link>

      <article className="rounded-xl border p-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Plain <img> so any logo URL works without next/image config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={project.company.logo}
            alt={project.company.name}
            className="h-10 w-10 rounded-md object-contain"
          />
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">#{project.id}</p>
            <h1 className="text-xl font-semibold tracking-tight">
              {project.name}
            </h1>
          </div>
        </div>

        <dl className="mt-5 grid gap-x-6 gap-y-2 border-t pt-5 text-sm sm:grid-cols-2">
          {overview.map((item) => (
            <div key={item.label} className="flex gap-2">
              <dt className="text-muted-foreground">{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </article>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          {t("projects.detail.membersTitle")}
          {project.members.length > 0 && (
            <span className="ms-2 text-sm font-normal text-muted-foreground">
              ({project.members.length})
            </span>
          )}
        </h2>

        {project.members.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("projects.detail.membersEmpty")}
          </div>
        ) : (
          <ul className="space-y-2">
            {project.members.map((member) => (
              <li
                key={member.user.id}
                className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <span>
                  {member.user.name}
                  <span className="ms-2 text-xs text-muted-foreground">
                    {member.user.username}
                  </span>
                </span>
                <Badge variant="outline">{member.role.name}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          {t("projects.detail.ticketsTitle")}
          {project.tickets.length > 0 && (
            <span className="ms-2 text-sm font-normal text-muted-foreground">
              ({project.tickets.length})
            </span>
          )}
        </h2>

        {project.tickets.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("projects.detail.ticketsEmpty")}
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">{t("tickets.id")}</TableHead>
                  <TableHead>{t("projects.detail.ticketTitle")}</TableHead>
                  <TableHead>{t("projects.detail.ticketStatus")}</TableHead>
                  <TableHead>{t("projects.detail.ticketCreated")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project.tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      #{ticket.id}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/dashboard/tickets/${ticket.id}`}
                        className="hover:underline"
                      >
                        {ticket.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(ticket.status)}>
                        {t(`status.${ticket.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {ticket.createdAt.toISOString().slice(0, 10)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
