import { MOLDOVA_NORMATIVE_BASELINE } from "./moldova-normative-baseline";
import type {
  NormativeIntelligenceRepository,
  NormativeSourceOverview,
  NormativeSourceRecord,
  NormativeSourceUsage,
  NormativeUpdateRecord,
} from "./normative-intelligence.repository";
import type { NormativeSourceMonitor } from "./normative-source-monitor";

export interface NormativeIntelligenceOverview {
  sources: NormativeSourceOverview[];
  updates: NormativeUpdateRecord[];
  stats: {
    monitoredSources: number;
    inForceSources: number;
    pendingReview: number;
    verificationErrors: number;
  };
}

export interface VerificationRunResult {
  checked: number;
  changed: number;
  initialized: number;
  failed: number;
}

export function formatSourceImpact(usage: NormativeSourceUsage): string {
  const parts: string[] = [];
  if (usage.normVersions > 0) {
    parts.push(
      `${usage.normVersions} ${usage.normVersions === 1 ? "versiune de normă" : "versiuni de norme"}`,
    );
  }
  if (usage.resources > 0) {
    parts.push(
      `${usage.resources} ${usage.resources === 1 ? "resursă" : "resurse"}`,
    );
  }
  if (usage.resourcePrices > 0) {
    parts.push(
      `${usage.resourcePrices} ${usage.resourcePrices === 1 ? "preț de resursă" : "prețuri de resurse"}`,
    );
  }
  if (usage.calculationRules > 0) {
    parts.push(
      `${usage.calculationRules} ${usage.calculationRules === 1 ? "regulă de calcul" : "reguli de calcul"}`,
    );
  }

  return parts.length > 0
    ? `Sursa este folosită de: ${parts.join(" · ")}.`
    : "Sursa nu este încă folosită în calcule profesionale.";
}

export class NormativeIntelligenceService {
  constructor(
    private readonly repository: NormativeIntelligenceRepository,
    private readonly monitor: NormativeSourceMonitor,
  ) {}

  async getOverview(
    organizationId: string,
  ): Promise<NormativeIntelligenceOverview> {
    const [sources, updates] = await Promise.all([
      this.repository.listSources(organizationId),
      this.repository.listUpdates(organizationId),
    ]);

    return {
      sources,
      updates,
      stats: {
        monitoredSources: sources.filter((source) => source.monitoringEnabled)
          .length,
        inForceSources: sources.filter(
          (source) => source.officialStatus === "in_force",
        ).length,
        pendingReview: updates.filter(
          (update) => update.reviewStatus === "detected",
        ).length,
        verificationErrors: sources.filter(
          (source) => source.lastVerificationStatus === "error",
        ).length,
      },
    };
  }

  async bootstrapMoldovaBaseline(organizationId: string): Promise<number> {
    return this.repository.upsertSources(
      organizationId,
      [...MOLDOVA_NORMATIVE_BASELINE],
    );
  }

  async verifyOrganization(
    organizationId: string,
  ): Promise<VerificationRunResult> {
    const sources = await this.repository.listMonitoredSources(organizationId);
    return this.verifySources(sources);
  }

  async verifyAllOrganizations(): Promise<VerificationRunResult> {
    const sources = await this.repository.listMonitoredSources();
    return this.verifySources(sources);
  }

  async markReviewed(
    organizationId: string,
    updateId: string,
  ): Promise<void> {
    await this.repository.setUpdateReviewStatus(
      organizationId,
      updateId,
      "reviewed",
    );
  }

  async dismissUpdate(
    organizationId: string,
    updateId: string,
  ): Promise<void> {
    await this.repository.setUpdateReviewStatus(
      organizationId,
      updateId,
      "dismissed",
    );
  }

  private async verifySources(
    sources: NormativeSourceRecord[],
  ): Promise<VerificationRunResult> {
    const result: VerificationRunResult = {
      checked: 0,
      changed: 0,
      initialized: 0,
      failed: 0,
    };

    // One official URL may be duplicated across tenants. Reuse the network
    // result within the run; persistence and impact analysis remain tenant-safe.
    const checks = new Map<
      string,
      | { ok: true; checkedAt: Date; fingerprint: string }
      | { ok: false; checkedAt: Date; error: string }
    >();

    for (const source of sources) {
      result.checked += 1;

      if (!source.sourceUri) {
        result.failed += 1;
        await this.repository.saveVerification(
          source.organizationId,
          source.id,
          {
            checkedAt: new Date(),
            status: "error",
            error: "Sursa monitorizată nu are URL oficial configurat.",
          },
        );
        continue;
      }

      let check = checks.get(source.sourceUri);
      if (!check) {
        try {
          const monitored = await this.monitor.verify(source.sourceUri);
          check = {
            ok: true,
            checkedAt: monitored.checkedAt,
            fingerprint: monitored.fingerprint,
          };
        } catch (error) {
          check = {
            ok: false,
            checkedAt: new Date(),
            error:
              error instanceof Error
                ? error.message
                : "Verificarea sursei oficiale a eșuat.",
          };
        }
        checks.set(source.sourceUri, check);
      }

      if (!check.ok) {
        result.failed += 1;
        await this.repository.saveVerification(
          source.organizationId,
          source.id,
          {
            checkedAt: check.checkedAt,
            status: "error",
            error: check.error,
          },
        );
        continue;
      }

      if (!source.contentFingerprint) {
        result.initialized += 1;
        await this.repository.saveVerification(
          source.organizationId,
          source.id,
          {
            checkedAt: check.checkedAt,
            status: "success",
            fingerprint: check.fingerprint,
          },
        );
        continue;
      }

      if (source.contentFingerprint !== check.fingerprint) {
        result.changed += 1;
        const usage = await this.repository.getUsage(
          source.organizationId,
          source.id,
        );

        await this.repository.recordDetectedUpdate({
          organizationId: source.organizationId,
          sourceId: source.id,
          updateType: "source_page_changed",
          title: `Sursa oficială ${source.code} s-a modificat`,
          summary:
            "Conținutul paginii oficiale monitorizate diferă de ultima versiune verificată. Modificarea trebuie analizată înainte de a schimba norme, prețuri sau reguli de calcul.",
          impactSummary: formatSourceImpact(usage),
          officialUri: source.sourceUri,
          eventFingerprint: check.fingerprint,
          metadata: {
            previousFingerprint: source.contentFingerprint,
            detectedBy: "official_source_monitor",
          },
        });
      }

      await this.repository.saveVerification(
        source.organizationId,
        source.id,
        {
          checkedAt: check.checkedAt,
          status: "success",
          fingerprint: check.fingerprint,
        },
      );
    }

    return result;
  }
}
