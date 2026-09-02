'use client';

import {
  type ActionDetail,
  type ActionEntry,
  type ActionType,
  exportFileName,
  newSessionId,
  toNdjson,
} from './action-log';
import { appendEntry, clearAll, count, readAll } from './action-log.store';

/**
 * The app-facing logging API.
 *
 * Every call is fire-and-forget and swallows its errors: an action log that can
 * fail a sale is worse than no action log. Writes are also queued in order, so
 * two calls in the same tick cannot land out of sequence.
 */

const SESSION_KEY = 'cantine-action-log-session';

let queue: Promise<unknown> = Promise.resolve();

/** Keys already recorded, namespaced by session id. See `logActionOnce`. */
const seenThisSession = new Set<string>();

/**
 * One session id per login, kept in sessionStorage so a mid-session reload
 * stays part of the same trail. sessionStorage (not localStorage) because the
 * id should not outlive the tab.
 */
function currentSessionId(): string {
  if (typeof sessionStorage === 'undefined') return 'no-session';
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = newSessionId();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return 'no-session';
  }
}

export function startSession(): string {
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* storage unavailable; a shared id is still better than failing */
    }
  }
  return currentSessionId();
}

/** Records an action. Never throws, never blocks the caller. */
export function logAction(type: ActionType, detail?: ActionDetail): void {
  const at = new Date().toISOString();
  const sessionId = currentSessionId();

  queue = queue
    .then(() => appendEntry({ at, sessionId, type, detail }))
    .catch((error) => {
      // Surfacing in the console is enough: the log is a debugging aid, and a
      // storage failure must not interrupt whoever is standing at the kiosk.
      console.warn('[action-log] could not record action', type, error);
    });
}

/**
 * Records an action at most once per session.
 *
 * Some actions are triggered from React effects, which run twice per mount
 * under StrictMode and can re-run whenever their dependencies change. `login`
 * is the obvious case: it happens once per visit to the kiosk by definition,
 * so a second entry is noise that makes the log harder to read, not a second
 * event.
 *
 * The key is namespaced by session id, so the next login logs again without
 * anything needing to be reset.
 */
export function logActionOnce(key: string, type: ActionType, detail?: ActionDetail): void {
  const dedupeKey = `${currentSessionId()}:${key}`;
  if (seenThisSession.has(dedupeKey)) return;
  seenThisSession.add(dedupeKey);
  logAction(type, detail);
}

/** Test seam: forget which one-shot actions have already been recorded. */
export function resetOnceGuards(): void {
  seenThisSession.clear();
}

/** Resolves once every queued write has been attempted. */
export function flushActionLog(): Promise<void> {
  return queue.then(
    () => undefined,
    () => undefined
  );
}

export async function readActionLog(): Promise<ActionEntry[]> {
  await flushActionLog();
  try {
    return await readAll();
  } catch {
    return [];
  }
}

export async function countActionLog(): Promise<number> {
  await flushActionLog();
  try {
    return await count();
  } catch {
    return 0;
  }
}

export async function clearActionLog(): Promise<void> {
  await flushActionLog();
  try {
    await clearAll();
  } catch {
    /* nothing useful to do; the log is best-effort by design */
  }
}

/**
 * Triggers a download of the whole log.
 *
 * Origin storage is sandboxed, so the file cannot be picked up off the device's
 * filesystem — the app has to hand it over deliberately. On an iPad this lands
 * in Files, from where it can be shared off the device.
 */
export async function downloadActionLog(): Promise<number> {
  const entries = await readActionLog();
  const blob = new Blob([toNdjson(entries)], {
    type: 'application/x-ndjson;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return entries.length;
}
