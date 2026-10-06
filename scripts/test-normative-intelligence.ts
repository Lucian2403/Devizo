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
import {
  HttpNormativeSourceMonitor,
  normalizeOfficialSourceContent,
} from "../infrastructure/normative/http-source-monitor";

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

}

class SequenceMonitor implements NormativeSourceMonitor {
  private index = 0;

  constructor(private readonly fingerprints: string[]) {}

  async verify(): Promise<SourceMonitorResult> {
    const fingerprint =
      this.fingerprints[Math.min(this.index, this.fingerprints.length - 1)];
    assert.ok(fingerprint, "SequenceMonitor needs at least one fingerprint");
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

  // A detected change is a review signal only: no official/legal or lifecycle
  // field of the source may be touched by verification.
  assert.equal(repository.source.officialStatus, "in_force");
  assert.equal(repository.source.status, "active");
  assert.equal(repository.source.effectiveDate, "2013-02-15");
  assert.equal(repository.source.validFrom, "2013-02-15");
  assert.equal(repository.source.sourceUri, source.sourceUri);

  // A proposed document must never be promoted to "in force" by monitoring.
  const consultation = new MemoryRepository();
  consultation.source = {
    ...source,
    officialStatus: "consultation",
    status: "draft",
    effectiveDate: null,
    validFrom: null,
    contentFingerprint: "fingerprint-a",
  };
  await new NormativeIntelligenceService(
    consultation,
    new SequenceMonitor(["fingerprint-b"]),
  ).verifyOrganization("org-1");
  assert.equal(consultation.updates.length, 1);
  assert.equal(consultation.source.officialStatus, "consultation");
  assert.equal(consultation.source.status, "draft");
  assert.equal(consultation.source.effectiveDate, null);
  assert.equal(consultation.source.validFrom, null);

  // A failed check keeps the previous fingerprint and creates no change signal.
  const failing = new MemoryRepository();
  failing.source = { ...source, contentFingerprint: "fingerprint-a" };
  const failedRun = await new NormativeIntelligenceService(failing, {
    async verify(): Promise<SourceMonitorResult> {
      throw new Error("official source unavailable");
    },
  }).verifyOrganization("org-1");
  assert.equal(failedRun.failed, 1);
  assert.equal(failing.updates.length, 0);
  assert.equal(failing.source.lastVerificationStatus, "error");
  assert.equal(failing.source.contentFingerprint, "fingerprint-a");

  // The HTTP monitor only reaches allowlisted official HTTPS hosts. These
  // checks fail before any network request is made.
  const httpMonitor = new HttpNormativeSourceMonitor();
  for (const url of [
    "http://ednc.gov.md/cp-l-01-01-2012/",
    "https://evil.example/",
    "https://ednc.gov.md.evil.example/",
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost/",
  ]) {
    await assert.rejects(
      () => httpMonitor.verify(url),
      `monitor must reject ${url}`,
    );
  }

  console.log("Normative intelligence checks passed.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
