/**
 * Photo Gallery — doctor-editable via /doctor-admin. Same pattern as
 * blog.ts / services.ts / team.ts.
 */

import { GALLERY_ITEMS as STATIC_GALLERY } from '../../src/data/clinicData';
import { GalleryItem } from '../../src/types';

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

export type GalleryItemInput = Omit<GalleryItem, 'id'>;

function rowToItem(row: any): GalleryItem {
  return { id: row.id, title: row.title, category: row.category, imageUrl: row.image_url, caption: row.caption };
}

function itemToRow(id: string, input: GalleryItemInput) {
  return {
    id,
    title: input.title,
    category: input.category,
    image_url: input.imageUrl,
    caption: input.caption,
    updated_at: new Date().toISOString()
  };
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'gallery-item';
}

let mockGallery: GalleryItem[] = STATIC_GALLERY.map((g) => ({ ...g }));
// Only latches permanently true once seeding is CONFIRMED unnecessary or
// complete — a transient failure (e.g. the table not existing yet) resets
// it back to false so the next call retries, instead of the process
// concluding once and for all that seeding is done when it never actually
// happened. Table-not-created-yet is exactly the failure mode that hit
// this in production: the first request 404'd before the schema was ever
// applied, latched true, and no gallery data ever got seeded afterward
// even once the table existed — only a process restart cleared it.
let seedAttempted = false;

async function ensureSeeded(): Promise<void> {
  if (seedAttempted || !isSupabaseConfigured()) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gallery_items?select=id&limit=1`, { headers: supabaseHeaders() });
    if (!res.ok) return;
    const rows: any[] = await res.json();
    if (rows.length > 0) { seedAttempted = true; return; }
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/gallery_items`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(STATIC_GALLERY.map((g) => itemToRow(g.id, g)))
    });
    if (insertRes.ok) seedAttempted = true;
  } catch (error: any) {
    console.error('Supabase gallery_items seed failed (will retry on next request):', error?.message || error);
  }
}

export async function listGalleryItems(): Promise<GalleryItem[]> {
  if (!isSupabaseConfigured()) return mockGallery;
  await ensureSeeded();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gallery_items?select=*&order=created_at.asc`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase gallery_items read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows.map(rowToItem);
  } catch (error: any) {
    console.error('Supabase listGalleryItems failed (falling back to static catalog):', error?.message || error);
    return mockGallery;
  }
}

export interface GalleryWriteResult {
  success: boolean;
  item?: GalleryItem;
  error?: string;
}

export async function createGalleryItem(input: GalleryItemInput): Promise<GalleryWriteResult> {
  const existing = await listGalleryItems();
  let id = slugify(input.title);
  if (existing.some((g) => g.id === id)) {
    let n = 2;
    while (existing.some((g) => g.id === `${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }
  const item: GalleryItem = { id, ...input };

  if (!isSupabaseConfigured()) {
    mockGallery.push(item);
    return { success: true, item };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gallery_items`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(itemToRow(id, input))
    });
    if (!res.ok) throw new Error(`Supabase gallery item insert failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return { success: true, item: rowToItem(rows[0]) };
  } catch (error: any) {
    console.error('Supabase createGalleryItem failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function updateGalleryItem(id: string, input: GalleryItemInput): Promise<GalleryWriteResult> {
  if (!isSupabaseConfigured()) {
    const idx = mockGallery.findIndex((g) => g.id === id);
    if (idx === -1) return { success: false, error: 'Gallery item not found.' };
    mockGallery[idx] = { id, ...input };
    return { success: true, item: mockGallery[idx] };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gallery_items?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(itemToRow(id, input))
    });
    if (!res.ok) throw new Error(`Supabase gallery item update failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    if (rows.length === 0) return { success: false, error: 'Gallery item not found.' };
    return { success: true, item: rowToItem(rows[0]) };
  } catch (error: any) {
    console.error('Supabase updateGalleryItem failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function deleteGalleryItem(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    const idx = mockGallery.findIndex((g) => g.id === id);
    if (idx === -1) return { success: false, error: 'Gallery item not found.' };
    mockGallery.splice(idx, 1);
    return { success: true };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gallery_items?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' })
    });
    if (!res.ok) throw new Error(`Supabase gallery item delete failed: ${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Supabase deleteGalleryItem failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}
