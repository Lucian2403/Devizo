import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProjectService } from "@/server/container";
import { archiveProject } from "./actions";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<string, string> = {
  planned: "Planificat",
  active: "Activ",
  completed: "Finalizat",
};

export default async function ProjectsPage() {
  const { org } = await requireCurrentOrg();
  const projects = await getProjectService().listProjects(org.id);

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
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between p-4"
            >
              <div>
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
              <form action={archiveProject}>
                <input type="hidden" name="projectId" value={project.id} />
                <Button variant="ghost" size="sm" type="submit">
                  Arhivează
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
