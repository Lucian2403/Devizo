import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DuplicateInternalNormError,
  DuplicateNormResourceError,
  InternalNormIdentityConflictError,
  NormAssignmentValidationError,
  NormLibraryRecordNotFoundError,
  NormVersionPublicationError,
  ProfessionalNormLibraryService,
  ProfessionalNormLibraryValidationError,
} from "../domain/professional-estimates/professional-norm-library.service";
import type {
  AppliedNorm,
  CreateInternalNormData,
  InternalNormResourceData,
  NormVersionDetail,
  NormVersionSummary,
  NormWorkspace,
  ProfessionalNormLibraryRepository,
} from "../domain/professional-estimates/professional-norm-library.repository";

interface EstimateFixture {
  organizationId: string;
  id: string;
  valuationDate: string;
  listId: string;
  items: NormWorkspace["items"];
}

class MemoryNormLibraryRepository implements ProfessionalNormLibraryRepository {
  readonly sources = new Map<string, {
    code: string;
    edition: string;
    title: string;
    sourceType: string;
    jurisdiction: string;
    status: string;
    officialStatus: string;
    monitoringEnabled: boolean;
  }>();
  readonly norms = new Map<string, {
    organizationId: string;
    detail: NormVersionDetail;
  }>();
  readonly normIds = new Map<string, string>();
  readonly estimates: EstimateFixture[] = [];
  resourcePriceInsertCount = 0;

  async listNormVersions(organizationId: string): Promise<NormVersionSummary[]> {
    return [...this.norms.values()]
      .filter(({ organizationId: owner }) => owner === organizationId)
      .map(({ detail }) => detail.norm);
  }

  async getNormVersion(
    organizationId: string,
    estimateNormVersionId: string,
  ): Promise<NormVersionDetail | null> {
    const entry = this.norms.get(estimateNormVersionId);
    return entry?.organizationId === organizationId ? entry.detail : null;
  }

  async createInternalNorm(
    organizationId: string,
    data: CreateInternalNormData,
  ): Promise<string> {
    const identityKey = `${organizationId}:company_custom:${data.code}`;
    const normId = this.normIds.get(identityKey) ?? randomUUID();
    const existingVersion = [...this.norms.values()].some(
      ({ organizationId: owner, detail }) =>
        owner === organizationId &&
        detail.norm.estimateNormId === normId &&
        detail.norm.versionLabel === data.versionLabel,
    );
    if (existingVersion) throw new DuplicateInternalNormError();
    const existingNorm = [...this.norms.values()].find(
      ({ organizationId: owner, detail }) =>
        owner === organizationId && detail.norm.estimateNormId === normId,
    )?.detail.norm;
    if (
      existingNorm &&
      (existingNorm.name !== data.name ||
        existingNorm.category !== (data.category ?? null) ||
        existingNorm.description !== (data.description ?? null))
    ) {
      throw new InternalNormIdentityConflictError();
    }
    this.normIds.set(identityKey, normId);

    const sourceKey = `${organizationId}:DEVIZO-COMPANY-NORMS:1`;
    if (!this.sources.has(sourceKey)) {
      this.sources.set(sourceKey, {
        code: "DEVIZO-COMPANY-NORMS",
        edition: "1",
        title: "Norme interne ale companiei",
        sourceType: "company_custom",
        jurisdiction: "MD",
        status: "active",
        officialStatus: "unknown",
        monitoringEnabled: false,
      });
    }
    const id = randomUUID();
    const norm: NormVersionSummary = {
      id,
      estimateNormId: normId,
      code: data.code,
      name: data.name,
      category: data.category ?? null,
      description: data.description ?? null,
      versionLabel: data.versionLabel,
      basisQuantity: data.basisQuantity,
      basisUnit: data.basisUnit,
      method: "resource",
      sourceType: "company_custom",
      sourceTitle: "Norme interne ale companiei",
      sourceCode: "DEVIZO-COMPANY-NORMS",
      officialStatus: "unknown",
      validFrom: data.validFrom ?? null,
      validTo: data.validTo ?? null,
      publicationStatus: "draft",
      resourceCount: 0,
    };
    this.norms.set(id, {
      organizationId,
      detail: { norm, resources: [] },
    });
    return id;
  }

