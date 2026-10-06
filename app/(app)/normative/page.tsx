import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getNormativeIntelligenceService } from "@/server/container";
import { Button } from "@/components/ui/button";
import {
  bootstrapMoldovaSources,
  dismissNormativeUpdate,
  reviewNormativeUpdate,
  verifyNormativeSources,
} from "./actions";

const OFFICIAL_STATUS_LABELS: Record<string, string> = {
  draft: "Proiect",
  consultation: "În consultare",
  approved: "Aprobat",
  in_force: "În vigoare",
  superseded: "Înlocuit",
  repealed: "Abrogat",
  unknown: "Necunoscut",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  normative_document: "Normativ",
  norm_collection: "Colecție de norme",
  price_catalog: "Catalog de prețuri",
  legislation: "Legislație",
  official_guidance: "Ghid oficial",
  company_custom: "Regulă companie",
  import: "Import",
};

function officialStatusClass(status: string): string {
  if (status === "in_force") {
    return "bg-status-ok-bg text-status-ok-fg";
  }
  if (status === "draft" || status === "consultation" || status === "approved") {
    return "bg-status-warn-bg text-status-warn-fg";
  }
  if (status === "repealed") {
    return "bg-status-error-bg text-status-error-fg";
  }
  return "bg-status-neutral-bg text-status-neutral-fg";
}

function verificationClass(status: string): string {
  if (status === "success") return "text-status-ok-fg";
  if (status === "error") return "text-status-error-fg";
  return "text-muted-foreground";
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value + "T00:00:00");
  return new Intl.DateTimeFormat("ro-MD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function usageTotal(usage: {
  normVersions: number;
  resources: number;
  resourcePrices: number;
  calculationRules: number;
}): number {
  return (
    usage.normVersions +
    usage.resources +
    usage.resourcePrices +
    usage.calculationRules
  );
}

function updateStatusClass(status: string): string {
  return status === "detected"
    ? "bg-status-warn-bg text-status-warn-fg"
    : "bg-status-neutral-bg text-status-neutral-fg";
}

