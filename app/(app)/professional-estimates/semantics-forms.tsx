"use client";

import { useActionState } from "react";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  PROCUREMENT_CATEGORIES, VAT_TREATMENTS, TRANSPORT_TREATMENTS,
  procurementCategoryLabels, vatTreatmentLabels, transportTreatmentLabels,
  type PriceSemantics, type ProcurementCategory, type NormativeCalculationContext,
} from "@/domain/professional-estimates/procurement-semantics";
import type { ResourcePriceFormState } from "./actions";

type SemanticAction = (state: ResourcePriceFormState, data: FormData) => Promise<ResourcePriceFormState>;
const selectClass = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Message({ state }: { state: ResourcePriceFormState }) {
  if (!state) return null;
  return "error" in state
    ? <p role="alert" className="text-sm text-destructive">{state.error}</p>
    : <p role="status" className="text-sm text-emerald-700">{state.success}</p>;
}

export function CloseResourcePriceValidityForm({
  action, priceId, validFrom, validTo,
}: {
  action: SemanticAction; priceId: string; validFrom: string; validTo: string | null;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <details className="mt-2 min-w-48 text-xs">
      <summary className="cursor-pointer text-primary">
        {validTo ? "Modifică data de încheiere" : "Închide valabilitatea"}
      </summary>
      <form action={formAction} className="mt-2 space-y-3">
        <Label htmlFor={`${priceId}-valid-to`}>Valabil până la</Label>
        <DateInput id={`${priceId}-valid-to`} name="validTo"
          required min={validFrom} defaultValue={validTo ?? ""} />
        <p>Data de sfârșit este inclusivă. Se modifică doar această dată.</p>
        <Message state={state} />
        <SubmitButton size="sm">Salvează data de încheiere</SubmitButton>
      </form>
    </details>
  );
}

export function PriceSemanticsFields({
  id, semantics,
}: { id: string; semantics?: PriceSemantics }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${id}-vat`}>TVA în preț</Label>
        <select id={`${id}-vat`} name="vatTreatment" required
          defaultValue={semantics?.vatTreatment ?? ""} className={selectClass}>
          <option value="" disabled>Selectați explicit</option>
          {VAT_TREATMENTS.map((value) =>
            <option key={value} value={value}>{vatTreatmentLabels[value]}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-transport`}>Transport în preț</Label>
        <select id={`${id}-transport`} name="transportTreatment" required
          defaultValue={semantics?.transportTreatment ?? ""} className={selectClass}>
          <option value="" disabled>Selectați explicit</option>
          {TRANSPORT_TREATMENTS.map((value) =>
            <option key={value} value={value}>{transportTreatmentLabels[value]}</option>)}
        </select>
      </div>
    </>
  );
}

export function UpdatePriceSemanticsForm({
  action, priceId, semantics,
}: { action: SemanticAction; priceId: string; semantics: PriceSemantics }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <details className="mt-2 min-w-48 text-xs">
      <summary className="cursor-pointer text-primary">Clasifică prețul</summary>
      <form action={formAction} className="mt-2 space-y-3">
        <PriceSemanticsFields id={priceId} semantics={semantics} />
        <p>Se modifică doar clasificarea TVA/transport, nu valoarea sau proveniența prețului.</p>
        <Message state={state} />
        <SubmitButton size="sm">Salvează clasificarea</SubmitButton>
      </form>
    </details>
  );
}

export function ProcurementCategoryForm({
  action, category,
}: { action: SemanticAction; category: ProcurementCategory | null }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="mt-4 space-y-3">
      <Label htmlFor="procurement-category">Categoria aprovizionare-depozitare</Label>
      <select id="procurement-category" name="procurementCategory"
        defaultValue={category ?? ""} className={selectClass}>
        <option value="">Neclasificată</option>
        {PROCUREMENT_CATEGORIES.map((value) =>
          <option key={value} value={value}>{procurementCategoryLabels[value]}</option>)}
      </select>
      <p className="text-sm text-muted-foreground">
        Categoria este folosită la rezolvarea regulilor de aprovizionare-depozitare.
        Devizo nu o deduce automat.
      </p>
      <Message state={state} />
      <SubmitButton size="sm">Salvează categoria</SubmitButton>
    </form>
  );
}

export function CalculationContextForm({
  action, context,
}: { action: SemanticAction; context: NormativeCalculationContext }) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="estimate-perspective">Perspectivă</Label>
        <select id="estimate-perspective" name="estimatePerspective" required
          defaultValue={context.estimatePerspective ?? ""} className={selectClass}>
          <option value="" disabled>Selectați perspectiva</option>
          <option value="investor">Deviz investitor</option>
          <option value="contractor">Deviz antreprenor</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="work-kind">Tip lucrări</Label>
        <select id="work-kind" name="workKind" required
          defaultValue={context.workKind ?? ""} className={selectClass}>
          <option value="" disabled>Selectați tipul lucrărilor</option>
          <option value="construction">Construcții</option>
          <option value="installation">Montaj</option>
          <option value="commissioning">Punere în funcțiune</option>
        </select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        {(!context.estimatePerspective || !context.workKind) &&
          <p className="text-sm text-amber-700">Contextul normativ nu este configurat complet.</p>}
        <Message state={state} />
        <SubmitButton size="sm">Salvează contextul</SubmitButton>
      </div>
    </form>
  );
}
