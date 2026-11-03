import {
  CustomerPageSkeleton,
  FormPageSkeleton,
} from "@/components/page-skeletons";

export default function ProfileLoading() {
  return (
    <CustomerPageSkeleton width="2xl">
      <FormPageSkeleton />
    </CustomerPageSkeleton>
  );
}
