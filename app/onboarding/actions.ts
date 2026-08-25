"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrganizationService } from "@/server/container";
import { SlugAlreadyTakenError } from "@/domain/organizations/organization.service";
import { createOrganizationSchema } from "@/schemas/domain/organization";

export type OnboardingState = { error: string } | null;

export async function createOrganization(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();

  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    defaultCurrency: formData.get("defaultCurrency") || undefined,
    defaultLanguage: formData.get("defaultLanguage") || undefined,
    customerDocumentLanguage:
      formData.get("customerDocumentLanguage") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await getOrganizationService().createOrganization({
      ...parsed.data,
      ownerUserId: user.id,
    });
  } catch (error) {
    if (error instanceof SlugAlreadyTakenError) {
      return { error: error.message };
    }
    throw error;
  }

  redirect("/");
}
