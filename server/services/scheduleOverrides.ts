/**
 * Per-doctor day-off / slot-off tracking. A slot is available by default —
 * a row in `doctor_schedule_overrides` means that (doctor, date, time_slot)
 * is BLOCKED. Kept as an in-memory mirror (same pattern as DOCTORS_LIVE /
 * appointmentsStorage elsewhere) so the many synchronous slot-availability
 * checks throughout the booking flow don't need to become async.
 */

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
