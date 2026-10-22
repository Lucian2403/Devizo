import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SUPPORTED_CURRENCIES } from "@/domain/shared/types";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  createProfessionalGeneralEstimate,
} from "../../actions";
import { GeneralEstimateCreateForm } from "../general-estimate-forms";

export default async function NewProfessionalGeneralEstimatePage() {
  await requireCurrentOrg();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/professional-estimates/general-estimates">← Înapoi la devizele generale</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-heading">Deviz general nou</h1>
      </div>
      <GeneralEstimateCreateForm
        action={createProfessionalGeneralEstimate}
        currencies={SUPPORTED_CURRENCIES}
      />
    </main>
  );
}
