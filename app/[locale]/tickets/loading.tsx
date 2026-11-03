import {
  CustomerPageSkeleton,
  ListPageSkeleton,
} from "@/components/page-skeletons";

export default function MyTicketsLoading() {
  return (
    <CustomerPageSkeleton width="5xl">
      <ListPageSkeleton />
    </CustomerPageSkeleton>
  );
}
