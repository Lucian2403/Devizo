"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthActionState } from "../actions";
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

export default function SignUpPage() {
  const [state, action] = useActionState<AuthActionState, FormData>(signUp, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creează cont</CardTitle>
        <CardDescription>Începe să creezi devize mai rapid.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Parolă</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <SubmitButton className="w-full" pendingLabel="Se creează contul...">
            Creează cont
          </SubmitButton>
          <p className="text-sm text-muted-foreground">
            Ai deja un cont?{" "}
            <Link href="/sign-in" className="underline">
              Autentificare
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
