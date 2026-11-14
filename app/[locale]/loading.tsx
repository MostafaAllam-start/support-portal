import { LandingPageSkeleton } from "@/components/page-skeletons";

// Shown while the landing page (or any page without a loading.tsx of its own) loads.
export default function LocaleLoading() {
  return <LandingPageSkeleton />;
}
