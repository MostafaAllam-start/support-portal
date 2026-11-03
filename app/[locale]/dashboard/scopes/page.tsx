import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireRole } from "@/lib/auth/guards";
import { companyService, scopeService } from "@/services";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScopeRowActions } from "./_components/scope-actions";

// The company scopes (CTC, ECM, …) given to team members and clients, who hold
// one or more. A team member's scopes decide whose tickets a reviewer or
// consultant works; a client's list the companies they belong to. The seed
// creates them; admins can rename them, change their companies or delete one
// nobody holds, but not add more.
export default async function ScopesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("admin");
  const t = await getTranslations("Dashboard");

  const [scopes, companies] = await Promise.all([
    scopeService.listWithUsage(),
    companyService.list(),
  ]);
  const companyOptions = companies.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("scopes.title")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("scopes.subtitle")}</p>
        </div>
      </div>

      {scopes.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("scopes.empty")}
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t("scopes.logo")}</TableHead>
                <TableHead>{t("scopes.name")}</TableHead>
                <TableHead>{t("scopes.companies")}</TableHead>
                <TableHead>{t("scopes.users")}</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {scopes.map((scope) => (
                <TableRow key={scope.id}>
                  <TableCell>
                    {scope.logo && (
                      // Plain <img> so any logo URL works without next/image config.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={scope.logo}
                        alt={scope.name}
                        className="h-9 w-9 rounded-md object-contain"
                      />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{scope.name}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      {scope.companies.map((company) => (
                        <Badge key={company.id} variant="secondary">
                          {company.name}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {scope.userCount}
                  </TableCell>
                  <TableCell>
                    <ScopeRowActions
                      scope={{
                        id: scope.id,
                        name: scope.name,
                        logo: scope.logo,
                        companyIds: scope.companies.map((company) => company.id),
                        userCount: scope.userCount,
                      }}
                      companies={companyOptions}
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
