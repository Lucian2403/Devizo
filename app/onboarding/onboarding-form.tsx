"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createOrganization, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Creating..." : "Create organization"}
    </Button>
  );
}

export function OnboardingForm() {
  const [state, action] = useFormState<OnboardingState, FormData>(
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
              <Input id="defaultCurrency" name="defaultCurrency" defaultValue="EUR" />
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
          <SubmitButton />
        </CardFooter>
      </form>
    </Card>
  );
}
