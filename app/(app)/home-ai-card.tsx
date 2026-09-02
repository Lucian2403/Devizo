"use client";

import { useState } from "react";
import { createQuoteForProject } from "@/app/(app)/quotes/actions";

interface ProjectOption {
  id: string;
  name: string;
}

// A prominent home-page entry point for the AI assistant. The contractor
// describes the job and picks a project; we create a quote and jump straight
// into the editor with the assistant pre-filled and open.
export function HomeAiCard({ projects }: { projects: ProjectOption[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [text, setText] = useState("");

  const hasProjects = projects.length > 0;
  const canSubmit = hasProjects && projectId !== "";

  // Stash the description so the editor can pre-fill the assistant after the
  // server action redirects us there.
  function handleSubmit() {
    if (text.trim()) {
      sessionStorage.setItem("ai_prefill", text.trim());
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xl">✨</span>
        <h2 className="text-lg font-semibold">Deviz nou cu AI</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Descrie lucrarea în orice limbă. Asistentul extrage articolele și le
        potrivește cu catalogul tău. Prețurile vin din catalog sau le introduci
        manual.
      </p>

      {!hasProjects ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Creează mai întâi un proiect pentru a începe un deviz.
        </p>
      ) : (
        <form action={createQuoteForProject} onSubmit={handleSubmit} className="mt-4 space-y-3">
          <textarea
            name="description"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex: dat jos gresia veche în baie, cca 18 m2, montat faianță nouă pe pereți..."
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="projectId"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-2 text-sm sm:max-w-xs"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              Continuă spre deviz
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
