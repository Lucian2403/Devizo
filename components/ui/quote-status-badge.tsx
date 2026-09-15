import type { QuoteStatus } from "@/domain/shared/types";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Schiță",
  sent: "Trimis",
  accepted: "Acceptat",
  rejected: "Respins",
};

const QUOTE_STATUS_TONES: Record<QuoteStatus, StatusTone> = {
  draft: "neutral",
  sent: "warn",
  accepted: "ok",
  rejected: "error",
};

export function QuoteStatusBadge({
  status,
  className,
}: {
  status: QuoteStatus;
  className?: string;
}) {
  return (
    <StatusPill tone={QUOTE_STATUS_TONES[status]} className={className}>
      {QUOTE_STATUS_LABELS[status]}
    </StatusPill>
  );
}
