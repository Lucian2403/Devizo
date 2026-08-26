"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthActionState } from "../actions";
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

export default function SignInPage() {
  const [state, action] = useActionState<AuthActionState, FormData>(signIn, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Autentificare</CardTitle>
        <CardDescription>Accesează spațiul tău de lucru Devizo.</CardDescription>
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
          <SubmitButton className="w-full" pendingLabel="Se autentifică...">
            Autentificare
          </SubmitButton>
          <p className="text-sm text-muted-foreground">
            Nu ai cont?{" "}
            <Link href="/sign-up" className="underline">
              Creează cont
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
