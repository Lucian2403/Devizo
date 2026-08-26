"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const links = [
  { href: "/", label: "Panou" },
  { href: "/projects", label: "Proiecte" },
  { href: "/catalog", label: "Catalog" },
  { href: "/customers", label: "Clienți" },
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
    <nav className="flex items-center gap-1 text-sm">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "relative flex items-center rounded-md px-3 py-1.5 font-medium transition-colors",
              active
                ? "text-foreground after:absolute after:inset-x-2 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-accent"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {link.label}
            <NavPending />
          </Link>
        );
      })}
    </nav>
  );
}
