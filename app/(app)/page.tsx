import { requireUser } from "@/lib/auth/session";
import { getOrganizationService } from "@/server/container";

export default async function DashboardPage() {
  const user = await requireUser();
  const orgs = await getOrganizationService().getOrganizationsForUser(user.id);
  const org = orgs[0];

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Workspace ready for {org?.name}. Estimate features arrive in the next
        milestones.
      </p>
    </div>
  );
}
