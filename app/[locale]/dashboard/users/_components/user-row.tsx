"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TableRow } from "@/components/ui/table";

export type UserDetails = {
  id: number;
  name: string;
  username: string;
  email: string;
  image: string | null;
  // The account type's display name, and a team member's project roles.
  type: string;
  projectRoles: string[];
  // The names of the scopes (CTC, ECM, …) a team member or client holds.
  scopes: string[];
  jobTitle: string | null;
  isDisabled: boolean;
  isFeatured: boolean;
  hasContactInfoCard: boolean;
  companies: { id: number; name: string }[];
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-end">{children}</span>
    </div>
  );
}

// A user row that reveals a details panel on double-click. The details modal
// surfaces the fields not shown in the table — including every company the user
// is connected to.
export function UserRow({
  details,
  children,
}: {
  details: UserDetails;
  children: ReactNode;
}) {
  const t = useTranslations("Dashboard");
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow
        onDoubleClick={() => setOpen(true)}
        className="cursor-default select-none"
      >
        {children}
      </TableRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("users.details.title")}</DialogTitle>
            <DialogDescription className="sr-only">
              {details.name}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              {details.image ? (
                <AvatarImage src={details.image} alt={details.name} />
              ) : null}
              <AvatarFallback>{initials(details.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium">{details.name}</div>
              <div className="text-xs text-muted-foreground">
                {details.username}
              </div>
            </div>
          </div>

          <div className="divide-y rounded-lg border px-3">
            <DetailRow label={t("users.email")}>{details.email}</DetailRow>
            <DetailRow label={t("users.role")}>
              <Badge variant="outline">{details.type}</Badge>
            </DetailRow>
            {details.projectRoles.length > 0 && (
              <DetailRow label={t("users.projectRolesLabel")}>
                <span className="flex flex-wrap justify-end gap-1">
                  {details.projectRoles.map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                </span>
              </DetailRow>
            )}
            {details.scopes.length > 0 && (
              <DetailRow label={t("users.form.scope")}>
                <span className="flex flex-wrap gap-1">
                  {details.scopes.map((name) => (
                    <Badge key={name} variant="outline">
                      {name}
                    </Badge>
                  ))}
                </span>
              </DetailRow>
            )}
            <DetailRow label={t("users.details.jobTitle")}>
              {details.jobTitle ?? t("users.details.none")}
            </DetailRow>
            <DetailRow label={t("users.status")}>
              {details.isDisabled ? (
                <Badge variant="destructive">{t("users.disabled")}</Badge>
              ) : (
                <Badge variant="secondary">{t("users.active")}</Badge>
              )}
            </DetailRow>
            <DetailRow label={t("users.details.companies")}>
              {details.companies.length > 0 ? (
                <span className="flex flex-wrap justify-end gap-1">
                  {details.companies.map((company) => (
                    <Badge key={company.id} variant="secondary">
                      {company.name}
                    </Badge>
                  ))}
                </span>
              ) : (
                t("users.details.none")
              )}
            </DetailRow>
            <DetailRow label={t("users.details.featured")}>
              {details.isFeatured
                ? t("users.details.yes")
                : t("users.details.no")}
            </DetailRow>
            <DetailRow label={t("users.details.contactCard")}>
              {details.hasContactInfoCard
                ? t("users.details.yes")
                : t("users.details.no")}
            </DetailRow>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
