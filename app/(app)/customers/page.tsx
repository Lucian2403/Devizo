import Link from "next/link";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getCustomerService } from "@/server/container";
import { archiveCustomer } from "./actions";
import { Button } from "@/components/ui/button";

export default async function CustomersPage() {
  const { org } = await requireCurrentOrg();
  const customers = await getCustomerService().listCustomers(org.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Customers</h1>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/customers/archived">Archived</Link>
          </Button>
          <Button asChild>
            <Link href="/customers/new">New customer</Link>
          </Button>
        </div>
      </div>

      {customers.length === 0 ? (
        <p className="text-muted-foreground">
          No customers yet. Create your first one.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {customers.map((customer) => (
            <li
              key={customer.id}
              className="flex items-center justify-between p-4"
            >
              <div>
                <Link
                  href={`/customers/${customer.id}`}
                  className="font-medium hover:underline"
                >
                  {customer.name}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {customer.email ?? customer.phone ?? "No contact details"}
                </p>
              </div>
              <form action={archiveCustomer}>
                <input type="hidden" name="customerId" value={customer.id} />
                <Button variant="ghost" size="sm" type="submit">
                  Archive
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
