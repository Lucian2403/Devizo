import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getCustomerService } from "@/server/container";
import { createProject } from "../actions";
import { ProjectForm } from "../project-form";

export default async function NewProjectPage() {
  const { org } = await requireCurrentOrg();
  const customers = await getCustomerService().listCustomers(org.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Proiect nou</h1>
      <ProjectForm
        action={createProject}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        submitLabel="Creează proiect"
      />
    </div>
  );
}
