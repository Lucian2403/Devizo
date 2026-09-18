"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createNewVersion,
  decideQuoteVersion,
  sendQuoteVersion,
  type QuoteDecisionState,
  type SendQuoteState,
} from "../../../actions";
import type { QuoteStatus } from "@/domain/shared/types";

// Status-driven actions for one quote version. The server enforces the same
// lifecycle rules again; this component only exposes the valid next actions.
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

  const acceptWithIds = decideQuoteVersion.bind(
    null,
    quoteId,
    versionId,
    "accepted",
  );
  const [acceptState, acceptAction] = useActionState<
    QuoteDecisionState,
    FormData
  >(acceptWithIds, null);

  const rejectWithIds = decideQuoteVersion.bind(
    null,
    quoteId,
    versionId,
    "rejected",
  );
  const [rejectState, rejectAction] = useActionState<
    QuoteDecisionState,
    FormData
  >(rejectWithIds, null);

  const createWithIds = createNewVersion.bind(null, quoteId, versionId);
  const decisionError = acceptState?.error ?? rejectState?.error;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === "draft" && (
          <>
            <Button asChild variant="outline">
              <Link href={`/quotes/${quoteId}/edit`}>Editează</Link>
            </Button>
            <form
              action={sendAction}
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    "Această versiune va fi finalizată și blocată; nu va mai putea fi editată. Vei putea genera PDF-ul și trimite oferta clientului.",
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <SubmitButton pendingLabel="Se finalizează…">
                Finalizează oferta
              </SubmitButton>
            </form>
          </>
        )}

        {status === "sent" && (
          <>
            <form
              action={acceptAction}
              onSubmit={(event) => {
                if (!window.confirm("Marchezi această ofertă ca acceptată?")) {
                  event.preventDefault();
                }
              }}
            >
              <SubmitButton pendingLabel="Se acceptă…">Acceptă</SubmitButton>
            </form>
            <form
              action={rejectAction}
              onSubmit={(event) => {
                if (!window.confirm("Marchezi această ofertă ca respinsă?")) {
                  event.preventDefault();
                }
              }}
            >
              <SubmitButton pendingLabel="Se respinge…" variant="destructive">
                Respinge
              </SubmitButton>
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

      {sendState?.error && (
        <p className="text-[12.5px] text-status-error-fg">{sendState.error}</p>
      )}
      {decisionError && (
        <p className="text-[12.5px] text-status-error-fg">{decisionError}</p>
      )}
    </div>
  );
}
