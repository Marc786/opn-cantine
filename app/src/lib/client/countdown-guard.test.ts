import { describe, it, expect } from 'vitest';
import { createCountdownGuard } from './countdown-guard';

describe('createCountdownGuard', () => {
  it('starts closed, so a stray cancel before any countdown is silent', () => {
    const guard = createCountdownGuard();

    expect(guard.isOpen()).toBe(false);
    expect(guard.close()).toBe(false);
  });

  it('reports the cancellation of a running countdown', () => {
    const guard = createCountdownGuard();
    guard.open();

    expect(guard.close()).toBe(true);
  });

  it('reports a cancellation only once, however often the dialog says so', () => {
    // The "Annuler" button fires onCancel, and the dialog closing fires it
    // again through onOpenChange. One press must not log two cancels.
    const guard = createCountdownGuard();
    guard.open();

    expect(guard.close()).toBe(true);
    expect(guard.close()).toBe(false);
    expect(guard.close()).toBe(false);
  });

  it('stays silent for a cancel arriving after a confirm closed the countdown', () => {
    // Confirming tears the countdown down first, then saves. Any dismissal
    // callback that follows must not be recorded as the user cancelling.
    const guard = createCountdownGuard();
    guard.open();
    guard.close(); // confirm tears it down

    expect(guard.close()).toBe(false);
  });

  it('stays silent for a cancel arriving after the countdown auto-fired', () => {
    const guard = createCountdownGuard();
    guard.open();
    guard.close(); // countdown reached zero

    expect(guard.close()).toBe(false);
  });

  it('allows a cancellation again once a new countdown opens', () => {
    const guard = createCountdownGuard();

    guard.open();
    expect(guard.close()).toBe(true);

    guard.open();
    expect(guard.close()).toBe(true);
  });

  it('treats reopening an already open countdown as still one countdown', () => {
    const guard = createCountdownGuard();

    guard.open();
    guard.open();

    expect(guard.close()).toBe(true);
    expect(guard.close()).toBe(false);
  });

  it('tracks isOpen across the lifecycle', () => {
    const guard = createCountdownGuard();
    expect(guard.isOpen()).toBe(false);

    guard.open();
    expect(guard.isOpen()).toBe(true);

    guard.close();
    expect(guard.isOpen()).toBe(false);
  });

  it('keeps separate countdowns independent', () => {
    const tab = createCountdownGuard();
    const cash = createCountdownGuard();

    tab.open();

    expect(cash.close()).toBe(false);
    expect(tab.close()).toBe(true);
  });
});
