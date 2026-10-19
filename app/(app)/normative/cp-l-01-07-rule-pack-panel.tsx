"use client";

import { useActionState, useState } from "react";
import type { ProfessionalRuleDefinitionRecord } from "@/domain/professional-estimates/professional-rule-definitions.repository";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatRomanianDecimal } from "@/lib/ui/decimal-display";
import { formatDate } from "@/lib/ui/date-display";
import { DateInput } from "@/components/ui/date-input";
import {
  installCpL010720112RulePack,
  verifyCpL010720112Calculation,
} from "./actions";

interface ApplicabilityChoice {
  id: string;
  revision: number;
  applicableFrom: string | null;
  applicableUntil: string | null;
}

interface PersistedRule {
  id: string;
  name: string;
  component: ProfessionalRuleDefinitionRecord["component"];
  value: string;
  valueType: ProfessionalRuleDefinitionRecord["valueType"];
  validFrom: string;
  validTo: string | null;
  estimatePerspective: ProfessionalRuleDefinitionRecord["estimatePerspective"];
  procurementCategory: string | null;
  ruleOrigin: ProfessionalRuleDefinitionRecord["ruleOrigin"];
  sourceReference: string | null;
  applicabilityDecisionId: string | null;
}

function categoryName(category: string | null): string {
  if (category === "construction_materials") return "Materiale de construcții";
  if (category === "metal_structures") return "Structuri metalice";
  return category ?? "Categorie nespecificată";
}

