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
import { formatMoney } from "@/lib/i18n/money";
import type { QuoteStatus } from "@/domain/shared/types";
import { ProjectForm } from "../project-form";
import { updateProject } from "../actions";
import { createQuoteForProject } from "@/app/(app)/quotes/actions";
import { QuoteRowActions } from "./quote-row-actions";

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Schiță",
  sent: "Trimis",
  accepted: "Acceptat",
  rejected: "Respins",
};

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

  let project;
  try {
    project = await getProjectService().getProject(org.id, id);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) notFound();
    throw error;
  }

  const customers = await getCustomerService().listCustomers(org.id);
  const currentView = view === "confirmed" ? "confirmed" : "all";
  const quotes =
    currentView === "confirmed"
      ? await getQuoteService().listByProjectStatuses(org.id, id, ["sent", "accepted"])
      : await getQuoteService().listByProject(org.id, id);

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
          <Button type="submit" size="sm">
            Deviz nou
          </Button>
        </form>
      </div>

      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Devize</h2>
            <Button asChild size="sm" variant={currentView === "all" ? "default" : "outline"}>
              <Link href={`/projects/${id}`}>Toate</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant={currentView === "confirmed" ? "default" : "outline"}
            >
              <Link href={`/projects/${id}?view=confirmed`}>Confirmate</Link>
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">
            {quotes.length} {quotes.length === 1 ? "deviz" : "devize"}
          </span>
        </div>

        {quotes.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            {currentView === "confirmed"
              ? "Nu există devize confirmate sau acceptate pentru acest proiect."
              : "Niciun deviz încă."}
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
                    <div>
                      <div className="font-medium">Versiunea {q.versionNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {STATUS_LABELS[q.status]}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="tabular-nums font-semibold">
                        {formatMoney(q.total, q.currency)}
                      </div>
                    </div>
                  </Link>
                  <QuoteRowActions quoteId={q.quoteId} projectId={id} view={currentView} />
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
