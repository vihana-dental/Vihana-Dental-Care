/**
 * Centralized per-service price DISPLAY — shown on the public website
 * (service cards + detail modal) and in the WhatsApp bot's "estimated
 * treatment cost" line. Editable by the doctor in /doctor-admin, no code
 * changes needed.
 *
 * IMPORTANT — display only, never a charge amount: this is a free-text
 * range ("₹22,000 - ₹45,000 per implant"), not a number, specifically so it
 * physically cannot be handed to Razorpay's createOrder/createPaymentLink as
 * an `amountINR`. The only amount ever actually charged, on every channel
 * and every route, is the flat advance booking fee — clinicFeeConfig in
 * server.ts (its own separate admin card, "Booking Advance Fees"). Do not
 * add a code path that reads getServicePriceDisplay() and feeds it into a
 * payment call; if that ever seems necessary, it means the flat-fee model
 * has changed and clinicFeeConfig should change instead.
 *
 * Supabase's `service_pricing` table (see supabase/schema.sql) is the live,
 * admin-editable source; when Supabase isn't configured, falls back to the
 * static clinicData.ts priceRange strings so local dev and the website keep
 * working before credentials exist.
 */

import { SERVICES } from '../../src/data/clinicData';
import { getAllServicePrices, upsertServicePrice as upsertServicePriceInSupabase, isSupabaseConfigured } from './supabase';

const STATIC_FALLBACK_DISPLAY: Record<string, string> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s.priceRange])
);

// Cache Supabase's price list briefly so a burst of page loads / WhatsApp
// booking requests doesn't each round-trip to Supabase individually.
let cachedPrices: Record<string, string> | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 60 * 1000;

async function loadPrices(): Promise<Record<string, string>> {
  if (cachedPrices && Date.now() < cacheExpiresAt) return cachedPrices;

  if (!isSupabaseConfigured()) {
    cachedPrices = STATIC_FALLBACK_DISPLAY;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return cachedPrices;
  }

  const rows = await getAllServicePrices();
  if (rows.length === 0) {
    // Supabase configured but table empty/unreachable — fail safe to static.
    cachedPrices = STATIC_FALLBACK_DISPLAY;
  } else {
    cachedPrices = Object.fromEntries(rows.map((r) => [r.serviceId, r.priceRangeDisplay]));
  }
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  return cachedPrices;
}

/** Display-only price range for a given service ID, e.g. "₹22,000 - ₹45,000 per implant". */
export async function getServicePriceDisplay(serviceId: string): Promise<string> {
  const prices = await loadPrices();
  return prices[serviceId] ?? STATIC_FALLBACK_DISPLAY[serviceId] ?? '';
}

/** All services' display prices at once — used by the public website endpoint and the admin panel. */
export async function getAllServicePriceDisplays(): Promise<{ serviceId: string; serviceName: string; priceRangeDisplay: string }[]> {
  const prices = await loadPrices();
  return SERVICES.map((s) => ({ serviceId: s.id, serviceName: s.title, priceRangeDisplay: prices[s.id] ?? s.priceRange }));
}

/** Admin write path (used by the pricing config endpoint) — invalidates the cache on success. */
export async function setServicePriceDisplay(serviceId: string, serviceName: string, priceRangeDisplay: string): Promise<{ success: boolean; error?: string }> {
  const result = await upsertServicePriceInSupabase(serviceId, serviceName, priceRangeDisplay);
  if (result.success) cachedPrices = null; // force a fresh read next time
  return result;
}
