"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { UNIT_LABELS } from "@/lib/i18n/units";
import { formatMoney } from "@/lib/i18n/money";
import type { SupportedUnit } from "@/domain/shared/types";
import type {
  ExtractionResult,
  MatchedItem,
} from "@/domain/ai/extraction.types";
import { extractFromText } from "../../ai-actions";

// A line the assistant hands back to the editor once the user confirms.
export interface AssistantLine {
  catalogItemId: string | null;
  name: string;
  description: string | null;
  unit: SupportedUnit;
  unitPrice: string;
  quantity: string;
}

// A per-item review decision the user makes before confirming.
interface RowDecision {
  include: boolean;
  // "" means manual (no catalog match); otherwise a catalog item id.
  catalogItemId: string;
  quantity: string;
  manualPrice: string;
}

const MATCH_LABELS: Record<MatchedItem["status"], string> = {
  matched: "Potrivit",
  review: "Verifică",
  low: "Nesigur",
  unmatched: "Fără potrivire",
};

const MATCH_CLASSES: Record<MatchedItem["status"], string> = {
  matched: "bg-emerald-100 text-emerald-700",
  review: "bg-amber-100 text-amber-800",
  low: "bg-slate-100 text-slate-600",
  unmatched: "bg-slate-100 text-slate-600",
};

export function AiAssistant({
  currency,
  onConfirm,
  initialText = "",
  autoOpen = false,
}: {
  currency: string;
  onConfirm: (lines: AssistantLine[]) => void;
  initialText?: string;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [decisions, setDecisions] = useState<RowDecision[]>([]);
  const [pending, startTransition] = useTransition();

  function analyze() {
    setError(null);
    startTransition(async () => {
      const res = await extractFromText(text);
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        setDecisions([]);
        return;
      }
      setResult(res.result);
      // Seed decisions. Only HIGH/MEDIUM preselect a catalog item; LOW and
      // NO_MATCH leave the catalog empty so the user chooses deliberately.
      // Quantity stays empty when the user didn't state one (never defaulted to 1).
      setDecisions(
        res.result.items.map((m) => ({
          include: m.status !== "unmatched",
          catalogItemId: m.suggestedCatalogItemId ?? "",
          quantity: m.item.quantity ?? "",
          manualPrice: "",
        })),
      );
    });
  }

  function updateDecision(index: number, patch: Partial<RowDecision>) {
    setDecisions((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }

  function confirm() {
    if (!result) return;
    const lines: AssistantLine[] = [];

    result.items.forEach((matched, index) => {
      const decision = decisions[index]!;
      if (!decision.include) return;

      const candidate = matched.candidates.find(
        (c) => c.catalogItemId === decision.catalogItemId,
      );

      if (candidate) {
        // Catalog match: price and unit come from the authoritative catalog.
        lines.push({
          catalogItemId: candidate.catalogItemId,
          name: candidate.name,
          description: matched.item.description || null,
          unit: candidate.unit,
          unitPrice: candidate.sellingPrice,
          quantity: decision.quantity || "1",
        });
      } else {
        // Manual line: no catalog price, user provides it explicitly.
        lines.push({
          catalogItemId: null,
          name: matched.item.description || matched.item.concept,
          description: null,
          unit: matched.item.unit ?? "pcs",
          unitPrice: decision.manualPrice.trim() || "0",
          quantity: decision.quantity || "1",
        });
      }
    });

    onConfirm(lines);
    reset();
  }

  function reset() {
    setOpen(false);
    setText("");
    setError(null);
    setResult(null);
    setDecisions([]);
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        ✨ Asistent AI
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Asistent AI</h3>
        <button
          type="button"
          onClick={reset}
          className="text-sm text-muted-foreground hover:underline"
        >
          Închide
        </button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ai-text">Descrie lucrarea</Label>
        <Textarea
          id="ai-text"
          rows={4}
          value={text}
          placeholder="Ex: dat jos gresia veche în baie, cca 18 m2, montat faianță nouă pe pereți..."
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button type="button" onClick={analyze} disabled={pending}>
            {pending && <Spinner />}
            {pending ? "Se analizează…" : "Analizează"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Prețurile vin din catalog sau le introduci manual.
          </span>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {result && (
        <div className="space-y-4 border-t pt-4">
          {result.items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nu am identificat lucrări. Reformulează și încearcă din nou.
            </p>
          )}

          {result.items.map((matched, index) => {
            const decision = decisions[index]!;
            return (
              <div key={index} className="rounded-lg border bg-background/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <label className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={decision.include}
                      onChange={(e) =>
                        updateDecision(index, { include: e.target.checked })
                      }
                    />
                    <span>
                      <span className="font-medium">
                        {matched.item.description || matched.item.concept}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        „{matched.item.rawText}"
                      </span>
                    </span>
                  </label>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${MATCH_CLASSES[matched.status]}`}
                  >
                    {MATCH_LABELS[matched.status]}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <Label className="text-xs">Cantitate</Label>
                    <Input
                      inputMode="decimal"
                      value={decision.quantity}
                      onChange={(e) =>
                        updateDecision(index, { quantity: e.target.value })
                      }
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <Label className="text-xs">Sursă preț</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={decision.catalogItemId}
                      onChange={(e) =>
                        updateDecision(index, { catalogItemId: e.target.value })
                      }
                    >
                      {matched.candidates.map((c) => (
                        <option key={c.catalogItemId} value={c.catalogItemId}>
                          {c.name} · {formatMoney(c.sellingPrice, currency)} /{" "}
                          {UNIT_LABELS[c.unit]}
                        </option>
                      ))}
                      <option value="">Manual (preț introdus)</option>
                    </select>
                  </div>
                </div>

                {decision.catalogItemId === "" && (
                  <div className="mt-2">
                    <Label className="text-xs">Preț unitar (manual)</Label>
                    <Input
                      inputMode="decimal"
                      value={decision.manualPrice}
                      placeholder="0"
                      onChange={(e) =>
                        updateDecision(index, { manualPrice: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}

          {(result.assumptions.length > 0 ||
            result.missingInformation.length > 0) && (
            <div className="space-y-2 rounded-lg border border-dashed bg-muted/20 p-3 text-sm">
              {result.missingInformation.length > 0 && (
                <div>
                  <div className="font-medium">Lipsește</div>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {result.missingInformation.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.assumptions.length > 0 && (
                <div>
                  <div className="font-medium">Presupuneri</div>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {result.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {result.items.length > 0 && (
            <Button type="button" onClick={confirm}>
              Adaugă în deviz
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
