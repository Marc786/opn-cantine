/**
 * Telling a barcode scanner apart from a person typing.
 *
 * The kiosk has no keyboard: input arrives from a USB scanner that types a
 * whole code in a few milliseconds and usually ends with Enter. Some scanners
 * do not send Enter at all, so a burst of fast keystrokes has to be treated as
 * a completed scan on its own.
 */

/** Keystrokes closer together than this are not human. */
export const RAPID_INPUT_THRESHOLD_MS = 80;

/** Quiet period after a burst before it counts as a finished code. */
export const AUTO_SUBMIT_DELAY_MS = 300;

/** Shorter than this is a misread, not a product. */
export const MIN_BARCODE_LENGTH = 4;

/** Consecutive fast keystrokes needed before input is trusted as a scan. */
export const RAPID_KEYSTROKES_REQUIRED = 3;

/** Scanners only ever emit digits; anything else is noise from the field. */
export function normaliseBarcode(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isRapidKeystroke(gapMs: number): boolean {
  return gapMs < RAPID_INPUT_THRESHOLD_MS;
}

/**
 * Whether a burst is long enough, and the code plausible enough, to submit
 * without waiting for an Enter that may never come.
 */
export function isCompleteScan(rapidKeystrokes: number, barcode: string): boolean {
  return (
    rapidKeystrokes >= RAPID_KEYSTROKES_REQUIRED &&
    barcode.length >= MIN_BARCODE_LENGTH
  );
}

/** A code worth sending to the lookup at all. */
export function isSubmittableBarcode(barcode: string): boolean {
  return barcode.length >= MIN_BARCODE_LENGTH;
}
