"use client";

import { useActionState, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  TEMPORARY_WORKS_PROJECT_CONDITIONS,
} from "@/domain/professional-estimates/calculation";
import type { TemporaryWorksView } from "@/domain/professional-estimates/professional-temporary-works.service";
import type { TemporaryWorksFormState } from "./temporary-works-actions";

type FormAction = (
  state: TemporaryWorksFormState,
  formData: FormData,
) => Promise<TemporaryWorksFormState>;

function Message({ state }: { state: TemporaryWorksFormState }) {
  if (!state) return null;
  if ("error" in state) {
    return <p role="alert" className="text-sm text-destructive">{state.error}</p>;
  }
  return <p role="status" className="text-sm text-emerald-700">{state.success}</p>;
}

export function TemporaryWorksPackForm({
  action,
  view,
}: {
  action: FormAction;
  view: TemporaryWorksView;
}) {
  const [state, formAction] = useActionState<TemporaryWorksFormState, FormData>(
    action,
    null,
  );
  const source = view.source;
  const decisions = view.applicabilityDecisions.filter(
    (decision) => decision.decision === "applicable",
  );

  if (!source) {
    return (
      <p className="text-sm text-amber-800">
        Sursa NCM L.02.05-2012 nu există încă în registrul normativ al companiei.
        Inițializați baza normativă Moldova înainte de instalarea pachetului.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="sourceId" value={source.id} />
      <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Sursă</dt>
        <dd>{source.code} · ediția {source.edition}</dd>
        <dt className="text-muted-foreground">Statut oficial</dt>
        <dd>{source.officialStatus === "in_force" ? "În vigoare" : source.officialStatus}</dd>
        <dt className="text-muted-foreground">Reguli așteptate</dt>
        <dd>{view.expectedRuleCount}</dd>
        <dt className="text-muted-foreground">Reguli instalate</dt>
        <dd>{view.installedRules.length}</dd>
      </dl>

      <div className="space-y-2">
        <Label htmlFor="temporaryWorksApplicability">
          Decizie de aplicabilitate
        </Label>
        <select
          id="temporaryWorksApplicability"
          name="applicabilityDecisionId"
          required
          defaultValue=""
          disabled={decisions.length === 0}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
        >
          <option value="" disabled>Selectați explicit decizia</option>
          {decisions.map((decision) => (
            <option key={decision.id} value={decision.id}>
              Revizia {decision.revision} · aplicabilă de la {decision.applicableFrom ?? "—"}
              {decision.applicableUntil ? ` până la ${decision.applicableUntil}` : ""}
            </option>
          ))}
        </select>
      </div>

      {decisions.length === 0 && (
        <p className="text-xs text-amber-800">
          Este necesară o decizie explicită „Aplicabilă” pentru această sursă.
        </p>
      )}
      <Message state={state} />
      <SubmitButton
        pendingLabel="Se verifică..."
        disabled={decisions.length === 0}
        variant="outline"
      >
        Verifică / instalează pachetul oficial
      </SubmitButton>
    </form>
  );
}

export function TemporaryWorksDecisionForm({
  action,
  view,
}: {
  action: FormAction;
  view: TemporaryWorksView;
}) {
  const [state, formAction] = useActionState<TemporaryWorksFormState, FormData>(
    action,
    null,
  );
  const persistedMode = view.decision?.mode ?? "normative_rate";
  const [mode, setMode] = useState(persistedMode);

  const groups = useMemo(() => {
    const map = new Map<string, typeof view.eligibleRules>();
    for (const rule of view.eligibleRules) {
      const rows = map.get(rule.groupLabel) ?? [];
      map.set(rule.groupLabel, [...rows, rule]);
    }
    return [...map.entries()];
  }, [view.eligibleRules]);

  const selectedRuleId =
    view.decision?.mode === "normative_rate"
      ? view.decision.ruleDefinitionId ?? ""
      : "";
  const selectedCondition =
    view.decision?.mode === "normative_rate"
      ? view.decision.projectCondition ?? ""
      : "";
  const projectConstruction =
    view.decision?.mode === "project_calculation"
      ? view.decision.projectConstructionAmount ?? ""
      : "";
  const projectInstallation =
    view.decision?.mode === "project_calculation"
      ? view.decision.projectInstallationAmount ?? ""
      : "";
  const projectReference =
    view.decision?.mode === "project_calculation"
      ? view.decision.projectReference ?? ""
      : "";

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="temporaryWorksMode">Metodă</Label>
        <select
          id="temporaryWorksMode"
          name="mode"
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as "normative_rate" | "project_calculation")
          }
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="normative_rate">Normă procentuală NCM</option>
          <option value="project_calculation">
            Tipul nu este prevăzut în tabel — calcul conform proiectului
          </option>
        </select>
      </div>

      {mode === "normative_rate" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="temporaryWorksRule">Tipul construcției</Label>
            <select
              id="temporaryWorksRule"
              name="ruleDefinitionId"
              required
              defaultValue={selectedRuleId}
              disabled={view.eligibleRules.length === 0}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
            >
              <option value="" disabled>Selectați explicit poziția NCM</option>
              {groups.map(([group, rules]) => (
                <optgroup key={group} label={group}>
                  {rules.map((rule) => (
                    <option key={rule.id} value={rule.id}>
                      {rule.ruleCode} — {rule.name} — {rule.value}%
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="temporaryWorksCondition">Condiția proiectului</Label>
            <select
              id="temporaryWorksCondition"
              name="projectCondition"
              required
              defaultValue={selectedCondition}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="" disabled>Selectați explicit condiția</option>
              {TEMPORARY_WORKS_PROJECT_CONDITIONS.map((condition) => (
                <option key={condition.value} value={condition.value}>
                  {condition.label} · K={condition.coefficient}
                </option>
              ))}
            </select>
          </div>

          {view.eligibleRules.length === 0 && (
            <p className="text-xs text-amber-800">
              Nu există reguli NCM eligibile instalate pentru data acestui deviz.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            NCM L.02.05-2012 pct. 1.5: pentru un tip absent din tabel se folosește
            calculul din proiectul de organizare a construcției. Nu se aplică un
            procent sau un coeficient normativ.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="temporaryProjectConstruction">
                Lucrări de construcții
              </Label>
              <Input
                id="temporaryProjectConstruction"
                name="projectConstructionAmount"
                inputMode="decimal"
                defaultValue={projectConstruction}
                placeholder="0"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temporaryProjectInstallation">
                Lucrări de montaj
              </Label>
              <Input
                id="temporaryProjectInstallation"
                name="projectInstallationAmount"
                inputMode="decimal"
                defaultValue={projectInstallation}
                placeholder="0"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="temporaryProjectReference">
              Referința la calculul din proiect
            </Label>
            <Input
              id="temporaryProjectReference"
              name="projectReference"
              defaultValue={projectReference}
              placeholder="Ex.: POS, capitol / calcul tehnic"
              required
            />
          </div>
        </>
      )}

      <Message state={state} />
      <SubmitButton
        pendingLabel="Se salvează..."
        disabled={mode === "normative_rate" && view.eligibleRules.length === 0}
      >
        Salvează calculul construcțiilor provizorii
      </SubmitButton>
    </form>
  );
}
