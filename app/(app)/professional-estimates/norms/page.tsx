import Link from "next/link";
import { formatDate } from "@/lib/ui/date-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalNormLibraryService } from "@/server/container";
import { createInternalNorm } from "../actions";
import { CreateInternalNormForm } from "./norm-forms";

export default async function ProfessionalNormLibraryPage() {
  const { org } = await requireCurrentOrg();
  const norms =
    await getProfessionalNormLibraryService().listNormVersions(org.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/professional-estimates">← Înapoi la devize</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-heading">
          Norme profesionale
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Biblioteca normelor folosite în devize. Normele interne sunt separate
          de sursele normative oficiale.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Normă internă nouă</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateInternalNormForm action={createInternalNorm} />
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="norm-library-heading">
        <h2 id="norm-library-heading" className="text-lg font-semibold text-heading">
          Biblioteca companiei
        </h2>
        {norms.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nu există încă norme în biblioteca companiei.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {norms.map((norm) => (
              <Link
                key={norm.id}
                href={`/professional-estimates/norms/${norm.id}`}
                className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors hover:border-primary/50">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-heading">
                        {norm.code} · {norm.name}
                      </h3>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {norm.sourceType === "company_custom"
                          ? "Normă internă"
                          : norm.sourceType}
                      </span>
                    </div>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                      <dt className="text-muted-foreground">Versiune</dt>
                      <dd>{norm.versionLabel}</dd>
                      <dt className="text-muted-foreground">Bază</dt>
                      <dd>
                        {norm.basisQuantity} {norm.basisUnit}
                      </dd>
                      <dt className="text-muted-foreground">Proveniență</dt>
                      <dd>{norm.sourceTitle} · {norm.sourceCode}</dd>
                      <dt className="text-muted-foreground">Valabilitate</dt>
                      <dd>
                        {formatDate(norm.validFrom)} – {formatDate(norm.validTo)}
                      </dd>
                      <dt className="text-muted-foreground">Publicare</dt>
                      <dd>
                        {norm.publicationStatus === "draft"
                          ? "Draft intern"
                          : norm.publicationStatus === "published"
                            ? "Publicată pentru utilizare internă"
                            : norm.publicationStatus}
                      </dd>
                      <dt className="text-muted-foreground">Resurse</dt>
                      <dd>{norm.resourceCount}</dd>
                    </dl>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
