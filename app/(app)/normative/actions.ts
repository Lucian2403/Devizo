"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getNormativeIntelligenceService } from "@/server/container";

export async function bootstrapMoldovaSources(): Promise<void> {
  const { org } = await requireCurrentOrg();
  await getNormativeIntelligenceService().bootstrapMoldovaBaseline(org.id);
  revalidatePath("/normative");
}

export async function verifyNormativeSources(): Promise<void> {
  const { org } = await requireCurrentOrg();
  await getNormativeIntelligenceService().verifyOrganization(org.id);
  revalidatePath("/normative");
}

export async function reviewNormativeUpdate(formData: FormData): Promise<void> {
  const { org } = await requireCurrentOrg();
  const updateId = String(formData.get("updateId") ?? "");
  if (!updateId) return;

  await getNormativeIntelligenceService().markReviewed(org.id, updateId);
  revalidatePath("/normative");
}

export async function dismissNormativeUpdate(formData: FormData): Promise<void> {
  const { org } = await requireCurrentOrg();
  const updateId = String(formData.get("updateId") ?? "");
  if (!updateId) return;

  await getNormativeIntelligenceService().dismissUpdate(org.id, updateId);
  revalidatePath("/normative");
}
