import type { SupportedLanguage } from "@/domain/shared/types";

/**
 * Thin provider port for speech-to-text. Keeping this isolated means a future
 * production stack (e.g. OpenAI gpt-4o-mini-transcribe) is a new adapter only —
 * the route handler and the AI assistant never change.
 *
 * The provider must transcribe VERBATIM and preserve the spoken language(s).
 * It must not translate, summarize or extract anything: transcription feeds the
 * existing text extraction flow, which owns all understanding.
 */
export interface TranscriptionResult {
  text: string;
  // Best-effort language guess; may be undefined and is not relied upon.
  detectedLanguage?: SupportedLanguage;
}

export interface TranscriptionProvider {
  // Turns raw audio bytes into text. Server-only; the API key never leaves the
  // server. Callers pass the browser-reported MIME type so the provider can
  // label the audio part correctly.
  transcribe(audio: Uint8Array, mimeType: string): Promise<TranscriptionResult>;
}

// Raised when the provider cannot return a usable transcript. Callers surface a
// controlled, generic message — never provider internals.
export class TranscriptionError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "TranscriptionError";
  }
}
