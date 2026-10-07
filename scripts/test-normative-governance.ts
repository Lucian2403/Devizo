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
        (entry) => entry.sourceId === input.sourceId && entry.organizationId === input.organizationId,
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
      sourceTitle: "Normativ de test",
      sourcePublisher: "Emitent",
      sourceJurisdiction: "MD",
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

  await assert.rejects(
    () => service.decideApplicability({
      organizationId: "org-1",
      decidedByUserId: "user-1",
      sourceId: "source-1",
      decision: "applicable",
      basisNote: "Test fără data de început.",
    }),
    {
      name: "NormativeGovernanceValidationError",
      message: "Pentru o decizie «Aplicabilă» trebuie indicată data de început.",
    },
  );

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
    "normative_applicability_source_org_fkey",
    "normative_applicability_update_org_fkey",
    "normative_source_relations_from_source_org_fkey",
    "normative_source_relations_to_source_org_fkey",
    "normative_source_relations_not_self_check",
    "normative_source_relations_unique",
  ]) {
    assert.ok(schema.includes(constraint), `missing DB constraint ${constraint}`);
  }
  assert.match(guards, /guard_normative_applicability_insert/);
  assert.match(guards, /source_record\.official_status <> 'in_force'/);
  assert.match(guards, /guard_normative_governance_append_only/);
  assert.match(guards, /A published normative version is immutable/);
  assert.match(guards, /An estimate norm with published versions is immutable/);
  const consumptionGuard = guards.slice(guards.indexOf("FUNCTION public.guard_published_norm_consumptions"));
  assert.equal((consumptionGuard.match(/version_status <> 'draft'/g) ?? []).length, 2);
  assert.equal((consumptionGuard.match(/FOR UPDATE/g) ?? []).length, 2);
  assert.match(consumptionGuard, /organization_id = OLD\.organization_id/);
  assert.match(consumptionGuard, /organization_id = NEW\.organization_id/);
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
  assert.doesNotMatch(normativePage, /(^|[^\p{L}])uman(?:ă|e)?(?=$|[^\p{L}])/iu);
  assert.doesNotMatch(normativePage, /Necunoscută\s*\/\s*neverificată/iu);
  assert.match(normativePage, /Aplicabilitate nedeterminată/);
  assert.doesNotMatch(governanceRepository, /(^|[^\p{L}])uman(?:ă|e)?(?=$|[^\p{L}])/iu);

  for (const actorField of ["reviewer_user_id", "decided_by_user_id", "created_by_user_id"]) {
    assert.match(guards, new RegExp(`guard_normative_governance_actor_insert\\('${actorField}'\\)`));
    assert.match(schema, new RegExp(`uuid\\("${actorField}"\\)\\.notNull\\(\\)`));
  }
  assert.doesNotMatch(schema, /organizationMembers|reviewerOrgFk|deciderOrgFk|creatorOrgFk/);
  const followUpMigration = readFileSync("infrastructure/db/migrations/0017_minor_blacklash.sql", "utf8");
  for (const constraint of [
    "normative_update_reviews_reviewer_org_fkey",
    "normative_applicability_decider_org_fkey",
    "normative_source_relations_creator_org_fkey",
  ]) {
    assert.ok(followUpMigration.includes(`DROP CONSTRAINT "${constraint}"`));
  }
  for (const column of ["source_title", "source_publisher", "source_jurisdiction"]) {
    assert.ok(followUpMigration.includes(`ADD COLUMN "${column}" text`));
  }
  assert.doesNotMatch(followUpMigration, /UPDATE |DELETE |catalog_items|quote_items|quote_versions/);
  assert.match(guards, /FROM public\.organization_members[\s\S]*?FOR KEY SHARE/);
  assert.match(guards, /guard_normative_governance_actor_insert\(\)[\s\S]*?SECURITY DEFINER\s+SET search_path = pg_catalog/);
  assert.match(guards, /actor_id IS DISTINCT FROM auth\.uid\(\)/);
  for (const [snapshot, sourceField] of [
    ["source_code", "code"], ["source_edition", "edition"],
    ["source_title", "title"], ["source_publisher", "publisher"],
    ["source_jurisdiction", "jurisdiction"], ["source_authority", "authority"],
    ["source_uri", "source_uri"], ["source_fingerprint", "content_fingerprint"],
    ["official_status", "official_status"],
  ]) {
    assert.ok(guards.includes(`NEW.${snapshot} IS DISTINCT FROM source_record.${sourceField}`));
  }
  const applicabilityWrite = governanceRepository.slice(
    governanceRepository.indexOf("async createApplicabilityDecision"),
    governanceRepository.indexOf("async createSourceRelation"),
  );
  const lockIndex = applicabilityWrite.indexOf('.for("update")');
  const revisionIndex = applicabilityWrite.indexOf("max(normativeApplicabilityDecisions.revision)");
  assert.ok(lockIndex >= 0 && revisionIndex > lockIndex);
  assert.match(schema, /sourceRevisionUnique:[\s\S]*?\.on\(table\.organizationId, table\.sourceId, table\.revision\)/);
  assert.doesNotMatch(governanceRepository, /\.(?:update|delete)\(normative(?:UpdateReviews|ApplicabilityDecisions|SourceRelations)\)/);
  const architecture = readFileSync("docs/architecture/professional-estimate-domain.md", "utf8");
  assert.match(architecture, /published.*not proof of applicability/);
  const concurrentRepository = new MemoryGovernanceRepository();
  const concurrentService = new NormativeGovernanceService(concurrentRepository);
  await Promise.all(Array.from({ length: 10 }, (_, index) =>
    concurrentService.decideApplicability({
      organizationId: "org-1",
      sourceId: "source-current",
      decidedByUserId: "user-1",
      decision: "deferred",
      basisNote: `Decision ${index + 1}`,
    }),
  ));
  assert.deepEqual(concurrentRepository.applicability.map((entry) => entry.revision), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  const actions = readFileSync("app/(app)/normative/actions.ts", "utf8");
  const form = readFileSync("app/(app)/normative/governance-form.tsx", "utf8");
  assert.match(actions, /error instanceof NormativeGovernanceValidationError/);
  assert.match(actions, /return \{ error: error\.message \}/);
  assert.match(actions, /throw error;/);
  assert.match(form, /useActionState/);
  assert.match(form, /role="alert"/);
  for (const action of [
    "decideNormativeApplicability",
    "reviewNormativeUpdate",
    "relateNormativeSources",
  ]) {
    assert.match(normativePage, new RegExp(`<GovernanceForm\\s+action=\\{${action}\\}`));
  }

  console.log("Normative governance checks passed.");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
