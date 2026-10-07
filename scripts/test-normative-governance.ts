import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NormativeGovernanceService,
} from "../domain/professional-estimates/normative-governance.service";
import type {
  CreateNormativeApplicabilityInput,
  CreateNormativeSourceRelationInput,
  CreateNormativeUpdateReviewInput,
  NormativeApplicabilityRecord,
  NormativeGovernanceRepository,
  NormativeSourceRelationRecord,
  NormativeUpdateReviewRecord,
} from "../domain/professional-estimates/normative-governance.repository";

const schema = readFileSync(
  join(process.cwd(), "infrastructure/db/schema/professionalEstimates.ts"),
  "utf8",
);
const policies = readFileSync(
  join(
    process.cwd(),
    "infrastructure/db/policies/0007_professional_estimates_rls.sql",
  ),
  "utf8",
);
const guards = readFileSync(
  join(
    process.cwd(),
    "infrastructure/db/policies/0008_normative_governance_guards.sql",
  ),
  "utf8",
);
const migration = readFileSync(
  join(
    process.cwd(),
    "infrastructure/db/migrations/0016_wide_bastion.sql",
  ),
  "utf8",
);
const governanceRepository = readFileSync(
  join(
    process.cwd(),
    "infrastructure/db/repositories/normativeGovernance.repository.ts",
  ),
  "utf8",
);

class MemoryGovernanceRepository implements NormativeGovernanceRepository {
  reviews: NormativeUpdateReviewRecord[] = [];
  applicability: NormativeApplicabilityRecord[] = [];
  relations: NormativeSourceRelationRecord[] = [];
  readonly reviewedUpdateIds = new Set<string>();
  readonly sourceOrganizations = new Map([
    ["source-current", "org-1"],
    ["source-proposal", "org-1"],
    ["source-other-org", "org-2"],
  ]);
  readonly officialStatuses = new Map([
    ["source-current", "in_force"],
    ["source-proposal", "consultation"],
    ["source-other-org", "in_force"],
  ]);

  async listUpdateReviews(): Promise<NormativeUpdateReviewRecord[]> {
    return this.reviews;
  }

  async listApplicabilityDecisions(): Promise<NormativeApplicabilityRecord[]> {
    return this.applicability;
  }

  async listSourceRelations(): Promise<NormativeSourceRelationRecord[]> {
    return this.relations;
  }

  async createUpdateReview(
    input: CreateNormativeUpdateReviewInput,
  ): Promise<void> {
    if (this.reviews.some((review) => review.updateId === input.updateId)) return;
    this.reviews.push({
      id: `review-${this.reviews.length + 1}`,
      organizationId: input.organizationId,
      updateId: input.updateId,
      sourceId: "source-current",
      decision: input.decision,
      note: input.note ?? null,
      reviewerUserId: input.reviewerUserId,
      reviewerName: "Utilizator de test",
      reviewedAt: new Date("2026-10-06T10:00:00Z"),
      sourceCode: "NCM-X",
      sourceEdition: "2026",
      sourceAuthority: "Autoritate",
      officialUri: "https://authority.example/ncm-x",
      publicationDate: null,
      effectiveDate: null,
      previousFingerprint: "fingerprint-old",
      detectedFingerprint: "fingerprint-detected",
    });
    this.reviewedUpdateIds.add(input.updateId);
  }

  async createApplicabilityDecision(
    input: CreateNormativeApplicabilityInput,
  ): Promise<void> {
    if (this.sourceOrganizations.get(input.sourceId) !== input.organizationId) {
      throw new Error("Sursa normativă nu a fost găsită.");
    }
    if (
      input.decision === "applicable" &&
      this.officialStatuses.get(input.sourceId) !== "in_force"
    ) {
      throw new Error("Sursa nu este în vigoare.");
    }
    if (
      input.triggeringUpdateId &&
      !this.reviewedUpdateIds.has(input.triggeringUpdateId)
    ) {
      throw new Error("Modificarea trebuie analizată înaintea deciziei.");
    }
    const revision =
      this.applicability.filter(
        (entry) => entry.sourceId === input.sourceId,
      ).length + 1;
    this.applicability.push({
      id: `applicability-${revision}`,
      organizationId: input.organizationId,
      sourceId: input.sourceId,
      revision,
      decision: input.decision,
      applicableFrom: input.applicableFrom ?? null,
      applicableUntil: input.applicableUntil ?? null,
      decidedAt: new Date("2026-10-06T10:00:00Z"),
      decidedByUserId: input.decidedByUserId,
      decidedByName: "Utilizator de test",
      basisNote: input.basisNote,
      evidenceUri: input.evidenceUri ?? null,
      sourceCode: input.sourceId,
      sourceEdition: "2026",
      sourceAuthority: "Autoritate",
      sourceUri: "https://authority.example/source",
      sourceFingerprint: "fingerprint-at-decision",
      officialStatus: this.officialStatuses.get(input.sourceId) ?? "unknown",
      triggeringUpdateId: input.triggeringUpdateId ?? null,
    });
  }

