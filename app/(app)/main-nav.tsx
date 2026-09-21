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
    <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-[13px] [scrollbar-width:none] sm:gap-1 sm:text-[13.5px] [&::-webkit-scrollbar]:hidden">
      {links.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

        const className = cn(
          "relative flex shrink-0 items-center whitespace-nowrap px-2.5 py-3 font-medium transition-colors sm:px-3",
          active
            ? "text-heading after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
            : "text-secondary-foreground hover:text-heading",
        );

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
