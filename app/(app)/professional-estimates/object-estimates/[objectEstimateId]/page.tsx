import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/ui/date-display";
import { formatProfessionalResourceMoney } from "@/lib/ui/professional-resource-money";
import { ProfessionalObjectEstimateNotFoundError } from "@/domain/professional-estimates/professional-object-estimate.service";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalObjectEstimateService } from "@/server/container";
import {
  addProfessionalObjectEstimateEntry,
  updateProfessionalObjectEstimateEntry,
} from "../../actions";
import {
  AddLocalEstimateForm,
  ObjectEstimateEntryControls,
} from "../object-estimate-forms";

const categoryLabels = {
  construction_works: "Lucrări de construcții",
  installation_works: "Lucrări de montaj",
  equipment_furniture_inventory: "Utilaj, mobilier și inventar",
  other_costs: "Alte cheltuieli",
} as const;

export default async function ProfessionalObjectEstimateDetailPage({
  params,
}: {
  params: Promise<{ objectEstimateId: string }>;
}) {
  const { objectEstimateId } = await params;
  const { org } = await requireCurrentOrg();
  let estimate;
  try {
    estimate = await getProfessionalObjectEstimateService().get(
      org.id,
      objectEstimateId,
    );
  } catch (error) {
    if (error instanceof ProfessionalObjectEstimateNotFoundError) notFound();
    throw error;
  }
  const addEntryAction = addProfessionalObjectEstimateEntry.bind(
    null,
    objectEstimateId,
  );

  return (
    <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/professional-estimates/object-estimates">← Înapoi la devizele pe obiect</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-heading">
          Deviz pe obiect: {estimate.name}
        </h1>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
            <Detail label="Obiect">{estimate.constructionObjectName}</Detail>
            <Detail label="ID obiect">{estimate.constructionObjectId}</Detail>
            <Detail label="Cod">{estimate.code || "—"}</Detail>
            <Detail label="Data evaluării">{formatDate(estimate.valuationDate)}</Detail>
            <Detail label="Monedă">{estimate.currency}</Detail>
            {estimate.notes && <Detail label="Note">{estimate.notes}</Detail>}
          </dl>
          <p className="mt-4 border-t pt-3 text-sm text-amber-800">
            Devizul pe obiect folosește valorile curente ale devizelor locale.
            Valorile nu sunt încă înghețate într-o versiune finală.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Devize locale</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Poz.</th>
                  <th className="px-3 py-2 font-medium">Deviz local / proveniență</th>
                  <th className="px-3 py-2 font-medium">Categorie</th>
                  <th className="px-3 py-2 font-medium">Data evaluării</th>
                  <th className="px-3 py-2 text-right font-medium">Subtotal local</th>
                  <th className="px-3 py-2 font-medium">Stare</th>
                  <th className="px-3 py-2 font-medium">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {estimate.entries.map((entry) => {
                  const local = entry.localEstimate;
                  const localComplete =
                    local?.complete === true &&
                    local.subtotal !== null;
                  return (
                    <tr key={entry.id} className="border-b border-border/70 align-top last:border-0">
                      <td className="px-3 py-3">{entry.positionNumber}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{local?.name ?? "Deviz local indisponibil"}</div>
                        <p className="mt-1 break-all text-xs text-muted-foreground">
                          Intrare: {entry.id}<br />
                          Context de calcul: {entry.calculationContextId}<br />
                          Obiect: {estimate.constructionObjectId}
                        </p>
                        {entry.eligibilityError && (
                          <p className="mt-1 text-xs text-destructive">{entry.eligibilityError}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">{categoryLabels[entry.costCategory]}</td>
                      <td className="px-3 py-3">
                        {local ? formatDate(local.valuationDate) : "—"}
                        {local && <span className="block text-xs text-muted-foreground">{local.currency}</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {localComplete
                          ? formatProfessionalResourceMoney(local.subtotal!, local.currency)
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {localComplete ? "Complet" : "Incomplet"}
                        {entry.eligibilityError && (
                          <span className="block text-xs text-destructive">
                            Neeligibil pentru agregare
                          </span>
                        )}
                        {!entry.included && <span className="block text-xs text-muted-foreground">Exclus</span>}
                      </td>
                      <td className="px-3 py-3">
                        <ObjectEstimateEntryControls
                          action={updateProfessionalObjectEstimateEntry.bind(
                            null,
                            objectEstimateId,
                            entry.id,
                          )}
                          entry={entry}
                        />
                      </td>
                    </tr>
                  );
                })}
                {estimate.entries.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      Nu există devize locale asociate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Valorile locale sunt recalculate la fiecare afișare. Categoriile sunt
            alese explicit și nu sunt deduse din norma sau tipul resurselor.
          </p>
          <div className="border-t pt-4">
            <h2 className="mb-3 text-sm font-semibold text-heading">Asociază un deviz local</h2>
            <AddLocalEstimateForm action={addEntryAction} candidates={estimate.candidates} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Totaluri pe categorii</CardTitle></CardHeader>
        <CardContent>
          {estimate.complete && estimate.totals ? (
            <>
              <dl className="space-y-2">
                <Total label="Lucrări de construcții" value={estimate.totals.constructionWorks} currency={estimate.currency} />
                <Total label="Lucrări de montaj" value={estimate.totals.installationWorks} currency={estimate.currency} />
                <Total label="Utilaj, mobilier și inventar" value={estimate.totals.equipmentFurnitureInventory} currency={estimate.currency} />
                <Total label="Alte cheltuieli" value={estimate.totals.otherCosts} currency={estimate.currency} />
                <Total label="Total deviz pe obiect" value={estimate.totals.total} currency={estimate.currency} emphasized />
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Subtotal intermediar. TVA și costurile generale nu sunt calculate aici.
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-amber-800">
              Devizul pe obiect este incomplet. Includeți cel puțin un deviz local
              complet, cu aceeași dată și monedă. Nu este afișat niciun total
              monetar până la completare.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{children}</dd>
    </div>
  );
}

function Total({
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
    <div className={`flex justify-between gap-4 ${emphasized ? "border-t pt-3 font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd className="whitespace-nowrap text-right tabular-nums">
        {formatProfessionalResourceMoney(value, currency)}
      </dd>
    </div>
  );
}
