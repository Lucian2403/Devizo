import Link from "next/link";
import { formatDate } from "@/lib/ui/date-display";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfessionalEstimateNotFoundError } from "@/domain/professional-estimates/professional-estimate-workspace.service";
import { formatRomanianDecimal } from "@/lib/ui/decimal-display";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import type { AppliedNormBreakdown } from "@/domain/professional-estimates/professional-norm-library.service";
import type { DirectResourceCostPosition } from "@/domain/professional-estimates/professional-resource-prices.service";
import { formatProfessionalResourceMoney } from "@/lib/ui/professional-resource-money";
import {
  getProfessionalEstimateWorkspaceService,
  getProfessionalCostComponentDecisionService,
  getProfessionalNormLibraryService,
  getProfessionalResourcePricesService,
  getProfessionalRuleDefinitionService,
} from "@/server/container";
import { calculateProcurementStorage } from "@/domain/professional-estimates/calculation/procurement-storage";
import {
  calculateProfessionalCostStack,
  parseDecimal,
  toDecimalString,
  resolveProfessionalRule,
  type ResolvedCostRuleReference,
  type ProfessionalCostStackInput,
  type ResourceTypeTotals,
} from "@/domain/professional-estimates/calculation";
import type {
  PersistedCostComponent,
  ProfessionalCostComponentDecisionRecord,
} from "@/domain/professional-estimates/professional-cost-component-decisions.repository";
import { isStoredCostComponentDecisionStale } from "@/domain/professional-estimates/professional-cost-component-decisions.service";
import type { ProfessionalRuleDefinitionRecord } from "@/domain/professional-estimates/professional-rule-definitions.repository";
import { CalculationContextForm } from "../semantics-forms";
import { NormativeCosts } from "./normative-costs";
import { CostComponentDecisionCard } from "./cost-component-forms";
import { saveProfessionalCostComponentDecision } from "../actions";
import { vatTreatmentLabels, transportTreatmentLabels } from "@/domain/professional-estimates/procurement-semantics";
import {
  assignNormToWorkItem,
  createWorkQuantityItem,
  updateWorkQuantityItem,
  updateCalculationContext,
} from "../actions";
import {
  AddWorkQuantityItemForm,
  EditWorkQuantityItemForm,
} from "./item-forms";
import { AssignNormForm } from "../norms/norm-forms";

const resourceTypeLabels: Record<string, string> = {
  labor: "Manoperă",
  material: "Material",
  machinery: "Utilaj",
  transport: "Transport",
  energy: "Energie",
  other: "Altele",
};
const costComponents: PersistedCostComponent[] = [
  "labor_contributions",
  "material_transport",
  "overhead",
  "estimated_profit",
];
const costComponentLabels: Record<PersistedCostComponent, string> = {
  labor_contributions: "Contribuții aferente manoperei",
  material_transport: "Transport materiale",
  overhead: "Cheltuieli de regie",
  estimated_profit: "Beneficiu estimat",
};

function professionalRuleReference(
  definition: ProfessionalRuleDefinitionRecord,
): ResolvedCostRuleReference {
  return {
    ruleType: definition.component,
    calculationRuleId: null,
    sourceId: definition.sourceId,
    sourceReference: definition.sourceReference,
    professionalRuleDefinitionId: definition.id,
    ruleOrigin: definition.ruleOrigin,
    validFrom: definition.validFrom,
    validTo: definition.validTo,
    estimatePerspective: definition.estimatePerspective,
    workKind: definition.workKind,
  };
}

type ComponentDecision<C extends PersistedCostComponent> =
  C extends "labor_contributions"
    ? ProfessionalCostStackInput["laborContributions"]
    : C extends "material_transport"
      ? ProfessionalCostStackInput["materialTransport"]
      : C extends "overhead"
        ? ProfessionalCostStackInput["overhead"]
        : ProfessionalCostStackInput["estimatedProfit"];

