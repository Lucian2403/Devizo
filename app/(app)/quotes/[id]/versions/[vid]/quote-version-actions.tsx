"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createNewVersion,
  sendQuoteVersion,
  type SendQuoteState,
} from "../../../actions";
import type { QuoteStatus } from "@/domain/shared/types";

// Status-driven actions for a single quote version. Draft versions can be
// edited or sent (with confirmation); frozen versions are view-only, except
// sent/rejected which can spawn a new draft version. All server-side rules are
// enforced again in the service — this UI only reflects them.
export function QuoteVersionActions({
  quoteId,
  versionId,
  status,
}: {
  quoteId: string;
  versionId: string;
  status: QuoteStatus;
}) {
  const sendWithIds = sendQuoteVersion.bind(null, quoteId, versionId);
  const [sendState, sendAction] = useActionState<SendQuoteState, FormData>(
    sendWithIds,
    null,
  );
  const createWithIds = createNewVersion.bind(null, quoteId, versionId);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {status === "draft" && (
          <>
            <Button asChild variant="outline">
              <Link href={`/quotes/${quoteId}/edit`}>Editează</Link>
            </Button>
            <form
              action={sendAction}
              onSubmit={(e) => {
                if (
                  !window.confirm(
                    "Această versiune va fi blocată și nu va mai putea fi editată. După finalizare vei putea genera PDF-ul și trimite devizul clientului.",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <SubmitButton pendingLabel="Se confirmă…">Confirmă Devizul</SubmitButton>
            </form>
          </>
        )}

        {(status === "sent" || status === "rejected") && (
          <form action={createWithIds}>
            <SubmitButton pendingLabel="Se creează…" variant="outline">
              Creează versiune nouă
            </SubmitButton>
          </form>
        )}

        {status !== "draft" && (
          <Button asChild variant="outline">
            <a
              href={`/api/quotes/${quoteId}/versions/${versionId}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Descarcă PDF
            </a>
          </Button>
        )}
      </div>

      {sendState && "error" in sendState && (
        <p className="text-[12.5px] text-status-error-fg">{sendState.error}</p>
      )}
    </div>
  );
}
