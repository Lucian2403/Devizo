import { notFound, redirect } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getQuoteService } from "@/server/container";

// A quote has no page of its own: it redirects to its latest version view.
export default async function QuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await requireCurrentOrg();

  const versionId = await getQuoteService().getLatestVersionId(org.id, id);
  if (!versionId) notFound();

  redirect(`/quotes/${id}/versions/${versionId}`);
}
