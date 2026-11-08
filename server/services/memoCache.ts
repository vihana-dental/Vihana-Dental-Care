/**
 * Tiny in-memory cache for the public read endpoints.
 *
 * Every visitor request used to re-download whole tables from Supabase —
 * including the gallery and blog, whose photos are stored as base64 and add up
 * to several MB per read — which is what exhausted the project's egress quota.
 * Public data changes rarely, so each list is loaded once and reused for a few
 * minutes. Admin writes call clearMemo(), so edits still show up immediately.
 * Failed loads are never cached.
 */

const store = new Map<string, { at: number; value: Promise<unknown> }>();

export const MEMO_TTL_MS = 10 * 60 * 1000;

export function memo<T>(key: string, load: () => Promise<T>, ttlMs: number = MEMO_TTL_MS): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  store.set(key, { at: Date.now(), value });
  value.catch(() => {
    if (store.get(key)?.value === value) store.delete(key);
  });
  return value;
}

export function clearMemo(): void {
  store.clear();
}
