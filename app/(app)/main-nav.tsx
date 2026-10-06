"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LinkPending } from "@/components/ui/link-pending";

const links = [
  { href: "/projects", label: "Proiecte" },
  { href: "/catalog", label: "Catalog" },
  { href: "/customers", label: "Clienți" },
  { href: "/normative", label: "Normative" },
  { href: null, label: "Rapoarte" },
  { href: "/settings", label: "Setări" },
];

// Highlights the link matching the current route. The Dashboard link only
// matches the exact root; the others match their section prefix.
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-[13.5px]">
      {links.map((link) => {
        const active =
          link.href === null
            ? false
            : link.href === "/"
              ? pathname === "/"
              : pathname.startsWith(link.href);

        const className = cn(
          "relative flex items-center px-3 py-3 font-medium transition-colors",
          active
            ? "text-heading after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
            : "text-secondary-foreground hover:text-heading",
        );

        if (link.href === null) {
          return (
            <span
              key={link.label}
              aria-disabled="true"
              className={cn(className, "cursor-not-allowed opacity-60")}
            >
              {link.label}
            </span>
          );
        }

        return (
          <Link key={link.href} href={link.href} className={className}>
            {link.label}
            <LinkPending className="ml-1" />
          </Link>
        );
      })}
    </nav>
  );
}
