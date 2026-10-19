import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PROFESSIONAL_RESOURCE_TYPES } from "@/domain/professional-estimates/types";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalResourcePricesService } from "@/server/container";

const resourceTypeLabels: Record<
  (typeof PROFESSIONAL_RESOURCE_TYPES)[number],
  string
> = {
  labor: "Manoperă",
  material: "Material",
  machinery: "Utilaj",
  transport: "Transport",
  energy: "Energie",
  other: "Altele",
};

export default async function ProfessionalResourcesPage() {
  const { org } = await requireCurrentOrg();
  const resources =
    await getProfessionalResourcePricesService().listProfessionalResourcesWithPrices(
      org.id,
    );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/professional-estimates">
              ← Înapoi la devize profesionale
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-heading">
            Resurse și prețuri
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Registrul prețurilor resurselor profesionale este separat de
            catalogul comercial. Prețurile înregistrate aici nu includ ajustări
            sau taxe decât dacă acestea sunt documentate explicit.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/professional-estimates/norms">Biblioteca de norme</Link>
        </Button>
      </div>

      {resources.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nu există încă resurse profesionale în companie. Resursele sunt
            create în componența normelor profesionale.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Cod</th>
                  <th className="px-4 py-3 font-medium">Resursă</th>
                  <th className="px-4 py-3 font-medium">Tip</th>
                  <th className="px-4 py-3 font-medium">UM</th>
                  <th className="px-4 py-3 font-medium">Sursă / proveniență</th>
                  <th className="px-4 py-3 text-right font-medium">Prețuri</th>
                </tr>
              </thead>
              <tbody>
                {resources.map(({ resource, prices }) => (
                  <tr key={resource.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{resource.code ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/professional-estimates/resources/${resource.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {resource.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {resourceTypeLabels[resource.resourceType]}
                    </td>
                    <td className="px-4 py-3">{resource.unit}</td>
                    <td className="px-4 py-3">
                      <span>{resource.source.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {resource.source.type} · {resource.source.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {prices.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
