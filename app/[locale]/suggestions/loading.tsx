import {
  CustomerPageSkeleton,
  ListPageSkeleton,
} from "@/components/page-skeletons";

export default function MySuggestionsLoading() {
  return (
    <CustomerPageSkeleton width="5xl">
      <ListPageSkeleton />
    </CustomerPageSkeleton>
  );
}
