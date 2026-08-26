import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProjectService } from "@/server/container";
import { restoreProject } from "../actions";
import { Button } from "@/components/ui/button";

export default async function ArchivedProjectsPage() {
  const { org } = await requireCurrentOrg();
  const projects = await getProjectService().listArchivedProjects(org.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proiecte arhivate</h1>
        <Button asChild variant="outline">
          <Link href="/projects">Înapoi la proiecte</Link>
        </Button>
      </div>

      {projects.length === 0 ? (
        <p className="text-muted-foreground">Niciun proiect arhivat.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex items-center justify-between p-4"
            >
              <div>
                <p className="font-medium">{project.name}</p>
                <p className="text-sm text-muted-foreground">
                  {project.customerName ?? "Fără client"}
                </p>
              </div>
              <form action={restoreProject}>
                <input type="hidden" name="projectId" value={project.id} />
                <Button variant="ghost" size="sm" type="submit">
                  Restaurează
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
