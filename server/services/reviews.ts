/**
 * Curated testimonials — doctor-editable via /doctor-admin. Shown
 * immediately in TestimonialsView while the live Google Places fetch
 * (/api/google-reviews) loads, and kept as the fallback if that fetch
 * fails. Distinct from reviewOverrideConfig in server.ts, which controls
 * the live rating/review-count display, not this curated list. Same
 * pattern as blog.ts / services.ts / team.ts / gallery.ts.
 */

import { REVIEWS as STATIC_REVIEWS } from '../../src/data/clinicData';
import { Review } from '../../src/types';

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

export type ReviewInput = Omit<Review, 'id'>;

function rowToReview(row: any): Review {
  return {
    id: row.id,
    authorName: row.author_name,
    authorPhoto: row.author_photo ?? undefined,
    rating: row.rating,
    relativeTimeDescription: row.relative_time_description,
    text: row.review_text,
    date: row.review_date,
    verifiedGoogle: row.verified_google,
    clinicReply: row.clinic_reply ?? undefined
  };
}

function reviewToRow(input: ReviewInput) {
  return {
    author_name: input.authorName,
    author_photo: input.authorPhoto ?? null,
    rating: input.rating,
    relative_time_description: input.relativeTimeDescription,
    review_text: input.text,
    review_date: input.date,
    verified_google: input.verifiedGoogle,
    clinic_reply: input.clinicReply ?? null,
    updated_at: new Date().toISOString()
  };
}

let mockReviews: Review[] = STATIC_REVIEWS.map((r) => ({ ...r }));
let seedAttempted = false;

async function ensureSeeded(): Promise<void> {
  if (seedAttempted || !isSupabaseConfigured()) return;
  seedAttempted = true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews?select=id&limit=1`, { headers: supabaseHeaders() });
    if (!res.ok) return;
    const rows: any[] = await res.json();
    if (rows.length > 0) return;
    await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(STATIC_REVIEWS.map(reviewToRow))
    });
  } catch (error: any) {
    console.error('Supabase reviews seed failed:', error?.message || error);
  }
}

export async function listCuratedReviews(): Promise<Review[]> {
  if (!isSupabaseConfigured()) return mockReviews;
  await ensureSeeded();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews?select=*&order=created_at.desc`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase reviews read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows.map(rowToReview);
  } catch (error: any) {
    console.error('Supabase listCuratedReviews failed (falling back to static catalog):', error?.message || error);
    return mockReviews;
  }
}

export interface ReviewWriteResult {
  success: boolean;
  review?: Review;
  error?: string;
}

export async function createCuratedReview(input: ReviewInput): Promise<ReviewWriteResult> {
  if (!isSupabaseConfigured()) {
    const review: Review = { id: `review-${Date.now()}`, ...input };
    mockReviews.unshift(review);
    return { success: true, review };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(reviewToRow(input))
    });
    if (!res.ok) throw new Error(`Supabase review insert failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return { success: true, review: rowToReview(rows[0]) };
  } catch (error: any) {
    console.error('Supabase createCuratedReview failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function updateCuratedReview(id: string, input: ReviewInput): Promise<ReviewWriteResult> {
  if (!isSupabaseConfigured()) {
    const idx = mockReviews.findIndex((r) => r.id === id);
    if (idx === -1) return { success: false, error: 'Review not found.' };
    mockReviews[idx] = { id, ...input };
    return { success: true, review: mockReviews[idx] };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(reviewToRow(input))
    });
    if (!res.ok) throw new Error(`Supabase review update failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    if (rows.length === 0) return { success: false, error: 'Review not found.' };
    return { success: true, review: rowToReview(rows[0]) };
  } catch (error: any) {
    console.error('Supabase updateCuratedReview failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function deleteCuratedReview(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    const idx = mockReviews.findIndex((r) => r.id === id);
    if (idx === -1) return { success: false, error: 'Review not found.' };
    mockReviews.splice(idx, 1);
    return { success: true };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' })
    });
    if (!res.ok) throw new Error(`Supabase review delete failed: ${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Supabase deleteCuratedReview failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}
