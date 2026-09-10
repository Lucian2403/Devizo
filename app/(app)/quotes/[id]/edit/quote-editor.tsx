"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { UNIT_LABELS, UNIT_OPTIONS } from "@/lib/i18n/units";
import { formatMoney } from "@/lib/i18n/money";
import type { SupportedUnit } from "@/domain/shared/types";
import {
  saveDraft,
  searchCatalog,
  type CatalogSearchResult,
  type SaveDraftState,
} from "../../actions";
import { AiAssistant, type AssistantLine } from "./ai-assistant";

// One editable line in the client. All money/quantities are kept as strings so
// the exact value the user typed reaches the server unchanged.
interface EditorLine {
  key: string;
  catalogItemId: string | null;
  name: string;
  description: string | null;
  unit: SupportedUnit;
  unitPrice: string;
  quantity: string;
  discountPct: string;
}

interface QuoteEditorProps {
  quoteId: string;
  versionId: string;
  currency: string;
  vatRate: string;
  snapshot: {
    customerName: string | null;
    projectName: string | null;
    projectAddress: string | null;
  };
  initial: {
    notes: string | null;
    validityDays: number | null;
    discountPct: string;
    items: {
      catalogItemId: string | null;
      name: string;
      description: string | null;
      unit: SupportedUnit;
      unitPrice: string;
      quantity: string;
      discountPct: string;
    }[];
  };
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `line-${keyCounter}`;
}