  async addInternalNormResource(
    organizationId: string,
    estimateNormVersionId: string,
    data: InternalNormResourceData,
  ): Promise<void> {
    const entry = this.norms.get(estimateNormVersionId);
    if (!entry || entry.organizationId !== organizationId) {
      throw new NormLibraryRecordNotFoundError();
    }
    if (entry.detail.norm.publicationStatus !== "draft") {
      throw new NormVersionPublicationError();
    }
    const sameCode = data.code
      ? [...this.norms.values()]
          .filter(({ organizationId: owner }) => owner === organizationId)
          .flatMap(({ detail }) => detail.resources)
          .find(({ code }) => code === data.code)
      : undefined;
    if (
      sameCode &&
      (sameCode.name !== data.name ||
        sameCode.resourceType !== data.resourceType ||
        sameCode.unit !== data.unit)
    ) {
      throw new DuplicateNormResourceError();
    }
    const resourceId = sameCode?.resourceId ?? randomUUID();
    const consumption = {
      id: randomUUID(),
      positionNumber: entry.detail.resources.length + 1,
      resourceId,
      code: data.code ?? null,
      name: data.name,
      resourceType: data.resourceType,
      unit: data.unit,
      quantityPerNormBasis: data.quantityPerNormBasis,
    };
    entry.detail.resources.push(consumption);
    entry.detail.norm.resourceCount = entry.detail.resources.length;
  }

  async publishInternalNormVersion(
    organizationId: string,
    estimateNormVersionId: string,
  ): Promise<void> {
    const entry = this.norms.get(estimateNormVersionId);
    if (!entry || entry.organizationId !== organizationId) {
      throw new NormLibraryRecordNotFoundError();
    }
    if (entry.detail.norm.publicationStatus !== "draft") {
      throw new NormVersionPublicationError();
    }
    entry.detail.norm.publicationStatus = "in_review";
    entry.detail.norm.publicationStatus = "approved";
    entry.detail.norm.publicationStatus = "published";
  }

  async getNormWorkspace(
    organizationId: string,
    calculationContextId: string,
  ): Promise<NormWorkspace | null> {
    const estimate = this.estimates.find(
      ({ organizationId: owner, id }) =>
        owner === organizationId && id === calculationContextId,
    );
    if (!estimate) return null;
    return {
      valuationDate: estimate.valuationDate,
      items: estimate.items,
      normVersions: [...this.norms.values()]
        .filter(({ organizationId: owner }) => owner === organizationId)
        .map(({ detail }) => detail),
    };
  }

  async getWorkItemNormAssignmentStatus(
    organizationId: string,
    calculationContextId: string,
    workQuantityItemId: string,
  ): Promise<{ unit: string; hasNormApplication: boolean } | null> {
    const estimate = this.estimates.find(
      ({ organizationId: owner, id }) =>
        owner === organizationId && id === calculationContextId,
    );
    const item = estimate?.items.find(({ id }) => id === workQuantityItemId);
    return item
      ? { unit: item.unit, hasNormApplication: item.application !== null }
      : null;
  }

  async createNormApplication(
    organizationId: string,
    calculationContextId: string,
    workQuantityItemId: string,
    estimateNormVersionId: string,
  ): Promise<void> {
    const estimate = this.estimates.find(
      ({ organizationId: owner, id }) =>
        owner === organizationId && id === calculationContextId,
    );
    const item = estimate?.items.find(({ id }) => id === workQuantityItemId);
    const norm = this.norms.get(estimateNormVersionId);
    if (!estimate || !item || !norm || norm.organizationId !== organizationId) {
      throw new NormAssignmentValidationError(
        "Poziția sau devizul nu a fost găsit.",
      );
    }
    if (item.application) {
      throw new NormAssignmentValidationError(
        "Poziția are deja o normă alocată.",
      );
    }
    const date = estimate.valuationDate;
    if (
      norm.detail.norm.publicationStatus !== "published" ||
      norm.detail.norm.method !== "resource" ||
      norm.detail.norm.basisUnit !== item.unit ||
      (norm.detail.norm.validFrom && date < norm.detail.norm.validFrom) ||
      (norm.detail.norm.validTo && date > norm.detail.norm.validTo)
    ) {
      throw new NormAssignmentValidationError(
        "Norma selectată nu este eligibilă pentru această poziție.",
      );
    }
    const application: AppliedNorm = {
      id: randomUUID(),
      estimateNormVersionId,
      applicationOrder: 1,
      applicationCoefficient: "1",
      norm: norm.detail,
    };
    item.application = application;
  }

  addEstimate(
    organizationId: string,
    valuationDate: string,
    itemUnits: string[],
  ): { id: string; itemIds: string[] } {
    const id = randomUUID();
    const items = itemUnits.map((unit) => ({
      id: randomUUID(),
      unit,
      quantity: "250",
      application: null,
    }));
    this.estimates.push({
      organizationId,
      id,
      valuationDate,
      listId: randomUUID(),
      items,
    });
    return { id, itemIds: items.map(({ id: itemId }) => itemId) };
  }
}

function expectValidationError(run: () => unknown): void {
  assert.throws(run, ProfessionalNormLibraryValidationError);
}

