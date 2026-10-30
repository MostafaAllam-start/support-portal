"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  BellRing,
  CircleCheck,
  Eye,
  Loader2,
  MoreHorizontal,
  PhoneCall,
  RotateCcw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  notifyAdminAction,
  setRequestStatusAction,
  type RequestActionState,
} from "../actions";

type Status = "new" | "contacted" | "admin_notified" | "closed";

export type RequestItem = {
  id: number;
  name: string;
  email: string;
  organization: string;
  modules: string[];
  message: string | null;
  status: Status;
  createdAt: string; // ISO
  adminNotifiedAt: string | null; // ISO
  adminNotifiedBy: string | null;
};

const FILTERS = ["all", "new", "contacted", "admin_notified", "closed"] as const;
type Filter = (typeof FILTERS)[number];

const STATUS_CLASSES: Record<Status, string> = {
  new: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  contacted: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  admin_notified:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  closed: "text-muted-foreground",
};

// Dates render as UTC so server and browser agree (no hydration mismatch).
function formatDate(iso: string) {
  return iso.slice(0, 10);
}
function formatDateTime(iso: string) {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

function StatusBadge({ status }: { status: Status }) {
  const t = useTranslations("Dashboard.requests.status");
  return (
    <Badge variant="outline" className={STATUS_CLASSES[status]}>
      {t(status)}
    </Badge>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-end break-words">{children}</span>
    </div>
  );
}

// Calls a request server action outside a <form> and reports the outcome.
function useRequestAction(
  action: (prev: RequestActionState, formData: FormData) => Promise<RequestActionState>,
  successMessage: string,
  onSuccess?: () => void,
) {
  const [pending, startTransition] = useTransition();
  function run(fields: Record<string, string>) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.ok) {
        toast.success(successMessage);
        onSuccess?.();
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}

export function RequestsTable({
  requests,
  initialOpenId,
  canNotifyAdmin,
}: {
  requests: RequestItem[];
  initialOpenId: number | null;
  // False for admins: they would only be notifying themselves.
  canNotifyAdmin: boolean;
}) {
  const t = useTranslations("Dashboard.requests");
  const [filter, setFilter] = useState<Filter>("all");
  const [detailsId, setDetailsId] = useState<number | null>(initialOpenId);
  const [notifyId, setNotifyId] = useState<number | null>(null);

  const visible =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const details = requests.find((r) => r.id === detailsId) ?? null;
  const notifyTarget = requests.find((r) => r.id === notifyId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("filterLabel")}>
        {FILTERS.map((value) => {
          const count =
            value === "all"
              ? requests.length
              : requests.filter((r) => r.status === value).length;
          return (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? t("filterAll") : t(`status.${value}`)}
              <span className="tabular-nums opacity-70">{count}</span>
            </Button>
          );
        })}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("received")}</TableHead>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("organization")}</TableHead>
              <TableHead>{t("email")}</TableHead>
              <TableHead>{t("modules")}</TableHead>
              <TableHead>{t("statusLabel")}</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((request) => (
                <TableRow
                  key={request.id}
                  onDoubleClick={() => setDetailsId(request.id)}
                  className="cursor-default select-none"
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatDate(request.createdAt)}
                  </TableCell>
                  <TableCell className="font-medium">{request.name}</TableCell>
                  <TableCell>{request.organization}</TableCell>
                  <TableCell>
                    <a
                      href={`mailto:${request.email}`}
                      className="underline-offset-4 hover:underline"
                      onDoubleClick={(event) => event.stopPropagation()}
                    >
                      {request.email}
                    </a>
                  </TableCell>
                  <TableCell>
                    <ModuleBadges modules={request.modules} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={request.status} />
                  </TableCell>
                  <TableCell>
                    <RequestRowActions
                      request={request}
                      onView={() => setDetailsId(request.id)}
                      onNotify={canNotifyAdmin ? () => setNotifyId(request.id) : undefined}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RequestDetailsDialog
        request={details}
        onOpenChange={(open) => !open && setDetailsId(null)}
        onNotify={
          canNotifyAdmin
            ? (id) => {
                setDetailsId(null);
                setNotifyId(id);
              }
            : undefined
        }
      />
      <NotifyAdminDialog
        request={notifyTarget}
        onOpenChange={(open) => !open && setNotifyId(null)}
      />
    </div>
  );
}

function ModuleBadges({ modules }: { modules: string[] }) {
  const t = useTranslations("Dashboard.requests");
  if (modules.length === 0) {
    return <span className="text-muted-foreground">{t("none")}</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {modules.map((module) => (
        <Badge key={module} variant="secondary">
          {t(`moduleNames.${module}`)}
        </Badge>
      ))}
    </span>
  );
}

