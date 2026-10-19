import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProfessionalCostStackComponent } from "@/domain/professional-estimates/calculation";
import type { PersistedCostComponent } from "@/domain/professional-estimates/professional-cost-component-decisions.repository";
import { formatDate } from "@/lib/ui/date-display";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalRuleDefinitionService } from "@/server/container";
import { createCompanyProfessionalRule } from "../actions";
import { CreateCompanyRuleForm } from "./rule-forms";

const componentLabels: Record<ProfessionalCostStackComponent, string> = {
  labor_contributions: "Contribuții aferente manoperei",
  material_transport: "Transport materiale",
  procurement_storage: "Aprovizionare-depozitare",
  overhead: "Cheltuieli de regie",
  estimated_profit: "Beneficiu estimat",
};

const components: PersistedCostComponent[] = [
  "labor_contributions",
  "material_transport",
  "overhead",
  "estimated_profit",
];
const originLabels: Record<string, string> = {
  normative_sector_average: "Medie sectorială normativă",
  company_individual: "Regulă internă a companiei",
  contract_agreed: "Agreată contractual",
  statutory: "Sursă statutară",
};

export default async function ProfessionalCalculationRulesPage() {
  const { org } = await requireCurrentOrg();
  const rules =
    await getProfessionalRuleDefinitionService().listRuleDefinitions(org.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/professional-estimates">← Înapoi la devize</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-heading">Reguli de calcul</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Reguli profesionale reutilizabile pentru calcul. Regulile interne ale
          companiei nu sunt reguli normative oficiale.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regulă internă nouă</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Valorile interne trebuie să provină din datele justificate ale
            companiei sau din configurarea contractuală. Devizo nu le califică
            drept valori normative oficiale și nu acordă aprobare legală.
          </p>
          {components.map((component) => (
            <details key={component} className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium text-heading">
                {componentLabels[component]}
              </summary>
              <div className="pt-4">
                <CreateCompanyRuleForm
                  action={createCompanyProfessionalRule}
                  component={component}
                />
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="calculation-rules-heading">
        <h2 id="calculation-rules-heading" className="text-lg font-semibold text-heading">
          Biblioteca companiei
        </h2>
        {rules.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nu există încă reguli profesionale.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="space-y-3 p-5">
                  <div>
                    <h3 className="font-semibold text-heading">{rule.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {componentLabels[rule.component]}
                    </p>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 break-all text-sm">
                    <dt className="text-muted-foreground">Origine</dt>
                    <dd>{originLabels[rule.ruleOrigin] ?? rule.ruleOrigin}</dd>
                    <dt className="text-muted-foreground">Valoare</dt>
                    <dd>{rule.value}{rule.valueType === "percent" ? "%" : ` ${rule.currency}`}</dd>
                    <dt className="text-muted-foreground">Bază</dt>
                    <dd>{rule.calculationBasis}</dd>
                    <dt className="text-muted-foreground">Valabilitate</dt>
                    <dd>{formatDate(rule.validFrom)} – {formatDate(rule.validTo)}</dd>
                    <dt className="text-muted-foreground">Perspectivă</dt>
                    <dd>{rule.estimatePerspective}</dd>
                    <dt className="text-muted-foreground">Tip lucrări</dt>
                    <dd>{rule.workKind}</dd>
                    <dt className="text-muted-foreground">Sursă</dt>
                    <dd>{rule.sourceId}</dd>
                    {rule.sourceReference && (
                      <>
                        <dt className="text-muted-foreground">Referință</dt>
                        <dd>{rule.sourceReference}</dd>
                      </>
                    )}
                  </dl>
                  {rule.ruleOrigin === "company_individual" && (
                    <p className="text-xs text-muted-foreground">
                      Valoare introdusă de companie. Devizo nu o califică drept
                      rată normativă oficială.
                    </p>
                  )}
                  {rule.notes && (
                    <p className="whitespace-pre-wrap text-sm">{rule.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
