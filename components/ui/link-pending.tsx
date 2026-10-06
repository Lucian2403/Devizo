"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

// Shows a small spinner while the <Link> it is rendered inside is navigating.
// Must be used inside a <Link>.
export function LinkPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className={cn("h-3 w-3", className)} /> : null;
}
