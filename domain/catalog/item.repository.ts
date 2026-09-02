import type {
  CatalogCategoryId,
  CatalogItemId,
  CatalogItemType,
  OrganizationId,
  SupportedUnit,
} from "@/domain/shared/types";

export interface CatalogItem {
  id: CatalogItemId;
  organizationId: OrganizationId;
  categoryId: CatalogCategoryId | null;
  code: string | null;
  name: string;
  description: string | null;
  unit: SupportedUnit;
  // Whether this is a labor operation or a material product. Matching never
  // crosses the two types.
  itemType: CatalogItemType;
  // Money is kept as a canonical decimal string, never a JS float.
  sellingPrice: string;
  costPrice: string | null;
  active: boolean;
}

// Fields a user can set when creating or editing an item.
// Prices arrive already normalized to canonical decimal strings.
export interface CatalogItemData {
  categoryId?: CatalogCategoryId | null;
  code?: string | null;
  name: string;
  description?: string | null;
  unit: SupportedUnit;
  itemType: CatalogItemType;
  sellingPrice: string;
  costPrice?: string | null;
  active: boolean;
}

export class DuplicateItemCodeError extends Error {
  constructor(public readonly code: string) {
    super(`An item with code "${code}" already exists.`);
    this.name = "DuplicateItemCodeError";
  }
}

// A catalog row returned by semantic vector search, with its cosine similarity
// (0..1, higher is closer). The item carries authoritative price/unit/type.
export interface SemanticCandidate {
  item: CatalogItem;
  similarity: number;
}

// The semantic fields needed to (re)build an item's embedding, plus the
// currently stored hash so callers can skip unchanged items. categoryName is
// resolved via join so the embedding captures the category label, not an id.
export interface EmbeddingInputRow {
  id: CatalogItemId;
  name: string;
  description: string | null;
  categoryName: string | null;
  itemType: CatalogItemType;
  unit: SupportedUnit;
  storedHash: string | null;
}

// One embedding to persist for an item.
export interface EmbeddingWriteRow {
  id: CatalogItemId;
  embedding: number[];
  hash: string;
  model: string;
}

export interface CatalogItemRepository {
  listActive(organizationId: OrganizationId): Promise<CatalogItem[]>;
  listAll(organizationId: OrganizationId): Promise<CatalogItem[]>;
  // Search-as-you-type over active items by name or code (limited result set).
  // An optional itemType restricts results to labor or material only.
  searchActive(
    organizationId: OrganizationId,
    term: string,
    limit: number,
    itemType?: CatalogItemType,
  ): Promise<CatalogItem[]>;
  getById(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
  ): Promise<CatalogItem | null>;
  // Looks an item up by its code within the organization (for import matching).
  findByCode(
    organizationId: OrganizationId,
    code: string,
  ): Promise<CatalogItem | null>;
  create(
    organizationId: OrganizationId,
    data: CatalogItemData,
  ): Promise<CatalogItem>;
  update(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
    data: CatalogItemData,
  ): Promise<CatalogItem>;
  setActive(
    organizationId: OrganizationId,
    itemId: CatalogItemId,
    active: boolean,
  ): Promise<void>;
  // Bulk create/update used by import, run inside a single transaction.
  bulkUpsert(
    organizationId: OrganizationId,
    creates: CatalogItemData[],
    updates: { id: CatalogItemId; data: CatalogItemData }[],
  ): Promise<{ created: number; updated: number }>;

  // --- Semantic search (M5.1) --------------------------------------------
  // Exact cosine vector search, HARD-filtered by organization, item_type and
  // active BEFORE ranking. Rows without an embedding are excluded (they fall
  // back to lexical retrieval upstream). Returns at most `limit` rows.
  semanticSearch(
    organizationId: OrganizationId,
    queryEmbedding: number[],
    itemType: CatalogItemType,
    limit: number,
  ): Promise<SemanticCandidate[]>;

  // Returns the semantic inputs (with category name and stored hash) for the
  // org's active items, so the caller can decide which need (re)embedding.
  listEmbeddingInputs(
    organizationId: OrganizationId,
  ): Promise<EmbeddingInputRow[]>;

  // Persists embeddings for the given items in one transaction.
  saveEmbeddings(rows: EmbeddingWriteRow[]): Promise<void>;
}
