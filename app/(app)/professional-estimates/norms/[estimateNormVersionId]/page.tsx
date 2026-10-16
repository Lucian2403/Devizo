import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NormLibraryRecordNotFoundError,
} from "@/domain/professional-estimates/professional-norm-library.service";
import { formatRomanianDecimal } from "@/lib/ui/decimal-display";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalNormLibraryService } from "@/server/container";
import {
  addInternalNormResource,
  publishInternalNormVersion,
} from "../../actions";
import {
  AddNormResourceForm,
  PublishInternalNormForm,
} from "../norm-forms";

const resourceTypeLabels: Record<string, string> = {
  labor: "Manoperă",
  material: "Material",
  machinery: "Utilaj",
  transport: "Transport",
  energy: "Energie",
  other: "Altele",
};

export default async function ProfessionalNormDetailPage({
  params,
}: {
  params: Promise<{ estimateNormVersionId: string }>;
}) {
  const { estimateNormVersionId } = await params;
  const { org } = await requireCurrentOrg();
  let detail;
  try {
    detail = await getProfessionalNormLibraryService().getNormVersion(
      org.id,
      estimateNormVersionId,
    );
  } catch (error) {
    if (error instanceof NormLibraryRecordNotFoundError) notFound();
    throw error;
  }
  const { norm, resources } = detail;
  const resourceAction = addInternalNormResource.bind(
    null,
    estimateNormVersionId,
  );
  const publishAction = publishInternalNormVersion.bind(
    null,
    estimateNormVersionId,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-8 sm:px-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/professional-estimates/norms">
          ← Înapoi la biblioteca de norme
        </Link>
      </Button>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{norm.code} · {norm.name}</CardTitle>
            {norm.sourceType === "company_custom" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                {norm.publicationStatus === "published"
                  ? "Normă internă · Publicată pentru utilizare"
                  : "Normă internă"}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailValue label="Versiune">{norm.versionLabel}</DetailValue>
            <DetailValue label="Bază">
              {formatRomanianDecimal(norm.basisQuantity)} {norm.basisUnit}
            </DetailValue>
            <DetailValue label="Proveniență">
              {norm.sourceTitle} · {norm.sourceCode}
            </DetailValue>
            <DetailValue label="Tip sursă">{norm.sourceType}</DetailValue>
            <DetailValue label="Statut sursă">{norm.officialStatus}</DetailValue>
            <DetailValue label="Publicare">
              {norm.publicationStatus === "draft"
                ? "Draft intern"
                : norm.publicationStatus === "published"
                  ? "Publicată pentru utilizare internă"
                  : norm.publicationStatus}
            </DetailValue>
            <DetailValue label="Valabilă de la">{norm.validFrom ?? "—"}</DetailValue>
            <DetailValue label="Valabilă până la">{norm.validTo ?? "—"}</DetailValue>
            {norm.description && (
              <DetailValue label="Descriere">{norm.description}</DetailValue>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Componența normei</CardTitle>
        </CardHeader>
        <CardContent>
          {norm.publicationStatus === "published" && (
            <p className="mb-3 text-sm text-muted-foreground">
              Componența este doar în citire după publicarea internă a versiunii.
            </p>
          )}
          {resources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Norma nu are încă resurse.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Resursă</th>
                    <th className="py-2 pr-3 font-medium">Tip</th>
                    <th className="py-2 pr-3 font-medium">UM</th>
                    <th className="py-2 text-right font-medium">
                      Consum / {formatRomanianDecimal(norm.basisQuantity)} {norm.basisUnit}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resources.map((resource) => (
                    <tr key={resource.id} className="border-b last:border-0">
                      <td className="py-3 pr-3">
                        {resource.code ? `${resource.code} · ` : ""}
                        {resource.name}
                      </td>
                      <td className="py-3 pr-3">
                        {resourceTypeLabels[resource.resourceType] ??
                          resource.resourceType}
                      </td>
                      <td className="py-3 pr-3">{resource.unit}</td>
                      <td className="py-3 text-right tabular-nums">
                        {formatRomanianDecimal(resource.quantityPerNormBasis)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {norm.publicationStatus === "draft" ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adaugă resursă</CardTitle>
            </CardHeader>
            <CardContent>
              <AddNormResourceForm
                action={resourceAction}
                basisLabel={`${formatRomanianDecimal(norm.basisQuantity)} ${norm.basisUnit}`}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publicare internă</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 rounded-md bg-secondary px-3 py-2 text-sm">
                Draft intern
              </p>
              <PublishInternalNormForm action={publishAction} />
            </CardContent>
          </Card>
        </>
      ) : null}
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
