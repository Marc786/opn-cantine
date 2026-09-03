/**
 * On-device action log.
 *
 * The kiosk runs on a single shared iPad, so actions are strictly sequential
 * and a local trail is enough to reconstruct what happened before a bug. This
 * module holds the parts that do not touch storage, so they can be reasoned
 * about and tested directly.
 */

export type ActionType =
  | 'login'
  | 'cash_open'
  | 'scan'
  | 'scan_dropped'
  | 'scan_unknown'
  | 'price_check'
  | 'quick_add'
  | 'modify_item'
  | 'remove_item'
  | 'save_open'
  | 'save_cancel'
  | 'save_confirm'
  | 'save_result'
  | 'save_error'
  | 'reset_tab'
  | 'auto_logout'
  | 'disconnect';

/** Free-form context. Kept shallow so entries stay greppable in an export. */
export type ActionDetail = Record<string, string | number | boolean | null | undefined>;

export interface ActionEntry {
  /** Monotonic, assigned by the store. The ordering is the point of this log. */
  seq: number;
  /** Device clock. Useful, but never trusted for ordering — see `seq`. */
  at: string;
  /** Groups every entry between a login and the following logout. */
  sessionId: string;
  type: ActionType;
  detail: ActionDetail;
}

export type NewActionEntry = Omit<ActionEntry, 'seq'>;

/**
 * Entries kept on device before the oldest are dropped.
 *
 * Sized for retention, not for storage. An entry serialises to roughly 200
 * bytes, so this is about 10 MB of NDJSON — nothing next to the origin quota,
 * and trimming costs the same whatever the capacity because it only deletes
 * the overflow. A busy day is on the order of 3000 entries, so this keeps a
 * couple of weeks: long enough that a bug noticed on Monday is still in the
 * log, which is the whole point of keeping one.
 */
export const LOG_CAPACITY = 50000;

const CARD_SUFFIX_LENGTH = 4;

/**
 * Card numbers are the credential employees log in with, so the log keeps only
 * enough to tell two people apart. An exported file may be mailed around; it
 * must not be a list of working credentials.
 */
export function redactCardNumber(cardNumber: string | null | undefined): string | null {
  if (cardNumber === null || cardNumber === undefined) return null;
  const trimmed = String(cardNumber).trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= CARD_SUFFIX_LENGTH) return '*'.repeat(trimmed.length);
  return `*${trimmed.slice(-CARD_SUFFIX_LENGTH)}`;
}

/** Keys whose value is a credential and must never be written verbatim. */
const REDACT_KEYS = new Set(['cardnumber', 'card']);
/** Keys whose value has no debugging use at all and is simply dropped. */
const DROP_KEYS = new Set(['pin', 'password', 'token', 'secret']);

/**
 * Drops undefined values and redacts anything credential-shaped, whatever the
 * caller passed. Call sites are easy to add and easy to get wrong, so the
 * scrubbing happens here rather than being remembered at each one.
 */
export function scrubDetail(detail: ActionDetail | undefined): ActionDetail {
  if (!detail) return {};
  const clean: ActionDetail = {};
  for (const [key, value] of Object.entries(detail)) {
    if (value === undefined) continue;
    const normalised = key.toLowerCase();
    if (DROP_KEYS.has(normalised)) continue;
    clean[key] = REDACT_KEYS.has(normalised) ? redactCardNumber(String(value)) : value;
  }
  return clean;
}

export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Keeps the newest `capacity` entries. */
export function trimToCapacity(
  entries: ActionEntry[],
  capacity: number = LOG_CAPACITY
): ActionEntry[] {
  if (capacity <= 0) return [];
  return entries.length <= capacity ? entries : entries.slice(entries.length - capacity);
}

/**
 * Newline-delimited JSON: one entry per line, so a truncated or partially
 * copied file still parses line by line, and `grep` works on it directly.
 */
export function toNdjson(entries: ActionEntry[]): string {
  return entries.map((entry) => JSON.stringify(entry)).join('\n');
}

export function parseNdjson(text: string): ActionEntry[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ActionEntry);
}

export function exportFileName(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `cantine-actions-${stamp}.ndjson`;
}
