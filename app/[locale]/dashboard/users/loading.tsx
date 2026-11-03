import { ListPageSkeleton } from "@/components/page-skeletons";

// The Users table leads with an avatar column.
export default function UsersLoading() {
  return <ListPageSkeleton avatar />;
}
