import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getCustomerService } from "@/server/container";
import { restoreCustomer } from "../actions";
import { Button } from "@/components/ui/button";

export default async function ArchivedCustomersPage() {
  const { org } = await requireCurrentOrg();
  const customers = await getCustomerService().listArchivedCustomers(org.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Archived customers</h1>
        <Button asChild variant="outline">
          <Link href="/customers">Back to customers</Link>
        </Button>
      </div>

      {customers.length === 0 ? (
        <p className="text-muted-foreground">No archived customers.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {customers.map((customer) => (
            <li
              key={customer.id}
              className="flex items-center justify-between p-4"
            >
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-sm text-muted-foreground">
                  {customer.email ?? customer.phone ?? "No contact details"}
                </p>
              </div>
              <form action={restoreCustomer}>
                <input type="hidden" name="customerId" value={customer.id} />
                <Button variant="ghost" size="sm" type="submit">
                  Restore
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
