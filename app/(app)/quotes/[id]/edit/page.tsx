import { notFound } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getQuoteService } from "@/server/container";
import { QuoteVersionNotFoundError } from "@/domain/quotes/quote.service";
import { QuoteEditor } from "./quote-editor";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await requireCurrentOrg();

  // Load the latest version of this quote to edit.
  const versionId = await getQuoteService().getLatestVersionId(org.id, id);
  if (!versionId) notFound();

  let data;
  try {
    data = await getQuoteService().getVersion(org.id, versionId);
  } catch (error) {
    if (error instanceof QuoteVersionNotFoundError) notFound();
    throw error;
  }

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
