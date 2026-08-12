/**
 * Full treatment catalog — doctor-editable via /doctor-admin. Supersedes
 * the old service_pricing-only editing (see server/services/pricing.ts,
 * left in place and still used internally to keep the WhatsApp bot's cost
 * estimate in sync — see syncPriceDisplay() below) with full CRUD over
 * every field: title, description, image, duration, price range,
 * benefits, procedures.
 *
 * Same pattern as blog.ts: Supabase-backed via raw PostgREST fetch calls,
 * with an in-memory fallback seeded from the existing static catalog in
 * src/data/clinicData.ts, so local dev and the live site keep working
 * identically before Supabase is configured. The very first read after
 * Supabase is configured seeds the `services` table from that same static
 * catalog if it's found empty, so turning persistence on doesn't blank
 * the site.
 */

import { SERVICES as STATIC_SERVICES } from '../../src/data/clinicData';
import { DentalService } from '../../src/types';
import { setServicePriceDisplay } from './pricing';

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

export type ServiceInput = Omit<DentalService, 'id'>;

function rowToService(row: any): DentalService {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    shortDescription: row.short_description,
    fullDescription: row.full_description,
    image: row.image,
    durationMinutes: row.duration_minutes,
    priceRange: row.price_range,
    benefits: row.benefits ?? [],
    procedures: row.procedures ?? [],
    iconName: row.icon_name
  };
}

function serviceToRow(id: string, input: ServiceInput) {
  return {
    id,
    title: input.title,
    category: input.category,
    short_description: input.shortDescription,
    full_description: input.fullDescription,
    image: input.image,
    duration_minutes: input.durationMinutes,
    price_range: input.priceRange,
    benefits: input.benefits,
    procedures: input.procedures,
    icon_name: input.iconName,
    updated_at: new Date().toISOString()
  };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'service';
}

// In-memory fallback — starts as an editable copy of the static catalog so
// local dev without Supabase credentials still shows/edits real content.
let mockServices: DentalService[] = STATIC_SERVICES.map((s) => ({ ...s }));

let seedAttempted = false;
async function ensureSeeded(): Promise<void> {
  if (seedAttempted || !isSupabaseConfigured()) return;
  seedAttempted = true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/services?select=id&limit=1`, { headers: supabaseHeaders() });
    if (!res.ok) return;
    const rows: any[] = await res.json();
    if (rows.length > 0) return;
    await fetch(`${SUPABASE_URL}/rest/v1/services`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(STATIC_SERVICES.map((s) => serviceToRow(s.id, s)))
    });
  } catch (error: any) {
    console.error('Supabase services seed failed (site still works from the static catalog):', error?.message || error);
  }
}

export async function listServices(): Promise<DentalService[]> {
  if (!isSupabaseConfigured()) return mockServices;

  await ensureSeeded();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/services?select=*&order=created_at.asc`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase services read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows.map(rowToService);
  } catch (error: any) {
    console.error('Supabase listServices failed (falling back to static catalog):', error?.message || error);
    return mockServices;
  }
}

export async function getServiceById(id: string): Promise<DentalService | null> {
  const all = await listServices();
  return all.find((s) => s.id === id) ?? null;
}

export interface ServiceWriteResult {
  success: boolean;
  service?: DentalService;
  error?: string;
}

export async function createService(input: ServiceInput): Promise<ServiceWriteResult> {
  const existing = await listServices();
  let id = slugify(input.title);
  if (existing.some((s) => s.id === id)) {
    let n = 2;
    while (existing.some((s) => s.id === `${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }
  const service: DentalService = { id, ...input };

  if (!isSupabaseConfigured()) {
    mockServices.push(service);
    return { success: true, service };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/services`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(serviceToRow(id, input))
    });
    if (!res.ok) throw new Error(`Supabase service insert failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    await syncPriceDisplay(id, input.title, input.priceRange);
    return { success: true, service: rowToService(rows[0]) };
  } catch (error: any) {
    console.error('Supabase createService failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function updateService(id: string, input: ServiceInput): Promise<ServiceWriteResult> {
  if (!isSupabaseConfigured()) {
    const idx = mockServices.findIndex((s) => s.id === id);
    if (idx === -1) return { success: false, error: 'Service not found.' };
    mockServices[idx] = { id, ...input };
    return { success: true, service: mockServices[idx] };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/services?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(serviceToRow(id, input))
    });
    if (!res.ok) throw new Error(`Supabase service update failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    if (rows.length === 0) return { success: false, error: 'Service not found.' };
    await syncPriceDisplay(id, input.title, input.priceRange);
    return { success: true, service: rowToService(rows[0]) };
  } catch (error: any) {
    console.error('Supabase updateService failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function deleteService(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    const idx = mockServices.findIndex((s) => s.id === id);
    if (idx === -1) return { success: false, error: 'Service not found.' };
    mockServices.splice(idx, 1);
    return { success: true };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/services?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' })
    });
    if (!res.ok) throw new Error(`Supabase service delete failed: ${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Supabase deleteService failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

// Keeps the WhatsApp bot's "estimated treatment cost" line (which reads
// from the separate service_pricing table via pricing.ts) in sync whenever
// a service's price range is edited here, so there's a single place the
// doctor edits price from, even though two tables exist under the hood.
async function syncPriceDisplay(id: string, title: string, priceRange: string): Promise<void> {
  await setServicePriceDisplay(id, title, priceRange);
}
