import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/ui/date-display";
import { formatProfessionalResourceMoney } from "@/lib/ui/professional-resource-money";
import {
  PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS,
  type ProfessionalGeneralEstimateChapterTotals,
} from "@/domain/professional-estimates/calculation";
import {
  ProfessionalGeneralEstimateNotFoundError,
} from "@/domain/professional-estimates/professional-general-estimate.service";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  getProfessionalGeneralEstimateService,
  getProfessionalTemporaryWorksService,
} from "@/server/container";
import {
  addProfessionalGeneralEstimateEntry,
  updateProfessionalGeneralEstimateEntry,
} from "../../actions";
import {
  AddObjectEstimateForm,
  GeneralEstimateEntryControls,
} from "../general-estimate-forms";
import {
  installTemporaryWorksRulePack,
  saveTemporaryWorksDecision,
} from "../temporary-works-actions";
import {
  TemporaryWorksDecisionForm,
  TemporaryWorksPackForm,
} from "../temporary-works-forms";

const columns = [
  ["constructionWorks", "Lucrări de construcții"],
  ["installationWorks", "Lucrări de montaj"],
  ["equipmentFurnitureInventory", "Utilaj, mobilier și inventar"],
  ["otherCosts", "Alte cheltuieli"],
  ["total", "Total"],
] as const;

