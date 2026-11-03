import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guards";
import { userService } from "@/services";
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
  AddTeamMemberButton,
  TeamMemberRowActions,
} from "./_components/team-member-actions";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("admin");
  const t = await getTranslations("Dashboard");

  const [members, users] = await Promise.all([
    userService.featured(),
    userService.list(),
  ]);

  // Candidates for the "add" picker: active users not already on the team.
  const candidates = users
    .filter((user) => !user.isFeatured && !user.isDisabled)
    .map((user) => ({ id: user.id, name: user.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("teamMembers.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("teamMembers.subtitle")}
          </p>
        </div>
        <AddTeamMemberButton candidates={candidates} />
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("teamMembers.empty")}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t("teamMembers.image")}</TableHead>
                <TableHead>{t("teamMembers.name")}</TableHead>
                <TableHead>{t("teamMembers.position")}</TableHead>
                <TableHead>{t("teamMembers.company")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Avatar className="size-9">
                      {member.image ? (
                        <AvatarImage src={member.image} alt={member.name} />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {initials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                  </TableCell>
                  <TableCell className="font-medium">
                    {member.name}
                    <span className="ms-2 text-xs text-muted-foreground">
                      {member.username}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {member.jobTitle ?? t("teamMembers.noPosition")}
                  </TableCell>
                  <TableCell>
                    {member.company ? (
                      <Badge variant="secondary">{member.company.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("teamMembers.noCompany")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <TeamMemberRowActions
                      member={{ id: member.id, name: member.name }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
