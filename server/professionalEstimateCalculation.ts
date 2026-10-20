import type { OrganizationId } from "@/domain/shared/types";
import type { ProfessionalEstimateWorkspace } from "@/domain/professional-estimates/professional-estimate-workspace.repository";
import {
  calculateProfessionalCostStack,
  parseDecimal,
  resolveProfessionalRule,
  toDecimalString,
  type ProfessionalCostStackInput,
  type ResolvedCostRuleReference,
  type ResourceTypeTotals,
} from "@/domain/professional-estimates/calculation";
import { calculateProcurementStorage } from "@/domain/professional-estimates/calculation/procurement-storage";
import type {
  PersistedCostComponent,
  ProfessionalCostComponentDecisionRecord,
} from "@/domain/professional-estimates/professional-cost-component-decisions.repository";
import { isStoredCostComponentDecisionStale } from "@/domain/professional-estimates/professional-cost-component-decisions.service";
import type { ProfessionalRuleDefinitionRecord } from "@/domain/professional-estimates/professional-rule-definitions.repository";
import {
  getProfessionalCostComponentDecisionService,
  getProfessionalNormLibraryService,
  getProfessionalResourcePricesService,
  getProfessionalRuleDefinitionService,
} from "@/server/container";

const costComponents: PersistedCostComponent[] = [
  "labor_contributions",
  "material_transport",
  "overhead",
  "estimated_profit",
];

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

export async function getProfessionalEstimateCalculation(
  organizationId: OrganizationId,
  workspace: ProfessionalEstimateWorkspace,
) {
  const calculationContextId = workspace.context.id;
  const normPresentation =
    await getProfessionalNormLibraryService().getNormWorkspacePresentation(
      organizationId,
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
      organizationId,
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
    organizationId,
    "procurement_storage",
  );
  const procurement = calculateProcurementStorage(
    resourcePricing,
    workspace.context,
    procurementCandidates,
  );
  const allDefinitions = await ruleService.listRuleDefinitions(organizationId);
  const definitionsById = new Map(
    allDefinitions.map((definition) => [definition.id, definition]),
  );
  const savedComponentDecisions =
    await getProfessionalCostComponentDecisionService().listForContext(
      organizationId,
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
      ? await ruleService.loadCandidatesForComponent(organizationId, component)
      : [];
    const eligibleCandidates = contextComplete
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
              parseDecimal(
                position.directResourceTotal ?? "0",
                "directResourceTotal",
              ),
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
    parseDecimal(
      resourceCalculation.directResourceTotal,
      "directResourceTotal",
    ).isZero();
  const materialTransportZero =
    materialTransportDecision?.status === "zero_basis" ||
    materialTransportDecision?.status === "not_applicable" ||
    (materialTransportDecision?.status === "applied" &&
      (materialTransportDecision.method === "percentage_of_material"
        ? zeroResourceBases.material_transport
        : materialTransportDecision.method === "fixed_amount"
          ? parseDecimal(
              materialTransportDecision.amount,
              "materialTransport",
            ).isZero()
          : false));
  const procurementZero =
    procurementDecision?.status === "zero_basis" ||
    (procurementDecision?.status === "applied" &&
      procurement.procurementStorageTotal !== null &&
      parseDecimal(
        procurement.procurementStorageTotal,
        "procurementStorage",
      ).isZero());
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
    { title: "Poziții de lucrări", complete: workspace.items.length > 0 },
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

  return {
    normPresentation,
    pricingPositions,
    resourcePricing,
    pricesComplete,
    allPricedPositions,
    procurement,
    savedComponentDecisions,
    contextComplete,
    savedFor,
    eligibleFor,
    zeroResourceBases,
    directCostZero,
    makeComponentDecision,
    stackResult,
    progressSteps,
    isSavedDecisionStale: (component: PersistedCostComponent) =>
      isStoredCostComponentDecisionStale(
        savedFor(component),
        eligibleFor(component).map(({ id }) => id),
      ),
  };
}
