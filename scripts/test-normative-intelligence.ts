import assert from "node:assert/strict";
import {
  formatSourceImpact,
  NormativeIntelligenceService,
} from "../domain/professional-estimates/normative-intelligence.service";
import type {
  DetectedNormativeUpdateInput,
  NormativeIntelligenceRepository,
  NormativeSourceOverview,
  NormativeSourceRecord,
  NormativeSourceUpsertInput,
  NormativeSourceUsage,
  NormativeUpdateRecord,
  SourceVerificationResult,
} from "../domain/professional-estimates/normative-intelligence.repository";
import type {
  NormativeSourceMonitor,
  SourceMonitorResult,
} from "../domain/professional-estimates/normative-source-monitor";
import type { NormativeReviewStatus } from "../domain/professional-estimates/types";
import { normalizeOfficialSourceContent } from "../infrastructure/normative/http-source-monitor";

const pageA = [
  "<html><body>",
  "<header>navigation v1</header>",
  "<main><h1>CP L.01.01-2012</h1><p>Statutul În vigoare</p></main>",
  "<form>newsletter</form>",
  "<footer>Număr total de accesări 100</footer>",
  "</body></html>",
].join("");

const pageB = [
  "<html><body>",
  "<header>navigation v2</header>",
  "<main><h1>CP L.01.01-2012</h1><p>Statutul În vigoare</p></main>",
  "<form>different newsletter</form>",
  "<footer>Număr total de accesări 999</footer>",
  "</body></html>",
].join("");

const pageChanged = [
  "<html><body>",
  "<header>navigation v2</header>",
  "<main><h1>CP L.01.01-2012</h1><p>Statutul Înlocuit</p></main>",
  "<footer>Număr total de accesări 1000</footer>",
  "</body></html>",
].join("");

assert.equal(
  normalizeOfficialSourceContent(pageA),
  normalizeOfficialSourceContent(pageB),
  "non-document chrome must not trigger a normative change",
);
assert.notEqual(
  normalizeOfficialSourceContent(pageA),
  normalizeOfficialSourceContent(pageChanged),
  "document content changes must remain detectable",
);

assert.equal(
  formatSourceImpact({
    normVersions: 0,
    resources: 0,
    resourcePrices: 0,
    calculationRules: 0,
  }),
  "Sursa nu este încă folosită în calcule profesionale.",
);

const impact = formatSourceImpact({
  normVersions: 2,
  resources: 4,
  resourcePrices: 3,
  calculationRules: 1,
});
assert.match(impact, /2 versiuni de norme/);
assert.match(impact, /4 resurse/);
assert.match(impact, /3 prețuri de resurse/);
assert.match(impact, /1 regulă de calcul/);

const source: NormativeSourceRecord = {
  id: "source-1",
  organizationId: "org-1",
  code: "CP L.01.01-2012",
  title: "Metoda de resurse",
  edition: "2012",
  sourceType: "normative_document",
  publisher: null,
  jurisdiction: "MD",
  authority: null,
  sourceUri: "https://ednc.gov.md/cp-l-01-01-2012/",
  approvalDate: null,
  publicationDate: null,
  effectiveDate: "2013-02-15",
  validFrom: "2013-02-15",
  validTo: null,
  status: "active",
  officialStatus: "in_force",
  monitoringEnabled: true,
  lastVerifiedAt: null,
  lastVerificationStatus: "never",
  lastVerificationError: null,
  contentFingerprint: null,
  metadata: {},
};

class MemoryRepository implements NormativeIntelligenceRepository {
  source: NormativeSourceRecord = { ...source };
  updates: DetectedNormativeUpdateInput[] = [];

  async listSources(): Promise<NormativeSourceOverview[]> {
    return [
      {
        ...this.source,
        usage: await this.getUsage(),
      },
    ];
  }

  async listUpdates(): Promise<NormativeUpdateRecord[]> {
    return [];
  }

  async upsertSources(
    _organizationId: string,
    sources: NormativeSourceUpsertInput[],
  ): Promise<number> {
    return sources.length;
  }

  async listMonitoredSources(): Promise<NormativeSourceRecord[]> {
    return [{ ...this.source }];
  }

  async getUsage(): Promise<NormativeSourceUsage> {
    return {
      normVersions: 1,
      resources: 0,
      resourcePrices: 0,
      calculationRules: 1,
    };
  }

  async saveVerification(
    _organizationId: string,
    _sourceId: string,
    result: SourceVerificationResult,
  ): Promise<void> {
    this.source = {
      ...this.source,
      lastVerifiedAt: result.checkedAt,
      lastVerificationStatus: result.status,
      lastVerificationError: result.error ?? null,
      contentFingerprint:
        result.status === "success" && result.fingerprint
          ? result.fingerprint
          : this.source.contentFingerprint,
    };
  }

  async recordDetectedUpdate(
    input: DetectedNormativeUpdateInput,
  ): Promise<void> {
    if (
      !this.updates.some(
        (existing) =>
          existing.sourceId === input.sourceId &&
          existing.eventFingerprint === input.eventFingerprint,
      )
    ) {
      this.updates.push(input);
    }
  }

  async setUpdateReviewStatus(
    _organizationId: string,
    _updateId: string,
    _status: Extract<NormativeReviewStatus, "reviewed" | "dismissed">,
  ): Promise<void> {}
}

class SequenceMonitor implements NormativeSourceMonitor {
  private index = 0;

  constructor(private readonly fingerprints: string[]) {}

  async verify(): Promise<SourceMonitorResult> {
    const fingerprint =
      this.fingerprints[Math.min(this.index, this.fingerprints.length - 1)];
    this.index += 1;
    return {
      checkedAt: new Date("2026-10-06T10:00:00Z"),
      fingerprint,
    };
  }
}

async function main() {
  const repository = new MemoryRepository();
  const service = new NormativeIntelligenceService(
    repository,
    new SequenceMonitor(["fingerprint-a", "fingerprint-b", "fingerprint-b"]),
  );

  const firstRun = await service.verifyOrganization("org-1");
  assert.equal(firstRun.initialized, 1);
  assert.equal(firstRun.changed, 0);
  assert.equal(repository.updates.length, 0);

  const secondRun = await service.verifyOrganization("org-1");
  assert.equal(secondRun.changed, 1);
  assert.equal(repository.updates.length, 1);
  assert.match(
    repository.updates[0]?.impactSummary ?? "",
    /1 versiune de normă/,
  );

  const thirdRun = await service.verifyOrganization("org-1");
  assert.equal(thirdRun.changed, 0);
  assert.equal(repository.updates.length, 1);

  console.log("Normative intelligence checks passed.");
}

void main();