  async createSourceRelation(
    input: CreateNormativeSourceRelationInput,
  ): Promise<void> {
    if (
      this.sourceOrganizations.get(input.fromSourceId) !==
        input.organizationId ||
      this.sourceOrganizations.get(input.toSourceId) !== input.organizationId
    ) {
      throw new Error("Ambele surse trebuie să aparțină organizației curente.");
    }
    if (
      this.relations.some(
        (relation) =>
          relation.fromSourceId === input.fromSourceId &&
          relation.toSourceId === input.toSourceId &&
          relation.relationType === input.relationType,
      )
    ) {
      throw new Error("Relația există deja.");
    }
    this.relations.push({
      id: `relation-${this.relations.length + 1}`,
      organizationId: input.organizationId,
      fromSourceId: input.fromSourceId,
      toSourceId: input.toSourceId,
      fromSourceCode: input.fromSourceId,
      fromSourceEdition: "2026",
      toSourceCode: input.toSourceId,
      toSourceEdition: "2025",
      relationType: input.relationType,
      effectiveDate: input.effectiveDate ?? null,
      evidenceUri: input.evidenceUri ?? null,
      note: input.note ?? null,
      createdAt: new Date("2026-10-06T10:00:00Z"),
      createdByUserId: input.createdByUserId,
      createdByName: "Utilizator de test",
    });
  }
}

