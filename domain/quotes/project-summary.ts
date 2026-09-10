// COMMERCIAL DOMAIN. Pure aggregation of per-project quote totals with strict
// currency safety: amounts in different currencies are never summed together
// (there is no FX conversion in the commercial domain). See
// docs/architecture/commercial-vs-professional-estimates.md.
import Decimal from "decimal.js";
import type { ProjectId } from "@/domain/shared/types";
import type {
  ProjectCurrencyTotal,
  ProjectQuoteSummary,
} from "./quote.repository";

// One quote's contribution to its project: the total of its latest version and
// the currency that total is expressed in.
export interface LatestQuoteTotal {
  projectId: ProjectId;
  currency: string;
  total: string;
}

/**
 * Groups latest-version quote totals by project, and within each project by
 * currency. A project that mixes currencies yields one entry per currency
 * (sorted by currency code) instead of a single, meaningless combined total.
 */
export function aggregateProjectQuoteSummaries(
  rows: LatestQuoteTotal[],
): ProjectQuoteSummary[] {
  const byProject = new Map<
    ProjectId,
    { count: number; totals: Map<string, Decimal> }
  >();

  for (const row of rows) {
    const entry = byProject.get(row.projectId) ?? {
      count: 0,
      totals: new Map<string, Decimal>(),
    };
    entry.count += 1;
    const current = entry.totals.get(row.currency) ?? new Decimal(0);
    entry.totals.set(row.currency, current.plus(new Decimal(row.total)));
    byProject.set(row.projectId, entry);
  }

  return Array.from(byProject.entries()).map(([projectId, e]) => {
    const totals: ProjectCurrencyTotal[] = Array.from(e.totals.entries())
      .map(([currency, total]) => ({ currency, total: total.toFixed(2) }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
    return { projectId, quoteCount: e.count, totals };
  });
}
