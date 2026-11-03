import { ListPageSkeleton } from "@/components/page-skeletons";

// Shown in the content area (the sidebar + header in the layout stay put) while
// the next dashboard page's data loads during navigation. Mirrors the common
// page shape: a header (title + subtitle + action) above a list/table panel.
// Pages with a different shape have their own loading.tsx.
export default function DashboardLoading() {
  return <ListPageSkeleton />;
}
