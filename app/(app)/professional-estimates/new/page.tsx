import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { SUPPORTED_CURRENCIES } from "@/domain/shared/types";
import { createProfessionalEstimate } from "../actions";
import { ProfessionalEstimateCreateForm } from "../professional-estimate-create-form";

export default async function NewProfessionalEstimatePage() {
  await requireCurrentOrg();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/professional-estimates">← Înapoi la devize</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-heading">
          Deviz profesional nou
        </h1>
      </div>
      <ProfessionalEstimateCreateForm
        action={createProfessionalEstimate}
        currencies={SUPPORTED_CURRENCIES}
      />
    </div>
  );
}
