import Link from "next/link";
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
  getProfessionalNormLibraryService,
  getProfessionalResourcePricesService,
} from "@/server/container";
import {
  assignNormToWorkItem,
  createWorkQuantityItem,
  updateWorkQuantityItem,
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
    resourcePricing.pricedResourceCount === resourcePricing.requiredPriceCount;
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
    { title: "Calcul profesional", complete: false },
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
              {workspace.context.valuationDate}
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
                {workspace.workQuantityList.sourceDate}
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
              din prețurile eligibile. Nu includ ajustări normative, TVA,
              transport sau profit.
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
                            {positionPricing && (
                              <span className="block whitespace-nowrap text-xs text-amber-700">
                                Prețuri incomplete
                              </span>
                            )}
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
            Norma nu are încă resurse.
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
                        Sursă: {selectedPrice.sourceType}
                        {selectedPrice.sourceReference
                          ? ` · ${selectedPrice.sourceReference}`
                          : ""}
                        {selectedPrice.location
                          ? ` · ${selectedPrice.location}`
                          : ""}
                        <br />
                        Valabil: {selectedPrice.validFrom} –{" "}
                        {selectedPrice.validTo ?? "fără termen"}
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
