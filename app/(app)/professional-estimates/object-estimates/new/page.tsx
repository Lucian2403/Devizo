import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SUPPORTED_CURRENCIES } from "@/domain/shared/types";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getProfessionalObjectEstimateService } from "@/server/container";
import { createProfessionalObjectEstimate } from "../../actions";
import { ObjectEstimateCreateForm } from "../object-estimate-forms";

export default async function NewProfessionalObjectEstimatePage() {
  const { org } = await requireCurrentOrg();
  const objects =
    await getProfessionalObjectEstimateService().listConstructionObjects(org.id);
  if (objects.length === 0) notFound();

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/professional-estimates/object-estimates">← Înapoi la devizele pe obiect</Link>
        </Button>
        <h1 className="text-2xl font-semibold text-heading">Deviz pe obiect nou</h1>
      </div>
      <ObjectEstimateCreateForm
        action={createProfessionalObjectEstimate}
        objects={objects}
        currencies={SUPPORTED_CURRENCIES}
      />
    </main>
  );
}
