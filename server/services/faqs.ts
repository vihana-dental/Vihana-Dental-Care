/**
 * Doctor-editable FAQ entries — shown on the Services page's "Common
 * Patient Questions" section and mirrored into that page's FAQPage
 * JSON-LD structured data (see src/components/ServicesView.tsx, which
 * injects the JSON-LD client-side from this same live data instead of the
 * static block that used to live in index.html, so the two can never
 * drift apart again).
 *
 * Same Supabase-backed-with-in-memory-fallback pattern as blog.ts /
 * services.ts. Seeded once from the site's original hardcoded FAQ copy.
 */

import { FAQ } from '../../src/types';

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

export type FAQInput = Omit<FAQ, 'id'>;

function rowToFAQ(row: any): FAQ {
  return { id: row.id, question: row.question, answer: row.answer, order: row.display_order };
}

function faqToRow(input: FAQInput) {
  return { question: input.question, answer: input.answer, display_order: input.order, updated_at: new Date().toISOString() };
}

// The site's original hardcoded FAQ copy — used as both the in-memory
// fallback and the one-time Supabase seed.
const STATIC_FAQS: FAQInput[] = [
  {
    order: 1,
    question: 'Do you offer painless root canals in Kalapatti?',
    answer: 'Yes, Vihana Dental Care provides 100% painless root canals in Kalapatti using computer-controlled local anesthesia and advanced microscopic laser technology to ensure complete patient comfort.'
  },
  {
    order: 2,
    question: 'What is the cost of dental implants in Coimbatore?',
    answer: 'The cost of computer-guided dental implants at Vihana Dental Care ranges from ₹22,000 to ₹45,000 per implant, utilizing premium titanium posts for lifetime durability.'
  },
  {
    order: 3,
    question: 'How long does an Invisalign treatment take?',
    answer: 'Invisalign clear aligner treatments typically take between 6 to 18 months depending on case complexity. We use 3D iTero scanners to provide exact timelines during your first consultation.'
  },
  {
    order: 4,
    question: 'Is teeth whitening safe for enamel?',
    answer: 'Absolutely. Our advanced laser teeth whitening procedure is completely safe for enamel. It removes deep stains without causing structural damage or long-term sensitivity.'
  },
  {
    order: 5,
    question: 'Why do I need X-rays?',
    answer: "Digital X-rays let us see what a visual exam alone can't — cavities forming between teeth, bone loss around the roots, or early-stage infections. Catching these early usually means simpler, less invasive treatment than waiting until they cause pain."
  }
];

let mockFAQs: FAQ[] = STATIC_FAQS.map((f, i) => ({ id: `static-faq-${i + 1}`, ...f }));

let seedAttempted = false;
async function ensureSeeded(): Promise<void> {
  if (seedAttempted || !isSupabaseConfigured()) return;
  seedAttempted = true;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/faqs?select=id&limit=1`, { headers: supabaseHeaders() });
    if (!res.ok) return;
    const rows: any[] = await res.json();
    if (rows.length > 0) return;
    await fetch(`${SUPABASE_URL}/rest/v1/faqs`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(STATIC_FAQS.map(faqToRow))
    });
  } catch (error: any) {
    console.error('Supabase faqs seed failed (site still works from the static FAQ copy):', error?.message || error);
  }
}

export async function listFAQs(): Promise<FAQ[]> {
  if (!isSupabaseConfigured()) return [...mockFAQs].sort((a, b) => a.order - b.order);

  await ensureSeeded();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/faqs?select=*&order=display_order.asc`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase faqs read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows.map(rowToFAQ);
  } catch (error: any) {
    console.error('Supabase listFAQs failed (falling back to static FAQ copy):', error?.message || error);
    return [...mockFAQs].sort((a, b) => a.order - b.order);
  }
}

export interface FAQWriteResult {
  success: boolean;
  faq?: FAQ;
  error?: string;
}

export async function createFAQ(input: FAQInput): Promise<FAQWriteResult> {
  if (!isSupabaseConfigured()) {
    const faq: FAQ = { id: `faq-${Date.now()}`, ...input };
    mockFAQs.push(faq);
    return { success: true, faq };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/faqs`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(faqToRow(input))
    });
    if (!res.ok) throw new Error(`Supabase FAQ insert failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return { success: true, faq: rowToFAQ(rows[0]) };
  } catch (error: any) {
    console.error('Supabase createFAQ failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function updateFAQ(id: string, input: FAQInput): Promise<FAQWriteResult> {
  if (!isSupabaseConfigured()) {
    const idx = mockFAQs.findIndex((f) => f.id === id);
    if (idx === -1) return { success: false, error: 'FAQ not found.' };
    mockFAQs[idx] = { id, ...input };
    return { success: true, faq: mockFAQs[idx] };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/faqs?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(faqToRow(input))
    });
    if (!res.ok) throw new Error(`Supabase FAQ update failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    if (rows.length === 0) return { success: false, error: 'FAQ not found.' };
    return { success: true, faq: rowToFAQ(rows[0]) };
  } catch (error: any) {
    console.error('Supabase updateFAQ failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function deleteFAQ(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    const idx = mockFAQs.findIndex((f) => f.id === id);
    if (idx === -1) return { success: false, error: 'FAQ not found.' };
    mockFAQs.splice(idx, 1);
    return { success: true };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/faqs?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' })
    });
    if (!res.ok) throw new Error(`Supabase FAQ delete failed: ${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Supabase deleteFAQ failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}
