import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  date,
  boolean,
  jsonb,
  foreignKey,
  unique,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { organizations } from "./organizations";
import { projects } from "./projects";
import { organizationMembers } from "./organizationMembers";

/**
 * PROFESSIONAL ESTIMATE DOMAIN.
 *
 * These tables are additive and intentionally separate from the commercial
 * quote/catalog tables. A commercial catalog item is neither a norm nor a
 * professional resource, and no selling price is reused here.
 */

export const constructionObjects = pgTable(
  "construction_objects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"),
    code: text("code"),
    name: text("name").notNull(),
    address: text("address"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectOrgFk: foreignKey({
      columns: [table.projectId, table.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
      name: "construction_objects_project_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("construction_objects_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    codeUnique: uniqueIndex("construction_objects_org_code_unique")
      .on(table.organizationId, table.code)
      .where(sql`${table.code} is not null`),
  }),
);

export const normativeSources = pgTable(
  "normative_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    edition: text("edition").notNull(),
    sourceType: text("source_type").notNull(),
    publisher: text("publisher"),
    jurisdiction: text("jurisdiction").notNull().default("MD"),
    authority: text("authority"),
    sourceUri: text("source_uri"),
    approvalDate: date("approval_date"),
    publicationDate: date("publication_date"),
    effectiveDate: date("effective_date"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    status: text("status").notNull().default("active"),
    officialStatus: text("official_status").notNull().default("unknown"),
    monitoringEnabled: boolean("monitoring_enabled").notNull().default(false),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    lastVerificationStatus: text("last_verification_status")
      .notNull()
      .default("never"),
    lastVerificationError: text("last_verification_error"),
    contentFingerprint: text("content_fingerprint"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdUnique: unique("normative_sources_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    identityUnique: unique("normative_sources_org_code_edition_unique").on(
      table.organizationId,
      table.code,
      table.edition,
    ),
    sourceTypeCheck: check(
      "normative_sources_type_check",
      sql`${table.sourceType} in ('normative_document', 'norm_collection', 'price_catalog', 'legislation', 'official_guidance', 'company_custom', 'import')`,
    ),
    officialStatusCheck: check(
      "normative_sources_official_status_check",
      sql`${table.officialStatus} in ('draft', 'consultation', 'approved', 'in_force', 'superseded', 'repealed', 'unknown')`,
    ),
    verificationStatusCheck: check(
      "normative_sources_verification_status_check",
      sql`${table.lastVerificationStatus} in ('never', 'success', 'error')`,
    ),
    statusCheck: check(
      "normative_sources_status_check",
      sql`${table.status} in ('draft', 'active', 'superseded')`,
    ),
    validityCheck: check(
      "normative_sources_validity_check",
      sql`${table.validTo} is null or ${table.validFrom} is null or ${table.validTo} >= ${table.validFrom}`,
    ),
  }),
);
 
export const normativeUpdates = pgTable(
  "normative_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull(),
    updateType: text("update_type").notNull().default("source_page_changed"),
    reviewStatus: text("review_status").notNull().default("detected"),
    title: text("title").notNull(),
    summary: text("summary"),
    impactSummary: text("impact_summary"),
    officialUri: text("official_uri"),
    publicationDate: date("publication_date"),
    effectiveDate: date("effective_date"),
    eventFingerprint: text("event_fingerprint").notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    sourceOrgFk: foreignKey({
      columns: [table.sourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "normative_updates_source_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("normative_updates_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    eventUnique: unique("normative_updates_source_event_unique").on(
      table.organizationId,
      table.sourceId,
      table.eventFingerprint,
    ),
    updateTypeCheck: check(
      "normative_updates_type_check",
      sql`${table.updateType} in ('source_page_changed', 'amendment', 'replacement', 'status_change', 'price_catalog_update', 'other')`,
    ),
    reviewStatusCheck: check(
      "normative_updates_review_status_check",
      sql`${table.reviewStatus} in ('detected', 'reviewed', 'dismissed')`,
    ),
    orgDetectedIdx: index("normative_updates_org_detected_idx").on(
      table.organizationId,
      table.detectedAt,
    ),
  }),
);

export const normativeUpdateReviews = pgTable(
  "normative_update_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    updateId: uuid("update_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    reviewerUserId: uuid("reviewer_user_id").notNull(),
    decision: text("decision").notNull(),
    note: text("note"),
    sourceCode: text("source_code").notNull(),
    sourceEdition: text("source_edition").notNull(),
    sourceAuthority: text("source_authority"),
    officialUri: text("official_uri"),
    publicationDate: date("publication_date"),
    effectiveDate: date("effective_date"),
    previousFingerprint: text("previous_fingerprint"),
    detectedFingerprint: text("detected_fingerprint").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    updateOrgFk: foreignKey({
      columns: [table.updateId, table.organizationId],
      foreignColumns: [normativeUpdates.id, normativeUpdates.organizationId],
      name: "normative_update_reviews_update_org_fkey",
    }).onDelete("restrict"),
    sourceOrgFk: foreignKey({
      columns: [table.sourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "normative_update_reviews_source_org_fkey",
    }).onDelete("restrict"),
    reviewerOrgFk: foreignKey({
      columns: [table.organizationId, table.reviewerUserId],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
      name: "normative_update_reviews_reviewer_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("normative_update_reviews_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    updateUnique: unique("normative_update_reviews_update_unique").on(
      table.updateId,
    ),
    decisionCheck: check(
      "normative_update_reviews_decision_check",
      sql`${table.decision} in ('reviewed_no_action', 'dismissed', 'requires_normative_version', 'requires_metadata_update', 'requires_follow_up')`,
    ),
    noteCheck: check(
      "normative_update_reviews_note_length_check",
      sql`${table.note} is null or length(trim(${table.note})) <= 4000`,
    ),
    organizationReviewedIdx: index(
      "normative_update_reviews_org_reviewed_idx",
    ).on(table.organizationId, table.reviewedAt),
  }),
);

export const normativeApplicabilityDecisions = pgTable(
  "normative_applicability_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull(),
    triggeringUpdateId: uuid("triggering_update_id"),
    revision: integer("revision").notNull(),
    decision: text("decision").notNull(),
    applicableFrom: date("applicable_from"),
    applicableUntil: date("applicable_until"),
    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decidedByUserId: uuid("decided_by_user_id").notNull(),
    basisNote: text("basis_note").notNull(),
    evidenceUri: text("evidence_uri"),
    sourceCode: text("source_code").notNull(),
    sourceEdition: text("source_edition").notNull(),
    sourceAuthority: text("source_authority"),
    sourceUri: text("source_uri"),
    sourceFingerprint: text("source_fingerprint"),
    officialStatus: text("official_status").notNull(),
  },
  (table) => ({
    sourceOrgFk: foreignKey({
      columns: [table.sourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "normative_applicability_source_org_fkey",
    }).onDelete("restrict"),
    triggeringUpdateOrgFk: foreignKey({
      columns: [table.triggeringUpdateId, table.organizationId],
      foreignColumns: [normativeUpdates.id, normativeUpdates.organizationId],
      name: "normative_applicability_update_org_fkey",
    }).onDelete("restrict"),
    deciderOrgFk: foreignKey({
      columns: [table.organizationId, table.decidedByUserId],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
      name: "normative_applicability_decider_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("normative_applicability_decisions_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    sourceRevisionUnique: unique(
      "normative_applicability_source_revision_unique",
    ).on(table.organizationId, table.sourceId, table.revision),
    revisionCheck: check(
      "normative_applicability_revision_check",
      sql`${table.revision} > 0`,
    ),
    decisionCheck: check(
      "normative_applicability_decision_check",
      sql`${table.decision} in ('applicable', 'not_applicable', 'deferred', 'unknown')`,
    ),
    applicableDateCheck: check(
      "normative_applicability_applicable_date_check",
      sql`${table.decision} <> 'applicable' or (${table.applicableFrom} is not null and ${table.officialStatus} = 'in_force')`,
    ),
    validityCheck: check(
      "normative_applicability_validity_check",
      sql`${table.applicableUntil} is null or ${table.applicableFrom} is null or ${table.applicableUntil} >= ${table.applicableFrom}`,
    ),
    basisNoteCheck: check(
      "normative_applicability_basis_note_check",
      sql`length(trim(${table.basisNote})) between 1 and 4000`,
    ),
    evidenceUriCheck: check(
      "normative_applicability_evidence_uri_check",
      sql`${table.evidenceUri} is null or length(trim(${table.evidenceUri})) <= 2048`,
    ),
  }),
);

export const normativeSourceRelations = pgTable(
  "normative_source_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    fromSourceId: uuid("from_source_id").notNull(),
    toSourceId: uuid("to_source_id").notNull(),
    relationType: text("relation_type").notNull(),
    effectiveDate: date("effective_date"),
    evidenceUri: text("evidence_uri"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdByUserId: uuid("created_by_user_id").notNull(),
  },
  (table) => ({
    fromSourceOrgFk: foreignKey({
      columns: [table.fromSourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "normative_source_relations_from_source_org_fkey",
    }).onDelete("restrict"),
    toSourceOrgFk: foreignKey({
      columns: [table.toSourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "normative_source_relations_to_source_org_fkey",
    }).onDelete("restrict"),
    creatorOrgFk: foreignKey({
      columns: [table.organizationId, table.createdByUserId],
      foreignColumns: [
        organizationMembers.organizationId,
        organizationMembers.userId,
      ],
      name: "normative_source_relations_creator_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("normative_source_relations_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    relationUnique: unique("normative_source_relations_unique").on(
      table.organizationId,
      table.fromSourceId,
      table.toSourceId,
      table.relationType,
    ),
    notSelfCheck: check(
      "normative_source_relations_not_self_check",
      sql`${table.fromSourceId} <> ${table.toSourceId}`,
    ),
    relationTypeCheck: check(
      "normative_source_relations_type_check",
      sql`${table.relationType} in ('amends', 'replaces', 'supersedes', 'supplements', 'corrigendum_to', 'related_to')`,
    ),
    evidenceUriCheck: check(
      "normative_source_relations_evidence_uri_check",
      sql`${table.evidenceUri} is null or length(trim(${table.evidenceUri})) <= 2048`,
    ),
    noteCheck: check(
      "normative_source_relations_note_check",
      sql`${table.note} is null or length(trim(${table.note})) <= 4000`,
    ),
    organizationCreatedIdx: index(
      "normative_source_relations_org_created_idx",
    ).on(table.organizationId, table.createdAt),
  }),
);

export const estimateNorms = pgTable(
  "estimate_norms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    namespace: text("namespace").notNull().default("default"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    orgIdUnique: unique("estimate_norms_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    codeUnique: unique("estimate_norms_org_namespace_code_unique").on(
      table.organizationId,
      table.namespace,
      table.code,
    ),
  }),
);

export const professionalResources = pgTable(
  "professional_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").notNull(),
    code: text("code"),
    name: text("name").notNull(),
    resourceType: text("resource_type").notNull(),
    unit: text("unit").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sourceOrgFk: foreignKey({
      columns: [table.sourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "professional_resources_source_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("professional_resources_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    codeUnique: uniqueIndex("professional_resources_org_source_code_unique")
      .on(table.organizationId, table.sourceId, table.code)
      .where(sql`${table.code} is not null`),
    resourceTypeCheck: check(
      "professional_resources_type_check",
      sql`${table.resourceType} in ('labor', 'material', 'machinery', 'transport', 'energy', 'other')`,
    ),
    unitCheck: check(
      "professional_resources_unit_nonempty_check",
      sql`length(trim(${table.unit})) > 0`,
    ),
  }),
);

export const workQuantityLists = pgTable(
  "work_quantity_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    constructionObjectId: uuid("construction_object_id").notNull(),
    code: text("code"),
    name: text("name").notNull(),
    revision: integer("revision").notNull().default(1),
    sourceReference: text("source_reference"),
    sourceDate: date("source_date"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    objectOrgFk: foreignKey({
      columns: [table.constructionObjectId, table.organizationId],
      foreignColumns: [constructionObjects.id, constructionObjects.organizationId],
      name: "work_quantity_lists_object_org_fkey",
    }).onDelete("cascade"),
    orgIdUnique: unique("work_quantity_lists_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    objectLinkUnique: unique("work_quantity_lists_id_object_org_unique").on(
      table.id,
      table.constructionObjectId,
      table.organizationId,
    ),
    revisionCheck: check(
      "work_quantity_lists_revision_check",
      sql`${table.revision} > 0`,
    ),
  }),
);

export const workQuantityItems = pgTable(
  "work_quantity_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    workQuantityListId: uuid("work_quantity_list_id").notNull(),
    positionNumber: integer("position_number").notNull(),
    code: text("code"),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    listOrgFk: foreignKey({
      columns: [table.workQuantityListId, table.organizationId],
      foreignColumns: [workQuantityLists.id, workQuantityLists.organizationId],
      name: "work_quantity_items_list_org_fkey",
    }).onDelete("cascade"),
    orgIdUnique: unique("work_quantity_items_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    listLinkUnique: unique("work_quantity_items_id_list_org_unique").on(
      table.id,
      table.workQuantityListId,
      table.organizationId,
    ),
    positionUnique: unique("work_quantity_items_list_position_unique").on(
      table.workQuantityListId,
      table.positionNumber,
    ),
    positionCheck: check(
      "work_quantity_items_position_check",
      sql`${table.positionNumber} > 0`,
    ),
    quantityCheck: check(
      "work_quantity_items_quantity_check",
      sql`${table.quantity} > 0`,
    ),
    unitCheck: check(
      "work_quantity_items_unit_nonempty_check",
      sql`length(trim(${table.unit})) > 0`,
    ),
  }),
);

export const estimateNormVersions = pgTable(
  "estimate_norm_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    estimateNormId: uuid("estimate_norm_id").notNull(),
    sourceId: uuid("source_id").notNull(),
    versionLabel: text("version_label").notNull(),
    method: text("method").notNull().default("resource"),
    basisQuantity: numeric("basis_quantity", { precision: 18, scale: 6 })
      .notNull()
      .default("1"),
    basisUnit: text("basis_unit").notNull(),
    description: text("description"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    applicability: jsonb("applicability").notNull().default({}),
    publicationStatus: text("publication_status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    normOrgFk: foreignKey({
      columns: [table.estimateNormId, table.organizationId],
      foreignColumns: [estimateNorms.id, estimateNorms.organizationId],
      name: "estimate_norm_versions_norm_org_fkey",
    }).onDelete("restrict"),
    sourceOrgFk: foreignKey({
      columns: [table.sourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "estimate_norm_versions_source_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("estimate_norm_versions_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    versionUnique: unique("estimate_norm_versions_norm_version_unique").on(
      table.estimateNormId,
      table.versionLabel,
    ),
    methodCheck: check(
      "estimate_norm_versions_method_check",
      sql`${table.method} = 'resource'`,
    ),
    basisQuantityCheck: check(
      "estimate_norm_versions_basis_quantity_check",
      sql`${table.basisQuantity} > 0`,
    ),
    basisUnitCheck: check(
      "estimate_norm_versions_basis_unit_nonempty_check",
      sql`length(trim(${table.basisUnit})) > 0`,
    ),
    validityCheck: check(
      "estimate_norm_versions_validity_check",
      sql`${table.validTo} is null or ${table.validFrom} is null or ${table.validTo} >= ${table.validFrom}`,
    ),
    publicationStatusCheck: check(
      "estimate_norm_versions_publication_status_check",
      sql`${table.publicationStatus} in ('draft', 'in_review', 'approved', 'published')`,
    ),
  }),
);

export const resourceConsumptions = pgTable(
  "resource_consumptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    estimateNormVersionId: uuid("estimate_norm_version_id").notNull(),
    positionNumber: integer("position_number").notNull(),
    resourceId: uuid("resource_id").notNull(),
    quantityPerNormBasis: numeric("quantity_per_norm_basis", {
      precision: 18,
      scale: 6,
    }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    normVersionOrgFk: foreignKey({
      columns: [table.estimateNormVersionId, table.organizationId],
      foreignColumns: [estimateNormVersions.id, estimateNormVersions.organizationId],
      name: "resource_consumptions_norm_version_org_fkey",
    }).onDelete("restrict"),
    resourceOrgFk: foreignKey({
      columns: [table.resourceId, table.organizationId],
      foreignColumns: [professionalResources.id, professionalResources.organizationId],
      name: "resource_consumptions_resource_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("resource_consumptions_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    positionUnique: unique("resource_consumptions_norm_position_unique").on(
      table.estimateNormVersionId,
      table.positionNumber,
    ),
    positionCheck: check(
      "resource_consumptions_position_check",
      sql`${table.positionNumber} > 0`,
    ),
    quantityCheck: check(
      "resource_consumptions_quantity_check",
      sql`${table.quantityPerNormBasis} >= 0`,
    ),
  }),
);

export const resourcePrices = pgTable(
  "resource_prices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id").notNull(),
    sourceId: uuid("source_id"),
    price: numeric("price", { precision: 18, scale: 6 }).notNull(),
    basisQuantity: numeric("basis_quantity", { precision: 18, scale: 6 })
      .notNull()
      .default("1"),
    currency: text("currency").notNull(),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to"),
    sourceType: text("source_type").notNull().default("manual"),
    sourceReference: text("source_reference"),
    location: text("location"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    resourceOrgFk: foreignKey({
      columns: [table.resourceId, table.organizationId],
      foreignColumns: [professionalResources.id, professionalResources.organizationId],
      name: "resource_prices_resource_org_fkey",
    }).onDelete("restrict"),
    sourceOrgFk: foreignKey({
      columns: [table.sourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "resource_prices_source_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("resource_prices_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    resourceDateIdx: index("resource_prices_resource_valid_from_idx").on(
      table.resourceId,
      table.validFrom,
    ),
    priceCheck: check("resource_prices_price_check", sql`${table.price} >= 0`),
    basisQuantityCheck: check(
      "resource_prices_basis_quantity_check",
      sql`${table.basisQuantity} > 0`,
    ),
    currencyCheck: check(
      "resource_prices_currency_check",
      sql`${table.currency} in ('MDL', 'EUR', 'RON', 'USD', 'GBP')`,
    ),
    sourceTypeCheck: check(
      "resource_prices_source_type_check",
      sql`${table.sourceType} in ('manual', 'supplier', 'invoice', 'market', 'import')`,
    ),
    validityCheck: check(
      "resource_prices_validity_check",
      sql`${table.validTo} is null or ${table.validTo} >= ${table.validFrom}`,
    ),
  }),
);

export const calculationContexts = pgTable(
  "calculation_contexts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    constructionObjectId: uuid("construction_object_id").notNull(),
    workQuantityListId: uuid("work_quantity_list_id").notNull(),
    name: text("name").notNull(),
    valuationDate: date("valuation_date").notNull(),
    currency: text("currency").notNull(),
    region: text("region"),
    method: text("method").notNull().default("resource"),
    normativeBasis: text("normative_basis"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    objectOrgFk: foreignKey({
      columns: [table.constructionObjectId, table.organizationId],
      foreignColumns: [constructionObjects.id, constructionObjects.organizationId],
      name: "calculation_contexts_object_org_fkey",
    }).onDelete("cascade"),
    listObjectOrgFk: foreignKey({
      columns: [
        table.workQuantityListId,
        table.constructionObjectId,
        table.organizationId,
      ],
      foreignColumns: [
        workQuantityLists.id,
        workQuantityLists.constructionObjectId,
        workQuantityLists.organizationId,
      ],
      name: "calculation_contexts_list_object_org_fkey",
    }).onDelete("cascade"),
    orgIdUnique: unique("calculation_contexts_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    listLinkUnique: unique("calculation_contexts_id_list_org_unique").on(
      table.id,
      table.workQuantityListId,
      table.organizationId,
    ),
    currencyCheck: check(
      "calculation_contexts_currency_check",
      sql`${table.currency} in ('MDL', 'EUR', 'RON', 'USD', 'GBP')`,
    ),
    methodCheck: check(
      "calculation_contexts_method_check",
      sql`${table.method} = 'resource'`,
    ),
  }),
);

export const normApplications = pgTable(
  "norm_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    calculationContextId: uuid("calculation_context_id").notNull(),
    workQuantityListId: uuid("work_quantity_list_id").notNull(),
    workQuantityItemId: uuid("work_quantity_item_id").notNull(),
    estimateNormVersionId: uuid("estimate_norm_version_id").notNull(),
    applicationOrder: integer("application_order").notNull().default(1),
    applicationCoefficient: numeric("application_coefficient", {
      precision: 18,
      scale: 6,
    }).notNull().default("1"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    contextListOrgFk: foreignKey({
      columns: [
        table.calculationContextId,
        table.workQuantityListId,
        table.organizationId,
      ],
      foreignColumns: [
        calculationContexts.id,
        calculationContexts.workQuantityListId,
        calculationContexts.organizationId,
      ],
      name: "norm_applications_context_list_org_fkey",
    }).onDelete("cascade"),
    workItemListOrgFk: foreignKey({
      columns: [
        table.workQuantityItemId,
        table.workQuantityListId,
        table.organizationId,
      ],
      foreignColumns: [
        workQuantityItems.id,
        workQuantityItems.workQuantityListId,
        workQuantityItems.organizationId,
      ],
      name: "norm_applications_work_item_list_org_fkey",
    }).onDelete("cascade"),
    normVersionOrgFk: foreignKey({
      columns: [table.estimateNormVersionId, table.organizationId],
      foreignColumns: [estimateNormVersions.id, estimateNormVersions.organizationId],
      name: "norm_applications_norm_version_org_fkey",
    }).onDelete("restrict"),
    orgIdUnique: unique("norm_applications_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    contextLinkUnique: unique("norm_applications_id_context_org_unique").on(
      table.id,
      table.calculationContextId,
      table.organizationId,
    ),
    orderUnique: unique("norm_applications_context_item_order_unique").on(
      table.calculationContextId,
      table.workQuantityItemId,
      table.applicationOrder,
    ),
    orderCheck: check(
      "norm_applications_order_check",
      sql`${table.applicationOrder} > 0`,
    ),
    coefficientCheck: check(
      "norm_applications_coefficient_check",
      sql`${table.applicationCoefficient} > 0`,
    ),
  }),
);

export const calculationRules = pgTable(
  "calculation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    calculationContextId: uuid("calculation_context_id").notNull(),
    normApplicationId: uuid("norm_application_id"),
    sourceId: uuid("source_id").notNull(),
    name: text("name").notNull(),
    ruleType: text("rule_type").notNull(),
    basis: text("basis").notNull(),
    valueType: text("value_type").notNull(),
    value: numeric("value", { precision: 18, scale: 6 }).notNull(),
    currency: text("currency"),
    sortOrder: integer("sort_order").notNull().default(0),
    sourceReference: text("source_reference"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    contextOrgFk: foreignKey({
      columns: [table.calculationContextId, table.organizationId],
      foreignColumns: [calculationContexts.id, calculationContexts.organizationId],
      name: "calculation_rules_context_org_fkey",
    }).onDelete("cascade"),
    sourceOrgFk: foreignKey({
      columns: [table.sourceId, table.organizationId],
      foreignColumns: [normativeSources.id, normativeSources.organizationId],
      name: "calculation_rules_source_org_fkey",
    }).onDelete("restrict"),
    normApplicationContextOrgFk: foreignKey({
      columns: [
        table.normApplicationId,
        table.calculationContextId,
        table.organizationId,
      ],
      foreignColumns: [
        normApplications.id,
        normApplications.calculationContextId,
        normApplications.organizationId,
      ],
      name: "calculation_rules_norm_application_context_org_fkey",
    }).onDelete("cascade"),
    orgIdUnique: unique("calculation_rules_id_org_unique").on(
      table.id,
      table.organizationId,
    ),
    ruleTypeCheck: check(
      "calculation_rules_type_check",
      sql`${table.ruleType} in ('coefficient', 'overhead', 'estimated_profit', 'transport', 'procurement_storage', 'temporary_works', 'winter_conditions', 'other')`,
    ),
    basisCheck: check(
      "calculation_rules_basis_check",
      sql`${table.basis} in ('direct_cost', 'labor_cost', 'material_cost', 'machinery_cost', 'wages', 'resource_cost', 'custom')`,
    ),
    valueTypeCheck: check(
      "calculation_rules_value_type_check",
      sql`${table.valueType} in ('percent', 'coefficient', 'fixed_amount')`,
    ),
    valueCheck: check(
      "calculation_rules_value_check",
      sql`${table.value} >= 0`,
    ),
    fixedCurrencyCheck: check(
      "calculation_rules_fixed_currency_check",
      sql`(${table.valueType} = 'fixed_amount' and ${table.currency} is not null)
        or (${table.valueType} <> 'fixed_amount' and ${table.currency} is null)`,
    ),
    currencyCheck: check(
      "calculation_rules_currency_check",
      sql`${table.currency} is null or ${table.currency} in ('MDL', 'EUR', 'RON', 'USD', 'GBP')`,
    ),
  }),
);

export type ConstructionObject = typeof constructionObjects.$inferSelect;
export type WorkQuantityList = typeof workQuantityLists.$inferSelect;
export type WorkQuantityItem = typeof workQuantityItems.$inferSelect;
export type NormativeSource = typeof normativeSources.$inferSelect;
export type NormativeUpdate = typeof normativeUpdates.$inferSelect;
export type NormativeUpdateReview = typeof normativeUpdateReviews.$inferSelect;
export type NormativeApplicabilityDecision =
  typeof normativeApplicabilityDecisions.$inferSelect;
export type NormativeSourceRelation = typeof normativeSourceRelations.$inferSelect;
export type EstimateNorm = typeof estimateNorms.$inferSelect;
export type EstimateNormVersion = typeof estimateNormVersions.$inferSelect;
export type ProfessionalResource = typeof professionalResources.$inferSelect;
export type ResourceConsumption = typeof resourceConsumptions.$inferSelect;
export type ResourcePrice = typeof resourcePrices.$inferSelect;
export type CalculationContext = typeof calculationContexts.$inferSelect;
export type NormApplication = typeof normApplications.$inferSelect;
export type CalculationRule = typeof calculationRules.$inferSelect;
