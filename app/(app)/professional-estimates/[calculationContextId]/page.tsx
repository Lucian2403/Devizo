import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfessionalEstimateNotFoundError } from "@/domain/professional-estimates/professional-estimate-workspace.service";
import { formatDecimalRo } from "@/lib/i18n/decimal";
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
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/professional-estimates">← Înapoi la devize</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-heading">
          Deviz: {workspace.context.name}
        </h1>
      </div>

      <Card>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailValue label="Obiect">
            {workspace.constructionObject.name}
          </DetailValue>
          {workspace.constructionObject.code && (
            <DetailValue label="Cod obiect">
              {workspace.constructionObject.code}
            </DetailValue>
          )}
          <DetailValue label="Lista de cantități">
            {workspace.workQuantityList.name} · Revizia{" "}
            {workspace.workQuantityList.revision}
          </DetailValue>
          <DetailValue label="Data evaluării">
            {workspace.context.valuationDate}
          </DetailValue>
          <DetailValue label="Moneda">{workspace.context.currency}</DetailValue>
          <DetailValue label="Metodă">Metoda de resurse</DetailValue>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Progresul devizului</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {progressSteps.map((step) => (
              <li
                key={step.title}
                className="flex items-center gap-2 text-sm text-secondary-foreground"
              >
                <span
                  aria-hidden="true"
                  className={
                    step.complete ||
                    (step.title === "Poziții de lucrări" && workspace.items.length > 0)
                      ? "text-emerald-700"
                      : "text-muted-foreground"
                  }
                >
                  {step.complete ||
                  (step.title === "Poziții de lucrări" && workspace.items.length > 0)
                    ? "✓"
                    : "○"}
                </span>
                {step.title}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-muted-foreground">
            Costul va putea fi calculat după alocarea unei norme și a resurselor.
          </p>
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
                      {formatDecimalRo(item.quantity)}
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
        <CardHeader>
          <CardTitle>Adaugă poziție</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
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
    <>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-heading">{children}</dd>
    </>
  );
}
