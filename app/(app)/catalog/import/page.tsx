import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { ImportWizard } from "./import-wizard";
import { Button } from "@/components/ui/button";

export default async function CatalogImportPage() {
  // Ensures the user is authenticated and belongs to an organization.
  await requireCurrentOrg();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Importă lista de prețuri</h1>
        <Button asChild variant="outline">
          <Link href="/catalog">Înapoi la catalog</Link>
        </Button>
      </div>
      <ImportWizard />
    </div>
  );
}
