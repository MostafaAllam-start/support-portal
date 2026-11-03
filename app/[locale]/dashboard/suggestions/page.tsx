import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  managedCompanyIds,
  managedProjectIds,
  requireRole,
} from "@/lib/auth/guards";
import { ProjectRole, UserRole } from "@/lib/auth/roles";
import { suggestionService } from "@/services";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SuggestionRow } from "./_components/suggestion-row";
import { SuggestionRowActions } from "./_components/suggestion-actions";

export default async function SuggestionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireRole(UserRole.admin, ProjectRole.Manager);
  const t = await getTranslations("Dashboard");

  // A manager sees the suggestions on their projects, plus the company-wide ones
  // (no project) of the companies those projects belong to.
  const suggestions =
    user.effectiveRole === "admin"
      ? await suggestionService.list()
      : await suggestionService.listForManager({
          projectIds: [
            ...new Set([
              ...managedProjectIds(user),
              ...user.memberships.map((membership) => membership.projectId),
            ]),
          ],
          companyIds: managedCompanyIds(user),
        });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("suggestions.heading")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("suggestions.subtitle")}
        </p>
      </div>

      {suggestions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("suggestions.empty")}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">{t("suggestions.id")}</TableHead>
                <TableHead>{t("suggestions.titleLabel")}</TableHead>
                <TableHead>{t("suggestions.detailsLabel")}</TableHead>
                <TableHead>{t("suggestions.author")}</TableHead>
                <TableHead>{t("suggestions.created")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.id}
                  id={suggestion.id}
                  label={suggestion.title}
                >
                  <TableCell className="text-muted-foreground">
                    #{suggestion.id}
                  </TableCell>
                  <TableCell className="font-medium">
                    {suggestion.title}
                  </TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">
                    {suggestion.details ?? "—"}
                  </TableCell>
                  <TableCell>{suggestion.createdBy.name}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {suggestion.createdAt.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <SuggestionRowActions
                      suggestion={{
                        id: suggestion.id,
                        title: suggestion.title,
                      }}
                    />
                  </TableCell>
                </SuggestionRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
