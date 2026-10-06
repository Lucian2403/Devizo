"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { LinkPending } from "@/components/ui/link-pending";

// Project views. Every entry is a real page.
const projectViews = [
  { href: "/projects", label: "Toate proiectele", icon: "▤" },
  { href: "/projects/archived", label: "Arhivă", icon: "🗄" },
];

// "/projects" is a prefix of "/projects/archived", so the first entry must not
// stay highlighted on the archive page.
function isActive(href: string, pathname: string) {
  if (href === "/projects/archived") {
    return pathname.startsWith("/projects/archived");
  }
  return (
    pathname.startsWith("/projects") &&
    !pathname.startsWith("/projects/archived")
  );
}

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
          <LinkPending />
        </Link>
      </div>

      <nav className="mt-1 flex flex-col gap-0.5 px-3">
        {projectViews.map((view) => (
          <Link
            key={view.href}
            href={view.href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors",
              isActive(view.href, pathname)
                ? "bg-accent-soft text-heading"
                : "text-secondary-foreground hover:bg-secondary",
            )}
          >
            <span className="w-4 text-center text-muted-foreground">
              {view.icon}
            </span>
            {view.label}
            <LinkPending className="ml-auto" />
          </Link>
        ))}
      </nav>
    </aside>
  );
}