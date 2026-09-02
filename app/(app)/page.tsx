import { requireUser } from "@/lib/auth/session";
import { getOrganizationService, getProjectService } from "@/server/container";
import { HomeAiCard } from "./home-ai-card";

export default async function DashboardPage() {
  const user = await requireUser();
  const orgs = await getOrganizationService().getOrganizationsForUser(user.id);
  const org = orgs[0];

  const projects = org
    ? await getProjectService().listProjects(org.id)
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Panou</h1>
        <p className="text-muted-foreground">
          Spațiu de lucru pentru {org?.name}.
        </p>
      </div>

      <HomeAiCard
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
