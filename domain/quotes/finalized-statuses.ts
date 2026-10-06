import { QUOTE_STATUSES, type QuoteStatus } from "@/domain/shared/types";

// A finalized commercial document is any version that is no longer a draft:
// sent, accepted and rejected are all frozen by the database immutability
// triggers. Derived from the status list so a new status can never be left out
// of "finalized" by accident.
export const FINALIZED_QUOTE_STATUSES: QuoteStatus[] = QUOTE_STATUSES.filter(
  (status) => status !== "draft",
);