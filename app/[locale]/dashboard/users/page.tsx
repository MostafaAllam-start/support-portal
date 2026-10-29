import { getTranslations, setRequestLocale } from "next-intl/server";
import { DEFAULT_ADMIN_USERNAME, requireRole } from "@/lib/auth/guards";
import { companyService, userService } from "@/services";
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

  const [users, companies] = await Promise.all([
    userService.listDetailed(),
    companyService.list(),
  ]);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));

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
        <AddUserButton companies={companyOptions} />
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
                  role: user.role.name,
                  jobTitle: user.jobTitle,
                  isDisabled: user.isDisabled,
                  isTeamMember: user.isTeamMember,
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
                  @{user.username}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <Badge variant="outline">{user.role.name}</Badge>
                </TableCell>
                <TableCell>
                  {user.companies.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
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
                      isAdmin: user.isAdmin,
                      isSystemSupport: user.isSystemSupport,
                      canAccessDashboard: user.canAccessDashboard,
                      image: user.image,
                      isDisabled: user.isDisabled,
                      companyId: user.companyId,
                      website: user.website,
                      whatsapp: user.whatsapp,
                      linkedin: user.linkedin,
                      isTeamMember: user.isTeamMember,
                      hasContactInfoCard: user.hasContactInfoCard,
                    }}
                    companies={companyOptions}
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
