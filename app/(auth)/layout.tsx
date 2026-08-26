import { Logo } from "@/components/brand/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      {/* Warm brand glow behind the auth card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45rem_28rem_at_50%_-10%,hsl(42_96%_55%/0.22),transparent_60%)]"
      />
      <Logo className="scale-110" />
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Devize pentru echipe de renovări, gata în câteva minute.
      </p>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
