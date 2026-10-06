import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  getCustomerService,
  getProjectService,
  getQuoteService,
} from "@/server/container";
import { ProjectNotFoundError } from "@/domain/projects/project.service";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { QuoteStatusBadge } from "@/components/ui/quote-status-badge";
import { formatMoney } from "@/lib/i18n/money";
import { ProjectForm } from "../project-form";
import { updateProject } from "../actions";
import { createQuoteForProject } from "@/app/(app)/quotes/actions";
import { QuoteRowActions } from "./quote-row-actions";

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const { org } = await requireCurrentOrg();

  const currentView = view === "confirmed" ? "confirmed" : "all";
  const quoteRequest =
    currentView === "confirmed"
      ? getQuoteService().listByProjectStatuses(org.id, id, [
          "sent",
          "accepted",
          "rejected",
        ])
      : getQuoteService().listByProject(org.id, id);

  let project;
  let customers;
  let quotes;
  try {
    // None of these reads depends on another. Run them in one wave so a remote
    // database costs roughly one round-trip window instead of three in series.
    [project, customers, quotes] = await Promise.all([
      getProjectService().getProject(org.id, id),
      getCustomerService().listCustomers(org.id),
      quoteRequest,
    ]);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) notFound();
    throw error;
  }

  // Bind the project id so the form action has the (state, formData) shape.
  const action = updateProject.bind(null, id);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Proiect
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{project.name}</h1>
        </div>
        <form action={createQuoteForProject}>
          <input type="hidden" name="projectId" value={id} />
          <SubmitButton type="submit" size="sm" pendingLabel="Se creează…">
            Ofertă nouă
          </SubmitButton>
        </form>
      </div>

      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Oferte</h2>
            <Button asChild size="sm" variant={currentView === "all" ? "default" : "outline"}>
              <Link href={`/projects/${id}`}>Toate</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={currentView === "confirmed" ? "default" : "outline"}
            >
              <Link href={`/projects/${id}?view=confirmed`}>Finalizate</Link>
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">
            {quotes.length} {quotes.length === 1 ? "ofertă" : "oferte"}
          </span>
        </div>

        {quotes.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            {currentView === "confirmed"
              ? "Nu există oferte finalizate pentru acest proiect."
              : "Nicio ofertă încă."}
          </div>
        ) : (
          <ul className="space-y-3">
            {quotes.map((q) => (
              <li key={q.versionId}>
                <div className="flex items-center gap-3 rounded-xl border bg-background/60 px-4 py-3">
                  <Link
                    href={`/quotes/${q.quoteId}/versions/${q.versionId}`}
                    className="flex flex-1 items-center justify-between gap-4 transition-colors hover:text-primary"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">Versiunea {q.versionNumber}</div>
                      <QuoteStatusBadge status={q.status} />
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="tabular-nums font-semibold">
                        {formatMoney(q.total, q.currency)}
                      </div>
                    </div>
                  </Link>
                  <QuoteRowActions
                    quoteId={q.quoteId}
                    projectId={id}
                    view={currentView}
                    canDelete={q.status === "draft" && q.versionNumber === 1}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Editează proiect</h2>
        <ProjectForm
          action={action}
          project={project}
          customers={customers.map((c) => ({ id: c.id, name: c.name }))}
          submitLabel="Salvează modificările"
        />
      </section>
    </div>
  );
}
