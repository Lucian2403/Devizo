"use client";

import { useActionState, type ReactNode } from "react";

export type GovernanceFormState = { error: string } | { success: true } | null;

export function GovernanceForm({
  action,
  children,
  className,
}: {
  action: (state: GovernanceFormState, data: FormData) => Promise<GovernanceFormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state && "error" in state ? (
        <p role="alert" className="text-sm text-status-error-fg">
          {state.error}
        </p>
      ) : null}
      {state && "success" in state ? (
        <p role="status" className="text-sm text-status-ok-fg">
          Înregistrarea a fost salvată.
        </p>
      ) : null}
    </form>
  );
}
