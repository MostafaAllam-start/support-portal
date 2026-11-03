import {
  CustomerPageSkeleton,
  DetailPageSkeleton,
} from "@/components/page-skeletons";

export default function SuggestionDetailLoading() {
  return (
    <CustomerPageSkeleton width="3xl">
      <DetailPageSkeleton />
    </CustomerPageSkeleton>
  );
}
