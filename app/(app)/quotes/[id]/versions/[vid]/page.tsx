import { notFound } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getQuoteService } from "@/server/container";
import { QuoteVersionNotFoundError } from "@/domain/quotes/quote.service";
import { UNIT_LABELS } from "@/lib/i18n/units";
import { formatMoney } from "@/lib/i18n/money";
import type { QuoteStatus } from "@/domain/shared/types";
import { QuoteVersionActions } from "./quote-version-actions";
import { buildQuoteDocumentNumber } from "@/lib/quotes/document-number";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Schiță",
  sent: "Trimis",
  accepted: "Acceptat",
  rejected: "Respins",
};

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export default async function QuoteVersionPage({
  params,
}: {
  params: Promise<{ id: string; vid: string }>;
}) {
  const { id, vid } = await params;
  const { org } = await requireCurrentOrg();

  let data;
  try {
    data = await getQuoteService().getVersion(org.id, vid);
  } catch (error) {
    if (error instanceof QuoteVersionNotFoundError) notFound();
    throw error;
  }

  // Guard against a version id that belongs to a different quote in the URL.
  if (data.quote.id !== id) notFound();

  const v = data.version;
  const docNumber = buildQuoteDocumentNumber(v);
  const issueDate = formatDate(v.sentAt);
  const validUntil = formatDate(v.validUntil);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Deviz · versiunea {v.versionNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            {STATUS_LABELS[v.status]}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {docNumber} · v{v.versionNumber} · {STATUS_LABELS[v.status]} · emis: {issueDate} · valabil până la: {validUntil}
          </p>
        </div>
        <QuoteVersionActions quoteId={id} versionId={v.id} status={v.status} />
      </div>

      {/* Snapshot header */}
      <div className="rounded-lg border bg-card p-4 text-sm">
        <div className="font-medium">{v.projectName ?? "Proiect"}</div>
        {v.customerName && (
          <div className="text-muted-foreground">{v.customerName}</div>
        )}
        {v.customerEmail && (
          <div className="text-muted-foreground">{v.customerEmail}</div>
        )}
        {v.customerPhone && (
          <div className="text-muted-foreground">{v.customerPhone}</div>
        )}
        {v.projectAddress && (
          <div className="text-muted-foreground">{v.projectAddress}</div>
        )}
      </div>

      {/* Items */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Denumire</th>
              <th className="px-3 py-2 text-right">Cant.</th>
              <th className="px-3 py-2">Unit.</th>
              <th className="px-3 py-2 text-right">Preț</th>
              <th className="px-3 py-2 text-right">Red.</th>
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {v.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-muted-foreground">
                  Niciun articol.
                </td>
              </tr>
            )}
            {v.items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <div className="font-medium">{item.name}</div>
                  {item.description && (
                    <div className="text-muted-foreground">
                      {item.description}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {item.quantity}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {UNIT_LABELS[item.unit]}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(item.unitPrice, v.currency)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {item.discountPct}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(item.lineTotal, v.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <dl className="ml-auto max-w-xs space-y-1 text-sm tabular-nums">
        <Row label="Subtotal" value={formatMoney(v.subtotal, v.currency)} />
        <Row
          label={`Reducere (${v.discountPct}%)`}
          value={`− ${formatMoney(v.discountAmount, v.currency)}`}
        />
        <Row label="Bază TVA" value={formatMoney(v.taxableAmount, v.currency)} />
        <Row
          label={`TVA (${v.vatRate}%)`}
          value={formatMoney(v.vatAmount, v.currency)}
        />
        <div className="flex justify-between border-t pt-1 text-base font-semibold">
          <dt>Total</dt>
          <dd>{formatMoney(v.total, v.currency)}</dd>
        </div>
      </dl>

      {v.notes && (
        <div className="rounded-lg border bg-card p-4 text-sm">
          <div className="mb-1 font-medium">Note</div>
          <p className="whitespace-pre-wrap text-muted-foreground">{v.notes}</p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
