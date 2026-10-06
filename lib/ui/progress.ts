// A tiny shared "something is loading" counter. Anything that starts work the
// user is waiting for (a link click, a form action) calls startProgress() and
// gets back a function that ends it. The top progress bar shows while at least
// one piece of work is active, so overlapping actions don't cut each other off.

type Listener = () => void;

let activeCount = 0;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function startProgress(): () => void {
  activeCount += 1;
  notify();

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    activeCount = Math.max(0, activeCount - 1);
    notify();
  };
}

export function subscribeProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isProgressActive(): boolean {
  return activeCount > 0;
}
