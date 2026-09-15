"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  getCatalogItemService,
  getProjectService,
  getQuoteDecisionService,
  getQuoteService,
} from "@/server/container";
import { draftUpdateSchema } from "@/schemas/domain/quoteVersion";
import {
  QuoteNotEditableError,
  QuoteNotSendableError,
  QuoteVersionNotCloneableError,
  QuoteVersionNotFoundError,
} from "@/domain/quotes/quote.service";
import {
  QuoteDecisionNotAllowedError,
  QuoteDecisionVersionNotFoundError,
  type QuoteDecision,
} from "@/domain/quotes/quote-decision.service";
import type { SupportedCurrency, SupportedUnit } from "@/domain/shared/types";

// --- Catalog search (for the editor's search-as-you-type picker) ----------

export interface CatalogSearchResult {
  id: string;
  name: string;
  code: string | null;
  unit: SupportedUnit;
  sellingPrice: string;
  // The item's own currency. The editor blocks adding an item whose currency
  // differs from the quote version's currency (no silent reinterpretation).
  currency: SupportedCurrency;
}

export async function searchCatalog(
  term: string,
): Promise<CatalogSearchResult[]> {
  const { org } = await requireCurrentOrg();
  const items = await getCatalogItemService().searchActiveItems(org.id, term);
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    code: item.code,
    unit: item.unit,
    sellingPrice: item.sellingPrice,
    currency: item.currency,
  }));
}

// --- Create a quote from a project ----------------------------------------

export async function createQuoteForProject(formData: FormData): Promise<void> {
  const { org } = await requireCurrentOrg();
  const projectId = String(formData.get("projectId"));

  // Load project + customer snapshot data in one database query.
  const snapshot = await getProjectService().getQuoteSnapshot(org.id, projectId);

  const created = await getQuoteService().createQuote(org.id, {
    projectId,
    currency: org.defaultCurrency,
    vatRate: org.vatRate ?? "0",
    snapshot: {
      customerName: snapshot.customerName,
      customerEmail: snapshot.customerEmail,
      customerPhone: snapshot.customerPhone,
      projectName: snapshot.projectName,
      projectAddress: snapshot.projectAddress,
    },
  });

  // We already know the exact draft version we just created. Pass it forward
  // so the editor does not query the database again just to rediscover it.
  redirect(
    `/quotes/${created.quote.id}/edit?versionId=${encodeURIComponent(created.version.id)}`,
  );
}

// --- Save a draft version --------------------------------------------------

export type SaveDraftState = { error: string } | { ok: true } | null;

// The editor submits items as a JSON string plus the version-level fields.
export async function saveDraft(
  versionId: string,
  _prev: SaveDraftState,
  formData: FormData,
): Promise<SaveDraftState> {
  const { org } = await requireCurrentOrg();

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Articole invalide." };
  }

  const parsed = draftUpdateSchema.safeParse({
    notes: formData.get("notes") || undefined,
    validityDays: formData.get("validityDays") || undefined,
    discountPct: formData.get("discountPct") || "0",
    items: rawItems,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Date invalide." };
  }

  try {
    await getQuoteService().saveDraft(org.id, versionId, {
      notes: parsed.data.notes ?? null,
      validityDays: parsed.data.validityDays ?? null,
      discountPct: parsed.data.discountPct,
      items: parsed.data.items.map((item) => ({
        catalogItemId: item.catalogItemId ?? null,
        name: item.name,
        description: item.description ?? null,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discountPct: item.discountPct,
      })),
    });
  } catch (error) {
    if (error instanceof QuoteNotEditableError) {
      return { error: "Această versiune nu mai poate fi editată." };
    }
    throw error;
  }

  revalidatePath(`/quotes`);
  return { ok: true };
}

// --- Send a draft version (freeze it as the commercial document) -----------

export type SendQuoteState = { error: string } | null;

