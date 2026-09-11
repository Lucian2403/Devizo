import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProjectService } from "@/server/container";
import { HomeAiCard } from "./home-ai-card";

export default async function DashboardPage() {
  const { org } = await requireCurrentOrg();
  const projects = await getProjectService().listProjects(org.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Panou</h1>
        <p className="text-muted-foreground">
          Spațiu de lucru pentru {org.name}.
        </p>
      </div>

      <HomeAiCard
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