export default async function ProfessionalGeneralEstimateDetailPage({
  params,
}: {
  params: Promise<{ generalEstimateId: string }>;
}) {
  const { generalEstimateId } = await params;
  const { org } = await requireCurrentOrg();
  let estimate;
  try {
    estimate = await getProfessionalGeneralEstimateService().get(
      org.id,
      generalEstimateId,
    );
  } catch (error) {
    if (error instanceof ProfessionalGeneralEstimateNotFoundError) notFound();
    throw error;
  }
  const temporaryWorks = await getProfessionalTemporaryWorksService().getView(
    org.id,
    {
      id: estimate.id,
      valuationDate: estimate.valuationDate,
      currency: estimate.currency,
      complete: estimate.complete,
      totals: estimate.totals,
    },
  );
  const selectedTemporaryRule =
    temporaryWorks.decision?.ruleDefinitionId
      ? temporaryWorks.installedRules.find(
          (rule) => rule.id === temporaryWorks.decision?.ruleDefinitionId,
        ) ?? null
      : null;
  const addEntryAction = addProfessionalGeneralEstimateEntry.bind(
    null,
    generalEstimateId,
  );
  const installTemporaryPackAction = installTemporaryWorksRulePack.bind(
    null,
    generalEstimateId,
  );
  const saveTemporaryWorksAction = saveTemporaryWorksDecision.bind(
    null,
    generalEstimateId,
  );

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/professional-estimates/general-estimates">← Înapoi la devizele generale</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-heading">
          Deviz general: {estimate.name}
        </h1>
      </div>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
            <Detail label="Cod">{estimate.code || "—"}</Detail>
            <Detail label="Data evaluării">{formatDate(estimate.valuationDate)}</Detail>
            <Detail label="Monedă">{estimate.currency}</Detail>
            {estimate.notes && <Detail label="Note">{estimate.notes}</Detail>}
          </dl>
          <p className="mt-4 border-t pt-3 text-sm text-amber-800">
            Devizul general folosește valorile curente ale devizelor pe obiect.
            Valorile nu sunt încă înghețate într-o versiune finală.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Rezerva, alte ajustări normative aplicabile și TVA nu sunt încă calculate.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Devize pe obiect asociate</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Nr.</th>
                  <th className="px-3 py-2 font-medium">Deviz pe obiect / proveniență</th>
                  <th className="px-3 py-2 font-medium">Capitol</th>
                  {columns.map(([, label]) => (
                    <th key={label} className="px-3 py-2 text-right font-medium">{label}</th>
                  ))}
                  <th className="px-3 py-2 font-medium">Stare</th>
                  <th className="px-3 py-2 font-medium">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {estimate.entries.map((entry) => {
                  const source = entry.objectEstimate;
                  const totals =
                    source?.complete && !entry.eligibilityError
                      ? source.totals
                      : null;
                  return (
                    <tr key={entry.id} className="border-b border-border/70 align-top last:border-0">
                      <td className="px-3 py-3">
                        {entry.chapterNumber}-{entry.chapterPositionNumber}
                      </td>
                      <td className="px-3 py-3">
                        {source ? (
                          <>
                            <Link
                              className="font-medium text-primary underline-offset-4 hover:underline"
                              href={`/professional-estimates/object-estimates/${source.id}`}
                            >
                              {source.name}
                            </Link>
                            <p className="mt-1 break-all text-xs text-muted-foreground">
                              Intrare generală: {entry.id}<br />
                              Deviz pe obiect: {source.id}<br />
                              Obiect de construcție: {source.constructionObjectName} ({source.constructionObjectId})<br />
                              Data evaluării: {formatDate(source.valuationDate)} · {source.currency}
                            </p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Deviz pe obiect indisponibil</span>
                        )}
                        {entry.eligibilityError && (
                          <p className="mt-1 text-xs text-destructive">{entry.eligibilityError}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        Capitolul {entry.chapterNumber}
                      </td>
                      {columns.map(([key]) => (
                        <td key={key} className="whitespace-nowrap px-3 py-3 text-right tabular-nums">
                          {totals
                            ? formatProfessionalResourceMoney(totals[key], estimate.currency)
                            : "—"}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        {source?.complete && !entry.eligibilityError ? "Complet" : "Incomplet"}
                        {!entry.included && (
                          <span className="block text-xs text-muted-foreground">Exclus</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <GeneralEstimateEntryControls
                          action={updateProfessionalGeneralEstimateEntry.bind(
                            null,
                            generalEstimateId,
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
                    <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                      Nu există devize pe obiect asociate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Pozițiile sunt numerotate pe capitol și păstrează proveniența live.
            Asocierea și capitolul sunt alegeri explicite.
          </p>
          <div className="border-t pt-4">
            <h2 className="mb-3 text-sm font-semibold text-heading">Asociază un deviz pe obiect</h2>
            <AddObjectEstimateForm action={addEntryAction} candidates={estimate.candidates} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Subtotal surse înainte de cheltuieli normative</CardTitle></CardHeader>
        <CardContent>
          {estimate.complete && estimate.totals ? (
            <div className="space-y-5">
              {PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS.map(({ number, label }) => (
                <section key={number} className="space-y-2 border-b pb-4 last:border-0">
                  <h2 className="font-semibold text-heading">
                    Capitolul {number} — {label}
                  </h2>
                  <TotalsRow
                    totals={estimate.totals!.chapters[number]}
                    currency={estimate.currency}
                  />
                </section>
              ))}
              <section className="space-y-2 border-t pt-4">
                <h2 className="font-semibold text-heading">Subtotal surse — capitolele 1–12</h2>
                <TotalsRow totals={estimate.totals.totals} currency={estimate.currency} emphasized />
              </section>
            </div>
          ) : (
            <p className="text-sm font-medium text-amber-800">
              Devizul general este incomplet. Includeți cel puțin un deviz pe obiect
              complet, cu aceeași dată și monedă. Nu este afișat niciun subtotal
              monetar până la completare.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cheltuieli normative ale devizului general</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-4">
            <div>
              <h2 className="font-semibold text-heading">
                Clădiri și construcții speciale provizorii
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                NCM L.02.05-2012 · Capitolul 8 — Organizarea construcțiilor.
                Baza procentuală folosește numai lucrările de construcții și
                montaj din capitolele 1–7.
              </p>
            </div>

            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium text-heading">
                Pachetul oficial NCM L.02.05-2012
              </summary>
              <div className="pt-4">
                <TemporaryWorksPackForm
                  action={installTemporaryPackAction}
                  view={temporaryWorks}
                />
              </div>
            </details>

            {temporaryWorks.base && (
              <dl className="grid gap-3 rounded-lg border p-4 text-sm sm:grid-cols-3">
                <Detail label="Bază construcții, cap. 1–7">
                  {formatProfessionalResourceMoney(
                    temporaryWorks.base.construction,
                    estimate.currency,
                  )}
                </Detail>
                <Detail label="Bază montaj, cap. 1–7">
                  {formatProfessionalResourceMoney(
                    temporaryWorks.base.installation,
                    estimate.currency,
                  )}
                </Detail>
                <Detail label="Bază combinată">
                  {formatProfessionalResourceMoney(
                    temporaryWorks.base.combined,
                    estimate.currency,
                  )}
                </Detail>
              </dl>
            )}

            <TemporaryWorksDecisionForm
              key={[
                temporaryWorks.decision?.id ?? "new",
                temporaryWorks.decision?.mode ?? "normative_rate",
                temporaryWorks.decision?.ruleDefinitionId ?? "",
                temporaryWorks.decision?.projectCondition ?? "",
                temporaryWorks.decision?.updatedAt?.toISOString() ?? "",
              ].join(":")}
              action={saveTemporaryWorksAction}
              view={temporaryWorks}
            />

            {temporaryWorks.error && (
              <p className="text-sm font-medium text-amber-800">
                {temporaryWorks.error}
              </p>
            )}

            {temporaryWorks.result && (
              <div className="space-y-4 rounded-lg border p-4">
                <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Detail label="Metodă">
                    {temporaryWorks.result.mode === "normative_rate"
                      ? "Normă procentuală NCM"
                      : temporaryWorks.result.mode === "project_calculation"
                        ? "Calcul conform proiectului"
                        : "Bază obiectiv zero"}
                  </Detail>
                  {selectedTemporaryRule && (
                    <>
                      <Detail label="Poziția NCM">
                        {selectedTemporaryRule.ruleCode} — {selectedTemporaryRule.name}
                      </Detail>
                      <Detail label="Normă">
                        {selectedTemporaryRule.value}%
                      </Detail>
                      <Detail label="Referință">
                        {selectedTemporaryRule.sourceReference}
                      </Detail>
                    </>
                  )}
                  {temporaryWorks.result.coefficient && (
                    <Detail label="Coeficient">
                      {temporaryWorks.result.coefficient}
                    </Detail>
                  )}
                  {temporaryWorks.decision?.mode === "project_calculation" &&
                    temporaryWorks.decision.projectReference && (
                      <Detail label="Referință proiect">
                        {temporaryWorks.decision.projectReference}
                      </Detail>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Detail label="Construcții provizorii — construcții">
                    {formatProfessionalResourceMoney(
                      temporaryWorks.result.temporaryConstruction,
                      estimate.currency,
                    )}
                  </Detail>
                  <Detail label="Construcții provizorii — montaj">
                    {formatProfessionalResourceMoney(
                      temporaryWorks.result.temporaryInstallation,
                      estimate.currency,
                    )}
                  </Detail>
                  <Detail label="Total construcții provizorii">
                    {formatProfessionalResourceMoney(
                      temporaryWorks.result.temporaryTotal,
                      estimate.currency,
                    )}
                  </Detail>
                  <Detail label="Sume recuperate (15%)">
                    {formatProfessionalResourceMoney(
                      temporaryWorks.result.recoverableAmount,
                      estimate.currency,
                    )}
                  </Detail>
                </div>
                <p className="text-xs text-muted-foreground">
                  Suma recuperabilă este prezentată separat conform NCM
                  L.02.05-2012 pct. 4.5 și nu se scade din subtotalul
                  capitolelor 1–12 în această etapă.
                </p>
              </div>
            )}

            <div className="space-y-1 text-xs text-muted-foreground">
              <p>
                Lucrările provizorii neprevăzute în lista de titluri sunt
                tratate prin cheltuielile de regie conform NCM L.02.05-2012
                pct. 3.3 și nu se adaugă automat aici.
              </p>
              <p>
                Cheltuielile individuale prevăzute de proiect la pct. 3.4 nu
                sunt calculate automat în acest milestone.
              </p>
              <p>
                Construcțiile provizorii netipice complexe care au devize pe
                obiect separate nu sunt adăugate încă o dată prin această
                secțiune.
              </p>
            </div>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subtotal capitolele 1–12 după ajustarea normativă</CardTitle>
        </CardHeader>
        <CardContent>
          {temporaryWorks.adjustedGeneralCalculationComplete &&
          temporaryWorks.adjustedTotals ? (
            <div className="space-y-5">
              {PROFESSIONAL_GENERAL_ESTIMATE_CHAPTERS.map(({ number, label }) => (
                <section
                  key={number}
                  className="space-y-2 border-b pb-4 last:border-0"
                >
                  <h2 className="font-semibold text-heading">
                    Capitolul {number} — {label}
                  </h2>
                  <TotalsRow
                    totals={temporaryWorks.adjustedTotals!.chapters[number]}
                    currency={estimate.currency}
                  />
                </section>
              ))}
              <section className="space-y-2 border-t pt-4">
                <h2 className="font-semibold text-heading">
                  Subtotal capitolele 1–12 după această ajustare
                </h2>
                <TotalsRow
                  totals={temporaryWorks.adjustedTotals.totals}
                  currency={estimate.currency}
                  emphasized
                />
              </section>
              <p className="text-sm font-medium text-amber-800">
                Acesta nu este totalul final al investiției. Costurile pentru
                timp friguros, alte cheltuieli normative, rezerva, SDNC și TVA
                nu sunt încă incluse.
              </p>
            </div>
          ) : (
            <p className="text-sm font-medium text-amber-800">
              Subtotalul ajustat nu este disponibil până când sursele de bază și
              calculul construcțiilor provizorii sunt complete.
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

function TotalsRow({
  totals,
  currency,
  emphasized = false,
}: {
  totals: ProfessionalGeneralEstimateChapterTotals;
  currency: string;
  emphasized?: boolean;
}) {
  const values: Array<[string, string]> = [
    ["Lucrări de construcții", totals.constructionWorks],
    ["Lucrări de montaj", totals.installationWorks],
    ["Utilaj, mobilier și inventar", totals.equipmentFurnitureInventory],
    ["Alte cheltuieli", totals.otherCosts],
    ["Total", totals.total],
  ];
  return (
    <dl className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-5 ${emphasized ? "font-semibold" : ""}`}>
      {values.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 whitespace-nowrap text-sm tabular-nums">
            {formatProfessionalResourceMoney(value, currency)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
