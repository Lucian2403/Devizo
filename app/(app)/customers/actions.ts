"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getCustomerService } from "@/server/container";
import { customerSchema } from "@/schemas/domain/customer";

export type CustomerFormState = { error: string } | null;

function parseCustomer(formData: FormData) {
  return customerSchema.safeParse({
    name: formData.get("name"),
    contactName: formData.get("contactName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    preferredLanguage: formData.get("preferredLanguage") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const { org } = await requireCurrentOrg();

  const parsed = parseCustomer(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await getCustomerService().createCustomer(org.id, parsed.data);

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(
  customerId: string,
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const { org } = await requireCurrentOrg();

  const parsed = parseCustomer(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await getCustomerService().updateCustomer(org.id, customerId, parsed.data);

  revalidatePath("/customers");
  redirect("/customers");
}

export async function archiveCustomer(formData: FormData): Promise<void> {
  const { org } = await requireCurrentOrg();
  const customerId = String(formData.get("customerId"));
  await getCustomerService().archiveCustomer(org.id, customerId);
  revalidatePath("/customers");
}

export async function restoreCustomer(formData: FormData): Promise<void> {
  const { org } = await requireCurrentOrg();
  const customerId = String(formData.get("customerId"));
  await getCustomerService().restoreCustomer(org.id, customerId);
  revalidatePath("/customers/archived");
  revalidatePath("/customers");
}