async function main() {
  const repository = new MemoryGovernanceRepository();
  const service = new NormativeGovernanceService(repository);

  await service.reviewUpdate({
    organizationId: "org-1",
    reviewerUserId: "user-1",
    updateId: "update-1",
    decision: "requires_normative_version",
    note: "Se solicită analiza unei ediții noi.",
  });
  await service.reviewUpdate({
    organizationId: "org-1",
    reviewerUserId: "user-1",
    updateId: "update-1",
    decision: "requires_normative_version",
  });
  assert.equal(repository.reviews.length, 1, "repeat reviews must not duplicate");
  assert.equal(repository.reviews[0]?.detectedFingerprint, "fingerprint-detected");
  assert.equal(repository.reviews[0]?.previousFingerprint, "fingerprint-old");

  await assert.rejects(
    () =>
      service.decideApplicability({
        organizationId: "org-1",
        decidedByUserId: "user-1",
        sourceId: "source-proposal",
        decision: "applicable",
        applicableFrom: "2026-10-01",
        basisNote: "Proiect în consultare.",
      }),
    /nu este în vigoare/,
    "consultation sources must not become applicable",
  );
  await assert.rejects(
    () =>
      service.decideApplicability({
        organizationId: "org-1",
        decidedByUserId: "user-1",
        sourceId: "source-current",
        decision: "applicable",
        applicableFrom: "2026-10-01",
        basisNote: "Semnal încă neanalizat.",
        triggeringUpdateId: "update-not-reviewed",
      }),
    /trebuie analizată/,
    "an associated update must be reviewed before deciding applicability",
  );
  await assert.rejects(
    () =>
      service.decideApplicability({
        organizationId: "org-1",
        decidedByUserId: "user-1",
        sourceId: "source-current",
        decision: "applicable",
        applicableFrom: "2026-11-02",
        applicableUntil: "2026-11-01",
        basisNote: "Date inversate.",
      }),
    /Data de sfârșit/,
  );
  await service.decideApplicability({
    organizationId: "org-1",
    decidedByUserId: "user-1",
    sourceId: "source-current",
    decision: "applicable",
    applicableFrom: "2026-10-01",
    basisNote: "Decizie umană bazată pe actul oficial.",
    evidenceUri: "https://authority.example/source",
    triggeringUpdateId: "update-1",
  });
  await service.decideApplicability({
    organizationId: "org-1",
    decidedByUserId: "user-1",
    sourceId: "source-current",
    decision: "deferred",
    basisNote: "Decizie ulterioară, păstrând revizia precedentă.",
  });
  assert.deepEqual(
    repository.applicability.map((entry) => entry.revision),
    [1, 2],
    "applicability changes must append a new revision",
  );
  assert.equal(repository.applicability[0]?.decision, "applicable");
  assert.equal(repository.applicability[1]?.decision, "deferred");
  await assert.rejects(
    () =>
      service.decideApplicability({
        organizationId: "org-1",
        decidedByUserId: "user-1",
        sourceId: "source-current",
        decision: "applicable",
        basisNote: "Lipsă dată de început.",
      }),
    /trebuie indicată data de început/,
  );
  await assert.rejects(
    () =>
      service.decideApplicability({
        organizationId: "org-1",
        decidedByUserId: "user-1",
        sourceId: "source-current",
        decision: "unknown",
        basisNote: "Data nevalidă.",
        applicableFrom: "2026-02-30",
      }),
    /dată calendaristică validă/,
  );

  await service.relateSources({
    organizationId: "org-1",
    createdByUserId: "user-1",
    fromSourceId: "source-current",
    toSourceId: "source-proposal",
    relationType: "amends",
    note: "Relație stabilită după verificarea documentelor.",
  });
  assert.equal(repository.relations.length, 1);
  await assert.rejects(
    () =>
      service.relateSources({
        organizationId: "org-1",
        createdByUserId: "user-1",
        fromSourceId: "source-current",
        toSourceId: "source-current",
        relationType: "amends",
      }),
    /nu poate avea o relație cu ea însăși/,
  );
  await assert.rejects(
    () =>
      service.relateSources({
        organizationId: "org-1",
        createdByUserId: "user-1",
        fromSourceId: "source-current",
        toSourceId: "source-other-org",
        relationType: "related_to",
      }),
    /trebuie să aparțină organizației curente/,
  );
  await assert.rejects(
    () =>
      service.relateSources({
        organizationId: "org-1",
        createdByUserId: "user-1",
        fromSourceId: "source-current",
        toSourceId: "source-proposal",
        relationType: "amends",
      }),
    /există deja/,
  );

  for (const table of [
    "normative_update_reviews",
    "normative_applicability_decisions",
    "normative_source_relations",
  ]) {
    assert.ok(schema.includes(`"${table}"`), `missing ${table} schema`);
    assert.ok(policies.includes(`'${table}'`), `missing RLS for ${table}`);
  }
  for (const constraint of [
    "normative_update_reviews_update_org_fkey",
    "normative_update_reviews_source_org_fkey",
    "normative_update_reviews_reviewer_org_fkey",
    "normative_applicability_source_org_fkey",
    "normative_applicability_update_org_fkey",
    "normative_applicability_decider_org_fkey",
    "normative_source_relations_from_source_org_fkey",
    "normative_source_relations_to_source_org_fkey",
    "normative_source_relations_creator_org_fkey",
    "normative_source_relations_not_self_check",
    "normative_source_relations_unique",
  ]) {
    assert.ok(schema.includes(constraint), `missing DB constraint ${constraint}`);
  }
  assert.match(guards, /guard_normative_applicability_insert/);
  assert.match(guards, /source_official_status <> 'in_force'/);
  assert.match(guards, /guard_normative_governance_append_only/);
  assert.match(guards, /A published normative version is immutable/);
  assert.match(guards, /An estimate norm with published versions is immutable/);
  assert.match(guards, /Resource consumptions for a published normative version are immutable/);
  assert.match(guards, /Invalid normative publication status transition/);
  assert.match(policies, /FOR SELECT USING \(public\.is_org_member\(organization_id\)\)/);
  assert.match(policies, /FOR INSERT WITH CHECK \(public\.is_org_member\(organization_id\)\)/);
  for (const table of [
    "normative_update_reviews",
    "normative_applicability_decisions",
    "normative_source_relations",
  ]) {
    assert.ok(migration.includes(`CREATE TABLE IF NOT EXISTS "${table}"`));
  }
  assert.equal(
    /catalog_items|quote_items|quote_versions/.test(migration),
    false,
    "M8.2 migration must not touch commercial records",
  );

  const writeTargets = [
    ...governanceRepository.matchAll(
      /\.(?:insert|update|delete)\(\s*(\w+)\s*\)/g,
    ),
  ].map((match) => match[1]);
  assert.ok(writeTargets.length > 0);
  for (const target of writeTargets) {
    assert.ok(
      [
        "normativeUpdateReviews",
        "normativeUpdates",
        "normativeApplicabilityDecisions",
        "normativeSourceRelations",
      ].includes(target ?? ""),
      `governance repository must not write calculation or commercial data: ${target}`,
    );
  }

  const normativePage = readFileSync(
    "app/(app)/normative/page.tsx",
    "utf8",
  );
  const historyStart = normativePage.indexOf("{history.map((entry)");
  const historyEnd = normativePage.indexOf("action={decideNormativeApplicability}", historyStart);
  assert.ok(historyStart >= 0 && historyEnd > historyStart);
  const decisionHistory = normativePage.slice(historyStart, historyEnd);
  const auditStart = decisionHistory.indexOf("<details");
  assert.ok(auditStart > 0, "technical audit evidence must be collapsed");
  const readableHistory = decisionHistory.slice(0, auditStart);
  const auditHistory = decisionHistory.slice(auditStart);
  assert.match(readableHistory, /Responsabil:/);
  assert.match(readableHistory, /Membru al companiei/);
  assert.match(readableHistory, /Motivul deciziei:/);
  assert.match(readableHistory, /Perioada înregistrată:/);
  assert.doesNotMatch(readableHistory, /entry\.decidedByUserId|entry\.sourceFingerprint/);
  assert.match(auditHistory, /Detalii tehnice pentru audit/);
  assert.match(auditHistory, /entry\.decidedByUserId/);
  assert.match(auditHistory, /entry\.sourceFingerprint/);

  console.log("Normative governance checks passed.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
