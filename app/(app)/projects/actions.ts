"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProjectService } from "@/server/container";
import { projectSchema } from "@/schemas/domain/project";

export type ProjectFormState = { error: string } | null;

function parseProject(formData: FormData) {
  return projectSchema.safeParse({
    name: formData.get("name"),
    customerId: formData.get("customerId"),
    address: formData.get("address") || undefined,
    description: formData.get("description") || undefined,
    notes: formData.get("notes") || undefined,
    status: formData.get("status"),
  });
}

export async function createProject(
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const { org } = await requireCurrentOrg();

  const parsed = parseProject(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Date invalide." };
  }

  await getProjectService().createProject(org.id, parsed.data);

  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProject(
  projectId: string,
  _prev: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const { org } = await requireCurrentOrg();

  const parsed = parseProject(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Date invalide." };
  }

  await getProjectService().updateProject(org.id, projectId, parsed.data);

  revalidatePath("/projects");
  redirect("/projects");
}

export async function archiveProject(formData: FormData): Promise<void> {
  const { org } = await requireCurrentOrg();
  const projectId = String(formData.get("projectId"));
  await getProjectService().archiveProject(org.id, projectId);
  revalidatePath("/projects");
}

export async function restoreProject(formData: FormData): Promise<void> {
  const { org } = await requireCurrentOrg();
  const projectId = String(formData.get("projectId"));
  await getProjectService().restoreProject(org.id, projectId);
  revalidatePath("/projects/archived");
  revalidatePath("/projects");
}
