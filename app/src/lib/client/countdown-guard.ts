/**
 * Tells a real cancellation apart from a countdown simply going away.
 *
 * The save countdown closes for three different reasons — the user cancels, the
 * user confirms, or it fires on its own — and only the first is a cancellation.
 * On top of that the dialog reports a dismissal both from its "Annuler" button
 * and from its `onOpenChange`, so the same cancel can arrive twice.
 *
 * The guard collapses all of that into one rule: a countdown can be cancelled
 * at most once, and only while it is actually running.
 */
export interface CountdownGuard {
  /** Marks a countdown as running. */
  open(): void;
  /**
   * Closes the countdown, returning true only for the call that closed a
   * running one. Later calls return false, so a cancel that arrives after a
   * confirm or an auto-fire is correctly silent.
   */
  close(): boolean;
  /** Whether a countdown is currently running. */
  isOpen(): boolean;
}

export function createCountdownGuard(): CountdownGuard {
  let open = false;

  return {
    open() {
      open = true;
    },
    close() {
      const wasOpen = open;
      open = false;
      return wasOpen;
    },
    isOpen() {
      return open;
    },
  };
}
