"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LinkPending } from "@/components/ui/link-pending";

// Every entry is a real page. "Panou" is here because the sidebar (which holds
// the logo link) is hidden on narrow screens.
const links = [
  { href: "/", label: "Panou" },
  { href: "/projects", label: "Proiecte" },
  { href: "/catalog", label: "Catalog" },
  { href: "/customers", label: "Clienți" },
  { href: "/normative", label: "Normative" },
  { href: "/settings", label: "Setări" },
];

// Highlights the link matching the current route. The Dashboard link only
// matches the exact root; the others match their section prefix. On narrow
// screens the list scrolls sideways instead of overflowing the header.
export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto text-[13px] [scrollbar-width:none] sm:gap-1 sm:text-[13.5px] [&::-webkit-scrollbar]:hidden">
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
              "relative flex shrink-0 items-center whitespace-nowrap px-2.5 py-3 font-medium transition-colors sm:px-3",
              active
                ? "text-heading after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary sm:after:inset-x-3"
                : "text-secondary-foreground hover:text-heading",
            )}
          >
            {link.label}
            <LinkPending className="ml-1" />
          </Link>
        );
      })}
    </nav>
  );
}