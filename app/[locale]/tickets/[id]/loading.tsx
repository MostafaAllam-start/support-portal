import {
  CustomerPageSkeleton,
  DetailPageSkeleton,
} from "@/components/page-skeletons";

export default function TicketDetailLoading() {
  return (
    <CustomerPageSkeleton width="3xl">
      <DetailPageSkeleton />
    </CustomerPageSkeleton>
  );
}
