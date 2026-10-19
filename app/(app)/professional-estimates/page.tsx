import Link from "next/link";
import { formatDate } from "@/lib/ui/date-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalEstimateWorkspaceService } from "@/server/container";

export default async function ProfessionalEstimatesPage() {
  const { org } = await requireCurrentOrg();
  const estimates =
    await getProfessionalEstimateWorkspaceService().listProfessionalEstimates(
      org.id,
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-heading">
            Devize profesionale
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Devize calculate prin metoda de resurse, separate de ofertele
            comerciale.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/professional-estimates/new">Deviz profesional nou</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/professional-estimates/norms">Biblioteca de norme</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/professional-estimates/resources">
              Resurse și prețuri
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/professional-estimates/rules">Reguli de calcul</Link>
          </Button>
        </div>
      </div>

      {estimates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Nu există încă devize profesionale.
            </p>
            <Button asChild variant="outline">
              <Link href="/professional-estimates/new">
                Deviz profesional nou
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {estimates.map((estimate) => (
            <Link
              key={estimate.context.id}
              href={`/professional-estimates/${estimate.context.id}`}
              className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition-colors hover:border-primary/50">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-heading">
                      {estimate.context.name}
                    </h2>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {estimate.context.currency}
                    </span>
                  </div>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="text-muted-foreground">Obiect</dt>
                    <dd>{estimate.constructionObject.name}</dd>
                    <dt className="text-muted-foreground">Listă</dt>
                    <dd>
                      {estimate.workQuantityList.name} · Revizia{" "}
                      {estimate.workQuantityList.revision}
                    </dd>
                    <dt className="text-muted-foreground">Data evaluării</dt>
                    <dd>{formatDate(estimate.context.valuationDate)}</dd>
                    <dt className="text-muted-foreground">Poziții</dt>
                    <dd>
                      {estimate.itemCount === 0
                        ? "Nu există încă poziții"
                        : estimate.itemCount}
                    </dd>
                    <dt className="text-muted-foreground">Metodă</dt>
                    <dd>Metoda de resurse</dd>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
