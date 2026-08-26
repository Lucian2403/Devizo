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

  const quotesByProject = new Map(quoteSummaries.map((s) => [s.projectId, s]));
  const totalValue = quoteSummaries.reduce(
    (sum, item) => sum + Number(item.total || "0"),
    0,
  );
  const activeCount = projects.filter((project) => project.status === "active")
    .length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Portfolio
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Proiecte</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/projects/archived">Arhivate</Link>
          </Button>
          <Button asChild>
            <Link href="/projects/new">Proiect nou</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Proiecte
          </div>
          <div className="mt-2 text-2xl font-semibold">{projects.length}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Active
          </div>
          <div className="mt-2 text-2xl font-semibold">{activeCount}</div>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Valoare devize
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">
            {formatMoney(String(totalValue), org.defaultCurrency)}
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card/60 p-10 text-center text-muted-foreground">
          Niciun proiect încă. Creează-l pe primul.
        </div>
      ) : (
        <div className="rounded-2xl border bg-card/80 p-3 shadow-sm">
          <ul className="space-y-3">
            {projects.map((project) => {
              const quotes = quotesByProject.get(project.id);
              const statusClass = {
                planned: "bg-slate-100 text-slate-700",
                active: "bg-amber-100 text-amber-800",
                completed: "bg-emerald-100 text-emerald-700",
              }[project.status] ?? "bg-muted text-muted-foreground";

              return (
                <li
                  key={project.id}
                  className="rounded-xl border bg-background/60 p-4 transition-colors hover:bg-secondary/20"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${statusClass}`}>
                          {STATUS_LABELS[project.status]}
                        </span>
                      </div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="block text-lg font-semibold text-foreground hover:text-primary"
                      >
                        {project.name}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {project.customerName ?? "Fără client"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 md:justify-end">
                      {quotes ? (
                        <div className="min-w-[150px] rounded-xl border bg-card px-3 py-2 text-right">
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            {quotes.quoteCount} {quotes.quoteCount === 1 ? "deviz" : "devize"}
                          </div>
                          <div className="mt-1 text-base font-semibold tabular-nums">
                            {formatMoney(quotes.total, quotes.currency)}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          Fără devize
                        </div>
                      )}

                      <form action={archiveProject}>
                        <input type="hidden" name="projectId" value={project.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          Arhivează
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
