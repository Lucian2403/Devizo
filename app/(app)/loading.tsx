export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl animate-pulse space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-muted" />
        <div className="h-8 w-56 rounded bg-muted" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-2xl border bg-card" />
        <div className="h-24 rounded-2xl border bg-card" />
        <div className="h-24 rounded-2xl border bg-card" />
      </div>
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="h-16 rounded-xl bg-muted/70" />
        <div className="h-16 rounded-xl bg-muted/70" />
        <div className="h-16 rounded-xl bg-muted/70" />
      </div>
    </div>
  );
}
