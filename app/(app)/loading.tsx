import { PageSkeleton } from "@/components/ui/page-skeleton";

// Shown instantly by Next.js while a route in the app section is loading on the
// server. This gives immediate visual feedback the moment a nav link is clicked.
export default function Loading() {
  return <PageSkeleton />;
}