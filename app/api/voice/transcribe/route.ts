import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import {
  getOrganizationService,
  getTranscriptionProvider,
} from "@/server/container";
import { TranscriptionError } from "@/domain/ai/transcription.provider";

/**
 * Voice upload endpoint (M5.2). A Route Handler is used instead of a Server
 * Action because the payload is binary audio. The audio is transcribed in
 * memory and discarded — nothing is persisted.
 *
 * The transcript is returned to the client, which shows it (editable) and then
 * runs the SAME existing text extraction flow. This endpoint never extracts,
 * prices or touches the quote draft.
 */

// Server-side guards. Duration is enforced on the client timer; here we cap by
// size, which is the reliable server-side proxy for a short recording.
const MAX_BYTES = 10 * 1024 * 1024; // ~10 MB
const ALLOWED_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
]);

// Strips codec parameters, e.g. "audio/webm;codecs=opus" → "audio/webm".
function baseMime(type: string): string {
  return type.split(";")[0]!.trim().toLowerCase();
}

export async function POST(request: Request): Promise<Response> {
  // 1) Authenticated user only. Route handlers can't redirect, so return 401.
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Neautentificat." }, { status: 401 });
  }

  // 2) Verify the user has a current organization.
  const orgs = await getOrganizationService().getOrganizationsForUser(user.id);
  if (!orgs[0]) {
    return NextResponse.json({ error: "Fără organizație." }, { status: 403 });
  }

  // 3) Read the multipart form and validate the audio file.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Cerere invalidă." }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Lipsește audio." }, { status: 400 });
  }

  const mime = baseMime(file.type);
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: "Format audio nesuportat." },
      { status: 415 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Înregistrare goală." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Înregistrarea este prea mare." },
      { status: 413 },
    );
  }

  const audio = new Uint8Array(await file.arrayBuffer());

  // 4) Transcribe in memory, then let the buffer go out of scope (no storage).
  try {
    const result = await getTranscriptionProvider().transcribe(audio, mime);
    const text = result.text.trim();
    if (text.length === 0) {
      return NextResponse.json(
        { error: "Nu am putut transcrie audio. Încearcă din nou." },
        { status: 422 },
      );
    }
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof TranscriptionError) {
      console.error("Transcription failed:", error);
      return NextResponse.json(
        { error: "Transcrierea a eșuat. Încearcă din nou." },
        { status: 502 },
      );
    }
    if (error instanceof Error && error.message.includes("API_KEY")) {
      return NextResponse.json(
        { error: "Transcrierea nu este configurată." },
        { status: 503 },
      );
    }
    console.error("Unexpected transcription error:", error);
    return NextResponse.json(
      { error: "Serviciul vocal nu este disponibil." },
      { status: 500 },
    );
  }
}
