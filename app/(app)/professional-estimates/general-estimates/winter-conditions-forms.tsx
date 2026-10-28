"use client";

import { useActionState, useMemo, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { NCM_L_02_06_2012_RULE_PACK } from "@/domain/professional-estimates/official-rule-packs/ncm-l-02-06-2012";
import type { WinterConditionsView } from "@/domain/professional-estimates/professional-winter-conditions.service";
import type { WinterFormState } from "./winter-conditions-actions";

type FormAction = (state: WinterFormState, data: FormData) => Promise<WinterFormState>;

function Message({ state }: { state: WinterFormState }) {
  if (!state) return null;
  return "error" in state
    ? <p role="alert" className="text-sm text-destructive">{state.error}</p>
    : <p role="status" className="text-sm text-emerald-700">{state.success}</p>;
}

const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50";

export function WinterRulePackForm({
  action, view,
}: { action: FormAction; view: WinterConditionsView }) {
  const [state, formAction] = useActionState<WinterFormState, FormData>(action, null);
  const source = view.source;
  if (!source) return (
    <p className="text-sm text-amber-800">
      NCM L.02.06-2012 nu este încă în registrul normativ al companiei.
      Inițializați sursa și decizia „Aplicabilă” în secțiunea Normative.
    </p>
  );
  const decisions = view.applicabilityDecisions.filter(
    (item) => item.decision === "applicable",
  );
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="sourceId" value={source.id} />
      <p className="text-sm">
        {source.code} · ediția {source.edition} · {view.installedRules.length} din {view.expectedRuleCount} reguli instalate
      </p>
      <div className="space-y-2">
        <Label htmlFor="winterApplicability">Decizia de aplicabilitate</Label>
        <select id="winterApplicability" name="applicabilityDecisionId" required
          defaultValue="" disabled={decisions.length === 0} className={selectClass}>
          <option value="" disabled>Selectați explicit decizia</option>
          {decisions.map((item) => (
            <option key={item.id} value={item.id}>
              Revizia {item.revision} · de la {item.applicableFrom ?? "—"}
              {item.applicableUntil ? ` până la ${item.applicableUntil}` : ""}
            </option>
          ))}
        </select>
      </div>
      {decisions.length === 0 && (
        <p className="text-xs text-amber-800">
          Instalați doar după confirmarea aplicabilității oficiale în registrul normativ.
        </p>
      )}
      <Message state={state} />
      <SubmitButton disabled={decisions.length === 0} pendingLabel="Se verifică..." variant="outline">
        Verifică / instalează cele 58 de reguli
      </SubmitButton>
    </form>
  );
}

