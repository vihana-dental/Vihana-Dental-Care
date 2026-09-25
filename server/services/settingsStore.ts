/**
 * Small key/value settings store (`clinic_settings`, Supabase-backed).
 *
 * Exists because admin-editable settings that lived only in a server variable
 * (the booking fee config) were silently reset to their defaults on every
 * deploy or restart. Same pattern as the other stores here: the caller keeps
 * an in-memory copy, this only loads it at startup and writes it through on
 * change. Never throws — a Supabase outage must not block an admin edit, it
 * just means the change isn't durable until the next successful save.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

export async function loadSetting<T>(key: string): Promise<T | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clinic_settings?key=eq.${encodeURIComponent(key)}&select=value`, { headers: headers() });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const rows: { value: T }[] = await res.json();
    return rows[0]?.value ?? null;
  } catch (error: any) {
    console.error(`Supabase loadSetting(${key}) failed (using defaults):`, error?.message || error);
    return null;
  }
}

export async function saveSetting(key: string, value: unknown): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured()) return { success: true };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clinic_settings?on_conflict=key`, {
      method: 'POST',
      headers: headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Supabase saveSetting(${key}) failed:`, error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}
