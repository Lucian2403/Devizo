"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MissingInformationField } from "@/domain/ai/extraction.types";

function hasValue(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

function isPositiveNumber(value: unknown): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function isMissingFieldValid(
  field: MissingInformationField,
  value: unknown,
): boolean {
  if (!field.required && !hasValue(value)) return true;
  if (!field.required && hasValue(value) === false) return true;

  if (field.inputType === "number") return isPositiveNumber(value);
  if (field.inputType === "boolean") {
    if (typeof value === "boolean") return true;
    const normalized = String(value).trim().toLowerCase();
    return ["true", "false", "da", "nu", "yes", "no", "1", "0"].includes(normalized);
  }
  if (field.inputType === "select") {
    const text = String(value ?? "").trim();
    if (text.length === 0) return false;
    if (field.options.length === 0) return true;
    return field.options.some((option) => option.value === text);
  }
  return String(value ?? "").trim().length > 0;
}

export function MissingInformationPanel({
  fields,
  values,
  legacyNotes,
  pending,
  onValueChange,
  onRecalculate,
}: {
  fields: MissingInformationField[];
  values: Record<string, string | number | boolean>;
  legacyNotes: string[];
  pending: boolean;
  onValueChange: (fieldId: string, value: string | number | boolean) => void;
  onRecalculate: () => void;
}) {
  if (fields.length === 0 && legacyNotes.length === 0) return null;

  const requiredFields = fields.filter((field) => field.required);
  const optionalFields = fields.filter((field) => !field.required);
  const canRecalculate = requiredFields.every((field) =>
    isMissingFieldValid(field, values[field.id]),
  );

  const renderField = (field: MissingInformationField) => {
    const value = values[field.id];
    const invalid = field.required && !isMissingFieldValid(field, value);

    if (field.inputType === "select") {
      return (
        <div key={field.id} className="space-y-1">
          <label className="text-[12px] font-medium text-secondary-foreground">
            {field.label}
            {!field.required && (
              <span className="ml-1 text-[11px] text-muted-foreground">(opțional)</span>
            )}
          </label>
          <select
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onValueChange(field.id, event.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
          >
            <option value="">Selectează…</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {invalid && (
            <p className="text-[11px] text-status-error-fg">Completează acest câmp.</p>
          )}
        </div>
      );
    }

    if (field.inputType === "boolean") {
      return (
        <div key={field.id} className="space-y-1">
          <label className="text-[12px] font-medium text-secondary-foreground">
            {field.label}
            {!field.required && (
              <span className="ml-1 text-[11px] text-muted-foreground">(opțional)</span>
            )}
          </label>
          <select
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onValueChange(field.id, event.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
          >
            <option value="">Selectează…</option>
            {field.options.length > 0 ? (
              field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            ) : (
              <>
                <option value="true">Da</option>
                <option value="false">Nu</option>
              </>
            )}
          </select>
          {invalid && (
            <p className="text-[11px] text-status-error-fg">Completează acest câmp.</p>
          )}
        </div>
      );
    }

    return (
      <div key={field.id} className="space-y-1">
        <label className="text-[12px] font-medium text-secondary-foreground">
          {field.label}
          {!field.required && (
            <span className="ml-1 text-[11px] text-muted-foreground">(opțional)</span>
          )}
        </label>
        <div className="flex h-9 overflow-hidden rounded-md border border-border bg-background">
          <Input
            type={field.inputType === "number" ? "number" : "text"}
            inputMode={field.inputType === "number" ? "decimal" : "text"}
            value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
            onChange={(event) => onValueChange(field.id, event.target.value)}
            placeholder={field.question}
            className="h-9 rounded-none border-0"
          />
          {field.unit && (
            <span className="inline-flex items-center border-l border-border px-2 text-[12px] text-muted-foreground">
              {field.unit}
            </span>
          )}
        </div>
        {invalid && (
          <p className="text-[11px] text-status-error-fg">Completează acest câmp.</p>
        )}
      </div>
    );
  };

  return (
    <section className="rounded-lg border border-status-warn-dot/35 bg-status-warn-bg p-3">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="pt-0.5 text-status-warn-dot">⚠</span>
        <div>
          <h4 className="text-[14px] font-semibold text-heading">
            {fields.length} informații necesare înainte de calculul final
          </h4>
          <p className="text-[12px] text-muted-foreground">
            Devizo are nevoie de câteva detalii pentru a putea calcula exact.
          </p>
        </div>
      </div>

      {requiredFields.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {requiredFields.map(renderField)}
        </div>
      )}

      {optionalFields.length > 0 && (
        <div className="mt-2.5">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Opțional
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {optionalFields.map(renderField)}
          </div>
        </div>
      )}

      {legacyNotes.length > 0 && (
        <div className="mt-2.5 rounded-md border border-status-warn-dot/25 bg-white/60 p-2">
          <p className="text-[12px] font-medium text-secondary-foreground">
            Informații neacționabile încă
          </p>
          <ul className="list-disc pl-4 text-[12px] text-muted-foreground">
            {legacyNotes.map((note, index) => (
              <li key={`${note}-${index}`}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={onRecalculate}
          disabled={!canRecalculate || pending}
        >
          {pending ? "Se recalculează…" : "Completează și recalculează"}
        </Button>
      </div>
    </section>
  );
}
