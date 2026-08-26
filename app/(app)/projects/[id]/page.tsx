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
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Quotes for this project — shown first. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <form action={createQuoteForProject}>
            <input type="hidden" name="projectId" value={id} />
            <Button type="submit" size="sm">
              Deviz nou
            </Button>
          </form>
        </div>

        {quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Niciun deviz încă.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {quotes.map((q) => (
              <li key={q.quoteId}>
                <Link
                  href={`/quotes/${q.quoteId}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-accent"
                >
                  <span>
                    <span className="font-medium">
                      Versiunea {q.versionNumber}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {STATUS_LABELS[q.status]}
                    </span>
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(q.total, q.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Project editing section — below the quotes. */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Editează proiect</h2>
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
