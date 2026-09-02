"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { Spinner } from "@/components/ui/spinner";
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
  const [state, formAction] = useActionState<SaveDraftState, FormData>(
    saveWithId,
    null,
  );

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
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function addManualLine() {
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Editează deviz</h1>
        <Link
          href={`/quotes/${quoteId}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          Închide
        </Link>
      </div>

      {/* Snapshot header: who/what the quote is for. */}
      <div className="rounded-lg border bg-card p-4 text-sm">
        <div className="font-medium">{snapshot.projectName ?? "Proiect"}</div>
        {snapshot.customerName && (
          <div className="text-muted-foreground">{snapshot.customerName}</div>
        )}
        {snapshot.projectAddress && (
          <div className="text-muted-foreground">{snapshot.projectAddress}</div>
        )}
      </div>

      <AiAssistant
        currency={currency}
        onConfirm={addAssistantLines}
        initialText={aiPrefill}
        autoOpen={aiPrefill.length > 0}
      />

      <CatalogPicker onPick={addCatalogLine} currency={currency} />

      {/* Lines table */}
      <div className="space-y-3">
        {lines.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Niciun articol. Caută în catalog sau adaugă o linie manuală.
          </p>
        )}
        {lines.map((line, index) => (
          <div key={line.key} className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  value={line.name}
                  placeholder="Denumire"
                  onChange={(e) => updateLine(line.key, { name: e.target.value })}
                />
                <Textarea
                  value={line.description ?? ""}
                  placeholder="Descriere (opțional)"
                  rows={1}
                  onChange={(e) =>
                    updateLine(line.key, {
                      description: e.target.value || null,
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-destructive"
                onClick={() => removeLine(line.key)}
              >
                Șterge
              </Button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <div>
                <Label className="text-xs">Cantitate</Label>
                <Input
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(line.key, { quantity: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Unitate</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
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
              </div>
              <div>
                <Label className="text-xs">Preț unitar</Label>
                <Input
                  inputMode="decimal"
                  value={line.unitPrice}
                  onChange={(e) =>
                    updateLine(line.key, { unitPrice: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Reducere %</Label>
                <Input
                  inputMode="decimal"
                  value={line.discountPct}
                  onChange={(e) =>
                    updateLine(line.key, { discountPct: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Total linie</Label>
                <div className="flex h-10 items-center justify-end px-1 text-sm tabular-nums">
                  {formatMoney(preview.lineTotals[index]!.toFixed(2), currency)}
                </div>
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addManualLine}>
          + Linie manuală
        </Button>
      </div>

      {/* Totals + version-level fields, submitted together. */}
      <form action={formAction} className="space-y-4 rounded-lg border bg-card p-4">
        <input type="hidden" name="items" value={itemsJson} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="discountPct">Reducere deviz %</Label>
            <Input
              id="discountPct"
              name="discountPct"
              inputMode="decimal"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="validityDays">Valabilitate (zile)</Label>
            <Input
              id="validityDays"
              name="validityDays"
              inputMode="numeric"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="notes">Note</Label>
          <Textarea
            id="notes"
            name="notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Preview totals — server recomputes on save. */}
        <dl className="space-y-1 border-t pt-3 text-sm tabular-nums">
          <Row label="Subtotal" value={formatMoney(preview.subtotal.toFixed(2), currency)} />
          <Row
            label="Reducere"
            value={`− ${formatMoney(preview.discountAmount.toFixed(2), currency)}`}
          />
          <Row
            label={`TVA (${vatRate}%)`}
            value={formatMoney(preview.vatAmount.toFixed(2), currency)}
          />
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <dt>Total</dt>
            <dd>{formatMoney(preview.total.toFixed(2), currency)}</dd>
          </div>
        </dl>

        {state && "error" in state && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state && "ok" in state && (
          <p className="text-sm text-green-600">Salvat.</p>
        )}

        <SubmitButton pendingLabel="Se salvează…">Salvează schița</SubmitButton>
      </form>
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
      <Label htmlFor="catalog-search">Caută în catalog</Label>
      <div className="relative">
        <Input
          id="catalog-search"
          value={term}
          placeholder="Scrie cel puțin 2 caractere…"
          onChange={(e) => setTerm(e.target.value)}
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner />
          </div>
        )}
      </div>
      {results.length > 0 && (
        <ul className="divide-y rounded-md border bg-card">
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                onClick={() => {
                  onPick(item);
                  setTerm("");
                  setResults([]);
                }}
              >
                <span>
                  <span className="font-medium">{item.name}</span>
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
          ))}
        </ul>
      )}
    </div>
  );
}
