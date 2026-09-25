/**
 * Per-doctor day-off / slot-off tracking. A slot is available by default —
 * a row in `doctor_schedule_overrides` means that (doctor, date, time_slot)
 * is BLOCKED. Kept as an in-memory mirror (same pattern as DOCTORS_LIVE /
 * appointmentsStorage elsewhere) so the many synchronous slot-availability
 * checks throughout the booking flow don't need to become async.
 */

import { getTimeSlotsForDate, formatSlotLabel } from '../../src/data/clinicData';
import { parseSlotLabel } from '../../src/lib/clinicTime';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

const key = (doctorId: string, date: string) => `${doctorId}::${date}`;

// doctorId::date -> Set of blocked time-slot labels ("09:00 AM").
let BLOCKED_SLOTS: Map<string, Set<string>> = new Map();

export async function loadScheduleOverrides(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/doctor_schedule_overrides?select=doctor_id,date,time_slot`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) throw new Error(`Supabase schedule overrides read failed: ${res.status} ${await res.text()}`);

    const rows: { doctor_id: string; date: string; time_slot: string }[] = await res.json();
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      const k = key(row.doctor_id, row.date);
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(row.time_slot);
    }
    BLOCKED_SLOTS = map;
    console.log(`Loaded ${rows.length} doctor schedule override(s) from Supabase.`);
  } catch (error: any) {
    console.error('Supabase loadScheduleOverrides failed (falling back to no overrides):', error?.message || error);
  }
}

export function getBlockedSlots(doctorId: string, date: string): Set<string> {
  return BLOCKED_SLOTS.get(key(doctorId, date)) || new Set();
}

export function isSlotBlockedForDoctor(doctorId: string | undefined, date: string, timeSlot: string): boolean {
  if (!doctorId) return false;
  return getBlockedSlots(doctorId, date).has(timeSlot);
}

export async function setSlotBlocked(doctorId: string, date: string, timeSlot: string, blocked: boolean): Promise<{ success: boolean; mock: boolean; error?: string }> {
  // Always update the in-memory mirror immediately so the very next
  // availability check reflects the change, even if Supabase is
  // unreachable or unconfigured (mock mode) — this store's whole purpose
  // is to gate booking, so it must never silently no-op.
  const k = key(doctorId, date);
  if (blocked) {
    if (!BLOCKED_SLOTS.has(k)) BLOCKED_SLOTS.set(k, new Set());
    BLOCKED_SLOTS.get(k)!.add(timeSlot);
  } else {
    BLOCKED_SLOTS.get(k)?.delete(timeSlot);
  }

  if (!isSupabaseConfigured()) {
    return { success: true, mock: true };
  }

  try {
    if (blocked) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/doctor_schedule_overrides`, {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'return=minimal,resolution=merge-duplicates' }),
        body: JSON.stringify({ doctor_id: doctorId, date, time_slot: timeSlot })
      });
      if (!res.ok) throw new Error(`Supabase schedule override insert failed: ${res.status} ${await res.text()}`);
    } else {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/doctor_schedule_overrides?doctor_id=eq.${encodeURIComponent(doctorId)}&date=eq.${encodeURIComponent(date)}&time_slot=eq.${encodeURIComponent(timeSlot)}`,
        { method: 'DELETE', headers: supabaseHeaders({ Prefer: 'return=minimal' }) }
      );
      if (!res.ok) throw new Error(`Supabase schedule override delete failed: ${res.status} ${await res.text()}`);
    }
    return { success: true, mock: false };
  } catch (error: any) {
    console.error('Supabase setSlotBlocked failed:', error?.message || error);
    return { success: false, mock: false, error: error?.message || 'Unknown Supabase error' };
  }
}

// ---------------------------------------------------------------------------
// Custom slots — add / edit / delete a slot for one (doctor, date).
//
// A day's slots are the clinic's default weekly hours (getTimeSlotsForDate)
// adjusted per doctor and date: an 'added' row puts an extra slot on the day
// (a special session, or a whole extra day on a normally-closed weekday), and
// a 'removed' row takes a default slot off the day entirely. That is different
// from a *blocked* slot above, which stays visible as "unavailable"; a removed
// slot simply doesn't exist for that date. Editing a slot is a remove + add.
// ---------------------------------------------------------------------------

type SlotChangeKind = 'added' | 'removed';

let ADDED_SLOTS: Map<string, Set<string>> = new Map();
let REMOVED_SLOTS: Map<string, Set<string>> = new Map();

const minutesOf = (label: string) => {
  const { hours, minutes } = parseSlotLabel(label);
  return hours * 60 + minutes;
};

/**
 * Accepts "14:30" (what <input type="time"> produces) or "2:30 PM" and returns
 * the canonical slot label used everywhere else ("2:30 PM"), or null if the
 * value isn't a real time of day.
 */
export function normalizeSlotLabel(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim().toUpperCase();

  const twentyFour = value.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    const h = Number(twentyFour[1]);
    const m = Number(twentyFour[2]);
    return h <= 23 && m <= 59 ? formatSlotLabel(h, m) : null;
  }

  const twelve = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (twelve) {
    let h = Number(twelve[1]);
    const m = Number(twelve[2]);
    if (h < 1 || h > 12 || m > 59) return null;
    if (twelve[3] === 'PM' && h !== 12) h += 12;
    if (twelve[3] === 'AM' && h === 12) h = 0;
    return formatSlotLabel(h, m);
  }

  return null;
}

/** The slots that exist for this doctor on this date: defaults, minus removed, plus added — time-ordered. */
export function getEffectiveSlots(doctorId: string | undefined, date: string): string[] {
  const defaults = getTimeSlotsForDate(date);
  if (!doctorId) return defaults;

  const k = key(doctorId, date);
  const removed = REMOVED_SLOTS.get(k);
  const added = ADDED_SLOTS.get(k);
  if (!removed && !added) return defaults;

  const merged = new Set<string>(defaults.filter((s) => !removed?.has(s)));
  added?.forEach((s) => merged.add(s));
  return Array.from(merged).sort((a, b) => minutesOf(a) - minutesOf(b));
}

/** Default-schedule slots an admin has deleted for this date (offered back as "restore"). */
export function getRemovedDefaultSlots(doctorId: string, date: string): string[] {
  const removed = REMOVED_SLOTS.get(key(doctorId, date));
  if (!removed) return [];
  const defaults = new Set(getTimeSlotsForDate(date));
  return Array.from(removed).filter((s) => defaults.has(s)).sort((a, b) => minutesOf(a) - minutesOf(b));
}

/** True when this slot was added by an admin rather than coming from the default weekly hours. */
export function isCustomSlot(doctorId: string, date: string, timeSlot: string): boolean {
  return ADDED_SLOTS.get(key(doctorId, date))?.has(timeSlot) ?? false;
}

/** True when the day has at least one slot that isn't blocked — i.e. a patient could actually book it. */
export function dayHasOpenSlots(doctorId: string | undefined, date: string): boolean {
  const slots = getEffectiveSlots(doctorId, date);
  if (!doctorId) return slots.length > 0;
  const blocked = getBlockedSlots(doctorId, date);
  return slots.some((s) => !blocked.has(s));
}

export async function loadSlotChanges(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/doctor_slot_changes?select=doctor_id,date,time_slot,kind`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);

    const rows: { doctor_id: string; date: string; time_slot: string; kind: SlotChangeKind }[] = await res.json();
    const added = new Map<string, Set<string>>();
    const removed = new Map<string, Set<string>>();
    for (const row of rows) {
      const target = row.kind === 'added' ? added : removed;
      const k = key(row.doctor_id, row.date);
      if (!target.has(k)) target.set(k, new Set());
      target.get(k)!.add(row.time_slot);
    }
    ADDED_SLOTS = added;
    REMOVED_SLOTS = removed;
    console.log(`Loaded ${rows.length} custom slot change(s) from Supabase.`);
  } catch (error: any) {
    console.error('Supabase loadSlotChanges failed (using the default weekly hours only):', error?.message || error);
  }
}

