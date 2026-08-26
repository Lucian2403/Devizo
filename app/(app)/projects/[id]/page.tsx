import { notFound } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getCustomerService, getProjectService } from "@/server/container";
import { ProjectNotFoundError } from "@/domain/projects/project.service";
import { ProjectForm } from "../project-form";
import { updateProject } from "../actions";

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

  // Bind the project id so the form action has the (state, formData) shape.
  const action = updateProject.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Editează proiect</h1>
      <ProjectForm
        action={action}
        project={project}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        submitLabel="Salvează modificările"
      />
    </div>
  );
}
