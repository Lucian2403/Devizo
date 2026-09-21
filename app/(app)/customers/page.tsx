import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getCustomerService } from "@/server/container";
import { archiveCustomer } from "./actions";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";

export default async function CustomersPage() {
  const { org } = await requireCurrentOrg();
  const customers = await getCustomerService().listCustomers(org.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Clienți</h1>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/customers/archived">Arhivate</Link>
          </Button>
          <Button asChild>
            <Link href="/customers/new">Client nou</Link>
          </Button>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/60 p-8 text-center text-sm text-muted-foreground">
          Niciun client încă. Creează-l pe primul.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {customers.map((customer) => (
            <li
              key={customer.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <Link
                  href={`/customers/${customer.id}`}
                  className="font-medium hover:underline"
                >
                  {customer.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {customer.email ?? customer.phone ?? "Fără date de contact"}
                </p>
              </div>
              <form action={archiveCustomer}>
                <input type="hidden" name="customerId" value={customer.id} />
                <SubmitButton
                  variant="ghost"
                  size="sm"
                  pendingLabel="Se arhivează…"
                >
                  Arhivează
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
