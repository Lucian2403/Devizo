"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  IMPORT_FIELDS,
  type ImportField,
  type MappedRow,
} from "@/domain/catalog/import.service";
import { DECIMAL_FORMAT_EXAMPLES, type DecimalFormat } from "@/domain/catalog/money";
import { suggestUnit } from "@/domain/catalog/units";
import { SUPPORTED_UNITS, type SupportedUnit } from "@/domain/shared/types";
import { UNIT_LABELS } from "@/lib/i18n/units";
import { parseUpload, validateImport, runImport } from "./actions";
import type { ImportPreview, ImportResult } from "./types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

// Human labels for the mappable fields. Name, unit and selling price are needed.
const FIELD_LABELS: Record<ImportField, string> = {
  code: "Cod",
  name: "Denumire (obligatoriu)",
  description: "Descriere",
  unit: "Unitate (obligatoriu)",
  sellingPrice: "Preț de vânzare (obligatoriu)",
  costPrice: "Preț de cost",
  category: "Categorie",
};

type Step = "upload" | "map" | "preview" | "done";

export function ImportWizard() {
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parsed file.
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[] | null>(null);
  const [sheet, setSheet] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);

  // Mapping / options.
  const [mapping, setMapping] = useState<Record<ImportField, number>>(
    () => Object.fromEntries(IMPORT_FIELDS.map((f) => [f, -1])) as Record<ImportField, number>,
  );
  const [decimalFormat, setDecimalFormat] = useState<DecimalFormat>("dot");
  const [unitMapping, setUnitMapping] = useState<Record<string, SupportedUnit>>({});

  // Preview / confirm.
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [applyUpdates, setApplyUpdates] = useState(false);
  const [createCategories, setCreateCategories] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  // Distinct raw unit values from the chosen unit column, for unit mapping.
  const distinctUnits = useMemo(() => {
    const idx = mapping.unit;
    if (idx < 0) return [];
    const set = new Set<string>();
    for (const row of rows) {
      const raw = (row[idx] ?? "").trim();
      if (raw) set.add(raw);
    }
    return [...set];
  }, [mapping.unit, rows]);

  // Turn rows + column mapping into field-keyed rows for the server.
  function buildMappedRows(): MappedRow[] {
    return rows.map((row) => {
      const mapped: MappedRow = {};
      for (const field of IMPORT_FIELDS) {
        const idx = mapping[field];
        if (idx >= 0) mapped[field] = row[idx] ?? "";
      }
      return mapped;
    });
  }

  async function handleParse(withSheet?: string) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (withSheet) formData.set("sheet", withSheet);

      const res = await parseUpload(formData);

      if (res.status === "error") {
        setError(res.error);
        return;
      }
      if (res.status === "needs_sheet") {
        setSheets(res.sheets);
        return;
      }
      setHeaders(res.headers);
      setRows(res.rows);
      // Pre-fill unit mapping suggestions once rows are known.
      setStep("map");
    } catch {
      setError("Fișierul nu a putut fi citit. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  function setFieldMapping(field: ImportField, index: number) {
    setMapping((prev) => ({ ...prev, [field]: index }));
  }

  function setUnitFor(raw: string, unit: SupportedUnit) {
    setUnitMapping((prev) => ({ ...prev, [raw.toLowerCase()]: unit }));
  }

  // Effective canonical unit for a raw value: explicit choice or suggestion.
  function effectiveUnit(raw: string): SupportedUnit | "" {
    return unitMapping[raw.toLowerCase()] ?? suggestUnit(raw) ?? "";
  }

  async function handleValidate() {
    // Basic client guard: required columns must be mapped.
    if (mapping.name < 0 || mapping.unit < 0 || mapping.sellingPrice < 0) {
      setError("Mapează cel puțin Denumire, Unitate și Preț de vânzare.");
      return;
    }
    setError(null);
    setLoading(true);

    // Freeze the unit mapping using the effective (chosen or suggested) values.
    const frozenUnitMapping: Record<string, SupportedUnit> = {};
    for (const raw of distinctUnits) {
      const unit = effectiveUnit(raw);
      if (unit) frozenUnitMapping[raw.toLowerCase()] = unit;
    }
    setUnitMapping(frozenUnitMapping);

    try {
      const res = await validateImport({
        rows: buildMappedRows(),
        decimalFormat,
        unitMapping: frozenUnitMapping,
      });
      setPreview(res);
      setStep("preview");
    } catch {
      setError("Rândurile nu au putut fi validate. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    setError(null);
    try {
      const res = await runImport({
        rows: buildMappedRows(),
        decimalFormat,
        unitMapping,
        applyUpdates,
        createCategories,
      });
      setResult(res);
      setStep("done");
    } catch {
      setError("Importul a eșuat. Nicio modificare nu a fost salvată. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  // --- Render -------------------------------------------------------------

  if (step === "done" && result) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <h2 className="text-lg font-semibold">Import finalizat</h2>
          <ul className="space-y-1 text-sm">
            <li>Create: {result.created}</li>
            <li>Actualizate: {result.updated}</li>
            {result.skippedUpdates > 0 && (
              <li>Articole potrivite omise (neconfirmate): {result.skippedUpdates}</li>
            )}
            <li>Rânduri cu erori (neimportate): {result.errors}</li>
          </ul>
          <Button asChild>
            <Link href="/catalog">Înapoi la catalog</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Orice fișier CSV sau XLSX funcționează — îi mapezi coloanele în pasul
              următor. Nu ești sigur de structură?{" "}
              <a
                href="/devizo-catalog-template.csv"
                download
                className="font-medium text-accent underline"
              >
                Descarcă un exemplu CSV
              </a>
              .
            </p>
            <div className="space-y-2">
              <Label htmlFor="file">Fișier CSV sau XLSX (max 10 MB, 5.000 de rânduri)</Label>
              <input
                id="file"
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setSheets(null);
                }}
                className="block w-full text-sm"
              />
            </div>

            {sheets && (
              <div className="space-y-2">
                <Label htmlFor="sheet">Acest registru are mai multe foi. Alege una:</Label>
                <select
                  id="sheet"
                  value={sheet}
                  onChange={(e) => setSheet(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Selectează o foaie</option>
                  {sheets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Button
              onClick={() => handleParse(sheets ? sheet : undefined)}
              disabled={loading || !file || (sheets !== null && !sheet)}
            >
              {loading && <Spinner />}
              Continuă
            </Button>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="font-semibold">Mapează coloanele</h2>
              {IMPORT_FIELDS.map((field) => (
                <div key={field} className="grid grid-cols-2 items-center gap-4">
                  <Label>{FIELD_LABELS[field]}</Label>
                  <select
                    value={mapping[field]}
                    onChange={(e) => setFieldMapping(field, Number(e.target.value))}
                    className={selectClasses}
                  >
                    <option value={-1}>— Nemapat —</option>
                    {headers.map((header, index) => (
                      <option key={index} value={index}>
                        {header || `Coloana ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label>Formatul numerelor din fișier</Label>
              <select
                value={decimalFormat}
                onChange={(e) => setDecimalFormat(e.target.value as DecimalFormat)}
                className={selectClasses}
              >
                <option value="dot">1,234.56 (zecimală cu punct)</option>
                <option value="comma">1.234,56 (zecimală cu virgulă)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Exemplu: {DECIMAL_FORMAT_EXAMPLES[decimalFormat]}. Separatorii nu
                sunt niciodată ghiciți.
              </p>
            </div>

            {mapping.unit >= 0 && distinctUnits.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Mapează unitățile</h3>
                <p className="text-xs text-muted-foreground">
                  Fiecare valoare din fișier trebuie mapată la o unitate canonică.
                </p>
                {distinctUnits.map((raw) => (
                  <div key={raw} className="grid grid-cols-2 items-center gap-4">
                    <Label className="font-mono">{raw}</Label>
                    <select
                      value={effectiveUnit(raw)}
                      onChange={(e) => setUnitFor(raw, e.target.value as SupportedUnit)}
                      className={selectClasses}
                    >
                      <option value="">— Alege unitatea —</option>
                      {SUPPORTED_UNITS.map((u) => (
                        <option key={u} value={u}>
                          {UNIT_LABELS[u]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Înapoi
              </Button>
              <Button onClick={handleValidate} disabled={loading}>
                {loading && <Spinner />}
                Validează
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && preview && (
          <div className="space-y-4">
            <h2 className="font-semibold">Previzualizare</h2>
            <ul className="space-y-1 text-sm">
              <li>Total rânduri: {preview.totalRows}</li>
              <li>Articole noi de creat: {preview.createCount}</li>
              <li>Articole potrivite (după cod): {preview.updateCount}</li>
              <li>Rânduri cu erori: {preview.errorRows.length}</li>
            </ul>

            {preview.newCategoryNames.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Categorii noi în fișier: {preview.newCategoryNames.join(", ")}
              </p>
            )}

            {preview.errorRows.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-md border p-3 text-sm">
                <p className="mb-2 font-medium text-destructive">
                  Aceste rânduri vor fi omise:
                </p>
                <ul className="space-y-1">
                  {preview.errorRows.map((row) => (
                    <li key={row.rowNumber}>
                      Rândul {row.rowNumber}: {row.errors.join(" ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              {preview.updateCount > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={applyUpdates}
                    onChange={(e) => setApplyUpdates(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Actualizează cele {preview.updateCount} articole potrivite
                </label>
              )}
              {preview.newCategoryNames.length > 0 && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={createCategories}
                    onChange={(e) => setCreateCategories(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Creează categoriile noi
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")}>
                Înapoi
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || (preview.createCount === 0 && !applyUpdates)}
              >
                {loading && <Spinner />}
                Importă
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