function RequestRowActions({
  request,
  onView,
  onNotify,
}: {
  request: RequestItem;
  onView: () => void;
  // Omitted when the viewer can't notify the admins (they are one).
  onNotify?: () => void;
}) {
  const t = useTranslations("Dashboard.requests");
  const status = useRequestAction(setRequestStatusAction, t("toast.updated"));

  return (
    <span onDoubleClick={(event) => event.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" disabled={status.pending}>
            {status.pending ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
            <span className="sr-only">{t("actions")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onView}>
            <Eye />
            {t("view")}
          </DropdownMenuItem>
          {onNotify && (
            <DropdownMenuItem onSelect={onNotify}>
              <BellRing />
              {t("notifyAdmin")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {request.status === "closed" ? (
            <DropdownMenuItem onSelect={() => status.run({ id: String(request.id), status: "new" })}>
              <RotateCcw />
              {t("reopen")}
            </DropdownMenuItem>
          ) : (
            <>
              {request.status !== "contacted" && (
                <DropdownMenuItem
                  onSelect={() => status.run({ id: String(request.id), status: "contacted" })}
                >
                  <PhoneCall />
                  {t("markContacted")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() => status.run({ id: String(request.id), status: "closed" })}
              >
                <CircleCheck />
                {t("close")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

function RequestDetailsDialog({
  request,
  onOpenChange,
  onNotify,
}: {
  request: RequestItem | null;
  onOpenChange: (open: boolean) => void;
  // Omitted when the viewer can't notify the admins (they are one).
  onNotify?: (id: number) => void;
}) {
  const t = useTranslations("Dashboard.requests");

  return (
    <Dialog open={request != null} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-4 sm:max-h-[85vh]">
        {request && (
          <>
            <DialogHeader>
              <DialogTitle>{t("details.title", { id: request.id })}</DialogTitle>
              <DialogDescription>
                {t("details.from", { name: request.name, organization: request.organization })}
              </DialogDescription>
            </DialogHeader>

            <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1">
              <div className="divide-y rounded-lg border px-3">
                <DetailRow label={t("statusLabel")}>
                  <StatusBadge status={request.status} />
                </DetailRow>
                <DetailRow label={t("email")}>
                  <a href={`mailto:${request.email}`} className="underline-offset-4 hover:underline">
                    {request.email}
                  </a>
                </DetailRow>
                <DetailRow label={t("organization")}>{request.organization}</DetailRow>
                <DetailRow label={t("modules")}>
                  <span className="inline-flex justify-end">
                    <ModuleBadges modules={request.modules} />
                  </span>
                </DetailRow>
                <DetailRow label={t("received")}>{formatDateTime(request.createdAt)}</DetailRow>
                {request.adminNotifiedAt && (
                  <DetailRow label={t("details.adminNotified")}>
                    {t("details.adminNotifiedBy", {
                      date: formatDateTime(request.adminNotifiedAt),
                      name: request.adminNotifiedBy ?? t("none"),
                    })}
                  </DetailRow>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t("details.message")}</p>
                <p
                  className={cn(
                    "rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap",
                    !request.message && "text-muted-foreground",
                  )}
                >
                  {request.message ?? t("details.noMessage")}
                </p>
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  {t("details.close")}
                </Button>
              </DialogClose>
              {onNotify && (
                <Button type="button" onClick={() => onNotify(request.id)}>
                  <BellRing />
                  {t("notifyAdmin")}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotifyAdminDialog({
  request,
  onOpenChange,
}: {
  request: RequestItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("Dashboard.requests");
  const notify = useRequestAction(notifyAdminAction, t("toast.notified"), () =>
    onOpenChange(false),
  );

  return (
    <Dialog
      open={request != null}
      // Stay open while the notification is being sent.
      onOpenChange={(open) => !open && !notify.pending && onOpenChange(false)}
    >
      <DialogContent>
        {request && (
          <>
            <DialogHeader>
              <DialogTitle>{t("notify.title")}</DialogTitle>
              <DialogDescription>
                {t("notify.description", {
                  name: request.name,
                  email: request.email,
                  organization: request.organization,
                })}
              </DialogDescription>
            </DialogHeader>
            {request.adminNotifiedAt && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                {t("notify.already", {
                  date: formatDateTime(request.adminNotifiedAt),
                  name: request.adminNotifiedBy ?? t("none"),
                })}
              </p>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={notify.pending}>
                  {t("notify.cancel")}
                </Button>
              </DialogClose>
              <Button
                type="button"
                disabled={notify.pending}
                onClick={() => notify.run({ id: String(request.id) })}
              >
                {notify.pending ? <Loader2 className="animate-spin" /> : <BellRing />}
                {request.adminNotifiedAt ? t("notify.again") : t("notify.confirm")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
