"use client";

import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { startsInAppNavigation } from "@/lib/ui/navigation";
import {
  isProgressActive,
  startProgress,
  subscribeProgress,
} from "@/lib/ui/progress";

// If a navigation never reports completion (for example the request fails),
// stop the bar anyway instead of leaving it crawling forever.
const NAVIGATION_TIMEOUT_MS = 30_000;

// Starts the bar the moment an in-app link is clicked and stops it once the new
// route has been committed. Without this, a click on a page that needs the
// server (and in development, a compile) shows nothing for seconds.
function NavigationWatcher() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const finishNavigation = useRef<(() => void) | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearNavigation() {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    finishNavigation.current?.();
    finishNavigation.current = null;
  }

  // The route changed: the navigation is done.
  useEffect(() => {
    clearNavigation();
  }, [pathname, search]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      const navigates = startsInAppNavigation(
        event,
        {
          href: anchor.href,
          target: anchor.target,
          hasDownload: anchor.hasAttribute("download"),
        },
        window.location,
      );
      if (!navigates) return;

      clearNavigation();
      finishNavigation.current = startProgress();
      timeout.current = setTimeout(clearNavigation, NAVIGATION_TIMEOUT_MS);
    }

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearNavigation();
    };
  }, []);

  return null;
}

function ProgressBar() {
  const busy = useSyncExternalStore(
    subscribeProgress,
    isProgressActive,
    () => false,
  );
  const [visible, setVisible] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (busy) {
      setFinishing(false);
      setVisible(true);
      return;
    }

    // Work ended: run the bar to the end, then fade it out.
    setFinishing(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setFinishing(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [busy]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
    >
      <div
        className={
          finishing
            ? "h-full w-full bg-primary opacity-0 transition-opacity duration-300"
            : "progress-crawl h-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
        }
      />
    </div>
  );
}

// Mounted once in the root layout.
export function NavigationProgress() {
  return (
    <>
      <ProgressBar />
      <Suspense fallback={null}>
        <NavigationWatcher />
      </Suspense>
    </>
  );
}