export function CpL010720112RulePackPanel({
  sourceId,
  decisions,
  rules,
  hasPackRule,
}: {
  sourceId: string;
  decisions: ApplicabilityChoice[];
  rules: PersistedRule[];
  hasPackRule: boolean;
}) {
  const [installState, installAction] = useActionState(
    installCpL010720112RulePack,
    null,
  );
  const [previewState, previewAction] = useActionState(
    verifyCpL010720112Calculation,
    null,
  );
  const [valuationDate, setValuationDate] = useState("");
  const [category, setCategory] = useState("");
  const [materialBase, setMaterialBase] = useState("");
  const previewResult =
    previewState && "result" in previewState ? previewState.result : null;

  return (
    <section
      aria-label="CP L.01.07-2012 — Reguli Devizo"
      className="space-y-4 rounded-lg border border-primary/20 bg-background p-4"
    >
      <div>
        <h3 className="font-semibold text-heading">
          CP L.01.07-2012 — Reguli Devizo
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Regulile sunt persistate în biblioteca profesională și păstrează
          proveniența sursei și a deciziei de aplicabilitate.
        </p>
      </div>

      <form action={installAction} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <input type="hidden" name="sourceId" value={sourceId} />
        {decisions.length > 0 ? (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">
              Decizia explicită de aplicabilitate
            </span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              name="applicabilityDecisionId"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Alegeți o decizie Aplicabilă
              </option>
              {decisions.map((decision) => (
                <option key={decision.id} value={decision.id}>
                  Revizia {decision.revision} · Aplicabilă
                  {decision.applicableFrom
                    ? ` · de la ${formatDate(decision.applicableFrom)}`
                    : ""}
                  {decision.applicableUntil
                    ? ` · până la ${formatDate(decision.applicableUntil)}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="rounded-md bg-status-warn-bg px-3 py-2 text-sm text-status-warn-fg">
            Pentru instalarea regulilor este necesară mai întâi o decizie
            explicită „Aplicabilă” pentru această sursă.
          </p>
        )}
        <SubmitButton
          disabled={decisions.length === 0}
          pendingLabel="Se verifică regulile…"
        >
          Instalează / verifică regulile
        </SubmitButton>
        {installState && "error" in installState ? (
          <p role="alert" className="text-sm text-status-error-fg sm:col-span-2">
            {installState.error}
          </p>
        ) : null}
        {installState && "created" in installState ? (
          <p role="status" className="text-sm text-status-ok-fg sm:col-span-2">
            {installState.created}{" "}
            {installState.created === 1 ? "regulă instalată" : "reguli instalate"}
            {"; "}
            {installState.reused}{" "}
            {installState.reused === 1
              ? "regulă reverificată și reutilizată"
              : "reguli reverificate și reutilizate"}
            .
          </p>
        ) : null}
      </form>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-heading">
          Reguli profesionale persistate ({rules.length})
        </h4>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nu există încă reguli persistate pentru această sursă.
          </p>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {rules.map((rule) => {
              const decision = decisions.find(
                (choice) => choice.id === rule.applicabilityDecisionId,
              );
              return (
                <article key={rule.id} className="rounded-md border p-3 text-sm">
                  <h5 className="font-medium text-heading">{categoryName(rule.procurementCategory)}</h5>
                  <p className="mt-0.5 text-xs text-muted-foreground">{rule.name}</p>
                  <p className="mt-1 text-secondary-foreground">
                    {rule.valueType === "percent"
                      ? `${formatRomanianDecimal(rule.value)}%`
                      : rule.value}
                    {" · Perspectivă: "}
                    {rule.estimatePerspective === "investor"
                      ? "Investitor"
                      : rule.estimatePerspective}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Valabilă: {formatDate(rule.validFrom)} —{" "}
                    {rule.validTo ? formatDate(rule.validTo) : "fără termen"}
                  </p>
                  {rule.sourceReference ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Referință: {rule.sourceReference}
                    </p>
                  ) : null}
                  {decision ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Decizia de aplicabilitate · revizia {decision.revision}
                    </p>
                  ) : null}
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Detalii de proveniență</summary>
                    <dl className="mt-2 space-y-1 break-all">
                      <div>
                        <dt className="inline font-medium">Origine: </dt>
                        <dd className="inline">{rule.ruleOrigin}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Identificator definiție: </dt>
                        <dd className="inline">{rule.id}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Decizie legată: </dt>
                        <dd className="inline">
                          {rule.applicabilityDecisionId ?? "—"}
                        </dd>
                      </div>
                    </dl>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {hasPackRule ? (
        <div className="space-y-3 border-t pt-4">
          <div>
            <h4 className="font-semibold text-heading">Verificare calcul</h4>
            <p className="mt-1 rounded-md bg-status-warn-bg px-3 py-2 text-sm text-status-warn-fg">
              Instrument tehnic de verificare — nu reprezintă un deviz final.
            </p>
            <p className="mt-2 text-sm font-medium text-secondary-foreground">
              Baza materialelor fără TVA și fără transport
            </p>
            <p className="text-xs text-muted-foreground">
              Perspectivă investitor · lucrări de construcții · MDL. Baza este
              introdusă manual și declarată explicit fără TVA; transportul de
              livrare este exclus.
            </p>
          </div>

          <form action={previewAction} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="sourceId" value={sourceId} />
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Data evaluării</span>
              <DateInput
                className="w-full rounded-md border bg-background px-3 py-2"
                name="valuationDate"
                value={valuationDate}
                onValueChange={setValuationDate}
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Categorie</span>
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                name="category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
              >
                <option value="" disabled>Alegeți categoria materialelor</option>
                <option value="construction_materials">Materiale de construcții</option>
                <option value="metal_structures">Structuri metalice</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Baza materială (MDL)</span>
              <input
                className="w-full rounded-md border bg-background px-3 py-2"
                type="text"
                inputMode="decimal"
                name="materialBase"
                value={materialBase}
                onChange={(event) => setMaterialBase(event.target.value)}
                required
              />
            </label>
            <div className="sm:col-span-3">
              <SubmitButton
                variant="outline"
                pendingLabel="Se calculează…"
              >
                Calculează prin motorul profesional
              </SubmitButton>
            </div>
          </form>

          {previewState && "error" in previewState ? (
            <p role="alert" className="text-sm text-status-error-fg">
              {previewState.error}
            </p>
          ) : null}
          {previewResult?.status === "missing" ? (
            <p role="status" className="rounded-md border border-status-warn-fg/30 p-3 text-sm text-status-warn-fg">
              Nicio regulă eligibilă pentru această categorie și dată. Nu a fost aplicată nicio rată.
            </p>
          ) : null}
          {previewResult?.status === "ambiguous" ? (
            <p role="status" className="rounded-md border border-status-warn-fg/30 p-3 text-sm text-status-warn-fg">
              Rezultat ambiguu: {previewResult.candidateIds.length} reguli sunt eligibile. Nu a fost aleasă nicio rată.
            </p>
          ) : null}
          {previewResult?.status === "selected" ? (
            <div role="status" className="rounded-lg border bg-card p-4">
              <h5 className="font-semibold text-heading">Rezultatul determinist</h5>
              <dl className="mt-2 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Data evaluării</dt>
                  <dd className="font-medium tabular-nums">
                    {formatDate(previewResult.valuationDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Baza materiale (MDL)</dt>
                  <dd className="font-medium tabular-nums">{previewResult.materialBase}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Categoria</dt>
                  <dd className="font-medium">{categoryName(previewResult.category)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Regula selectată</dt>
                  <dd className="font-medium">Investitor · {previewResult.sourceReference}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Procent</dt>
                  <dd className="font-medium tabular-nums">
                    {formatRomanianDecimal(previewResult.ratePercent)}%
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cheltuieli achiziționare-depozitare</dt>
                  <dd className="font-medium tabular-nums">{previewResult.procurementStorage} MDL</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cost direct rezultat</dt>
                  <dd className="font-semibold tabular-nums">{previewResult.directCost} MDL</dd>
                </div>
              </dl>
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Detalii tehnice</summary>
                <dl className="mt-2 space-y-1 break-all">
                  <div>
                    <dt className="inline font-medium">Candidate / definiție: </dt>
                    <dd className="inline">{previewResult.candidateId}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Decizie de aplicabilitate: </dt>
                    <dd className="inline">{previewResult.applicabilityDecisionId ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="inline font-medium">Referință: </dt>
                    <dd className="inline">{previewResult.sourceReference ?? "—"}</dd>
                  </div>
                </dl>
              </details>
            </div>
          ) : null}

          <div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
            Limitări: baza materială este furnizată manual pentru această
            verificare tehnică și este presupusă fără TVA; categoriile materiale
            mixte nu sunt alocate automat; categoria utilaje nu este
            implementată; ratele specifice contractorului nu sunt implementate
            aici; TVA-ul, cheltuielile indirecte, salariile, beneficiul estimat
            și formularele finale sunt în afara acestui preview.
          </div>
        </div>
      ) : null}
    </section>
  );
}
