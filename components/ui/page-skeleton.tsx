// Placeholder layout shown while a page loads, so the screen is never blank and
// the content does not jump when it arrives.
export function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-4xl animate-pulse space-y-6"
      aria-busy="true"
      aria-label="Se încarcă"
    >
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-8 w-56 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-20 rounded-xl border bg-card" />
        <div className="h-20 rounded-xl border bg-card" />
        <div className="h-20 rounded-xl border bg-card" />
      </div>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <div className="h-10 rounded-lg bg-muted/70" />
        <div className="h-10 rounded-lg bg-muted/70" />
        <div className="h-10 rounded-lg bg-muted/70" />
        <div className="h-10 rounded-lg bg-muted/70" />
      </div>
    </div>
  );
}
