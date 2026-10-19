"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDate } from "@/lib/ui/date-display";
import type { ProfessionalRuleDefinitionRecord } from "@/domain/professional-estimates/professional-rule-definitions.repository";
import type {
  PersistedCostComponent,
  ProfessionalCostComponentDecisionRecord,
} from "@/domain/professional-estimates/professional-cost-component-decisions.repository";
import type { WorkQuantityItemFormState } from "../actions";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
const componentLabels: Record<PersistedCostComponent, string> = {
  labor_contributions: "Contribuții aferente manoperei",
  material_transport: "Transport materiale",
  overhead: "Cheltuieli de regie",
  estimated_profit: "Beneficiu estimat",
};
const originLabels: Record<string, string> = {
  normative_sector_average: "Medie sectorială normativă",
  company_individual: "Regulă internă a companiei",
  contract_agreed: "Agreată contractual",
  statutory: "Sursă statutară",
};

type Action = (
  state: WorkQuantityItemFormState,
  formData: FormData,
) => Promise<WorkQuantityItemFormState>;

export function CostComponentDecisionCard({
  component,
  action,
  definitions,
  decision,
  contextComplete,
  zeroBasis,
  stale,
}: {
  component: PersistedCostComponent;
  action: Action;
  definitions: ProfessionalRuleDefinitionRecord[];
  decision: ProfessionalCostComponentDecisionRecord | null;
  contextComplete: boolean;
  zeroBasis: boolean;
  stale: boolean;
}) {
  const [state, formAction] = useActionState<WorkQuantityItemFormState, FormData>(
    action,
    null,
  );
  const selected = decision?.decision === "applied"
    ? definitions.find((item) => item.id === decision.professionalRuleDefinitionId)
    : null;
  const resolutionStatus = zeroBasis
    ? "zero_basis"
    : !contextComplete
      ? "context_incomplete"
      : definitions.length === 0
        ? "missing"
        : definitions.length === 1
          ? "selected"
          : "ambiguous";
  const statusText: Record<string, string> = {
    zero_basis: "Nu există bază de calcul — contribuție 0",
    context_incomplete: "Completați contextul de calcul pentru rezolvare.",
    missing: "Nu există o regulă eligibilă.",
    selected: "Regulă eligibilă",
    ambiguous: `Ambiguu — ${definitions.length} reguli eligibile`,
  };

  return (
    <article className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-medium text-heading">{componentLabels[component]}</h3>
        <span className="rounded-full bg-secondary px-2 py-1 text-xs">
          {decision?.decision === "not_applicable"
            ? "Neaplicabilă — decizie explicită"
            : stale
              ? "Decizie neeligibilă"
              : decision?.decision === "applied"
                ? "Regulă aplicată explicit"
                : statusText[resolutionStatus]}
        </span>
      </div>
      {decision?.decision === "not_applicable" && (
        <div className="rounded bg-secondary/60 p-3 text-sm">
          <p className="font-medium">Motivul introdus</p>
          <p className="mt-1 whitespace-pre-wrap">{decision.reason}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Decizia salvată · {decision.id}
          </p>
        </div>
      )}
      {stale && (
        <p role="alert" className="text-sm text-amber-800">
          Decizia salvată nu mai este eligibilă pentru contextul curent.
        </p>
      )}
      {selected && decision?.decision === "applied" && !stale && (
        <div className="rounded bg-secondary/60 p-3 text-sm">
          <p className="font-medium">{selected.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Decizia salvată · {decision.id}
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-all text-xs">
            <dt>Definiție profesională</dt><dd>{selected.id}</dd>
            <dt>Origine</dt><dd>{originLabels[selected.ruleOrigin] ?? selected.ruleOrigin}</dd>
            <dt>Valoare / bază</dt>
            <dd>{selected.value}{selected.valueType === "percent" ? "%" : ` ${selected.currency}`} · {selected.calculationBasis}</dd>
            <dt>Valabilitate</dt><dd>{formatDate(selected.validFrom)} – {formatDate(selected.validTo)}</dd>
            <dt>Perspectivă / lucrări</dt>
            <dd>{selected.estimatePerspective} · {selected.workKind}</dd>
            <dt>Sursă</dt><dd>{selected.sourceId}</dd>
            {selected.sourceReference && (
              <><dt>Referință</dt><dd>{selected.sourceReference}</dd></>
            )}
          </dl>
          {selected.ruleOrigin === "company_individual" && (
            <p className="mt-2 text-xs text-muted-foreground">
              Valoare introdusă de companie. Devizo nu o califică drept rată normativă oficială.
            </p>
          )}
        </div>
      )}
      {definitions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Reguli eligibile pentru contextul curent
          </p>
          {definitions.map((definition) => (
            <details key={definition.id} className="rounded border px-3 py-2 text-sm">
              <summary className="cursor-pointer">
                {definition.name} · {definition.value}
                {definition.valueType === "percent" ? "%" : ` ${definition.currency}`}
                {definition.id === selected?.id ? " · Aplicată explicit" : ""}
              </summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-all text-xs">
                <dt>Definiție profesională</dt><dd>{definition.id}</dd>
                <dt>Origine</dt><dd>{originLabels[definition.ruleOrigin] ?? definition.ruleOrigin}</dd>
                <dt>Bază</dt><dd>{definition.calculationBasis}</dd>
                <dt>Valabilitate</dt><dd>{formatDate(definition.validFrom)} – {formatDate(definition.validTo)}</dd>
                <dt>Perspectivă / lucrări</dt>
                <dd>{definition.estimatePerspective} · {definition.workKind}</dd>
                <dt>Sursă ID</dt><dd>{definition.sourceId}</dd>
                {definition.sourceReference && (
                  <><dt>Referință</dt><dd>{definition.sourceReference}</dd></>
                )}
              </dl>
            </details>
          ))}
        </div>
      )}
      {definitions.length > 0 &&
        contextComplete &&
        (!zeroBasis || decision !== null) && (
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="component" value={component} />
          <input type="hidden" name="decision" value="applied" />
          {definitions.length === 1 ? (
            <input
              type="hidden"
              name="professionalRuleDefinitionId"
              value={definitions[0]?.id}
            />
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`${component}-rule-choice`}>Alegeți regula explicit</Label>
              <select
                id={`${component}-rule-choice`}
                name="professionalRuleDefinitionId"
                required
                defaultValue={
                  decision?.decision === "applied"
                    ? decision.professionalRuleDefinitionId ?? ""
                    : ""
                }
                className={selectClass}
              >
                <option value="" disabled>Selectați una dintre regulile eligibile</option>
                {definitions.map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name} · {definition.value}{definition.valueType === "percent" ? "%" : ` ${definition.currency}`} · {definition.ruleOrigin}
                  </option>
                ))}
              </select>
            </div>
          )}
          <SubmitButton size="sm" pendingLabel="Se validează...">
            Aplică această regulă
          </SubmitButton>
        </form>
      )}
      {(!zeroBasis || decision !== null) && (
        <form action={formAction} className="space-y-2 border-t pt-3">
          <input type="hidden" name="component" value={component} />
          <input type="hidden" name="decision" value="not_applicable" />
          <Label htmlFor={`${component}-reason`}>Motiv pentru „Nu se aplică”</Label>
          <textarea
            id={`${component}-reason`}
            name="reason"
            rows={2}
            required
            defaultValue={decision?.decision === "not_applicable" ? decision.reason ?? "" : ""}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <SubmitButton size="sm" variant="outline" pendingLabel="Se salvează...">
            Marchează ca neaplicabilă
          </SubmitButton>
        </form>
      )}
      {state && "error" in state && (
        <p role="alert" className="text-sm text-destructive">{state.error}</p>
      )}
      {state && "success" in state && (
        <p role="status" className="text-sm text-emerald-700">{state.success}</p>
      )}
    </article>
  );
}
