import { cn } from "@/lib/utils";

// The Devizo brand logo: an amber hard hat next to the wordmark.
// Rendered as inline SVG so it stays crisp at any size and can use theme colors.
export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="h-7 w-7" />
      {showWordmark && (
        <span className="text-xl font-bold tracking-tight text-foreground">
          Devizo
        </span>
      )}
    </span>
  );
}

// Just the hard-hat mark, useful on its own (favicons, tight spaces).
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* helmet dome */}
      <path
        d="M8 32c0-8.837 7.163-16 16-16s16 7.163 16 16H8Z"
        className="fill-accent"
      />
      {/* center ridge */}
      <path
        d="M21 16.4c0-1.4 1.343-2.4 3-2.4s3 1 3 2.4V20h-6v-3.6Z"
        className="fill-accent"
      />
      {/* brim */}
      <rect x="5" y="32" width="38" height="4" rx="2" className="fill-accent" />
      {/* subtle brim shadow for depth */}
      <rect
        x="5"
        y="32"
        width="38"
        height="2"
        rx="1"
        className="fill-foreground/15"
      />
    </svg>
  );
}
