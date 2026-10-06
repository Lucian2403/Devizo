export interface ClickLike {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export interface AnchorLike {
  href: string;
  target: string;
  hasDownload: boolean;
}

export interface LocationLike {
  href: string;
  origin: string;
  pathname: string;
  search: string;
}

// Decides whether a click on a link starts an in-app page navigation that the
// top progress bar should follow.
//
// Next's <Link> calls preventDefault() when it handles the click as a
// client-side navigation, so an un-prevented click is a plain browser action
// (a download, a new tab, an external site) that the bar must ignore.
export function startsInAppNavigation(
  click: ClickLike,
  anchor: AnchorLike,
  current: LocationLike,
): boolean {
  if (!click.defaultPrevented) return false;
  if (click.button !== 0) return false;
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) {
    return false;
  }
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasDownload) return false;

  let destination: URL;
  try {
    destination = new URL(anchor.href, current.href);
  } catch {
    return false;
  }

  if (destination.origin !== current.origin) return false;

  // Same page (or only the #hash differs): nothing is going to load.
  return (
    destination.pathname !== current.pathname ||
    destination.search !== current.search
  );
}