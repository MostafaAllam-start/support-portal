import { getTranslations, setRequestLocale } from "next-intl/server";
import { DEFAULT_ADMIN_USERNAME, requireRole } from "@/lib/auth/guards";
import {
  companyService,
  projectService,
  roleService,
  scopeService,
  userService,
} from "@/services";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  AddUserButton,
  UserRowActions,
} from "./_components/user-actions";
import { UserRow } from "./_components/user-row";

// Up to two uppercase initials from a display name, for the avatar fallback.
function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = await requireRole("admin");
  const t = await getTranslations("Dashboard");

  const [users, companies, projects, roles, scopes] = await Promise.all([
    userService.listDetailed(),
    companyService.list(),
    projectService.list(),
    roleService.list(),
    scopeService.list(),
  ]);
  // What the create/edit form offers: companies, and the projects and project
  // roles a team member can be given.
  const formOptions = {
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      companyId: p.company.id,
      companyName: p.company.name,
    })),
    roles: roles.map((r) => ({ id: r.id, name: r.name })),
    scopes: scopes.map((s) => ({ id: s.id, name: s.name, companies: s.companies })),
  };
  // A team member's project roles, as display names.
  const projectRoleLabel = (name: string) =>
    t.has(`users.projectRoles.${name}`) ? t(`users.projectRoles.${name}`) : name;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("users.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("users.subtitle")}</p>
          <p className="text-xs text-muted-foreground">{t("users.details.hint")}</p>
        </div>
        <AddUserButton options={formOptions} />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">{t("users.image")}</TableHead>
              <TableHead>{t("users.name")}</TableHead>
              <TableHead>{t("users.username")}</TableHead>
              <TableHead>{t("users.email")}</TableHead>
              <TableHead>{t("users.role")}</TableHead>
              <TableHead>{t("users.companies")}</TableHead>
              <TableHead>{t("users.status")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                details={{
                  id: user.id,
                  name: user.name,
                  username: user.username,
                  email: user.email,
                  image: user.image,
                  type: t(`users.types.${user.role}.label`),
                  scopes: user.scopeNames,
                  projectRoles: [
                    ...(user.role === "team_member" && user.isSupport
                      ? [t("users.form.support")]
                      : []),
                    ...user.projectRoles.map(projectRoleLabel),
                  ],
                  jobTitle: user.jobTitle,
                  isDisabled: user.isDisabled,
                  isFeatured: user.isFeatured,
                  hasContactInfoCard: user.hasContactInfoCard,
                  companies: user.companies,
                }}
              >
                <TableCell>
                  <Avatar className="size-9">
                    {user.image && (
                      <AvatarImage src={user.image} alt={user.name} />
                    )}
                    <AvatarFallback className="text-xs">
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {user.username}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap items-center gap-1">
                    <Badge variant={user.role === "admin" ? "default" : "outline"}>
                      {t(`users.types.${user.role}.label`)}
                    </Badge>
                    {user.role === "team_member" && user.isSupport && (
                      <Badge variant="secondary" className="font-normal">
                        {t("users.form.support")}
                      </Badge>
                    )}
                    {user.projectRoles.map((name) => (
                      <Badge key={name} variant="secondary" className="font-normal">
                        {projectRoleLabel(name)}
                      </Badge>
                    ))}
                  </span>
                </TableCell>
                <TableCell>
                  {user.companies.length > 0 ? (
                    <span className="flex flex-wrap items-center gap-1">
                      {user.companies.map((company) => (
                        <Badge key={company.id} variant="secondary">
                          {company.name}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {t("users.noCompanies")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {user.isDisabled ? (
                    <Badge variant="destructive">{t("users.disabled")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("users.active")}</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <UserRowActions
                    user={{
                      id: user.id,
                      name: user.name,
                      username: user.username,
                      email: user.email,
                      jobTitle: user.jobTitle,
                      role: user.role,
                      isSupport: user.isSupport,
                      scopeIds: user.scopeIds,
                      image: user.image,
                      isDisabled: user.isDisabled,
                      companyId: user.companyId,
                      website: user.website,
                      whatsapp: user.whatsapp,
                      linkedin: user.linkedin,
                      isFeatured: user.isFeatured,
                      hasContactInfoCard: user.hasContactInfoCard,
                      memberships: user.memberships,
                    }}
                    options={formOptions}
                    isSelf={user.id === admin.id}
                    isDefaultAdmin={user.username === DEFAULT_ADMIN_USERNAME}
                  />
                </TableCell>
              </UserRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
