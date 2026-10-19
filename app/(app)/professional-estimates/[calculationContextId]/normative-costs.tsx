import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { ProcurementBlock, ProcurementStorageResult } from "@/domain/professional-estimates/calculation/procurement-storage";
import type { ProfessionalEstimateWorkspace } from "@/domain/professional-estimates/professional-estimate-workspace.repository";
import { procurementCategoryLabels } from "@/domain/professional-estimates/procurement-semantics";
import { formatRomanianDecimal } from "@/lib/ui/decimal-display";
import { formatProfessionalResourceMoney } from "@/lib/ui/professional-resource-money";

const blockMessages: Record<ProcurementBlock["reason"], string> = {
  category: "Categoria de aprovizionare-depozitare nu este clasificată.",
  price_semantics: "Prețul nu este confirmat ca fiind fără TVA și fără transport.",
  direct_price: "Prețul resursei lipsește sau este ambiguu; costul materialului nu este determinat.",
  empty_composition: "Componența normei nu conține resurse.",
};
const perspectiveLabels = { investor: "Investitor", contractor: "Antreprenor" };
const workKindLabels = {
  construction: "Construcții", installation: "Montaj", commissioning: "Punere în funcțiune",
};

export function NormativeCosts({
  result, context, allPositionsAssigned,
}: {
  result: ProcurementStorageResult;
  context: ProfessionalEstimateWorkspace["context"];
  allPositionsAssigned: boolean;
}) {
  const money = (value: string) => formatProfessionalResourceMoney(value, context.currency);
  return (
    <Card>
      <CardHeader><CardTitle>Costuri normative</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <h3 className="font-medium">Aprovizionare-depozitare</h3>
        <p className="text-sm text-muted-foreground">
          Perspectivă: {context.estimatePerspective ? perspectiveLabels[context.estimatePerspective] : "Neconfigurată"}
          {" · "}Tip lucrări: {context.workKind ? workKindLabels[context.workKind] : "Neconfigurat"}
          {" · "}Data evaluării: {context.valuationDate}
        </p>
        {!result.contextComplete &&
          <p className="text-sm text-amber-700">Selectați perspectiva devizului și tipul lucrărilor.</p>}
        {!allPositionsAssigned &&
          <p className="text-sm text-amber-700">Nu toate pozițiile au norme alocate.</p>}
        {result.blocks.map((block, index) => (
          <div key={`${block.workQuantityItemId}-${block.resourceId}-${index}`}
            className="rounded border border-amber-200 p-3 text-sm text-amber-800">
            {block.resourceName && <p className="font-medium">{block.resourceName}</p>}
            <p>{blockMessages[block.reason]}</p>
            {block.resourceId &&
              <Link className="text-primary underline" href={`/professional-estimates/resources/${block.resourceId}`}>
                Vezi resursa și prețurile
              </Link>}
          </div>
        ))}
        {result.categories.map(({ category, materialBase, resolution, application }) => (
          <div key={category} className="space-y-2 rounded border p-3 text-sm">
            <h4 className="font-medium">{procurementCategoryLabels[category]}</h4>
            <p>Bază eligibilă: {money(materialBase)}</p>
            {resolution.status === "missing" &&
              <p className="text-amber-700">Nu există o regulă eligibilă pentru categorie și context.</p>}
            {resolution.status === "ambiguous" &&
              <p className="text-amber-700">Există {resolution.eligibleCandidates.length} reguli eligibile. Devizo nu a ales automat una.</p>}
            {application && (
              <>
                <p>Regulă: {formatRomanianDecimal(application.ratePercent)}%</p>
                <p>Sursă: {application.sourceReference ?? application.sourceId}</p>
                <p className="font-medium">Aprovizionare-depozitare: {money(application.amount)}</p>
                <details className="break-words text-xs text-muted-foreground">
                  <summary className="cursor-pointer text-primary">Proveniența calculului</summary>
                  <dl className="mt-2 space-y-1">
                    <div><dt className="inline">Definiție regulă: </dt><dd className="inline">{application.professionalRuleDefinitionId}</dd></div>
                    <div><dt className="inline">Sursă ID: </dt><dd className="inline">{application.sourceId ?? "—"}</dd></div>
                    <div><dt className="inline">Decizie aplicabilitate: </dt><dd className="inline">{application.applicabilityDecisionId ?? "—"}</dd></div>
                    <div><dt className="inline">Origine: </dt><dd className="inline">{application.ruleOrigin}</dd></div>
                    <div><dt className="inline">Categorie: </dt><dd className="inline">{application.procurementCategory}</dd></div>
                  </dl>
                  <ul className="mt-2 space-y-2">
                    {application.materials.map((material) =>
                      <li key={`${material.workQuantityItemId}-${material.resourceConsumptionId}`}>
                        Poziție: {material.workQuantityItemId}<br />
                        Resursă: {material.resourceId}<br />
                        Consum: {material.resourceConsumptionId}<br />
                        Preț ID: {material.resourcePriceId}<br />
                        Cost material: {money(material.resourceCost)}
                      </li>)}
                  </ul>
                </details>
              </>
            )}
          </div>
        ))}
        {allPositionsAssigned && result.directResourceTotal !== null &&
          <p>Cost direct resurse: {money(result.directResourceTotal)}</p>}
        {allPositionsAssigned && result.procurementStorageTotal !== null &&
          <p>Aprovizionare-depozitare: {money(result.procurementStorageTotal)}</p>}
        {allPositionsAssigned && result.directPlusProcurement !== null &&
          <p className="font-semibold">Cost direct + aprovizionare-depozitare: {money(result.directPlusProcurement)}</p>}
        <p className="text-xs text-muted-foreground">
          Componentă normativă intermediară, nu valoarea finală a devizului.
          Nu sunt calculate contribuții la manoperă, transport material,
          cheltuieli de regie, beneficiu estimat sau TVA.
        </p>
      </CardContent>
    </Card>
  );
}
