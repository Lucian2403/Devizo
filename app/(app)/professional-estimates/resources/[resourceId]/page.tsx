import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ProfessionalResourcePriceNotFoundError,
} from "@/domain/professional-estimates/professional-resource-prices.service";
import { SUPPORTED_CURRENCIES } from "@/domain/shared/types";
import { formatRomanianDecimal } from "@/lib/ui/decimal-display";
import { formatProfessionalResourceMoney } from "@/lib/ui/professional-resource-money";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalResourcePricesService } from "@/server/container";
import { createProfessionalResourcePrice } from "../../actions";
import { CreateResourcePriceForm } from "../resource-price-forms";

const resourceTypeLabels: Record<string, string> = {
  labor: "Manoperă",
  material: "Material",
  machinery: "Utilaj",
  transport: "Transport",
  energy: "Energie",
  other: "Altele",
};

const priceSourceLabels: Record<string, string> = {
  manual: "Manual",
  supplier: "Furnizor",
  invoice: "Factură",
  market: "Piață",
  import: "Import",
};

export default async function ProfessionalResourceDetailPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await params;
  const { org } = await requireCurrentOrg();
  let detail;
  try {
    detail =
      await getProfessionalResourcePricesService().getProfessionalResourceWithPrices(
        org.id,
        resourceId,
      );
  } catch (error) {
    if (error instanceof ProfessionalResourcePriceNotFoundError) notFound();
    throw error;
  }
  const { resource, prices } = detail;
  const createPriceAction = createProfessionalResourcePrice.bind(
    null,
    resource.id,
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/professional-estimates/resources">
          ← Înapoi la resurse și prețuri
        </Link>
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>
            {resource.code ? `${resource.code} · ` : ""}
            {resource.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailValue label="Tip">
              {resourceTypeLabels[resource.resourceType] ?? resource.resourceType}
            </DetailValue>
            <DetailValue label="Unitate">{resource.unit}</DetailValue>
            <DetailValue label="Sursă / proveniență">
              {resource.source.title} · {resource.source.code}
            </DetailValue>
            <DetailValue label="Tip sursă">
              {resource.source.type} · statut oficial:{" "}
              {resource.source.officialStatus}
            </DetailValue>
            {resource.description && (
              <DetailValue label="Descriere">{resource.description}</DetailValue>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Prețuri înregistrate</CardTitle>
        </CardHeader>
        <CardContent>
          {prices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nu există încă prețuri pentru această resursă.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Preț / cantitate</th>
                    <th className="py-2 pr-3 font-medium">ID preț</th>
                    <th className="py-2 pr-3 font-medium">Monedă</th>
                    <th className="py-2 pr-3 font-medium">Valabilitate</th>
                    <th className="py-2 pr-3 font-medium">Tip sursă</th>
                    <th className="py-2 pr-3 font-medium">Referință</th>
                    <th className="py-2 font-medium">Localitate / regiune</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((price) => (
                    <tr key={price.id} className="border-b align-top last:border-0">
                      <td className="py-3 pr-3 tabular-nums">
                        {formatProfessionalResourceMoney(price.price, price.currency)}
                        <span className="block text-xs text-muted-foreground">
                          / {formatRomanianDecimal(price.basisQuantity)}{" "}
                          {resource.unit}
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-mono text-xs">{price.id}</td>
                      <td className="py-3 pr-3">{price.currency}</td>
                      <td className="py-3 pr-3">
                        {price.validFrom} – {price.validTo ?? "fără termen"}
                      </td>
                      <td className="py-3 pr-3">
                        {priceSourceLabels[price.sourceType] ?? price.sourceType}
                      </td>
                      <td className="py-3 pr-3">{price.sourceReference ?? "—"}</td>
                      <td className="py-3">{price.location ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preț nou</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Prețurile manuale sunt date introduse de companie, nu valori
            oficiale. Se folosește suma exact introdusă; nu se adaugă automat
            TVA, transport sau alte ajustări.
          </p>
          <CreateResourcePriceForm
            action={createPriceAction}
            currencies={SUPPORTED_CURRENCIES}
            defaultDate={new Date().toISOString().slice(0, 10)}
          />
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
      <dd className="mt-1 break-words text-sm font-medium text-heading">
        {children}
      </dd>
    </div>
  );
}
