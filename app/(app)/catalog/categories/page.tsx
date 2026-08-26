import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getCatalogCategoryService } from "@/server/container";
import { CategoriesManager } from "./categories-manager";
import { Button } from "@/components/ui/button";

export default async function CatalogCategoriesPage() {
  const { org } = await requireCurrentOrg();
  const categories = await getCatalogCategoryService().listCategories(org.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categorii</h1>
        <Button asChild variant="outline">
          <Link href="/catalog">Înapoi la catalog</Link>
        </Button>
      </div>
      <CategoriesManager categories={categories} />
    </div>
  );
}
