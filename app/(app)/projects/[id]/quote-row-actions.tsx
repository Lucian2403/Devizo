"use client";

import { SubmitButton } from "@/components/ui/submit-button";
import { deleteQuoteFromProject } from "@/app/(app)/quotes/actions";

export function QuoteRowActions({
  quoteId,
  projectId,
  view,
}: {
  quoteId: string;
  projectId: string;
  view: "all" | "confirmed";
}) {
  const removeAction = deleteQuoteFromProject.bind(null, quoteId, projectId, view);

  return (
    <form
      action={removeAction}
      onSubmit={(event) => {
        if (!window.confirm("Ștergi acest deviz? Acțiunea nu poate fi anulată.")) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        pendingLabel="Se șterge…"
      >
        Șterge
      </SubmitButton>
    </form>
  );
}
