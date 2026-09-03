"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Client-side duration cap. The server also caps by size; this keeps the
// recording short and the upload small on mobile connections.
const MAX_SECONDS = 120;

// MIME types we try to record with, in order of preference. The browser picks
// the first it supports; the server allowlist mirrors these.
const PREFERRED_MIME = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED_MIME.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Phase = "idle" | "recording" | "uploading";

export function VoiceRecorder({
  onTranscript,
}: {
  // Called with the transcript once transcription succeeds. The parent puts it
  // in the editable textarea and runs the existing text flow.
  onTranscript: (text: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // When true, the stop was a user cancel — discard instead of uploading.
  const cancelledRef = useRef(false);

  // Always release the mic and timer when unmounting.
  useEffect(() => {
    return () => {
      stopTimer();
      releaseStream();
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function start() {
    setError(null);

    const mimeType = pickMimeType();
    if (!mimeType) {
      setError("Browserul nu suportă înregistrarea audio.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Accesul la microfon a fost refuzat.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    cancelledRef.current = false;

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stopTimer();
      releaseStream();
      if (cancelledRef.current) {
        setPhase("idle");
        setSeconds(0);
        return;
      }
      const blob = new Blob(chunksRef.current, { type: mimeType });
      void upload(blob);
    };

    recorder.start();
    setPhase("recording");
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        if (next >= MAX_SECONDS) stop();
        return next;
      });
    }, 1000);
  }

  function stop() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  function cancel() {
    cancelledRef.current = true;
    stop();
  }

  async function upload(blob: Blob) {
    if (blob.size === 0) {
      setError("Înregistrare goală. Încearcă din nou.");
      setPhase("idle");
      setSeconds(0);
      return;
    }

    setPhase("uploading");
    const form = new FormData();
    form.append("audio", blob, "recording.webm");

    try {
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
      });
      const data = (await response.json().catch(() => ({}))) as {
        text?: string;
        error?: string;
      };
      if (!response.ok || !data.text) {
        setError(data.error ?? "Transcrierea a eșuat.");
        return;
      }
      onTranscript(data.text);
    } catch {
      setError("Serviciul vocal nu este disponibil.");
    } finally {
      setPhase("idle");
      setSeconds(0);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {phase === "idle" && (
          <Button type="button" variant="outline" onClick={start}>
            🎤 Înregistrează
          </Button>
        )}

        {phase === "recording" && (
          <>
            <span className="flex items-center gap-2 text-sm font-medium text-destructive">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
              {formatDuration(seconds)}
            </span>
            <Button type="button" onClick={stop}>
              Oprește
            </Button>
            <Button type="button" variant="ghost" onClick={cancel}>
              Anulează
            </Button>
          </>
        )}

        {phase === "uploading" && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Se transcrie…
          </span>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
