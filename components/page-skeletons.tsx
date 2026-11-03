import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholders shaped like the pages they stand in for, so the layout
// doesn't jump when the data arrives. Used by the route-level loading.tsx files
// (and Suspense fallbacks). Purely visual: screen readers get one status line.

function Busy() {
  const t = useTranslations("Common");
  return (
    <span className="sr-only" role="status">
      {t("loading")}
    </span>
  );
}

// A page title, subtitle and (optionally) the primary action button.
export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action && <Skeleton className="h-9 w-32" />}
    </div>
  );
}

// A bordered table: a header row and `rows` body rows, optionally led by an
// avatar column (the Users table).
export function TableSkeleton({
  rows = 6,
  avatar = false,
}: {
  rows?: number;
  avatar?: boolean;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex gap-6 border-b px-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="hidden h-4 w-24 sm:block" />
        <Skeleton className="hidden h-4 w-20 md:block" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b px-4 py-3.5 last:border-0"
        >
          {avatar ? (
            <Skeleton className="size-9 shrink-0 rounded-full" />
          ) : (
            <Skeleton className="h-4 w-8 shrink-0" />
          )}
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="hidden h-4 w-1/5 sm:block" />
          <Skeleton className="hidden h-5 w-16 rounded-full md:block" />
          <Skeleton className="ms-auto size-8 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// A list page: header plus table (the default dashboard loading state).
export function ListPageSkeleton({
  action = true,
  avatar = false,
}: {
  action?: boolean;
  avatar?: boolean;
}) {
  return (
    <div className="space-y-6">
      <Busy />
      <PageHeaderSkeleton action={action} />
      <TableSkeleton avatar={avatar} />
    </div>
  );
}

// A card with a title line and a chart-sized block.
function ChartCardSkeleton({ height = "h-64" }: { height?: string }) {
  return (
    <div className="rounded-xl border p-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-2 h-3 w-48" />
      <Skeleton className={`mt-6 w-full ${height}`} />
    </div>
  );
}

// The KPIs page: four stat cards, the status and trend charts, and the
// per-company breakdown.
export function KpisPageSkeleton() {
  return (
    <div className="space-y-6">
      <Busy />
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-xl border p-6">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-4 h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCardSkeleton />
        <div className="lg:col-span-2">
          <ChartCardSkeleton />
        </div>
      </div>
      <ChartCardSkeleton height="h-40" />
    </div>
  );
}

// A detail page (ticket, complaint, suggestion, project): back link, the main
// card, and the conversation below it.
export function DetailPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <Busy />
      <Skeleton className="h-4 w-28" />
      <article className="rounded-xl border p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-6 w-64 max-w-full" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="mt-5 space-y-2 border-t pt-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </article>
      <section className="space-y-3">
        <Skeleton className="h-6 w-28" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ))}
      </section>
    </div>
  );
}

// A form page (account settings): header plus labelled fields and a button.
export function FormPageSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Busy />
      <PageHeaderSkeleton />
      <div className="space-y-5 rounded-xl border p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-9 w-32" />
        </div>
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

// The customer pages' top bar (logo, links, account menu), for their
// route-level loading states.
export function CustomerHeaderSkeleton() {
  return (
    <div className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-4">
        <Skeleton className="h-9 w-28" />
        <div className="ms-auto flex items-center gap-2">
          <Skeleton className="hidden h-8 w-24 sm:block" />
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// The customer pages' main column widths.
const CUSTOMER_WIDTH = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "5xl": "max-w-5xl",
} as const;

// A customer page: the top bar above the page body, as wide as the real page.
export function CustomerPageSkeleton({
  width,
  children,
}: {
  width: keyof typeof CUSTOMER_WIDTH;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CustomerHeaderSkeleton />
      <main className={`mx-auto w-full flex-1 px-4 py-10 ${CUSTOMER_WIDTH[width]}`}>
        {children}
      </main>
    </div>
  );
}