export default async function NormativePage() {
  const { org } = await requireCurrentOrg();
  const overview =
    await getNormativeIntelligenceService().getOverview(org.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Fundație profesională
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-heading">
            Bază normativă
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Sursele, edițiile și perioadele de valabilitate folosite de motorul
            profesional Devizo. O modificare detectată nu schimbă automat
            niciun deviz sau nicio regulă de calcul.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <form action={bootstrapMoldovaSources}>
            <Button variant="outline" type="submit">
              {overview.sources.length === 0
                ? "Încarcă baza Moldova"
                : "Actualizează metadatele Moldova"}
            </Button>
          </form>
          <form action={verifyNormativeSources}>
            <Button
              type="submit"
              disabled={overview.stats.monitoredSources === 0}
            >
              Verifică sursele oficiale
            </Button>
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-status-warn-bg px-4 py-3 text-sm text-status-warn-fg">
        <strong>Control uman obligatoriu.</strong> Monitorizarea compară
        conținutul paginilor oficiale și semnalează schimbări. Nu declară singură
        că o normă juridică s-a modificat și nu actualizează retroactiv calcule,
        reguli sau documente finalizate.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Surse urmărite
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {overview.stats.monitoredSources}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            În vigoare
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {overview.stats.inForceSources}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Necesită verificare
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {overview.stats.pendingReview}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Erori monitorizare
          </p>
          <p className="mt-2 text-2xl font-semibold text-heading">
            {overview.stats.verificationErrors}
          </p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">
            Surse și ediții
          </h2>
          <p className="text-sm text-muted-foreground">
            Statutul oficial este păstrat separat de statutul intern al
            înregistrării Devizo.
          </p>
        </div>

        {overview.sources.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="font-medium text-heading">
              Nu există încă surse normative configurate.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Încarcă baza Moldova pentru a porni registrul cu sursele oficiale
              de bază folosite în devizare.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead className="bg-muted-section text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Sursă</th>
                    <th className="px-4 py-3 font-medium">Ediție</th>
                    <th className="px-4 py-3 font-medium">Tip</th>
                    <th className="px-4 py-3 font-medium">Statut oficial</th>
                    <th className="px-4 py-3 font-medium">Aplicare</th>
                    <th className="px-4 py-3 font-medium">Ultima verificare</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Impact
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {overview.sources.map((source) => {
                    const affected = usageTotal(source.usage);
                    return (
                      <tr key={source.id} className="align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-heading">
                            {source.code}
                          </div>
                          <div className="mt-0.5 max-w-md text-muted-foreground">
                            {source.title}
                          </div>
                          {source.sourceUri ? (
                            <a
                              className="mt-1 inline-block text-xs font-medium text-primary-hover hover:underline"
                              href={source.sourceUri}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Sursa oficială ↗
                            </a>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {source.edition}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-secondary-foreground">
                          {SOURCE_TYPE_LABELS[source.sourceType] ??
                            source.sourceType}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              "inline-flex rounded-full px-2 py-1 text-[11px] font-medium " +
                              officialStatusClass(source.officialStatus)
                            }
                          >
                            {OFFICIAL_STATUS_LABELS[source.officialStatus] ??
                              source.officialStatus}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatDate(
                            source.effectiveDate ?? source.validFrom,
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className={verificationClass(
                              source.lastVerificationStatus,
                            )}
                          >
                            {source.lastVerificationStatus === "success"
                              ? "Verificată"
                              : source.lastVerificationStatus === "error"
                                ? "Eroare"
                                : "Neverificată"}
                          </div>
                          <div className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                            {formatDate(source.lastVerifiedAt)}
                          </div>
                          {source.lastVerificationError ? (
                            <div className="mt-1 max-w-xs text-xs text-status-error-fg">
                              {source.lastVerificationError}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {affected === 0 ? (
                            <span className="text-muted-foreground">Neutilizată</span>
                          ) : (
                            <span className="font-semibold text-heading">
                              {affected} legături
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">
            Modificări detectate
          </h2>
          <p className="text-sm text-muted-foreground">
            Semnale care trebuie analizate înainte de a publica o nouă regulă
            sau ediție în Devizo.
          </p>
        </div>

        {overview.updates.length === 0 ? (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground shadow-card">
            Nu există modificări detectate.
          </div>
        ) : (
          <div className="space-y-3">
            {overview.updates.map((update) => (
              <article
                key={update.id}
                className="rounded-xl border bg-card p-4 shadow-card"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-heading">
                        {update.sourceCode}
                      </span>
                      <span
                        className={
                          "rounded-full px-2 py-1 text-[11px] font-medium " +
                          updateStatusClass(update.reviewStatus)
                        }
                      >
                        {update.reviewStatus === "detected"
                          ? "De verificat"
                          : update.reviewStatus === "reviewed"
                            ? "Verificat"
                            : "Ignorat"}
                      </span>
                    </div>
                    <h3 className="mt-2 font-medium text-heading">
                      {update.title}
                    </h3>
                    {update.summary ? (
                      <p className="mt-1 max-w-3xl text-sm text-secondary-foreground">
                        {update.summary}
                      </p>
                    ) : null}
                    {update.impactSummary ? (
                      <p className="mt-2 text-xs font-medium text-muted-foreground">
                        {update.impactSummary}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Detectat: {formatDate(update.detectedAt)}
                    </p>
                    {update.officialUri ? (
                      <a
                        className="mt-2 inline-block text-xs font-medium text-primary-hover hover:underline"
                        href={update.officialUri}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Deschide sursa oficială ↗
                      </a>
                    ) : null}
                  </div>

                  {update.reviewStatus === "detected" ? (
                    <div className="flex shrink-0 gap-2">
                      <form action={reviewNormativeUpdate}>
                        <input
                          type="hidden"
                          name="updateId"
                          value={update.id}
                        />
                        <Button variant="outline" size="sm" type="submit">
                          Marchează verificat
                        </Button>
                      </form>
                      <form action={dismissNormativeUpdate}>
                        <input
                          type="hidden"
                          name="updateId"
                          value={update.id}
                        />
                        <Button variant="ghost" size="sm" type="submit">
                          Ignoră
                        </Button>
                      </form>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
