import { notFound } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getQuoteService } from "@/server/container";
import { QuoteVersionNotFoundError } from "@/domain/quotes/quote.service";
import { QuoteEditor } from "./quote-editor";

export default async function EditQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ versionId?: string }>;
}) {
  const [{ id }, { versionId: requestedVersionId }] = await Promise.all([
    params,
    searchParams,
  ]);
  const { org } = await requireCurrentOrg();

  // Creation and clone flows already know the exact draft version they made.
  // Reuse that id instead of asking the database which version is latest again.
  const versionId =
    requestedVersionId?.trim() ||
    (await getQuoteService().getLatestVersionId(org.id, id));
  if (!versionId) notFound();

  let data;
  try {
    data = await getQuoteService().getVersion(org.id, versionId);
  } catch (error) {
    if (error instanceof QuoteVersionNotFoundError) notFound();
    throw error;
  }

  // A supplied version id must still belong to the quote in the URL.
  if (data.quote.id !== id) notFound();

  // Only draft versions are editable.
  if (data.version.status !== "draft") notFound();

  return (
    <QuoteEditor
      quoteId={id}
      versionId={versionId}
      currency={data.version.currency}
      vatRate={data.version.vatRate}
      snapshot={{
        customerName: data.version.customerName,
        projectName: data.version.projectName,
        projectAddress: data.version.projectAddress,
      }}
      initial={{
        notes: data.version.notes,
        validityDays: data.version.validityDays,
        discountPct: data.version.discountPct,
        items: data.version.items.map((item) => ({
          catalogItemId: item.catalogItemId,
          name: item.name,
          description: item.description,
          unit: item.unit,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discountPct: item.discountPct,
        })),
      }}
    />
  );
}
