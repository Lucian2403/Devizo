import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProjectService, getQuoteService } from "@/server/container";
import { archiveProject } from "./actions";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/i18n/money";

const STATUS_LABELS: Record<string, string> = {
  planned: "Planificat",
  active: "Activ",
  completed: "Finalizat",
};

export default async function ProjectsPage() {
  const { org } = await requireCurrentOrg();
  const [projects, quoteSummaries] = await Promise.all([
    getProjectService().listProjects(org.id),
    getQuoteService().listProjectQuoteSummaries(org.id),
  ]);

  // Index quote figures by project id for a quick lookup while rendering.
  const quotesByProject = new Map(
    quoteSummaries.map((s) => [s.projectId, s]),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proiecte</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/projects/archived">Arhivate</Link>
          </Button>
          <Button asChild>
            <Link href="/projects/new">Proiect nou</Link>
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="text-muted-foreground">
          Niciun proiect încă. Creează-l pe primul.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {projects.map((project) => {
            const quotes = quotesByProject.get(project.id);
            return (
              <li
                key={project.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium hover:underline"
                  >
                    {project.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {project.customerName ?? "Fără client"} ·{" "}
                    {STATUS_LABELS[project.status]}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {quotes ? (
                    <div className="text-right">
                      <div className="text-sm font-medium tabular-nums">
                        {formatMoney(quotes.total, quotes.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {quotes.quoteCount}{" "}
                        {quotes.quoteCount === 1 ? "deviz" : "devize"}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Fără devize
                    </span>
                  )}
                  <form action={archiveProject}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      Arhivează
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
