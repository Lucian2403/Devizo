import { Spinner } from "@/components/ui/spinner";

// Shown instantly by Next.js while a route in the app section is loading on the
// server. This gives immediate visual feedback the moment a nav link is clicked.
export default function Loading() {
  return (
    <div className="flex items-center justify-center py-24 text-muted-foreground">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
