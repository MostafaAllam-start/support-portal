import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ScopeTicketStats } from "@/services";

export async function KpiProjectBreakdown({
  groups,
  isGlobal,
}: {
  groups: ScopeTicketStats[];
  isGlobal: boolean;
}) {
  const t = await getTranslations("Dashboard");

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("kpis.projectsTitle")}</CardTitle>
          <CardDescription>
            {isGlobal
              ? t("kpis.projectsDescriptionGlobal")
              : t("kpis.projectsDescriptionScoped")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("kpis.projectsEmpty")}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("kpis.projectsTitle")}</CardTitle>
        <CardDescription>
          {isGlobal
            ? t("kpis.projectsDescriptionGlobal")
            : t("kpis.projectsDescriptionScoped")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {groups.map((group) => (
          <div key={group.scopeId ?? `company:${group.scopeName}`} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{group.scopeName}</h3>
                <Badge variant="secondary">{group.stats.total}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>
                  {t("status.open")}:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {group.stats.open}
                  </span>
                </span>
                <span>
                  {t("status.in_progress")}:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {group.stats.in_progress}
                  </span>
                </span>
                <span>
                  {t("status.closed")}:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {group.stats.closed}
                  </span>
                </span>
              </div>
            </div>

            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("kpis.project")}</TableHead>
                    <TableHead className="text-end">{t("kpis.open")}</TableHead>
                    <TableHead className="text-end">
                      {t("kpis.inProgress")}
                    </TableHead>
                    <TableHead className="text-end">{t("kpis.closed")}</TableHead>
                    <TableHead className="text-end">{t("kpis.total")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.projects.map((project) => (
                    <TableRow key={project.projectId ?? "unscoped"}>
                      <TableCell className="font-medium">
                        {project.projectId == null
                          ? t("kpis.noProject")
                          : project.projectName}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {project.stats.open}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {project.stats.in_progress}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {project.stats.closed}
                      </TableCell>
                      <TableCell className="text-end tabular-nums">
                        {project.stats.total}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
