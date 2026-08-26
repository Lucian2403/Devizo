import { CustomerForm } from "../customer-form";
import { createCustomer } from "../actions";

export default function NewCustomerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Client nou</h1>
      <CustomerForm action={createCustomer} submitLabel="Creează client" />
    </div>
  );
}
