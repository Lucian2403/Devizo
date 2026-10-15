import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfessionalEstimateNotFoundError } from "@/domain/professional-estimates/professional-estimate-workspace.service";
import { formatRomanianDecimal } from "@/lib/ui/decimal-display";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalEstimateWorkspaceService } from "@/server/container";
import {
  createWorkQuantityItem,
  updateWorkQuantityItem,
} from "../actions";
import {
  AddWorkQuantityItemForm,
  EditWorkQuantityItemForm,
} from "./item-forms";

const progressSteps = [
  { title: "Obiect și listă create", complete: true },
  { title: "Poziții de lucrări", complete: false },
  { title: "Norme alocate", complete: false },
  { title: "Resurse și prețuri", complete: false },
  { title: "Calcul profesional", complete: false },
  { title: "Formulare finale", complete: false },
];

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
                const complete =
                  step.complete ||
                  (step.title === "Poziții de lucrări" && workspace.items.length > 0);
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
              Costul va putea fi calculat după alocarea unei norme și a resurselor.
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
                {workspace.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/70 align-top last:border-0"
                  >
                    <td className="px-3 py-3">{item.positionNumber}</td>
                    <td className="px-3 py-3">{item.code || "—"}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-heading">{item.description}</div>
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
                    <td className="px-3 py-3">Nealocată</td>
                    <td className="px-3 py-3 text-right">—</td>
                  </tr>
                ))}
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
