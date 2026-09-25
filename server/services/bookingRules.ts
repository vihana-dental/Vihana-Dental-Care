/**
 * Clinic-wide booking rules the admin can switch, kept as a tiny in-memory
 * mirror (read synchronously by the availability check on every request) and
 * persisted through the settings store so they survive a restart.
 *
 * allowMultiplePerSlot — off (default): a time slot takes one appointment, and
 * once it's booked it shows as unavailable everywhere. On: any number of
 * patients can book the same slot (e.g. a doctor who sees patients in
 * parallel, or walk-in style sessions). Doctor day-off / slot-off switches,
 * deleted slots and already-passed times still apply either way.
 */

export interface BookingRules {
  allowMultiplePerSlot: boolean;
}

export const DEFAULT_BOOKING_RULES: BookingRules = { allowMultiplePerSlot: false };

let rules: BookingRules = { ...DEFAULT_BOOKING_RULES };

export const BOOKING_RULES_SETTING_KEY = 'booking_rules';

export function normalizeBookingRules(raw: Partial<BookingRules> | null | undefined): BookingRules {
  return { allowMultiplePerSlot: Boolean(raw?.allowMultiplePerSlot) };
}

export function getBookingRules(): BookingRules {
  return { ...rules };
}

export function setBookingRules(next: Partial<BookingRules>): BookingRules {
  rules = normalizeBookingRules({ ...rules, ...next });
  return getBookingRules();
}

export function allowsMultiplePerSlot(): boolean {
  return rules.allowMultiplePerSlot;
}