// Freezes the exact saved QuoteVersion as 'sent'. Validates against the saved
// snapshot only (never the AI assistant's unresolved state). On success the
// user is redirected to the now-immutable version view.
export async function sendQuoteVersion(
  quoteId: string,
  versionId: string,
  _prev: SendQuoteState,
  _formData: FormData,
): Promise<SendQuoteState> {
  const { userId, org } = await requireCurrentOrg();

  try {
    // Freeze the company/document metadata from the live org NOW, at finalize
    // time. After this the PDF renders only from the frozen version snapshot.
    await getQuoteService().sendQuoteVersion(org.id, versionId, userId, {
      companyName: org.name,
      companyLegalName: org.legalName,
      companyTaxVatId: org.vatNumber,
      companyEmail: org.email,
      companyPhone: org.phone,
      companyAddress: org.address,
      companyCountry: org.country,
      documentLanguage: org.customerDocumentLanguage,
      paymentTerms: org.paymentTerms,
      executionDuration: org.executionDuration,
      inclusions: org.inclusions,
      exclusions: org.exclusions,
      companyTerms: org.legalTerms,
    });
  } catch (error) {
    if (error instanceof QuoteVersionNotFoundError) {
      return { error: "Versiunea nu a fost găsită." };
    }
    if (error instanceof QuoteNotSendableError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath(`/quotes`);
  revalidatePath(`/quotes/${quoteId}/versions/${versionId}`);
  redirect(`/quotes/${quoteId}/versions/${versionId}`);
}

// --- Accept or reject a sent version ---------------------------------------

export type QuoteDecisionState = { error: string } | null;

export async function decideQuoteVersion(
  quoteId: string,
  versionId: string,
  decision: QuoteDecision,
  _prev: QuoteDecisionState,
  _formData: FormData,
): Promise<QuoteDecisionState> {
  const { userId, org } = await requireCurrentOrg();

  try {
    await getQuoteDecisionService().decide(
      org.id,
      versionId,
      userId,
      decision,
    );
  } catch (error) {
    if (error instanceof QuoteDecisionVersionNotFoundError) {
      return { error: "Versiunea nu a fost găsită." };
    }
    if (error instanceof QuoteDecisionNotAllowedError) {
      return {
        error: "Doar un deviz trimis poate fi marcat ca acceptat sau respins.",
      };
    }
    throw error;
  }

  revalidatePath(`/quotes`);
  revalidatePath(`/projects`);
  revalidatePath(`/quotes/${quoteId}/versions/${versionId}`);
  redirect(`/quotes/${quoteId}/versions/${versionId}`);
}

// --- Create a new draft version from a sent/rejected version ----------------

// Clones a frozen version into a new draft (version + 1) and opens the editor.
// The source version stays immutable forever.
export async function createNewVersion(
  quoteId: string,
  sourceVersionId: string,
): Promise<void> {
  const { org } = await requireCurrentOrg();

  let newVersionId: string;
  try {
    newVersionId = await getQuoteService().createDraftFromVersion(
      org.id,
      sourceVersionId,
    );
  } catch (error) {
    if (
      error instanceof QuoteVersionNotFoundError ||
      error instanceof QuoteVersionNotCloneableError
    ) {
      redirect(`/quotes/${quoteId}/versions/${sourceVersionId}`);
    }
    throw error;
  }

  revalidatePath(`/quotes`);
  redirect(
    `/quotes/${quoteId}/edit?versionId=${encodeURIComponent(newVersionId)}`,
  );
}

// --- Delete a quote from the project view ---------------------------------

export async function deleteQuoteFromProject(
  quoteId: string,
  projectId: string,
  view: "all" | "confirmed",
): Promise<void> {
  const { org } = await requireCurrentOrg();
  const targetPath =
    view === "confirmed" ? `/projects/${projectId}?view=confirmed` : `/projects/${projectId}`;

  // A quote can be removed only while it consists of its first draft. Once a
  // version has been sent, the frozen history must remain available forever.
  const quoteService = getQuoteService();
  const latestVersionId = await quoteService.getLatestVersionId(org.id, quoteId);
  if (!latestVersionId) {
    redirect(targetPath);
  }

  try {
    const latestVersion = await quoteService.getVersion(org.id, latestVersionId);
    if (
      latestVersion.version.status !== "draft" ||
      latestVersion.version.versionNumber !== 1
    ) {
      redirect(targetPath);
    }
  } catch (error) {
    if (error instanceof QuoteVersionNotFoundError) {
      redirect(targetPath);
    }
    throw error;
  }

  await quoteService.deleteQuote(org.id, quoteId);

  revalidatePath(`/projects`);
  revalidatePath(`/quotes`);
  revalidatePath(`/projects/${projectId}`);
  redirect(targetPath);
}
