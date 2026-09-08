"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

// Primary project views. Only "Toate proiectele" maps to a real route today;
// the others are visual placeholders until those views exist.
const projectViews = [
  { href: "/projects", label: "Toate proiectele", icon: "▤" },
  { href: null, label: "Proiectele mele", icon: "◈" },
  { href: null, label: "Favorite", icon: "★" },
  { href: null, label: "Arhivă", icon: "🗄" },
];

// Tag filters — static placeholders shown for visual parity with the mockup.
const tags = [
  { label: "Renovare", color: "bg-status-warn-dot" },
  { label: "Case", color: "bg-status-ok-dot" },
  { label: "Apartamente", color: "bg-sky-400" },
  { label: "Comercial", color: "bg-violet-400" },
  { label: "Oferte trimise", color: "bg-status-neutral-fg" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[210px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-14 items-center px-4">
        <Link href="/">
          <Logo className="[&_span]:text-heading" />
        </Link>
      </div>

      <div className="px-3 pb-2">
        <Link
          href="/projects/new"
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13.5px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <span className="text-base leading-none">+</span> Proiect nou
        </Link>
      </div>

      <nav className="mt-1 flex flex-col gap-0.5 px-3">
        {projectViews.map((v) => {
          const active = v.href === "/projects" && pathname.startsWith("/projects");
          const cls = cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors",
            active
              ? "bg-accent-soft text-heading"
              : v.href
                ? "text-secondary-foreground hover:bg-secondary"
                : "cursor-not-allowed text-muted-foreground opacity-60",
          );
          const content = (
            <>
              <span className="w-4 text-center text-muted-foreground">
                {v.icon}
              </span>
              {v.label}
            </>
          );
          return v.href ? (
            <Link key={v.label} href={v.href} className={cls}>
              {content}
            </Link>
          ) : (
            <span key={v.label} className={cls}>
              {content}
            </span>
          );
        })}
      </nav>

      <div className="mt-5 px-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Etichete
        </p>
        <div className="flex flex-col gap-0.5">
          {tags.map((t) => (
            <span
              key={t.label}
              className="flex cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-secondary-foreground opacity-80"
            >
              <span className={cn("h-2 w-2 rounded-full", t.color)} />
              {t.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-3 p-4">
        <div className="rounded-lg border border-border bg-muted-section p-3 opacity-80">
          <p className="text-[13px] font-semibold text-heading">Plan Pro</p>
          <p className="mb-2 text-[12px] text-muted-foreground">124 / 200 devize</p>
          <div className="mb-2.5 h-1.5 overflow-hidden rounded-full bg-border">
            <div className="h-full w-[62%] rounded-full bg-primary" />
          </div>
          <button
            type="button"
            className="w-full cursor-not-allowed rounded-md border border-border-strong bg-card py-1.5 text-[12.5px] font-medium text-muted-foreground opacity-70"
            disabled
            aria-disabled="true"
          >
            Upgrade
          </button>
        </div>
        <span className="flex cursor-default items-center gap-2 px-1 text-[13px] text-muted-foreground opacity-80">
          <span className="w-4 text-center">?</span> Ajutor
        </span>
      </div>
    </aside>
  );
}