async function persistSlotChange(doctorId: string, date: string, timeSlot: string, kind: SlotChangeKind | null): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { success: true };

  try {
    const base = `${SUPABASE_URL}/rest/v1/doctor_slot_changes`;
    if (kind === null) {
      const res = await fetch(
        `${base}?doctor_id=eq.${encodeURIComponent(doctorId)}&date=eq.${encodeURIComponent(date)}&time_slot=eq.${encodeURIComponent(timeSlot)}`,
        { method: 'DELETE', headers: supabaseHeaders({ Prefer: 'return=minimal' }) }
      );
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    } else {
      const res = await fetch(`${base}?on_conflict=doctor_id,date,time_slot`, {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify({ doctor_id: doctorId, date, time_slot: timeSlot, kind })
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    }
    return { success: true };
  } catch (error: any) {
    console.error('Supabase persistSlotChange failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

const setOf = (map: Map<string, Set<string>>, k: string) => {
  if (!map.has(k)) map.set(k, new Set());
  return map.get(k)!;
};

/** Adds a slot to a day. Re-adding a deleted default slot simply restores it. */
export async function addSlot(doctorId: string, date: string, timeSlot: string): Promise<{ success: boolean; error?: string; code?: 'exists' }> {
  if (getEffectiveSlots(doctorId, date).includes(timeSlot)) {
    return { success: false, code: 'exists', error: `${timeSlot} is already on this day's schedule.` };
  }

  const k = key(doctorId, date);
  const isDefault = getTimeSlotsForDate(date).includes(timeSlot);

  if (isDefault) {
    // It was deleted earlier — restoring means dropping the 'removed' marker.
    REMOVED_SLOTS.get(k)?.delete(timeSlot);
    return persistSlotChange(doctorId, date, timeSlot, null);
  }

  setOf(ADDED_SLOTS, k).add(timeSlot);
  return persistSlotChange(doctorId, date, timeSlot, 'added');
}

/** Deletes a slot from a day. Also clears any block on it so nothing stale is left behind. */
export async function removeSlot(doctorId: string, date: string, timeSlot: string): Promise<{ success: boolean; error?: string; code?: 'missing' }> {
  if (!getEffectiveSlots(doctorId, date).includes(timeSlot)) {
    return { success: false, code: 'missing', error: `${timeSlot} isn't on this day's schedule.` };
  }

  const k = key(doctorId, date);
  if (isCustomSlot(doctorId, date, timeSlot)) {
    ADDED_SLOTS.get(k)?.delete(timeSlot);
    await setSlotBlocked(doctorId, date, timeSlot, false);
    return persistSlotChange(doctorId, date, timeSlot, null);
  }

  setOf(REMOVED_SLOTS, k).add(timeSlot);
  await setSlotBlocked(doctorId, date, timeSlot, false);
  return persistSlotChange(doctorId, date, timeSlot, 'removed');
}

/** Moves a slot to a new time on the same day (remove + add, preserving nothing else). */
export async function editSlot(doctorId: string, date: string, oldSlot: string, newSlot: string): Promise<{ success: boolean; error?: string; code?: 'exists' | 'missing' }> {
  if (oldSlot === newSlot) return { success: true };
  if (getEffectiveSlots(doctorId, date).includes(newSlot)) {
    return { success: false, code: 'exists', error: `${newSlot} is already on this day's schedule.` };
  }

  const removed = await removeSlot(doctorId, date, oldSlot);
  if (!removed.success) return removed;
  return addSlot(doctorId, date, newSlot);
}

/** Bulk day toggle — blocks/unblocks every slot in `timeSlots` for one (doctor, date) in a single round trip. */
export async function setDayBlocked(doctorId: string, date: string, timeSlots: string[], blocked: boolean): Promise<{ success: boolean; mock: boolean; error?: string }> {
  const k = key(doctorId, date);
  if (blocked) {
    BLOCKED_SLOTS.set(k, new Set(timeSlots));
  } else {
    BLOCKED_SLOTS.delete(k);
  }

  if (!isSupabaseConfigured()) {
    return { success: true, mock: true };
  }

  try {
    if (blocked) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/doctor_schedule_overrides`, {
        method: 'POST',
        headers: supabaseHeaders({ Prefer: 'return=minimal,resolution=merge-duplicates' }),
        body: JSON.stringify(timeSlots.map((timeSlot) => ({ doctor_id: doctorId, date, time_slot: timeSlot })))
      });
      if (!res.ok) throw new Error(`Supabase bulk schedule override insert failed: ${res.status} ${await res.text()}`);
    } else {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/doctor_schedule_overrides?doctor_id=eq.${encodeURIComponent(doctorId)}&date=eq.${encodeURIComponent(date)}`,
        { method: 'DELETE', headers: supabaseHeaders({ Prefer: 'return=minimal' }) }
      );
      if (!res.ok) throw new Error(`Supabase bulk schedule override delete failed: ${res.status} ${await res.text()}`);
    }
    return { success: true, mock: false };
  } catch (error: any) {
    console.error('Supabase setDayBlocked failed:', error?.message || error);
    return { success: false, mock: false, error: error?.message || 'Unknown Supabase error' };
  }
}