async function expectRejected(
  run: () => Promise<unknown>,
  errorType: new (...args: never[]) => Error,
): Promise<Error> {
  try {
    await run();
  } catch (error) {
    assert.ok(error instanceof errorType);
    return error;
  }
  assert.fail("Expected the operation to reject.");
}

async function main(): Promise<void> {
  const actionSource = readFileSync(
    join(
      process.cwd(),
      "app/(app)/professional-estimates/actions.ts",
    ),
    "utf8",
  );
  const normLibraryErrorMapper = actionSource.match(
    /function normLibraryErrorState\(error: unknown\): NormLibraryFormState \{([\s\S]*?)\n\}/,
  )?.[1];
  assert.ok(normLibraryErrorMapper, "Norm library action error mapper exists.");
  assert.match(
    normLibraryErrorMapper,
    /error instanceof InternalNormIdentityConflictError/,
  );
  assert.match(
    normLibraryErrorMapper,
    /return \{ error: error\.message \};/,
  );
  const identityConflict = new InternalNormIdentityConflictError();
  assert.equal(
    identityConflict.message,
    "Codul normei există deja cu alte date de identificare. Folosiți denumirea și categoria existente.",
  );

  const repository = new MemoryNormLibraryRepository();
  const service = new ProfessionalNormLibraryService(repository);
  const org = "org-a";
  const normForm = {
    code: "TEST-TENC-001",
    name: "Tencuieli interioare — normă internă de test",
    versionLabel: "1",
    basisQuantity: "100",
    basisUnit: "m²",
    validFrom: "2026-01-01",
    validTo: "2026-12-31",
  };

  expectValidationError(() =>
    service.createInternalNorm(org, { ...normForm, code: " " }),
  );
  expectValidationError(() =>
    service.createInternalNorm(org, { ...normForm, basisQuantity: "0" }),
  );
  expectValidationError(() =>
    service.createInternalNorm(org, { ...normForm, basisQuantity: "-1" }),
  );
  expectValidationError(() =>
    service.createInternalNorm(org, { ...normForm, basisQuantity: "1.1234567" }),
  );
  expectValidationError(() =>
    service.createInternalNorm(org, { ...normForm, basisQuantity: "1000000000000" }),
  );
  expectValidationError(() =>
    service.createInternalNorm(org, {
      ...normForm,
      validFrom: "2026-12-31",
      validTo: "2026-01-01",
    }),
  );
  assert.equal(repository.sources.size, 0);

  const normId = await service.createInternalNorm(org, normForm);
  const norm = await service.getNormVersion(org, normId);
  assert.equal(norm.norm.basisQuantity, "100");
  assert.equal(norm.norm.publicationStatus, "draft");
  assert.equal(norm.norm.method, "resource");
  assert.equal(norm.norm.sourceType, "company_custom");
  assert.equal(norm.norm.sourceCode, "DEVIZO-COMPANY-NORMS");
  assert.equal(norm.norm.officialStatus, "unknown");
  assert.equal(repository.sources.size, 1);
  assert.equal(repository.sources.get(`${org}:DEVIZO-COMPANY-NORMS:1`)?.status, "active");
  assert.equal(
    repository.sources.get(`${org}:DEVIZO-COMPANY-NORMS:1`)?.monitoringEnabled,
    false,
  );

  await expectRejected(
    () => service.createInternalNorm(org, normForm),
    DuplicateInternalNormError,
  );
  const secondVersionId = await service.createInternalNorm(org, {
    ...normForm,
    versionLabel: "2",
  });
  const secondVersion = await service.getNormVersion(org, secondVersionId);
  assert.equal(secondVersion.norm.code, norm.norm.code);
  assert.equal(secondVersion.norm.versionLabel, "2");
  assert.equal(secondVersion.norm.estimateNormId, norm.norm.estimateNormId);
  assert.equal(secondVersion.norm.publicationStatus, "draft");
  await expectRejected(
    () =>
      service.createInternalNorm(org, {
        ...normForm,
        versionLabel: "3",
        name: "Altă identitate pentru același cod",
      }),
    InternalNormIdentityConflictError,
  );
  await service.createInternalNorm(org, {
    ...normForm,
    code: "TEST-TENC-002",
    versionLabel: "1",
  });
  assert.equal(repository.sources.size, 1);
  await service.createInternalNorm("org-b", {
    ...normForm,
    code: "TEST-TENC-001",
  });
  assert.equal(repository.sources.size, 2);
  await expectRejected(
    () => service.getNormVersion("org-b", normId),
    NormLibraryRecordNotFoundError,
  );

  const resourceRows = [
    {
      code: "LAB-001",
      name: "Muncitor constructor",
      resourceType: "labor",
      unit: "h",
      quantityPerNormBasis: "10",
    },
    {
      code: "MAT-001",
      name: "Material de test",
      resourceType: "material",
      unit: "kg",
      quantityPerNormBasis: "3",
    },
    {
      code: "MCH-001",
      name: "Utilaj de test",
      resourceType: "machinery",
      unit: "h",
      quantityPerNormBasis: "2",
    },
    {
      name: "Resursă cu consum zero",
      resourceType: "other",
      unit: "buc.",
      quantityPerNormBasis: "0",
    },
  ] as const;
  for (const resource of resourceRows) {
    await service.addInternalNormResource(org, normId, resource);
  }
  await expectRejected(
    () =>
      service.addInternalNormResource(org, normId, {
        ...resourceRows[0],
        name: "Altă denumire",
      }),
    DuplicateNormResourceError,
  );
  assert.equal((await service.getNormVersion(org, normId)).resources.length, 4);
  const draftEstimate = repository.addEstimate(org, "2026-06-15", ["m²"]);
  const draftOptions = await service.getNormWorkspacePresentation(
    org,
    draftEstimate.id,
  );
  assert.deepEqual(draftOptions.eligibleByWorkItemId[draftEstimate.itemIds[0]!], []);
  await expectRejected(
    () =>
      service.assignNorm(
        org,
        draftEstimate.id,
        draftEstimate.itemIds[0]!,
        normId,
      ),
    NormAssignmentValidationError,
  );
  await service.publishInternalNormVersion(org, normId);
  assert.equal(
    (await service.getNormVersion(org, normId)).norm.publicationStatus,
    "published",
  );
  const publishedOptions = await service.getNormWorkspacePresentation(
    org,
    draftEstimate.id,
  );
  assert.equal(
    publishedOptions.eligibleByWorkItemId[draftEstimate.itemIds[0]!]?.length,
    1,
  );
  assert.equal(
    publishedOptions.eligibleByWorkItemId[draftEstimate.itemIds[0]!]?.[0]?.id,
    normId,
  );
  await expectRejected(
    () => service.publishInternalNormVersion(org, normId),
    NormVersionPublicationError,
  );
  await expectRejected(
    () =>
      service.addInternalNormResource(org, normId, {
        name: "Resursă după publicare",
        resourceType: "other",
        unit: "buc.",
        quantityPerNormBasis: "1",
      }      ),
      NormVersionPublicationError,
  );

  const estimate = repository.addEstimate(org, "2026-06-15", ["m²", "kg"]);
  await expectRejected(
    () =>
      service.assignNorm(
        org,
        estimate.id,
        estimate.itemIds[1]!,
        normId,
      ),
    NormAssignmentValidationError,
  );
  await service.assignNorm(org, estimate.id, estimate.itemIds[0]!, normId);
  await expectRejected(
    () =>
      service.assignNorm(
        org,
        estimate.id,
        estimate.itemIds[0]!,
        normId,
      ),
    NormAssignmentValidationError,
  );
  const presentation = await service.getNormWorkspacePresentation(org, estimate.id);
  const applied = presentation.assignedByWorkItemId[estimate.itemIds[0]!]!;
  assert.equal(applied.applicationOrder, 1);
  assert.equal(applied.applicationCoefficient, "1");
  assert.equal(applied.calculatedResources[0]?.resourceQuantity, "25");
  assert.equal(applied.calculatedResources[1]?.resourceQuantity, "7.5");
  assert.equal(applied.calculatedResources[2]?.resourceQuantity, "5");
  assert.equal(applied.calculatedResources[3]?.resourceQuantity, "0");
  assert.equal(presentation.assignedCount, 1);
  assert.equal(presentation.itemCount, 2);
  assert.deepEqual(
    presentation.eligibleByWorkItemId[estimate.itemIds[1]!],
    [],
  );
  assert.equal(repository.resourcePriceInsertCount, 0);

  const before = repository.addEstimate(org, "2025-12-31", ["m²"]);
  await expectRejected(
    () => service.assignNorm(org, before.id, before.itemIds[0]!, normId),
    NormAssignmentValidationError,
  );
  const after = repository.addEstimate(org, "2027-01-01", ["m²"]);
  await expectRejected(
    () => service.assignNorm(org, after.id, after.itemIds[0]!, normId),
    NormAssignmentValidationError,
  );
  const wrongList = repository.addEstimate(org, "2026-06-15", ["m²"]);
  await expectRejected(
    () =>
      service.assignNorm(
        org,
        wrongList.id,
        estimate.itemIds[0]!,
        normId,
      ),
    NormAssignmentValidationError,
  );

  console.log("Professional norm library domain tests passed.");
}

void main();
