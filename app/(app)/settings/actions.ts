"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getOrganizationService } from "@/server/container";
import { companySettingsSchema } from "@/schemas/domain/organization";

export type SettingsState = { error: string } | { ok: true } | null;

export async function updateCompanySettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const { org } = await requireCurrentOrg();

  const parsed = companySettingsSchema.safeParse({
    name: formData.get("name"),
    legalName: formData.get("legalName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    country: formData.get("country"),
    vatNumber: formData.get("vatNumber"),
    vatRate: formData.get("vatRate") || undefined,
    defaultCurrency: formData.get("defaultCurrency"),
    defaultLanguage: formData.get("defaultLanguage"),
    customerDocumentLanguage: formData.get("customerDocumentLanguage"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Date invalide." };
  }

  await getOrganizationService().updateCompanySettings(org.id, parsed.data);

  revalidatePath("/settings");
  return { ok: true };
}
