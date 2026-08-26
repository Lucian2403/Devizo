import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import {
  getCatalogCategoryService,
  getCatalogItemService,
} from "@/server/container";
import { setItemActive } from "./actions";
import { UNIT_LABELS } from "@/lib/i18n/units";
import { Button } from "@/components/ui/button";

export default async function CatalogPage() {
  const { org } = await requireCurrentOrg();
  const [items, categories] = await Promise.all([
    getCatalogItemService().listItems(org.id),
    getCatalogCategoryService().listCategories(org.id),
  ]);

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Catalog de prețuri</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/catalog/categories">Categorii</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/catalog/import">Importă</Link>
          </Button>
          <Button asChild>
            <Link href="/catalog/new">Articol nou</Link>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Toate prețurile sunt în {org.defaultCurrency}.
      </p>

      {items.length === 0 ? (
        <p className="text-muted-foreground">
          Niciun articol încă. Creează unul sau importă o listă de prețuri.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Denumire</th>
                <th className="px-3 py-2 font-medium">Cod</th>
                <th className="px-3 py-2 font-medium">Categorie</th>
                <th className="px-3 py-2 font-medium">Unitate</th>
                <th className="px-3 py-2 text-right font-medium">Preț</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => (
                <tr key={item.id} className={item.active ? "" : "opacity-60"}>
                  <td className="px-3 py-1.5">
                    <Link
                      href={`/catalog/${item.id}`}
                      className="font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">{item.code ?? "—"}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {item.categoryId ? categoryName.get(item.categoryId) ?? "—" : "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">{UNIT_LABELS[item.unit]}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {item.sellingPrice}
                  </td>
                  <td className="px-3 py-1.5">
                    {item.active ? "Activ" : "Inactiv"}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <form action={setItemActive}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={item.active ? "false" : "true"}
                      />
                      <Button variant="ghost" size="sm" type="submit" className="h-7 px-2">
                        {item.active ? "Dezactivează" : "Activează"}
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
