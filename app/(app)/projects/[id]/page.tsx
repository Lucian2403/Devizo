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

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Schiță",
  sent: "Trimis",
  accepted: "Acceptat",
  rejected: "Respins",
};

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await requireCurrentOrg();

  let project;
  try {
    project = await getProjectService().getProject(org.id, id);
  } catch (error) {
    if (error instanceof ProjectNotFoundError) notFound();
    throw error;
  }

  const customers = await getCustomerService().listCustomers(org.id);
  const quotes = await getQuoteService().listByProject(org.id, id);

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
          <h2 className="text-lg font-semibold">Devize</h2>
          <span className="text-sm text-muted-foreground">
            {quotes.length} {quotes.length === 1 ? "deviz" : "devize"}
          </span>
        </div>

        {quotes.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            Niciun deviz încă.
          </div>
        ) : (
          <ul className="space-y-3">
            {quotes.map((q) => (
              <li key={q.quoteId}>
                <Link
                  href={`/quotes/${q.quoteId}`}
                  className="flex items-center justify-between gap-4 rounded-xl border bg-background/60 px-4 py-3 transition-colors hover:border-primary/40 hover:bg-secondary/20"
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
