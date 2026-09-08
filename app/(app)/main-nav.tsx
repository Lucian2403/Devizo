"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const links = [
  { href: "/projects", label: "Proiecte" },
  { href: "/catalog", label: "Catalog" },
  { href: "/customers", label: "Clienți" },
  { href: null, label: "Rapoarte" },
  { href: "/settings", label: "Setări" },
];

// Renders a small spinner the instant its parent Link starts navigating, so a
// click always gives immediate feedback even while the route compiles/loads.
function NavPending() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="ml-1 h-3 w-3" /> : null;
}

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
            <NavPending />
          </Link>
        );
      })}
    </nav>
  );
}
