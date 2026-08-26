"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface SubmitButtonProps extends ButtonProps {
  // Text shown while the form is submitting. Falls back to the button label.
  pendingLabel?: string;
}

// A submit button that automatically shows a spinner and a pending label while
// its parent <form> is being submitted. Uses the form status from React so no
// manual loading state is needed on each page.
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending && <Spinner />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
