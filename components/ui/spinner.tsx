import { cn } from "@/lib/utils";

// A small circular loading spinner. Inherits the current text color so it can
// sit inside buttons, links or on its own.
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
