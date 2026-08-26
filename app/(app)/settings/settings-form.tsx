"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { Organization } from "@/domain/organizations/organization.repository";
import { updateCompanySettings, type SettingsState } from "./actions";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/languages";
import { SUPPORTED_CURRENCIES } from "@/domain/shared/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

const selectClasses =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

// A dropdown limited to the supported languages.
function LanguageSelect({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
}) {
  return (
    <select
      id={name}
      name={name}
      defaultValue={defaultValue}
      className={selectClasses}
    >
      {LANGUAGE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

// A dropdown limited to the supported currencies.
function CurrencySelect({ defaultValue }: { defaultValue: string }) {
  return (
    <select
      id="defaultCurrency"
      name="defaultCurrency"
      defaultValue={defaultValue}
      className={selectClasses}
    >
      {SUPPORTED_CURRENCIES.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
}

// The fields live in their own component so they can read the pending state
// via useFormStatus and disable the whole form while the save is in flight.
function FormFields({
  org,
  state,
}: {
  org: Organization;
  state: SettingsState;
}) {
  const { pending } = useFormStatus();

  return (
    <>
      <CardContent className="space-y-4 pt-6">
        <fieldset disabled={pending} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company name</Label>
            <Input id="name" name="name" defaultValue={org.name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Legal name</Label>
            <Input
              id="legalName"
              name="legalName"
              defaultValue={org.legalName ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={org.email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={org.phone ?? ""} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              name="address"
              defaultValue={org.address ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              name="country"
              defaultValue={org.country ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vatNumber">Tax / VAT ID</Label>
              <Input
                id="vatNumber"
                name="vatNumber"
                defaultValue={org.vatNumber ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vatRate">VAT rate (%)</Label>
              <Input
                id="vatRate"
                name="vatRate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                defaultValue={org.vatRate ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Currency</Label>
              <CurrencySelect defaultValue={org.defaultCurrency} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultLanguage">Default language</Label>
              <LanguageSelect
                name="defaultLanguage"
                defaultValue={org.defaultLanguage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerDocumentLanguage">Document language</Label>
              <LanguageSelect
                name="customerDocumentLanguage"
                defaultValue={org.customerDocumentLanguage}
              />
            </div>
          </div>
        </fieldset>

        {state && "error" in state && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state && "ok" in state && !pending && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            Settings saved successfully.
          </p>
        )}
      </CardContent>
      <CardFooter>
        <SubmitButton pendingLabel="Saving...">Save changes</SubmitButton>
      </CardFooter>
    </>
  );
}

export function SettingsForm({ org }: { org: Organization }) {
  const [state, action] = useActionState<SettingsState, FormData>(
    updateCompanySettings,
    null,
  );

  return (
    <Card>
      <form action={action}>
        <FormFields org={org} state={state} />
      </form>
    </Card>
  );
}
