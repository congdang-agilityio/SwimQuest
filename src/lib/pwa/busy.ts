/**
 * "Busy" signal (#922): true while a swim upload or a form submit is on its way to the server.
 * The update card neither shows nor reloads the page while it is set.
 */
let pending = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** Marks the app busy until `work` settles, and returns it unchanged. */
export function trackBusy<T>(work: Promise<T>): Promise<T> {
  pending++;
  emit();
  return work.finally(() => {
    pending--;
    emit();
  });
}

export function isBusy(): boolean {
  return pending > 0;
}

export function subscribeBusy(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
