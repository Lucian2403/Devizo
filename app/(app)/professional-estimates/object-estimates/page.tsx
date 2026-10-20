import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/ui/date-display";
import { formatProfessionalResourceMoney } from "@/lib/ui/professional-resource-money";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalObjectEstimateService } from "@/server/container";

export default async function ProfessionalObjectEstimatesPage() {
  const { org } = await requireCurrentOrg();
  const estimates = await getProfessionalObjectEstimateService().list(org.id);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-heading">Devize pe obiect</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Agregă valorile curente ale devizelor locale pe categorii explicite.
            Totalurile nu includ TVA sau costuri generale.
          </p>
        </div>
        <Button asChild>
          <Link href="/professional-estimates/object-estimates/new">
            Deviz pe obiect nou
          </Link>
        </Button>
      </div>

      {estimates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nu există încă devize pe obiect.
            </p>
            <Button asChild variant="outline">
              <Link href="/professional-estimates/object-estimates/new">
                Deviz pe obiect nou
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {estimates.map((estimate) => (
            <Link
              key={estimate.id}
              href={`/professional-estimates/object-estimates/${estimate.id}`}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-heading">{estimate.name}</h2>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {estimate.currency}
                    </span>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Obiect</dt>
                    <dd>{estimate.constructionObjectName}</dd>
                    <dt className="text-muted-foreground">Data evaluării</dt>
                    <dd>{formatDate(estimate.valuationDate)}</dd>
                    <dt className="text-muted-foreground">Devize locale incluse</dt>
                    <dd>{estimate.includedCount}</dd>
                    <dt className="text-muted-foreground">Stare</dt>
                    <dd>{estimate.complete ? "Complet" : "Incomplet"}</dd>
                    {estimate.total !== null && (
                      <>
                        <dt className="text-muted-foreground">Total deviz pe obiect</dt>
                        <dd className="font-medium tabular-nums">
                          {formatProfessionalResourceMoney(estimate.total, estimate.currency)}
                        </dd>
                      </>
                    )}
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