function makeComponentDecision(
  component: "labor_contributions",
  saved: ProfessionalCostComponentDecisionRecord | undefined,
  eligibleDefinitions: ProfessionalRuleDefinitionRecord[],
  zeroBasis: boolean,
): ComponentDecision<"labor_contributions"> | null;
function makeComponentDecision(
  component: "material_transport",
  saved: ProfessionalCostComponentDecisionRecord | undefined,
  eligibleDefinitions: ProfessionalRuleDefinitionRecord[],
  zeroBasis: boolean,
): ComponentDecision<"material_transport"> | null;
function makeComponentDecision(
  component: "overhead",
  saved: ProfessionalCostComponentDecisionRecord | undefined,
  eligibleDefinitions: ProfessionalRuleDefinitionRecord[],
  zeroBasis: boolean,
): ComponentDecision<"overhead"> | null;
function makeComponentDecision(
  component: "estimated_profit",
  saved: ProfessionalCostComponentDecisionRecord | undefined,
  eligibleDefinitions: ProfessionalRuleDefinitionRecord[],
  zeroBasis: boolean,
): ComponentDecision<"estimated_profit"> | null;
function makeComponentDecision(
  component: PersistedCostComponent,
  saved: ProfessionalCostComponentDecisionRecord | undefined,
  eligibleDefinitions: ProfessionalRuleDefinitionRecord[],
  zeroBasis: boolean,
):
  | ProfessionalCostStackInput["laborContributions"]
  | ProfessionalCostStackInput["materialTransport"]
  | ProfessionalCostStackInput["overhead"]
  | ProfessionalCostStackInput["estimatedProfit"]
  | null;
function makeComponentDecision(
  component: PersistedCostComponent,
  saved: ProfessionalCostComponentDecisionRecord | undefined,
  eligibleDefinitions: ProfessionalRuleDefinitionRecord[],
  zeroBasis: boolean,
):
  | ProfessionalCostStackInput["laborContributions"]
  | ProfessionalCostStackInput["materialTransport"]
  | ProfessionalCostStackInput["overhead"]
  | ProfessionalCostStackInput["estimatedProfit"]
  | null {
  if (saved?.decision === "not_applicable") {
    return { status: "not_applicable", reason: saved.reason ?? "" };
  }
  if (saved?.decision === "applied") {
    const definition = eligibleDefinitions.find(
      ({ id }) => id === saved.professionalRuleDefinitionId,
    );
    if (!definition) return null;
    const rule = professionalRuleReference(definition);
    if (component === "material_transport") {
      return definition.valueType === "fixed_amount"
        ? {
            status: "applied",
            method: "fixed_amount",
            amount: definition.value,
            currency: definition.currency ?? "",
            rule,
          }
        : {
            status: "applied",
            method: "percentage_of_material",
            ratePercent: definition.value,
            rule,
          };
    }
    if (component === "overhead") {
      return {
        status: "applied",
        basis: definition.calculationBasis as "direct_cost" | "labor_cost",
        ratePercent: definition.value,
        rule,
      };
    }
    return { status: "applied", ratePercent: definition.value, rule };
  }
  if (!zeroBasis) return null;
  if (component === "labor_contributions") {
    return { status: "zero_basis", basis: "labor_cost" };
  }
  if (component === "material_transport") {
    return { status: "zero_basis", basis: "material_cost" };
  }
  if (component === "overhead") {
    return { status: "zero_basis", basis: "direct_cost" };
  }
  return { status: "zero_basis", basis: "estimate_cost_before_profit" };
}

