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
        <CardTitle>Create your company</CardTitle>
        <CardDescription>
          Set up your organization to start creating estimates.
        </CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Company name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Workspace slug</Label>
            <Input id="slug" name="slug" placeholder="acme-renovations" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="defaultCurrency">Currency</Label>
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
              <Label htmlFor="defaultLanguage">Language</Label>
              <Input id="defaultLanguage" name="defaultLanguage" defaultValue="en" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerDocumentLanguage">Docs</Label>
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
          <SubmitButton className="w-full" pendingLabel="Creating...">
            Create organization
          </SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
