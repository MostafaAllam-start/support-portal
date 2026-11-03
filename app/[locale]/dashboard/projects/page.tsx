import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guards";
import { companyService, projectService, roleService, userService } from "@/services";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AddProjectButton,
  ClickableProjectRow,
  ProjectRowActions,
} from "./_components/project-actions";

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("admin");
  const t = await getTranslations("Dashboard");

  const [projects, companies, users, roles] = await Promise.all([
    projectService.listDetailed(),
    companyService.list(),
    // Only team members manage projects or hold project roles.
    userService.teamMemberOptions(),
    roleService.list(),
  ]);

  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));
  // The team members who can work on a project of the given company.
  const userOptionsFor = (companyId: number) =>
    users
      .filter((user) => user.companyIds.includes(companyId))
      .map(({ id, name }) => ({ id, name }));
  const userOptions = users.map(({ id, name }) => ({ id, name }));
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("projects.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("projects.subtitle")}
          </p>
        </div>
        <AddProjectButton companies={companyOptions} users={userOptions} />
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("projects.empty")}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("projects.name")}</TableHead>
                <TableHead>{t("projects.company")}</TableHead>
                <TableHead>{t("projects.location")}</TableHead>
                <TableHead>{t("projects.manager")}</TableHead>
                <TableHead>{t("projects.members.column")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <ClickableProjectRow key={project.id} id={project.id}>
                  <TableCell className="font-medium">{project.name}</TableCell>
                  <TableCell>{project.company.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.location}
                  </TableCell>
                  <TableCell>
                    {project.manager?.name ?? (
                      <span className="text-muted-foreground">
                        {t("projects.noManager")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {project.members.length}
                  </TableCell>
                  <TableCell>
                    <ProjectRowActions
                      project={{
                        id: project.id,
                        name: project.name,
                        location: project.location,
                        companyId: project.companyId,
                        managerId: project.managerId,
                        members: project.members.map((m) => ({
                          userId: m.user.id,
                          userName: m.user.name,
                          roleId: m.role.id,
                          roleName: m.role.name,
                        })),
                      }}
                      companies={companyOptions}
                      users={userOptionsFor(project.companyId)}
                      roles={roleOptions}
                    />
                  </TableCell>
                </ClickableProjectRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
