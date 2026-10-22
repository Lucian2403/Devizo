"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LinkPending } from "@/components/ui/link-pending";

// Every entry is a real page. "Panou" is here because the sidebar (which holds
// the logo link) is hidden on narrow screens.
const links = [
  { href: "/", label: "Panou" },
  { href: "/projects", label: "Proiecte" },
  { href: "/catalog", label: "Catalog" },
  { href: "/customers", label: "Clienți" },
  { href: "/professional-estimates", label: "Devize" },
  { href: "/normative", label: "Normative" },
  { href: "/settings", label: "Setări" },
];

const estimateLinks = [
  { href: "/professional-estimates/new", label: "Deviz profesional nou" },
  { href: "/professional-estimates/object-estimates", label: "Devize pe obiect" },
  { href: "/professional-estimates/general-estimates", label: "Devize generale" },
  { href: "/professional-estimates/norms", label: "Biblioteca de norme" },
  { href: "/professional-estimates/resources", label: "Resurse și prețuri" },
  { href: "/professional-estimates/rules", label: "Reguli de calcul" },
];

function EstimateNavigation({ active }: { active: boolean }) {
  const pathname = usePathname();
  const panelId = useId();
  const triggerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  function open() {
    const bounds = triggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setPosition({
      top: bounds.bottom,
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - 264)),
    });
  }

  function contains(target: EventTarget | null) {
    return target instanceof Node &&
      (triggerRef.current?.contains(target) || panelRef.current?.contains(target));
  }

  useEffect(() => {
    if (!position) return;
    function dismiss(event: PointerEvent) {
      if (!contains(event.target)) setPosition(null);
    }
    function close() {
      setPosition(null);
    }
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close);
    };
  }, [position]);

  function closeOnLeave(target: EventTarget | null) {
    if (!contains(target)) setPosition(null);
  }

  function escape(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      buttonRef.current?.focus();
      setPosition(null);
    } else if (
      event.key === "Tab" &&
      !event.shiftKey &&
      event.target === buttonRef.current &&
      position
    ) {
      const firstLink = panelRef.current?.querySelector("a");
      if (firstLink) {
        event.preventDefault();
        firstLink.focus();
      }
    }
  }

  function panelKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "Tab") {
      escape(event);
      return;
    }
    const links = panelRef.current?.querySelectorAll("a");
    if (!links?.length) return;
    if (event.shiftKey && event.target === links[0]) {
      event.preventDefault();
      buttonRef.current?.focus();
    } else if (!event.shiftKey && event.target === links[links.length - 1]) {
      const nextLink = triggerRef.current?.nextElementSibling;
      if (nextLink instanceof HTMLElement) {
        event.preventDefault();
        nextLink.focus();
        setPosition(null);
      }
    }
  }

  return (
    <div
      ref={triggerRef}
      className="flex shrink-0 items-center"
      onMouseEnter={open}
      onMouseLeave={(event) => closeOnLeave(event.relatedTarget)}
      onBlur={(event) => closeOnLeave(event.relatedTarget)}
      onKeyDown={escape}
    >
      <Link
        href="/professional-estimates"
        onFocus={open}
        onClick={() => setPosition(null)}
        className={cn(
          "relative flex items-center whitespace-nowrap py-3 pl-2.5 pr-1 font-medium transition-colors sm:pl-3",
          active
            ? "text-heading after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary"
            : "text-secondary-foreground hover:text-heading",
        )}
      >
        Devize
        <LinkPending className="ml-1" />
      </Link>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Scurtături devize"
        aria-expanded={position !== null}
        aria-controls={panelId}
        className="rounded p-1.5 text-secondary-foreground hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => position ? setPosition(null) : open()}
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {position && createPortal(
        <div
          ref={panelRef}
          id={panelId}
          aria-label="Scurtături devize"
          className="fixed z-50 w-64 max-w-[calc(100vw-16px)] rounded-md border border-border bg-card p-1.5 text-sm shadow-lg"
          style={position}
          onMouseLeave={(event) => closeOnLeave(event.relatedTarget)}
          onBlur={(event) => closeOnLeave(event.relatedTarget)}
          onKeyDown={panelKeyDown}
        >
          {estimateLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              onClick={() => setPosition(null)}
              className="flex items-center rounded px-3 py-2 text-heading hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
            >
              {link.label}
              <LinkPending className="ml-auto" />
            </Link>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}

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

        if (link.href === "/professional-estimates") {
          return <EstimateNavigation key={link.href} active={active} />;
        }

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