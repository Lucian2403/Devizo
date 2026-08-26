"use client";

import { useActionState } from "react";
import { createOrganization, type OnboardingState } from "./actions";
import { SUPPORTED_CURRENCIES } from "@/domain/shared/types";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OnboardingForm() {
  const [state, action] = useActionState<OnboardingState, FormData>(
    createOrganization,
    null,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creează-ți compania</CardTitle>
        <CardDescription>
          Configurează organizația pentru a începe să creezi devize.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Numele companiei</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Identificator spațiu de lucru</Label>
            <Input id="slug" name="slug" placeholder="acme-renovations" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Monedă</Label>
              <select
                id="defaultCurrency"
                name="defaultCurrency"
                defaultValue="EUR"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultLanguage">Limbă</Label>
              <Input id="defaultLanguage" name="defaultLanguage" defaultValue="en" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerDocumentLanguage">Documente</Label>
              <Input
                id="customerDocumentLanguage"
                name="customerDocumentLanguage"
                defaultValue="en"
              />
            </div>
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter>
          <SubmitButton className="w-full" pendingLabel="Se creează...">
            Creează organizația
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
