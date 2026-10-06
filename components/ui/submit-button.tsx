"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { startProgress } from "@/lib/ui/progress";

interface SubmitButtonProps extends ButtonProps {
  // Text shown while the form is submitting. Falls back to the button label.
  pendingLabel?: string;
}

// A submit button that automatically shows a spinner and a pending label while
// its parent <form> is being submitted, and runs the top progress bar for the
// same time. Uses the form status from React so no manual loading state is
// needed on each page.
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (!pending) return;
    return startProgress();
  }, [pending]);

  return (
    <Button type="submit" loading={pending} disabled={disabled} {...props}>
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}