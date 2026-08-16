/**
 * Clinic-timezone arithmetic.
 *
 * Every booking time in this system is a *wall-clock time at the clinic in
 * Coimbatore* — "5:00 PM" means 5pm IST no matter where the code runs. The
 * booking logic used to express that with `new Date('2026-08-15T00:00:00')`
 * plus `setHours(...)`, which resolves against the **server's** timezone.
 * That is correct only by luck on an IST machine, and wrong everywhere else.
 *
 * In production the server runs on UTC, so the two consequences were:
 *
 *  - The "has this slot passed?" cutoff sat 5h30m behind clinic time, which
 *    left the whole evening bookable at 9pm.
 *  - A 5:00 PM booking was written to Google Calendar as 17:00 UTC — 10:30 PM
 *    IST. Appointments landed in the doctor's calendar five and a half hours
 *    late, and the freebusy window used to detect double-bookings was shifted
 *    by the same amount.
 *
 * These helpers do the conversion explicitly against a named zone, so the
 * result no longer depends on where the process happens to be running.
 * No dependency needed — Intl already carries the zone database.
 */

/**
 * The clinic's wall-clock zone. Matches the GOOGLE_CALENDAR_TIMEZONE default
 * in server/services/googleCalendar.ts; this constant is the client-safe
 * counterpart, since the browser can't read that env var.
 */
export const CLINIC_TIMEZONE = 'Asia/Kolkata';

/** Offset (ms) to add to a UTC instant to get the zone's wall-clock reading. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(utcMs));

  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  // Intl can render midnight as hour 24 in some engines; normalise it.
  const hour = at('hour') === 24 ? 0 : at('hour');

  const wallAsUtc = Date.UTC(at('year'), at('month') - 1, at('day'), hour, at('minute'), at('second'));
  return wallAsUtc - utcMs;
}

/**
 * Converts a wall-clock time in the clinic's zone to a real UTC instant.
 *
 * Works by guessing that the wall time *is* UTC, measuring how far off that
 * guess reads in the target zone, then correcting. The second pass matters
 * only where a zone has DST and the correction crosses a transition — India
 * has none, but getting it right costs one comparison and keeps the helper
 * honest if it's ever reused.
 */
export function clinicWallTimeToUtc(dateISO: string, hours: number, minutes: number): Date {
  const [year, month, day] = dateISO.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);

  const firstOffset = zoneOffsetMs(guess, CLINIC_TIMEZONE);
  let instant = guess - firstOffset;

  const secondOffset = zoneOffsetMs(instant, CLINIC_TIMEZONE);
  if (secondOffset !== firstOffset) instant = guess - secondOffset;

  return new Date(instant);
}

/** Today's date and time as the clinic experiences them, regardless of server zone. */
export function getClinicNow(): { dateISO: string; minutesSinceMidnight: number } {
  const now = new Date();
  // en-CA formats as YYYY-MM-DD, which is also directly comparable as a string.
  const dateISO = now.toLocaleDateString('en-CA', { timeZone: CLINIC_TIMEZONE });
  const [hours, minutes] = now
    .toLocaleTimeString('en-GB', { timeZone: CLINIC_TIMEZONE, hour12: false, hour: '2-digit', minute: '2-digit' })
    .split(':')
    .map(Number);

  return { dateISO, minutesSinceMidnight: hours * 60 + minutes };
}

/** Parses a "10:30 AM" slot label into 24-hour components. */
export function parseSlotLabel(timeSlot: string): { hours: number; minutes: number } {
  const [time, meridiem] = timeSlot.trim().split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}
