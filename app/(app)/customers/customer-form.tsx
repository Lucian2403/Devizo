"use client";

import { useActionState } from "react";
import type { Customer } from "@/domain/customers/customer.repository";
import type { CustomerFormState } from "./actions";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/languages";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export function CustomerForm({
  action,
  customer,
  submitLabel,
}: {
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
  customer?: Customer;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<CustomerFormState, FormData>(
    action,
    null,
  );

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={customer?.name ?? ""} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactName">Contact person</Label>
            <Input
              id="contactName"
              name="contactName"
              defaultValue={customer?.contactName ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={customer?.email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredLanguage">Preferred language</Label>
            <select
              id="preferredLanguage"
              name="preferredLanguage"
              defaultValue={customer?.preferredLanguage ?? ""}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Not set</option>
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={customer?.notes ?? ""} />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton pendingLabel="Saving...">{submitLabel}</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
