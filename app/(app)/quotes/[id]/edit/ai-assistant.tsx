"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { StatusPill } from "@/components/ui/status-pill";
import { UNIT_LABELS } from "@/lib/i18n/units";
import { formatMoney } from "@/lib/i18n/money";
import type { SupportedUnit } from "@/domain/shared/types";
import type {
  ExtractionResult,
  MatchedItem,
} from "@/domain/ai/extraction.types";
import {
  extractFromText,
  recalculateFromMissingInformation,
  recordMatchFeedback,
} from "../../ai-actions";
import { VoiceRecorder } from "./voice-recorder";
import { MissingInformationPanel } from "./missing-information-panel";

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

const MATCH_TONES: Record<MatchedItem["status"], "ok" | "warn" | "neutral"> = {
  matched: "ok",
  review: "warn",
  low: "neutral",
  unmatched: "neutral",
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
  const [missingValues, setMissingValues] = useState<
    Record<string, string | number | boolean>
  >({});
  const [pending, startTransition] = useTransition();
  const [recalcPending, startRecalcTransition] = useTransition();

  function seedDecisions(
    nextResult: ExtractionResult,
    previousResult?: ExtractionResult | null,
    previousDecisions?: RowDecision[],
  ) {
    if (!previousResult || !previousDecisions) {
      return nextResult.items.map((m) => ({
        include: m.status !== "unmatched",
        catalogItemId: m.suggestedCatalogItemId ?? "",
        quantity: m.item.quantity ?? "",
        manualPrice: "",
      }));
    }

    const previousByItemId = new Map(
      previousResult.items.map((m, index) => [m.item.id, previousDecisions[index]]),
    );

    return nextResult.items.map((m) => {
      const prev = previousByItemId.get(m.item.id);
      if (!prev) {
        return {
          include: m.status !== "unmatched",
          catalogItemId: m.suggestedCatalogItemId ?? "",
          quantity: m.item.quantity ?? "",
          manualPrice: "",
        };
      }
      const candidateIds = new Set(m.candidates.map((c) => c.catalogItemId));
      const catalogItemId = candidateIds.has(prev.catalogItemId)
        ? prev.catalogItemId
        : m.suggestedCatalogItemId ?? "";
      return {
        include: prev.include,
        catalogItemId,
        quantity: prev.quantity || m.item.quantity || "",
        manualPrice: prev.manualPrice,
      };
    });
  }

  function analyze() {
    setError(null);
    startTransition(async () => {
      const res = await extractFromText(text, currency);
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        setDecisions([]);
        setMissingValues({});
        return;
      }
      setResult(res.result);
      setDecisions(seedDecisions(res.result));
      setMissingValues({});
    });
  }

  function recalculateMissingInformation() {
    if (!result) return;
    const previousResult = result;
    setError(null);
    startRecalcTransition(async () => {
      const res = await recalculateFromMissingInformation({
        result: previousResult,
        values: missingValues,
        currency,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDecisions((previousDecisions) =>
        seedDecisions(res.result, previousResult, previousDecisions),
      );
      setResult(res.result);
      setMissingValues((previous) => {
        const allowed = new Set(res.result.missingInformation.map((f) => f.id));
        const next: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(previous)) {
          if (allowed.has(key)) next[key] = value;
        }
        return next;
      });
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

      // Capture feedback whenever the final choice differs from what the
      // assistant suggested (including the user picking "manual"/no match, or
      // skipping the item). Best-effort, fire-and-forget — never blocks confirm.
      const suggested = matched.suggestedCatalogItemId ?? null;
      const selected =
        decision.include && decision.catalogItemId
          ? decision.catalogItemId
          : null;
      if (selected !== suggested) {
        void recordMatchFeedback({
          extractedText: matched.item.rawText,
          suggestedCatalogItemId: suggested,
          selectedCatalogItemId: selected,
        });
      }

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
    setMissingValues({});
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-heading">
              Descrie lucrările
            </h3>
            <p className="text-[12.5px] text-muted-foreground">
              Scrie sau dictează, iar AI pregătește devizul.
            </p>
          </div>
          <Button type="button" onClick={() => setOpen(true)}>
            Deschide asistentul
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-heading">
          Descrie lucrările
        </h3>
        <button
          type="button"
          onClick={reset}
          className="text-[12.5px] text-muted-foreground hover:text-heading"
        >
          Închide
        </button>
      </div>

      <div className="space-y-2">
        {/* Voice is just another way to fill this textarea. The transcript is
            appended and stays editable; analysis reuses the same text flow. */}
        <VoiceRecorder
          onTranscript={(transcript) => {
            setError(null);
            setText((prev) =>
              prev.trim().length > 0 ? `${prev}\n${transcript}` : transcript,
            );
          }}
        />
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
        <div className="space-y-2 border-t pt-3">
          {result.items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nu am identificat lucrări. Reformulează și încearcă din nou.
            </p>
          )}

          {result.items.map((matched, index) => {
            const decision = decisions[index]!;
            return (
              <div
                key={index}
                className="rounded-md border border-border bg-background/60 px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <label className="flex min-w-0 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={decision.include}
                      onChange={(e) =>
                        updateDecision(index, { include: e.target.checked })
                      }
                    />
                    <span className="min-w-0 truncate text-[13px]">
                      <span className="font-medium text-heading">
                        {matched.item.description || matched.item.concept}
                      </span>
                      <span className="ml-1.5 text-[12px] text-muted-foreground">
                        „{matched.item.rawText}"
                      </span>
                    </span>
                  </label>
                  <StatusPill tone={MATCH_TONES[matched.status]}>
                    {MATCH_LABELS[matched.status]}
                  </StatusPill>
                </div>

                {matched.item.specifications.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-6">
                    {matched.item.specifications.map((spec, i) => (
                      <span
                        key={i}
                        className="rounded bg-secondary px-1.5 py-0.5 text-[11px] text-secondary-foreground"
                      >
                        {spec}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-1.5 flex items-center gap-2 pl-6">
                  <input
                    inputMode="decimal"
                    value={decision.quantity}
                    placeholder="Cant."
                    onChange={(e) =>
                      updateDecision(index, { quantity: e.target.value })
                    }
                    className="h-8 w-20 rounded-md border border-border bg-background px-2 text-[13px] tabular-nums focus:border-border-strong focus:outline-none"
                  />
                  <select
                    className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[13px]"
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
                  {decision.catalogItemId === "" && (
                    <input
                      inputMode="decimal"
                      value={decision.manualPrice}
                      placeholder="Preț"
                      onChange={(e) =>
                        updateDecision(index, { manualPrice: e.target.value })
                      }
                      className="h-8 w-24 rounded-md border border-border bg-background px-2 text-[13px] tabular-nums focus:border-border-strong focus:outline-none"
                    />
                  )}
                </div>
              </div>
            );
          })}

          {result.assumptions.length > 0 && (
            <div className="rounded-md border border-border bg-secondary/40 p-2 text-[12px] text-muted-foreground">
              <p className="mb-1 font-medium text-secondary-foreground">Presupuneri</p>
              <ul className="list-disc pl-4">
                {result.assumptions.map((assumption, index) => (
                  <li key={`${assumption}-${index}`}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}

          <MissingInformationPanel
            fields={result.missingInformation}
            values={missingValues}
            legacyNotes={result.missingInformationText}
            pending={recalcPending}
            onValueChange={(fieldId, value) =>
              setMissingValues((previous) => ({ ...previous, [fieldId]: value }))
            }
            onRecalculate={recalculateMissingInformation}
          />

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
