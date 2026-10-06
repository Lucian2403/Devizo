"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, FolderKanban, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

const projectViews = [
  { href: "/projects", label: "Toate proiectele", icon: FolderKanban },
  { href: "/projects/archived", label: "Arhivă", icon: Archive },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[210px] shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-14 items-center px-4">
        <Link href="/" aria-label="Panou">
          <Logo className="[&_span]:text-heading" />
        </Link>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/projects/new"
          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13.5px] font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Proiect nou
        </Link>
      </div>

      <div className="px-4 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Proiecte
        </p>
      </div>

      <nav className="flex flex-col gap-0.5 px-3">
        {projectViews.map((view) => {
          const active =
            view.href === "/projects"
              ? pathname === "/projects" || /^\/projects\/[^/]+$/.test(pathname)
              : pathname.startsWith(view.href);
          const Icon = view.icon;

          return (
            <Link
              key={view.href}
              href={view.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
                active
                  ? "bg-accent-soft text-heading"
                  : "text-secondary-foreground hover:bg-secondary",
              )}
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              {view.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto" />
    </aside>
  );
}