export function WinterDecisionForm({
  action, view,
}: { action: FormAction; view: WinterConditionsView }) {
  const [state, formAction] = useActionState<WinterFormState, FormData>(action, null);
  const [pending, startTransition] = useTransition();
  const saved = view.decision;
  const [mode, setMode] = useState(saved?.mode ?? "normative_rate");
  const [ruleId, setRuleId] = useState(saved?.ruleDefinitionId ?? "");
  const [buildingScope, setBuildingScope] = useState(saved?.buildingScope ?? "");
  const [classification, setClassification] = useState(saved?.classification ?? "listed");
  const [periodKind, setPeriodKind] = useState(saved?.periodKind ?? "annual_average");
  const groups = useMemo(() => {
    const result = new Map<string, typeof view.eligibleRules>();
    for (const rule of view.eligibleRules) {
      const previous = result.get(rule.groupLabel) ?? [];
      result.set(rule.groupLabel, [...previous, rule]);
    }
    return [...result.entries()];
  }, [view.eligibleRules]);

  // A native form action resets its fields even when our server action returns
  // a validation error. Dispatch it explicitly so the user's selections remain
  // in sync with the visible conditional fields after a rejected save.
  function submitWithoutReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    startTransition(() => formAction(values));
  }

  const selected = view.eligibleRules.find((row) => row.id === ruleId);
  const principalOnly = NCM_L_02_06_2012_RULE_PACK.find(
    (row) => row.ruleCode === selected?.ruleCode,
  )?.principalWorkOnly ?? false;

  return (
    <form action={formAction} onSubmit={submitWithoutReset} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="winterMode">Aplicabilitate / metodă</Label>
        <select id="winterMode" name="mode" value={mode}
          onChange={(event) => setMode(event.target.value as typeof mode)} className={selectClass}>
          <option value="normative_rate">Normă NCM pentru Devizul General</option>
          <option value="not_applicable">Nu se aplică — reparații curente în clădire încălzită</option>
        </select>
      </div>

      {mode === "normative_rate" ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="winterBuilding">Categoria clădirii / construcției</Label>
            <select id="winterBuilding" name="buildingScope" required value={buildingScope}
              onChange={(event) => setBuildingScope(event.target.value as typeof buildingScope)}
              className={selectClass}>
              <option value="" disabled>Selectați categoria</option>
              <option value="residential_administrative">Locuință sau clădire administrativă — NCM 22–23</option>
              <option value="other">Alt tip de construcție</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="winterRule">Poziția din Anexa A</Label>
            <select id="winterRule" name="ruleDefinitionId" required value={ruleId}
              onChange={(event) => setRuleId(event.target.value)}
              disabled={view.eligibleRules.length === 0} className={selectClass}>
              <option value="" disabled>Selectați explicit regula NCM</option>
              {groups.map(([label, rules]) => (
                <optgroup label={label} key={label}>
                  {rules.map((rule) => (
                    <option key={rule.id} value={rule.id}
                      disabled={buildingScope === "residential_administrative" &&
                        !["022", "023"].includes(rule.ruleCode)}>
                      {rule.ruleCode} — {rule.name} — {rule.value}%
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {view.eligibleRules.length === 0 && (
              <p className="text-xs text-amber-800">
                Nu există reguli eligibile. Verificați sursa și pachetul normativ.
              </p>
            )}
          </div>

          {principalOnly && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="principalWorkConfirmed"
                defaultChecked={saved?.principalWorkConfirmed ?? false} className="mt-1" />
              Confirm că această lucrare este principală în Devizul General (NCM pct. 4.8).
            </label>
          )}

          <div className="space-y-2">
            <Label htmlFor="winterClassification">Încadrarea lucrării</Label>
            <select id="winterClassification" name="classification" value={classification}
              onChange={(event) => setClassification(event.target.value as typeof classification)}
              className={selectClass}>
              <option value="listed">Tip prevăzut în Anexa A</option>
              <option value="analogous">Tip neprevăzut — normă aleasă explicit prin analogie</option>
            </select>
          </div>
          {classification === "analogous" && (
            <div className="space-y-2">
              <Label htmlFor="winterAnalogy">Justificarea tehnică a analogiei</Label>
              <Input id="winterAnalogy" name="analogyReference" required
                defaultValue={saved?.analogyReference ?? ""}
                placeholder="Trimitere la proiect / argumentarea analogiei" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="winterPeriod">Durata proiectului</Label>
            <select id="winterPeriod" name="periodKind" value={periodKind}
              onChange={(event) => setPeriodKind(event.target.value as typeof periodKind)}
              className={selectClass}>
              <option value="annual_average">Un an sau mai mult — norma medie anuală</option>
              <option value="short_project">Sub un an — coeficient calculat din graficul proiectului</option>
            </select>
          </div>
          {periodKind === "short_project" && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="winterStart">Data începerii</Label>
                  <Input id="winterStart" name="startDate" type="date" required
                    defaultValue={saved?.startDate ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="winterEnd">Data încheierii</Label>
                  <Input id="winterEnd" name="endDate" type="date" required
                    defaultValue={saved?.endDate ?? ""} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="winterDays">Zile cu temperaturi negative din grafic</Label>
                <Input id="winterDays" name="winterDays" type="number" min="0" step="1"
                  required defaultValue={saved?.winterDays?.toString() ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="winterProjectReference">Document justificativ (grafic/POS)</Label>
                <Input id="winterProjectReference" name="projectReference" required
                  defaultValue={saved?.projectReference ?? ""}
                  placeholder="Ex.: POS, grafic de execuție, fila..." />
              </div>
              <p className="text-xs text-muted-foreground">
                K = zile cu temperaturi negative / (durata proiectului în zile × 0,23).
                Zilele nu sunt deduse automat din prognoza meteo.
              </p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Regula pentru timp friguros nu include lucrările speciale de încălzire,
            deszăpezire ori condițiile contractuale de plată pe zile efective.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Excluderea este permisă numai pentru reparații curente executate în clădiri
          încălzite (NCM L.02.06-2012, pct. 4.6). Confirmarea se salvează explicit.
        </p>
      )}
      <Message state={state} />
      <Button type="submit" loading={pending}
        disabled={pending || (mode === "normative_rate" && view.eligibleRules.length === 0)}>
        {pending ? "Se salvează..." : "Salvează decizia pentru timp friguros"}
      </Button>
    </form>
  );
}
