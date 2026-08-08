/**
 * Supabase (Postgres) patient CRM layer — additive alongside the existing
 * booking system. Talks to Supabase's auto-generated PostgREST API directly
 * over fetch (no @supabase/supabase-js dependency needed for this handful of
 * calls), using the service_role key so requests bypass Row Level Security —
 * this file must only ever run server-side.
 *
 * Falls back to a clearly-flagged mock (logs the intended write, returns
 * success: false, never throws) whenever SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * aren't configured, so the rest of the booking flow keeps working before
 * credentials exist.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function isSupabaseConfigured(): boolean {
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

export interface UpsertPatientParams {
  name: string;
  phone: string;
  email?: string;
  sourceChannel: 'whatsapp' | 'chatbot' | 'website_cta';
}

export interface UpsertPatientResult {
  success: boolean;
  mock: boolean;
  patientId?: string;
  created: boolean;
  error?: string;
}

/**
 * Finds an existing patient by phone OR email; updates their name/email if
 * found, otherwise inserts a new row. Never throws — a Supabase outage must
 * never take down the booking flow that triggered it, so every failure is
 * caught, logged, and returned as a typed result instead.
 */
export async function upsertPatient(params: UpsertPatientParams): Promise<UpsertPatientResult> {
  const { name, phone, email, sourceChannel } = params;

  if (!isSupabaseConfigured()) {
    console.log('[supabase mock] Would upsert patient:', { name, phone, email, sourceChannel });
    return { success: false, mock: true, created: false };
  }

  try {
    // 1. Look up by phone OR email (email may be absent — PostgREST's `or`
    // filter syntax needs every clause present, so only include email.eq
    // when we actually have one).
    const orClauses = [`phone.eq.${encodeURIComponent(phone)}`];
    if (email) orClauses.push(`email.eq.${encodeURIComponent(email)}`);

    const lookupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/patients?or=(${orClauses.join(',')})&select=id&limit=1`,
      { headers: supabaseHeaders() }
    );

    if (!lookupRes.ok) {
      throw new Error(`Supabase lookup failed: ${lookupRes.status} ${await lookupRes.text()}`);
    }

    const existing: any[] = await lookupRes.json();

    if (existing.length > 0) {
      // 2a. Found — update name/email in case they've changed, bump updated_at.
      const patientId = existing[0].id;
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/patients?id=eq.${patientId}`, {
        method: 'PATCH',
        headers: supabaseHeaders({ Prefer: 'return=minimal' }),
        body: JSON.stringify({ name, email, updated_at: new Date().toISOString() })
      });

      if (!patchRes.ok) {
        throw new Error(`Supabase patient update failed: ${patchRes.status} ${await patchRes.text()}`);
      }

      return { success: true, mock: false, patientId, created: false };
    }

    // 2b. Not found — insert a new patient record.
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/patients`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({ name, phone, email, source_channel: sourceChannel })
    });

    if (!insertRes.ok) {
      throw new Error(`Supabase patient insert failed: ${insertRes.status} ${await insertRes.text()}`);
    }

    const inserted: any[] = await insertRes.json();
    return { success: true, mock: false, patientId: inserted[0]?.id, created: true };
  } catch (error: any) {
    console.error('Supabase upsertPatient failed (booking still proceeds):', error?.message || error);
    return { success: false, mock: false, created: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export interface ServicePriceRow {
  serviceId: string;
  serviceName: string;
  /** Free-text display range, e.g. "₹22,000 - ₹45,000 per implant" — display only, never a charge amount. */
  priceRangeDisplay: string;
}

/** Reads the full admin-editable price list. Returns [] (never throws) when unconfigured or on error. */
export async function getAllServicePrices(): Promise<ServicePriceRow[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/service_pricing?select=service_id,service_name,price_range_display`, {
      headers: supabaseHeaders()
    });
    if (!res.ok) throw new Error(`Supabase service_pricing read failed: ${res.status} ${await res.text()}`);

    const rows: any[] = await res.json();
    return rows.map((r) => ({ serviceId: r.service_id, serviceName: r.service_name, priceRangeDisplay: r.price_range_display }));
  } catch (error: any) {
    console.error('Supabase getAllServicePrices failed (falling back to static pricing):', error?.message || error);
    return [];
  }
}

/** Admin write path — upserts a single service's display price range (used by the pricing config endpoint). */
export async function upsertServicePrice(serviceId: string, serviceName: string, priceRangeDisplay: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    console.log('[supabase mock] Would upsert service_pricing:', { serviceId, serviceName, priceRangeDisplay });
    return { success: false };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/service_pricing?on_conflict=service_id`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify({ service_id: serviceId, service_name: serviceName, price_range_display: priceRangeDisplay, updated_at: new Date().toISOString() })
    });
    if (!res.ok) throw new Error(`Supabase service_pricing upsert failed: ${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Supabase upsertServicePrice failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}
