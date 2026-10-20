/**
 * Admin-chosen display order for the lists that have no order column of their
 * own (services, team, gallery, blog, curated reviews).
 *
 * Each list's order is just an array of ids kept in `clinic_settings`
 * (see settingsStore.ts), so turning this on needs no schema change: a list
 * with no saved order keeps behaving exactly as before (creation order, or
 * newest-first for the blog), and anything not in the saved array — a service
 * added after the last reorder — lands at the end (the start, for the
 * newest-first blog) until the doctor drags it somewhere.
 *
 * FAQs and certificates are not handled here: they already carry a
 * display_order column, so reordering them just renumbers it.
 *
 * Reads are cached briefly because the public list routes call this on every
 * request; a save updates the cache straight away, so the instance that took
 * the write never serves a stale order.
 */

import { loadSetting, saveSetting } from './settingsStore';

export type DisplayOrderList = 'services' | 'team_doctors' | 'team_consultants' | 'gallery' | 'blog' | 'reviews';

/** Where an item that isn't in the saved order goes — the end, except for newest-first lists. */
export type NewItemPosition = 'start' | 'end';

const SETTING_PREFIX = 'display_order:';
const CACHE_TTL_MS = 30_000;
const MAX_IDS = 1000;

const cache = new Map<DisplayOrderList, { ids: string[]; loadedAt: number }>();

async function getSavedOrder(list: DisplayOrderList): Promise<string[]> {
  const hit = cache.get(list);
  if (hit && Date.now() - hit.loadedAt < CACHE_TTL_MS) return hit.ids;

  const stored = await loadSetting<{ ids?: unknown }>(SETTING_PREFIX + list);
  // A failed or empty read keeps the last order this process knew about rather
  // than snapping the public site back to the default for a moment. (Without
  // Supabase there is nothing to read back, so the in-memory copy IS the order.)
  const ids = Array.isArray(stored?.ids)
    ? stored!.ids.filter((id): id is string => typeof id === 'string')
    : hit?.ids ?? [];
  cache.set(list, { ids, loadedAt: Date.now() });
  return ids;
}

/** Orders `items` by the saved order for `list`. Never throws; with no saved order it returns `items` untouched. */
export async function applyDisplayOrder<T extends { id: string }>(
  list: DisplayOrderList,
  items: T[],
  newItems: NewItemPosition = 'end'
): Promise<T[]> {
  const saved = await getSavedOrder(list);
  if (saved.length === 0 || items.length < 2) return items;

  const rank = new Map(saved.map((id, index) => [id, index]));
  const known = items.filter((item) => rank.has(item.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  const unknown = items.filter((item) => !rank.has(item.id));
  return newItems === 'start' ? [...unknown, ...known] : [...known, ...unknown];
}

/**
 * Turns a requested order into a complete one for the items that exist right
 * now: unknown or repeated ids are dropped, and anything the request left out
 * (an item created in another tab since this admin loaded the list) keeps its
 * current relative order at `newItems`, so a stale client can't lose an item.
 */
export function resolveOrder(requestedIds: string[], currentIds: string[], newItems: NewItemPosition = 'end'): string[] {
  const existing = new Set(currentIds);
  const seen = new Set<string>();
  const requested: string[] = [];
  for (const id of requestedIds) {
    if (!existing.has(id) || seen.has(id)) continue;
    seen.add(id);
    requested.push(id);
  }
  const left = currentIds.filter((id) => !seen.has(id));
  return newItems === 'start' ? [...left, ...requested] : [...requested, ...left];
}

/** Validates a request body of the form `{ ids: string[] }`. */
export function parseOrderBody(body: unknown): string[] | null {
  const ids = (body as { ids?: unknown } | null)?.ids;
  if (!Array.isArray(ids) || ids.length > MAX_IDS) return null;
  if (!ids.every((id) => typeof id === 'string' && id.length > 0 && id.length <= 200)) return null;
  return ids as string[];
}

export interface SaveOrderResult {
  success: boolean;
  ids?: string[];
  error?: string;
}

/** Persists the order for `list`. On failure nothing changes — neither the stored order nor the cache. */
export async function saveDisplayOrder(
  list: DisplayOrderList,
  requestedIds: string[],
  currentIds: string[],
  newItems: NewItemPosition = 'end'
): Promise<SaveOrderResult> {
  const ids = resolveOrder(requestedIds, currentIds, newItems);
  const saved = await saveSetting(SETTING_PREFIX + list, { ids });
  if (!saved.success) return { success: false, error: saved.error || 'Could not save the new order.' };

  cache.set(list, { ids, loadedAt: Date.now() });
  return { success: true, ids };
}
