import { notFound } from "next/navigation";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getCustomerService } from "@/server/container";
import { CustomerNotFoundError } from "@/domain/customers/customer.service";
import { CustomerForm } from "../customer-form";
import { updateCustomer } from "../actions";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { org } = await requireCurrentOrg();

  let customer;
  try {
    customer = await getCustomerService().getCustomer(org.id, id);
  } catch (error) {
    if (error instanceof CustomerNotFoundError) notFound();
    throw error;
  }

  // Bind the customer id so the form action has the (state, formData) shape.
  const action = updateCustomer.bind(null, id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Edit customer</h1>
      <CustomerForm action={action} customer={customer} submitLabel="Save changes" />
    </div>
  );
}