export default async function ProfessionalEstimateDetailPage({
  params,
}: {
  params: Promise<{ calculationContextId: string }>;
}) {
  const { calculationContextId } = await params;
  const { org } = await requireCurrentOrg();
  let workspace;
  try {
    workspace =
      await getProfessionalEstimateWorkspaceService().getProfessionalEstimate(
        org.id,
        calculationContextId,
      );
  } catch (error) {
    if (error instanceof ProfessionalEstimateNotFoundError) notFound();
    throw error;
  }
  const normPresentation =
    await getProfessionalNormLibraryService().getNormWorkspacePresentation(
      org.id,
      calculationContextId,
    );
  const pricingPositions = workspace.items.flatMap((item) => {
    const application = normPresentation.assignedByWorkItemId[item.id];
    if (!application) return [];
    return [
      {
        workQuantityItemId: item.id,
        workQuantity: item.quantity,
        estimateNormVersionId: application.norm.norm.id,
        normApplicationId: application.id,
        normBasisQuantity: application.norm.norm.basisQuantity,
        applicationCoefficient: application.applicationCoefficient,
        resources: application.calculatedResources.map((resource) => ({
          id: resource.id,
          code: resource.code,
          name: resource.name,
          resourceType: resource.resourceType,
          procurementCategory: resource.procurementCategory,
          unit: resource.unit,
          resourceConsumptionId: resource.id,
          resourceId: resource.resourceId,
          normativeConsumption: resource.quantityPerNormBasis,
        })),
      },
    ];
  });
  const resourcePricing =
    await getProfessionalResourcePricesService().calculateDirectResourceCosts(
      org.id,
      workspace.context.currency,
      workspace.context.valuationDate,
      pricingPositions,
    );
  const pricesComplete =
    normPresentation.itemCount > 0 &&
    normPresentation.assignedCount === normPresentation.itemCount &&
    resourcePricing.completePositionCount === normPresentation.assignedCount;
  const ruleService = getProfessionalRuleDefinitionService();
  const procurementCandidates = await ruleService.loadCandidatesForComponent(
    org.id,
    "procurement_storage",
  );
  const procurement = calculateProcurementStorage(
    resourcePricing,
    workspace.context,
    procurementCandidates,
  );
  const allDefinitions = await ruleService.listRuleDefinitions(org.id);
  const definitionsById = new Map(
    allDefinitions.map((definition) => [definition.id, definition]),
  );
  const savedComponentDecisions =
    await getProfessionalCostComponentDecisionService().listForContext(
      org.id,
      calculationContextId,
    );
  const decisionsByComponent = new Map(
    savedComponentDecisions.map((decision) => [decision.component, decision]),
  );
  const contextComplete =
    workspace.context.estimatePerspective !== null &&
    workspace.context.workKind !== null;
  const currentResolutions = new Map<
    PersistedCostComponent,
    ProfessionalRuleDefinitionRecord[]
  >();
  for (const component of costComponents) {
    const candidates = contextComplete
      ? await ruleService.loadCandidatesForComponent(org.id, component)
      : [];
    const eligibleCandidates =
      contextComplete
        ? resolveProfessionalRule(component, candidates, {
            valuationDate: workspace.context.valuationDate,
            estimatePerspective: workspace.context.estimatePerspective!,
            workKind: workspace.context.workKind!,
            currency: workspace.context.currency,
          }).eligibleCandidates
        : [];
    currentResolutions.set(
      component,
      eligibleCandidates.map((candidate) => {
        const definition = definitionsById.get(candidate.candidateId);
        if (!definition) {
          throw new Error(
            `Resolved professional rule ${candidate.candidateId} has no persisted definition.`,
          );
        }
        return definition;
      }),
    );
  }

  const allPricedPositions =
    pricesComplete &&
    normPresentation.assignedCount === workspace.items.length &&
    workspace.items.length > 0;
  const sumResourceType = (key: keyof ResourceTypeTotals) =>
    toDecimalString(
      Object.values(resourcePricing.positionsByWorkItemId).reduce(
        (total, position) =>
          total.plus(
            parseDecimal(position.totalsByResourceType?.[key] ?? "0", key),
          ),
        parseDecimal("0", key),
      ),
    );
  const resourceTotals = allPricedPositions
    ? {
        labor: sumResourceType("labor"),
        material: sumResourceType("material"),
        machinery: sumResourceType("machinery"),
        transport: sumResourceType("transport"),
        energy: sumResourceType("energy"),
        other: sumResourceType("other"),
      }
    : null;
  const directResourceTotal = allPricedPositions
    ? toDecimalString(
        Object.values(resourcePricing.positionsByWorkItemId).reduce(
          (total, position) =>
            total.plus(
              parseDecimal(position.directResourceTotal ?? "0", "directResourceTotal"),
            ),
          parseDecimal("0", "directResourceTotal"),
        ),
      )
    : null;
  const resourceCalculation =
    resourceTotals && directResourceTotal !== null
      ? {
          currency: workspace.context.currency,
          totalsByResourceType: resourceTotals,
          directResourceTotal,
        }
      : null;

  const savedFor = (component: PersistedCostComponent) =>
    decisionsByComponent.get(component);
  const eligibleFor = (component: PersistedCostComponent) =>
    currentResolutions.get(component) ?? [];
  const zeroResourceBases = {
    labor_contributions:
      resourceTotals !== null &&
      parseDecimal(resourceTotals.labor, "labor").isZero(),
    material_transport:
      resourceTotals !== null &&
      parseDecimal(resourceTotals.material, "material").isZero(),
  };
  const laborDecision = makeComponentDecision(
    "labor_contributions",
    savedFor("labor_contributions"),
    eligibleFor("labor_contributions"),
    zeroResourceBases.labor_contributions,
  );
  const materialTransportDecision = makeComponentDecision(
    "material_transport",
    savedFor("material_transport"),
    eligibleFor("material_transport"),
    zeroResourceBases.material_transport,
  );

  const procurementDecision: ProfessionalCostStackInput["procurementStorage"] | null =
    procurement.complete && procurement.procurementStorageTotal !== null
      ? procurement.categories.length === 0
        ? { status: "zero_basis", basis: "material_cost" }
        : {
            status: "applied",
            method: "resolved_total",
            amount: procurement.procurementStorageTotal,
            currency: workspace.context.currency,
            applications: procurement.categories.map((category) => {
              const application = category.application;
              if (!application) {
                throw new Error(
                  "A complete procurement calculation is missing a category application.",
                );
              }
              const definition = definitionsById.get(
                application.professionalRuleDefinitionId,
              );
              if (!definition) {
                throw new Error(
                  `Procurement rule ${application.professionalRuleDefinitionId} has no persisted definition.`,
                );
              }
              return {
                materialBase: application.materialBase,
                ratePercent: application.ratePercent,
                amount: application.amount,
                rule: professionalRuleReference(definition),
              };
            }),
          }
      : null;

  const rawResourceZero =
    resourceCalculation !== null &&
    parseDecimal(resourceCalculation.directResourceTotal, "directResourceTotal").isZero();
  const materialTransportZero =
    materialTransportDecision?.status === "zero_basis" ||
    materialTransportDecision?.status === "not_applicable" ||
    (materialTransportDecision?.status === "applied" &&
      (materialTransportDecision.method === "percentage_of_material"
        ? zeroResourceBases.material_transport
        : materialTransportDecision.method === "fixed_amount"
          ? parseDecimal(materialTransportDecision.amount, "materialTransport").isZero()
          : false));
  const procurementZero =
    procurementDecision?.status === "zero_basis" ||
    (procurementDecision?.status === "applied" &&
      procurement.procurementStorageTotal !== null &&
      parseDecimal(procurement.procurementStorageTotal, "procurementStorage").isZero());
  const directCostZero =
    rawResourceZero &&
    materialTransportZero &&
    procurementZero &&
    laborDecision !== null;
  const overheadDecision = makeComponentDecision(
    "overhead",
    savedFor("overhead"),
    eligibleFor("overhead"),
    directCostZero,
  );
  const estimatedProfitDecision = makeComponentDecision(
    "estimated_profit",
    savedFor("estimated_profit"),
    eligibleFor("estimated_profit"),
    directCostZero,
  );
  const stackResult =
    resourceCalculation &&
    procurementDecision &&
    laborDecision &&
    materialTransportDecision &&
    overheadDecision &&
    estimatedProfitDecision
      ? calculateProfessionalCostStack({
          resourceCalculation,
          laborContributions: laborDecision,
          materialTransport: materialTransportDecision,
          procurementStorage: procurementDecision,
          overhead: overheadDecision,
          estimatedProfit: estimatedProfitDecision,
        })
      : null;
  const progressSteps = [
    { title: "Obiect și listă create", complete: true },
    {
      title: "Poziții de lucrări",
      complete: workspace.items.length > 0,
    },
    {
      title: `Norme alocate: ${normPresentation.assignedCount} / ${normPresentation.itemCount}`,
      complete:
        normPresentation.itemCount > 0 &&
        normPresentation.assignedCount === normPresentation.itemCount,
    },
    {
      title: `Resurse și prețuri: ${resourcePricing.pricedResourceCount} / ${resourcePricing.requiredPriceCount}`,
      complete: pricesComplete,
    },
    { title: "Calcul profesional", complete: stackResult !== null },
    { title: "Formulare finale", complete: false },
  ];

  const addItemAction = createWorkQuantityItem.bind(
    null,
    calculationContextId,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/professional-estimates">← Înapoi la devize</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-heading">
          Deviz: {workspace.context.name}
        </h1>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
            <DetailValue label="Obiect">
              {workspace.constructionObject.name}
            </DetailValue>
            <DetailValue label="Lista de cantități">
              {workspace.workQuantityList.name}
              <span className="ml-2 inline-block rounded bg-secondary px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                Revizia {workspace.workQuantityList.revision}
              </span>
            </DetailValue>
            <DetailValue label="Data evaluării">
              {formatDate(workspace.context.valuationDate)}
            </DetailValue>
            <DetailValue label="Moneda">{workspace.context.currency}</DetailValue>
            <DetailValue label="Metodă">Metoda de resurse</DetailValue>
            {workspace.constructionObject.code && (
              <DetailValue label="Cod obiect">
                {workspace.constructionObject.code}
              </DetailValue>
            )}
            {workspace.constructionObject.address && (
              <DetailValue label="Adresa obiectului">
                {workspace.constructionObject.address}
              </DetailValue>
            )}
            {workspace.workQuantityList.sourceReference && (
              <DetailValue label="Sursa listei">
                {workspace.workQuantityList.sourceReference}
              </DetailValue>
            )}
            {workspace.workQuantityList.sourceDate && (
              <DetailValue label="Data sursei">
                {formatDate(workspace.workQuantityList.sourceDate)}
              </DetailValue>
            )}
          </dl>
          <div className="mt-4 border-t pt-3">
            <h2 className="text-xs font-semibold text-heading">
              Progresul devizului
            </h2>
            <ol className="mt-2 flex flex-wrap gap-2">
              {progressSteps.map((step) => {
                const complete = step.complete;
                return (
                  <li
                    key={step.title}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${
                      complete
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <span aria-hidden="true">{complete ? "✓" : "○"}</span>
                    <span className="sr-only">
                      {complete ? "Complet: " : "În așteptare: "}
                    </span>
                    {step.title}
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              Costurile afișate sunt costuri directe ale resurselor, calculate
              din prețurile eligibile exact introduse. Nu se aplică automat
              ajustări normative, TVA, transport sau profit la aceste prețuri.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Poziții de lucrări</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Poz.</th>
                  <th className="px-3 py-2 font-medium">Cod</th>
                  <th className="px-3 py-2 font-medium">Denumirea lucrării</th>
                  <th className="px-3 py-2 font-medium">UM</th>
                  <th className="px-3 py-2 text-right font-medium">Cantitate</th>
                  <th className="px-3 py-2 font-medium">Normă</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {workspace.items.map((item) => {
                  const positionPricing =
                    resourcePricing.positionsByWorkItemId[item.id];
                  const application =
                    normPresentation.assignedByWorkItemId[item.id];
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-border/70 align-top last:border-0"
                    >
                      <td className="px-3 py-3">{item.positionNumber}</td>
                      <td className="px-3 py-3">{item.code || "—"}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-heading">
                          {item.description}
                        </div>
                        {item.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.notes}
                          </p>
                        )}
                        <EditWorkQuantityItemForm
                          action={updateWorkQuantityItem.bind(
                            null,
                            calculationContextId,
                            item.id,
                          )}
                          item={item}
                        />
                      </td>
                      <td className="px-3 py-3">{item.unit}</td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {formatRomanianDecimal(item.quantity)}
                      </td>
                      <td className="px-3 py-3">
                        {application ? (
                          <AssignedNormSummary
                            application={application}
                            pricing={positionPricing}
                            currency={workspace.context.currency}
                          />
                        ) : (
                          <AssignNormForm
                            workItemId={item.id}
                            action={assignNormToWorkItem.bind(
                              null,
                              calculationContextId,
                              item.id,
                            )}
                            eligibleNorms={
                              normPresentation.eligibleByWorkItemId[item.id] ?? []
                            }
                          />
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {positionPricing?.directResourceTotal !== null &&
                        positionPricing ? (
                          <>
                            <span className="whitespace-nowrap font-medium">
                              {formatProfessionalResourceMoney(
                                positionPricing.directResourceTotal,
                                workspace.context.currency,
                              )}
                            </span>
                            <span className="block whitespace-nowrap text-xs text-muted-foreground">
                              Cost direct resurse
                            </span>
                          </>
                        ) : (
                          <>
                            <span>—</span>
                            {application?.calculatedResources.length === 0 ? (
                              <span className="block whitespace-nowrap text-xs text-amber-700">
                                Componența normei nu conține resurse
                              </span>
                            ) : positionPricing ? (
                              <span className="block whitespace-nowrap text-xs text-amber-700">
                                Prețuri incomplete
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {workspace.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-6 text-center text-sm text-muted-foreground"
                    >
                      Nu există încă poziții de lucrări.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Costul direct al resurselor este afișat numai când toate resursele
            necesare au exact un preț eligibil.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Context de calcul</CardTitle></CardHeader>
        <CardContent>
          <CalculationContextForm
            action={updateCalculationContext.bind(null, calculationContextId)}
            context={workspace.context}
          />
        </CardContent>
      </Card>
      <NormativeCosts
        result={procurement}
        context={workspace.context}
        allPositionsAssigned={workspace.items.length > 0 && normPresentation.assignedCount === workspace.items.length}
      />

      <Card>
        <CardHeader>
          <CardTitle>Configurarea costurilor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Regulile interne trebuie justificate prin datele companiei sau
            configurarea contractuală. Ele nu sunt automat valori normative
            oficiale.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {costComponents.map((component) => {
              const saved = savedFor(component) ?? null;
              const definitions = eligibleFor(component);
              const stale = isStoredCostComponentDecisionStale(
                saved,
                definitions.map(({ id }) => id),
              );
              const zeroBasis =
                saved === undefined &&
                (component === "labor_contributions"
                  ? zeroResourceBases.labor_contributions
                  : component === "material_transport"
                    ? zeroResourceBases.material_transport
                    : directCostZero);
              return (
                <CostComponentDecisionCard
                  key={component}
                  component={component}
                  action={saveProfessionalCostComponentDecision.bind(
                    null,
                    calculationContextId,
                  )}
                  definitions={definitions}
                  decision={saved}
                  contextComplete={contextComplete}
                  zeroBasis={zeroBasis}
                  stale={stale}
                />
              );
            })}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/professional-estimates/rules">Deschide biblioteca de reguli</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Calcul profesional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stackResult ? (
            <>
              <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                <CostLine
                  label="Cost resurse"
                  value={stackResult.rawResourceTotal}
                  currency={stackResult.currency}
                />
                <CostLine
                  label="Contribuții aferente manoperei"
                  value={stackResult.laborContributions}
                  currency={stackResult.currency}
                />
                <CostLine
                  label="Transport materiale"
                  value={stackResult.materialTransport}
                  currency={stackResult.currency}
                />
                <CostLine
                  label="Aprovizionare-depozitare"
                  value={stackResult.procurementStorage}
                  currency={stackResult.currency}
                />
                <CostLine
                  label="Cost direct"
                  value={stackResult.directCost}
                  currency={stackResult.currency}
                  emphasized
                />
                <CostLine
                  label="Cheltuieli de regie"
                  value={stackResult.overhead}
                  currency={stackResult.currency}
                />
                <CostLine
                  label="Cost înainte de beneficiu"
                  value={stackResult.estimateCostBeforeProfit}
                  currency={stackResult.currency}
                  emphasized
                />
                <CostLine
                  label="Beneficiu estimat"
                  value={stackResult.estimatedProfit}
                  currency={stackResult.currency}
                />
                <CostLine
                  label="Subtotal înainte de TVA"
                  value={stackResult.estimateSubtotalBeforeLimitedCostsAndVat}
                  currency={stackResult.currency}
                  emphasized
                />
              </dl>
              {savedComponentDecisions
                .filter((decision) => decision.decision === "not_applicable")
                .map((decision) => (
                  <p key={decision.id} className="text-sm text-muted-foreground">
                    {costComponentLabels[decision.component]} — neaplicabilă,
                    conform deciziei explicite {decision.id}: {decision.reason}
                  </p>
                ))}
            </>
          ) : (
            <>
              <p className="font-medium text-amber-800">
                Calculul profesional este incomplet.
              </p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {!allPricedPositions && (
                  <li>Resursele directe sau prețurile eligibile sunt incomplete.</li>
                )}
                {allPricedPositions &&
                  costComponents.map((component) => {
                    const saved = savedFor(component);
                    const definitions = eligibleFor(component);
                    const stale = isStoredCostComponentDecisionStale(
                      saved,
                      definitions.map(({ id }) => id),
                    );
                    const zeroBasis =
                      saved === undefined &&
                      (component === "labor_contributions"
                        ? zeroResourceBases.labor_contributions
                        : component === "material_transport"
                          ? zeroResourceBases.material_transport
                          : directCostZero);
                    const componentDecision = makeComponentDecision(
                      component,
                      saved,
                      definitions,
                      zeroBasis,
                    );
                    if (componentDecision !== null && !stale) return null;
                    return (
                      <li key={component}>
                        {costComponentLabels[component]} —{" "}
                        {stale
                          ? "decizia salvată nu mai este eligibilă"
                          : !contextComplete
                            ? "context incomplet"
                            : definitions.length > 1
                              ? `ambiguu (${definitions.length} reguli eligibile)`
                              : definitions.length === 0
                                ? "nu există regulă eligibilă sau decizie explicită"
                                : "alegeți și aplicați explicit regula eligibilă"}
                      </li>
                    );
                  })}
                {!procurement.complete && (
                  <li>
                    Aprovizionare-depozitare — nerezolvată; verificați contextul,
                    clasificarea materialelor, prețurile și regulile CP L.01.07.
                  </li>
                )}
                {procurement.complete && !contextComplete && (
                  <li>Completați perspectiva și tipul lucrărilor din context.</li>
                )}
              </ul>
            </>
          )}
          <p className="border-t pt-3 text-sm text-muted-foreground">
            Subtotal intermediar. TVA și alte costuri limitate/finale nu sunt
            încă calculate.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="px-4 pb-3 pt-4 sm:px-5">
          <CardTitle className="text-base">Adaugă poziție</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <AddWorkQuantityItemForm action={addItemAction} />
        </CardContent>
      </Card>
    </div>
  );
}

function AssignedNormSummary({
  application,
  pricing,
  currency,
}: {
  application: AppliedNormBreakdown;
  pricing?: DirectResourceCostPosition;
  currency: string;
}) {
  const { norm } = application.norm;
  return (
    <div className="min-w-48 space-y-2">
      <div className="font-medium text-heading">
        {norm.code}
        <p className="text-xs font-normal text-muted-foreground">{norm.name}</p>
        <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          {norm.sourceType === "company_custom" ? "Normă internă" : norm.sourceType}
          {" · versiunea "}
          {norm.versionLabel}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Bază: {formatRomanianDecimal(norm.basisQuantity)} {norm.basisUnit} ·
        coeficient: {formatRomanianDecimal(application.applicationCoefficient)}
      </p>
      <details className="text-xs">
        <summary className="cursor-pointer font-medium text-primary">
          Vezi resursele
        </summary>
        {application.calculatedResources.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            Componența normei nu conține resurse.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {application.calculatedResources.map((resource) => {
              const pricedResource = pricing?.resources.find(
                ({ id }) => id === resource.id,
              );
              const calculation = pricedResource?.calculation;
              const selectedPrice = pricedResource?.selectedPrice;
              return (
                <li
                  key={resource.id}
                  className="border-l-2 border-border pl-2"
                >
                  <span className="font-medium">
                    {resourceTypeLabels[resource.resourceType] ??
                      resource.resourceType}
                  </span>
                  <br />
                  {resource.code ? `${resource.code} · ` : ""}
                  {resource.name}
                  <br />
                  {formatRomanianDecimal(resource.quantityPerNormBasis)}{" "}
                  {resource.unit} / {formatRomanianDecimal(norm.basisQuantity)}{" "}
                  {norm.basisUnit}
                  <br />
                  <span className="font-medium">
                    Necesar: {formatRomanianDecimal(resource.resourceQuantity)}{" "}
                    {resource.unit}
                  </span>
                  {pricedResource?.priceStatus === "zero" ? (
                    <p className="mt-1 text-muted-foreground">
                      Nu este necesar preț — cantitatea calculată este 0.
                    </p>
                  ) : pricedResource?.priceStatus === "missing" ? (
                    <p className="mt-1 text-amber-700">
                      Preț: Lipsește
                      <br />
                      Nu există un preț {currency} valabil la data evaluării.
                    </p>
                  ) : pricedResource?.priceStatus === "ambiguous" ? (
                    <p className="mt-1 text-amber-700">
                      Preț: Ambiguu — {pricedResource.eligiblePriceCount} prețuri
                      eligibile
                      <br />
                      Costul nu poate fi determinat până când situația prețului
                      este clarificată.
                    </p>
                  ) : calculation && selectedPrice ? (
                    <div className="mt-1 space-y-0.5">
                      <p>
                        Preț:{" "}
                        {formatProfessionalResourceMoney(
                          selectedPrice.price,
                          selectedPrice.currency,
                        )}{" "}
                        / {formatRomanianDecimal(selectedPrice.basisQuantity)}{" "}
                        {resource.unit}
                      </p>
                      <p>
                        Preț efectiv:{" "}
                        {formatProfessionalResourceMoney(
                          calculation.effectiveUnitPrice,
                          currency,
                        )}
                        / {resource.unit}
                      </p>
                      <p className="font-medium">
                        Cost:{" "}
                        {formatProfessionalResourceMoney(
                          calculation.resourceCost,
                          currency,
                        )}
                      </p>
                      <p className="text-muted-foreground">
                        {vatTreatmentLabels[selectedPrice.vatTreatment]} ·{" "}
                        {transportTreatmentLabels[selectedPrice.transportTreatment]}
                        <br />
                        Sursă: {selectedPrice.sourceType}
                        {selectedPrice.sourceReference
                          ? ` · ${selectedPrice.sourceReference}`
                          : ""}
                        {selectedPrice.location
                          ? ` · ${selectedPrice.location}`
                          : ""}
                        <br />
                        Valabil: {formatDate(selectedPrice.validFrom)} –{" "}
                        {selectedPrice.validTo ? formatDate(selectedPrice.validTo) : "fără termen"}
                        <br />
                        ID preț: {selectedPrice.resourcePriceId}
                      </p>
                    </div>
                  ) : null}
                  <Link
                    href={`/professional-estimates/resources/${resource.resourceId}`}
                    className="mt-1 inline-block text-primary underline-offset-4 hover:underline"
                  >
                    Vezi prețurile resursei
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {pricing?.complete && pricing.totalsByResourceType && (
          <div className="mt-3 space-y-1 border-t pt-2">
            {Object.entries(pricing.totalsByResourceType)
              .filter(([, total]) => total !== "0")
              .map(([resourceType, total]) => (
                <p key={resourceType} className="text-xs text-muted-foreground">
                  {resourceTypeLabels[resourceType] ?? resourceType}:{" "}
                  {formatProfessionalResourceMoney(total, currency)}
                </p>
              ))}
            <p className="pt-1 text-xs font-semibold text-heading">
              Cost direct resurse:{" "}
              {formatProfessionalResourceMoney(
                pricing.directResourceTotal ?? "0",
                currency,
              )}
            </p>
          </div>
        )}
      </details>
    </div>
  );
}

function DetailValue({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-heading">{children}</dd>
    </div>
  );
}

function CostLine({
  label,
  value,
  currency,
  emphasized = false,
}: {
  label: string;
  value: string;
  currency: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b py-2">
      <dt className={emphasized ? "font-semibold text-heading" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd className={`whitespace-nowrap text-right tabular-nums ${emphasized ? "font-semibold text-heading" : "font-medium"}`}>
        {formatProfessionalResourceMoney(value, currency)}
      </dd>
    </div>
  );
}
