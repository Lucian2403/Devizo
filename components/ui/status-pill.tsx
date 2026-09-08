import { cn } from "@/lib/utils";

// Soft status pill with a colored dot, matching the Devizo status palette.
export type StatusTone = "ok" | "warn" | "error" | "neutral";

const TONE_CLASSES: Record<StatusTone, { pill: string; dot: string }> = {
  ok: { pill: "bg-status-ok-bg text-status-ok-fg", dot: "bg-status-ok-dot" },
  warn: {
    pill: "bg-status-warn-bg text-status-warn-fg",
    dot: "bg-status-warn-dot",
  },
  error: {
    pill: "bg-status-error-bg text-status-error-fg",
    dot: "bg-status-error-dot",
  },
  neutral: {
    pill: "bg-status-neutral-bg text-status-neutral-fg",
    dot: "bg-status-neutral-fg",
  },
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  const styles = TONE_CLASSES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium",
        styles.pill,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
      {children}
    </span>
  );
}