// A safe float parse for the live preview only. The server recomputes all
// totals with decimal.js on save, so this is display-only.
function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function QuoteEditor({
  quoteId,
  versionId,
  currency,
  vatRate,
  snapshot,
  initial,
}: QuoteEditorProps) {
  const [lines, setLines] = useState<EditorLine[]>(() =>
    initial.items.map((item) => ({ key: nextKey(), ...item })),
  );
  const [discountPct, setDiscountPct] = useState(initial.discountPct);
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [validityDays, setValidityDays] = useState(
    initial.validityDays != null ? String(initial.validityDays) : "",
  );

  const saveWithId = saveDraft.bind(null, versionId);
  const [state, formAction, isPending] = useActionState<
    SaveDraftState,
    FormData
  >(saveWithId, null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const saveStatus = isPending
    ? { label: "Se salvează...", tone: "neutral" as const }
    : state && "error" in state
      ? { label: "Salvarea a eșuat", tone: "warn" as const }
      : state && "ok" in state
        ? { label: "Salvat", tone: "ok" as const }
        : hasUnsavedChanges
          ? { label: "Modificări nesalvate", tone: "warn" as const }
          : { label: "Salvat", tone: "ok" as const };

  useEffect(() => {
    if (state && "ok" in state) {
      setHasUnsavedChanges(false);
    }
  }, [state]);

  // One-time AI prefill handed over from the home page "start with AI" card.
  // Read from sessionStorage on mount, then clear it so refreshes stay clean.
  const [aiPrefill, setAiPrefill] = useState("");
  useEffect(() => {
    const stored = sessionStorage.getItem("ai_prefill");
    if (stored) {
      setAiPrefill(stored);
      sessionStorage.removeItem("ai_prefill");
    }
  }, []);

  // --- Live preview totals (display only) ---------------------------------
  const preview = useMemo(() => {
    const lineTotals = lines.map((l) => {
      const gross = num(l.unitPrice) * num(l.quantity);
      return gross * (1 - num(l.discountPct) / 100);
    });
    const subtotal = lineTotals.reduce((s, t) => s + t, 0);
    const discountAmount = subtotal * (num(discountPct) / 100);
    const taxable = subtotal - discountAmount;
    const vatAmount = taxable * (num(vatRate) / 100);
    const total = taxable + vatAmount;
    return { lineTotals, subtotal, discountAmount, taxable, vatAmount, total };
  }, [lines, discountPct, vatRate]);

  function updateLine(key: string, patch: Partial<EditorLine>) {
    setHasUnsavedChanges(true);
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(key: string) {
    setHasUnsavedChanges(true);
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function addManualLine() {
    setHasUnsavedChanges(true);
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        catalogItemId: null,
        name: "",
        description: null,
        unit: "pcs",
        unitPrice: "0",
        quantity: "1",
        discountPct: "0",
      },
    ]);
  }

  function addCatalogLine(item: CatalogSearchResult) {
    // Currency safety: a catalog item priced in another currency must never
    // enter this quote as if its number were in the quote's currency. The
    // picker already blocks these, but guard here too (no silent conversion).
    if (item.currency !== currency) return;
    setHasUnsavedChanges(true);
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        catalogItemId: item.id,
        name: item.name,
        description: null,
        unit: item.unit,
        unitPrice: item.sellingPrice,
        quantity: "1",
        discountPct: "0",
      },
    ]);
  }

  // Appends confirmed AI-assistant rows as editor lines. The user already
  // reviewed each one; prices came from the catalog or explicit manual input.
  function addAssistantLines(assistantLines: AssistantLine[]) {
    if (assistantLines.length === 0) return;
    setHasUnsavedChanges(true);
    setLines((prev) => [
      ...prev,
      ...assistantLines.map((l) => ({
        key: nextKey(),
        catalogItemId: l.catalogItemId,
        name: l.name,
        description: l.description,
        unit: l.unit,
        unitPrice: l.unitPrice,
        quantity: l.quantity,
        discountPct: "0",
      })),
    ]);
  }

  // The items payload is serialized as JSON in a hidden field on submit.
  const itemsJson = JSON.stringify(
    lines.map((l) => ({
      catalogItemId: l.catalogItemId ?? undefined,
      name: l.name,
      description: l.description ?? undefined,
      unit: l.unit,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      discountPct: l.discountPct,
    })),
  );

  const lineCount = lines.length;

  return (
    <div className="flex flex-col xl:flex-row">
      {/* Main content column */}
      <div className="min-w-0 flex-1 px-6 py-5 xl:max-w-[950px]">
        {/* Breadcrumb + project header */}
        <nav className="mb-1 text-[12.5px] text-muted-foreground">
          <Link href="/projects" className="hover:text-heading">
            Proiecte
          </Link>
          <span className="mx-1.5">›</span>
          <span className="text-secondary-foreground">
            {snapshot.projectName ?? "Proiect"}
          </span>
        </nav>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-semibold leading-tight text-heading">
              {snapshot.projectName ?? "Deviz nou"}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {[snapshot.customerName, snapshot.projectAddress]
                .filter(Boolean)
                .join(" · ") || "Fără client"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 pt-1">
            <StatusPill tone="neutral">Schiță</StatusPill>
            <StatusPill tone={saveStatus.tone}>{saveStatus.label}</StatusPill>
            <Link
              href={`/quotes/${quoteId}`}
              className="text-muted-foreground transition-colors hover:text-heading"
              aria-label="Închide"
            >
              ⋯
            </Link>
          </div>
        </div>

        {/* Section tabs */}
        <div className="mt-4 flex gap-1 border-b border-border">
          {[
            { label: "Deviz", active: true, disabled: false },
            { label: "Documente", active: false, disabled: true },
            { label: "Notițe", active: false, disabled: true },
            { label: "Activitate", active: false, disabled: true },
          ].map((tab) => (
            <span
              key={tab.label}
              aria-disabled={tab.disabled}
              className={
                tab.active
                  ? "relative px-3 pb-2.5 text-[13.5px] font-medium text-heading after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
                  : tab.disabled
                    ? "cursor-not-allowed px-3 pb-2.5 text-[13.5px] font-medium text-muted-foreground opacity-60"
                    : "cursor-default px-3 pb-2.5 text-[13.5px] font-medium text-muted-foreground"
              }
            >
              {tab.label}
            </span>
          ))}
        </div>

        <div className="space-y-5 pt-5">
          {/* AI describe/analyze card */}
          <AiAssistant
            currency={currency}
            onConfirm={addAssistantLines}
            initialText={aiPrefill}
            autoOpen={aiPrefill.length > 0}
          />

          {/* Identified works */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-heading">
                  Lucrări în deviz
                </h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-secondary-foreground">
                  {lineCount} {lineCount === 1 ? "lucrare" : "lucrări"}
                </span>
              </div>
              <button
                type="button"
                onClick={addManualLine}
                className="text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
              >
                + Adaugă lucrare
              </button>
            </div>

            <CatalogPicker onPick={addCatalogLine} currency={currency} />

            {/* Dense lines table */}
            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card shadow-card">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted-section text-left text-[12px] font-medium text-muted-foreground">
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Lucrare</th>
                    <th className="w-24 px-3 py-2 font-medium">Cantitate</th>
                    <th className="w-24 px-3 py-2 font-medium">UM</th>
                    <th className="w-28 px-3 py-2 font-medium">Preț unitar</th>
                    <th className="w-24 px-3 py-2 font-medium">Reducere</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">
                      Total
                    </th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-6 text-center text-[13px] text-muted-foreground"
                      >
                        Niciun articol. Caută în catalog sau adaugă o linie
                        manuală.
                      </td>
                    </tr>
                  )}
                  {lines.map((line, index) => (
                    <tr
                      key={line.key}
                      className="border-b border-border last:border-0 align-top hover:bg-muted-section/60"
                    >
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          value={line.name}
                          placeholder="Denumire"
                          onChange={(e) =>
                            updateLine(line.key, { name: e.target.value })
                          }
                          className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-medium text-heading hover:border-border focus:border-border-strong focus:bg-background focus:outline-none"
                        />
                        <input
                          value={line.description ?? ""}
                          placeholder="Descriere (opțional)"
                          onChange={(e) =>
                            updateLine(line.key, {
                              description: e.target.value || null,
                            })
                          }
                          className="mt-0.5 w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[12px] text-muted-foreground hover:border-border focus:border-border-strong focus:bg-background focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          inputMode="decimal"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.key, { quantity: e.target.value })
                          }
                          className="w-full rounded-md border border-border bg-background px-2 py-1 text-[13px] tabular-nums focus:border-border-strong focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          className="w-full rounded-md border border-border bg-background px-1.5 py-1 text-[13px]"
                          value={line.unit}
                          onChange={(e) =>
                            updateLine(line.key, {
                              unit: e.target.value as SupportedUnit,
                            })
                          }
                        >
                          {UNIT_OPTIONS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          inputMode="decimal"
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(line.key, { unitPrice: e.target.value })
                          }
                          className="w-full rounded-md border border-border bg-background px-2 py-1 text-[13px] tabular-nums focus:border-border-strong focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <input
                          inputMode="decimal"
                          value={line.discountPct}
                          onChange={(e) =>
                            updateLine(line.key, {
                              discountPct: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-border bg-background px-2 py-1 text-[13px] tabular-nums focus:border-border-strong focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-heading">
                        {formatMoney(
                          preview.lineTotals[index]!.toFixed(2),
                          currency,
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          aria-label="Șterge"
                          className="text-muted-foreground transition-colors hover:text-status-error-fg"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky right column */}
      <aside className="w-full border-t border-border bg-muted-section px-6 py-5 xl:w-[360px] xl:border-l xl:border-t-0">
        <div className="xl:sticky xl:top-20 space-y-4">
          {/* Deviz summary */}
          <form
            action={formAction}
            className="rounded-lg border border-border bg-card p-4 shadow-card"
          >
            <input type="hidden" name="items" value={itemsJson} />
            <input type="hidden" name="discountPct" value={discountPct} />
            <input type="hidden" name="validityDays" value={validityDays} />
            <input type="hidden" name="notes" value={notes} />

            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-heading">Deviz</h2>
              <StatusPill tone="neutral">Schiță</StatusPill>
            </div>

            <dl className="space-y-2 text-[13px] tabular-nums">
              <Row
                label="Subtotal"
                value={formatMoney(preview.subtotal.toFixed(2), currency)}
              />
              <Row
                label="Reducere"
                value={`− ${formatMoney(preview.discountAmount.toFixed(2), currency)}`}
              />
              <Row
                label={`TVA (${vatRate}%)`}
                value={formatMoney(preview.vatAmount.toFixed(2), currency)}
              />
              <div className="flex justify-between border-t border-border pt-2.5 text-[16px] font-semibold text-heading">
                <dt>Total</dt>
                <dd>{formatMoney(preview.total.toFixed(2), currency)}</dd>
              </div>
            </dl>

            {state && "error" in state && (
              <p className="mt-3 text-[12.5px] text-status-error-fg">
                {state.error}
              </p>
            )}
            <p
              aria-live="polite"
              className={
                isPending
                  ? "mt-3 text-[12.5px] text-muted-foreground"
                  : state && "error" in state
                    ? "mt-3 text-[12.5px] text-status-error-fg"
                    : "mt-3 text-[12.5px] text-status-ok-fg"
              }
            >
              {isPending ? "Se salvează..." : saveStatus.label}
            </p>

            <div className="mt-4 space-y-2">
              <SubmitButton className="w-full" pendingLabel="Se salvează…">
                {hasUnsavedChanges ? "Salvează modificările" : "Salvează schița"}
              </SubmitButton>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled
                aria-disabled="true"
              >
                Descarcă PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled
                aria-disabled="true"
              >
                Trimite clientului
              </Button>
            </div>
          </form>

          {/* Detalii ofertă */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <h3 className="mb-3 text-[14px] font-semibold text-heading">
              Detalii ofertă
            </h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="discountPct" className="text-[12px]">
                  Reducere deviz %
                </Label>
                <Input
                  id="discountPct"
                  inputMode="decimal"
                  value={discountPct}
                  onChange={(e) => {
                    setHasUnsavedChanges(true);
                    setDiscountPct(e.target.value);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="validityDays" className="text-[12px]">
                  Valabilitate ofertă (zile)
                </Label>
                <Input
                  id="validityDays"
                  inputMode="numeric"
                  value={validityDays}
                  onChange={(e) => {
                    setHasUnsavedChanges(true);
                    setValidityDays(e.target.value);
                  }}
                />
              </div>
              <div>
                <Label htmlFor="notes" className="text-[12px]">
                  Note
                </Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Termeni, condiții de plată…"
                  value={notes}
                  onChange={(e) => {
                    setHasUnsavedChanges(true);
                    setNotes(e.target.value);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Informații proiect */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <h3 className="mb-3 text-[14px] font-semibold text-heading">
              Informații proiect
            </h3>
            <dl className="space-y-2 text-[13px]">
              <InfoRow label="Client" value={snapshot.customerName} />
              <InfoRow label="Adresă" value={snapshot.projectAddress} />
              <InfoRow label="Proiect" value={snapshot.projectName} />
            </dl>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-heading">{value}</dd>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-heading">{value || "—"}</dd>
    </div>
  );
}

// Search-as-you-type catalog picker. Never renders the full catalog; it queries
// the server (debounced) and shows a small result list, so it stays fast for
// large catalogs and works on mobile.
function CatalogPicker({
  onPick,
  currency,
}: {
  onPick: (item: CatalogSearchResult) => void;
  currency: string;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<CatalogSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const handle = setTimeout(async () => {
      const items = await searchCatalog(trimmed);
      // Ignore out-of-order responses.
      if (id === requestId.current) {
        setResults(items);
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [term]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          id="catalog-search"
          value={term}
          placeholder="Caută în catalog (min. 2 caractere)…"
          onChange={(e) => setTerm(e.target.value)}
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner />
          </div>
        )}
      </div>
      {results.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border bg-card shadow-card">
          {results.map((item) => {
            const mismatch = item.currency !== currency;
            if (mismatch) {
              return (
                <li key={item.id}>
                  <div className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] opacity-60">
                    <span>
                      <span className="font-medium text-heading">{item.name}</span>
                      {item.code && (
                        <span className="ml-2 text-muted-foreground">
                          {item.code}
                        </span>
                      )}
                      <span className="ml-2 text-muted-foreground">
                        / {UNIT_LABELS[item.unit]}
                      </span>
                    </span>
                    <span className="text-right text-[12px] text-amber-700">
                      Monedă diferită ({item.currency}) — nu poate fi adăugat în
                      acest deviz ({currency})
                    </span>
                  </div>
                </li>
              );
            }
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-muted-section"
                  onClick={() => {
                    onPick(item);
                    setTerm("");
                    setResults([]);
                  }}
                >
                  <span>
                    <span className="font-medium text-heading">{item.name}</span>
                    {item.code && (
                      <span className="ml-2 text-muted-foreground">
                        {item.code}
                      </span>
                    )}
                    <span className="ml-2 text-muted-foreground">
                      / {UNIT_LABELS[item.unit]}
                    </span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatMoney(item.sellingPrice, currency)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
