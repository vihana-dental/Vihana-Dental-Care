/**
 * Google Calendar + Meet integration, authenticated via OAuth 2.0 as the
 * doctor's real Google identity (not a service account).
 *
 * Why OAuth and not a service account: Google hard-blocks bare service
 * accounts from inviting attendees ("Service accounts cannot invite
 * attendees without Domain-Wide Delegation of Authority") and from creating
 * Meet conferences at all — both confirmed against a live personal Gmail
 * calendar. Domain-wide delegation would fix that, but only exists for paid
 * Google Workspace, not a personal account. OAuth acting as a real user has
 * neither restriction.
 *
 * Credential handover: swapping from the current (dev) Google account to the
 * client's account requires the client to click "Connect Google Calendar" in
 * /doctor-admin once, logging in with their own Google account — that
 * overwrites GOOGLE_CALENDAR_REFRESH_TOKEN and every booking from then on
 * writes to their calendar. GOOGLE_OAUTH_CLIENT_ID/SECRET stay the same
 * (they identify this app, not any particular Google user).
 *
 * Falls back to mock mode (fake IDs, always "available") whenever OAuth
 * credentials / GOOGLE_CALENDAR_ID aren't configured, so local development
 * and the booking UI/UX both work before real credentials exist.
 */

import { OAuth2Client } from 'google-auth-library';
import { Appointment, AvailabilitySlot } from '../../src/types';
import { getTimeSlotsForDate, isSlotInPast } from '../../src/data/clinicData';
import { clinicWallTimeToUtc, parseSlotLabel } from '../../src/lib/clinicTime';
import { isSlotBlockedForDoctor } from './scheduleOverrides';

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
const GOOGLE_CALENDAR_REFRESH_TOKEN = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || '';
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || '';
const GOOGLE_CALENDAR_TIMEZONE = process.env.GOOGLE_CALENDAR_TIMEZONE || 'Asia/Kolkata';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
// Requested in the same consent grant as Calendar (see getGoogleOAuthConsentUrl
// below) so server/services/googleSheets.ts can reuse this exact same OAuth
// client + refresh token — one "Connect Google Calendar" click authorizes
// both, since a service account turned out to be a dead end for Sheets too
// (it lived in a different, now-inaccessible Google Cloud project once the
// client's own account took over — OAuth as the real account sidesteps that
// entirely, same as it did for Calendar's attendee/Meet restriction).
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const APPOINTMENT_DURATION_MINUTES = 30;

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && GOOGLE_CALENDAR_REFRESH_TOKEN && GOOGLE_CALENDAR_ID);
}

export function isGoogleOAuthClientConfigured(): boolean {
  return Boolean(GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && GOOGLE_OAUTH_REDIRECT_URI);
}

function newOAuthClient(): OAuth2Client {
  return new OAuth2Client({
    clientId: GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: GOOGLE_OAUTH_REDIRECT_URI
  });
}

/** The consent screen URL for the one-time "Connect Google Calendar" flow. */
export function getGoogleOAuthConsentUrl(state: string): string {
  return newOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces a fresh refresh_token even if this account has authorized before
    scope: [CALENDAR_SCOPE, SHEETS_SCOPE],
    state
  });
}

/** Exchanges the callback's ?code= for tokens. Returns the refresh_token to persist. */
export async function exchangeGoogleOAuthCode(code: string): Promise<{ refreshToken?: string; error?: string }> {
  try {
    const { tokens } = await newOAuthClient().getToken(code);
    if (!tokens.refresh_token) {
      return { error: 'Google did not return a refresh token. Revoke this app\'s access at https://myaccount.google.com/permissions and try connecting again.' };
    }
    return { refreshToken: tokens.refresh_token };
  } catch (error: any) {
    return { error: error?.message || 'Token exchange failed' };
  }
}

let cachedClient: OAuth2Client | null = null;

function getAuthClient(): OAuth2Client {
  if (cachedClient) return cachedClient;
  cachedClient = newOAuthClient();
  cachedClient.setCredentials({ refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN });
  return cachedClient;
}

/**
 * google-auth-library caches/refreshes the underlying access token itself.
 * getRequestHeaders() resolves to a WHATWG Headers instance (not a plain
 * object), so it has to be flattened before merging with fetch's own headers.
 */
async function authorizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const client = getAuthClient();
  const authHeaders = await client.getRequestHeaders();
  const headers: Record<string, string> = {};
  authHeaders.forEach((value, key) => { headers[key] = value; });
  return fetch(url, { ...options, headers: { ...headers, ...options.headers } });
}

export interface CalendarSyncResult {
  synced: boolean;
  eventId?: string;
  htmlLink?: string;
  meetLink?: string;
  mock: boolean;
  error?: string;
  errorType?: 'auth' | 'rate_limit' | 'network' | 'unknown';
}

function classifyError(status: number | undefined): CalendarSyncResult['errorType'] {
  if (status === 401 || status === 403) return 'auth';
  if (status === 429) return 'rate_limit';
  if (!status) return 'network';
  return 'unknown';
}

function friendlyErrorMessage(errorType: CalendarSyncResult['errorType']): string {
  switch (errorType) {
    case 'auth':
      return "We couldn't reach the clinic's calendar right now (authorization issue). Your slot is held — we'll confirm the calendar sync shortly.";
    case 'rate_limit':
      return "The calendar service is busy right now. Your appointment is booked — calendar sync will retry automatically.";
    case 'network':
      return "We couldn't reach Google Calendar right now. Your appointment is still booked — we'll sync it as soon as the connection is back.";
    default:
      return "Calendar sync hit an unexpected issue, but your appointment is booked. Our team will confirm the calendar entry manually.";
  }
}

function parseSlotToISO(date: string, timeSlot: string): { startISO: string; endISO: string } {
  // timeSlot format: "10:30 AM" — a wall-clock time at the clinic, resolved
  // against the clinic's zone rather than the server's. Building this with
  // setHours() on a UTC host wrote every appointment into Google Calendar
  // 5h30m late (a 5:00 PM booking landed at 10:30 PM IST) and shifted the
  // freebusy comparison below by the same amount.
  const { hours, minutes } = parseSlotLabel(timeSlot);

  const start = clinicWallTimeToUtc(date, hours, minutes);
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MINUTES * 60 * 1000);

  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

// ---------------- FreeBusy / Availability ----------------

export interface BusyInterval {
  startISO: string;
  endISO: string;
}

export interface FreeBusyResult {
  success: boolean;
  busy: BusyInterval[];
  errorType?: CalendarSyncResult['errorType'];
  error?: string;
}

/** Busy intervals for the given calendar day (00:00–23:59 local clinic time). */
export async function getFreeBusyForDate(dateISO: string): Promise<FreeBusyResult> {
  if (!isGoogleCalendarConfigured()) {
    return { success: true, busy: [] };
  }

  // The clinic's own midnight-to-midnight, not the server's — otherwise the
  // queried window slides by the UTC offset and misses the busy intervals at
  // whichever end of the day falls outside it.
  const dayStart = clinicWallTimeToUtc(dateISO, 0, 0);
  const dayEnd = clinicWallTimeToUtc(dateISO, 23, 59);

  try {
    const res = await authorizedFetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        timeZone: GOOGLE_CALENDAR_TIMEZONE,
        items: [{ id: GOOGLE_CALENDAR_ID }]
      })
    });

    if (!res.ok) {
      const errorType = classifyError(res.status);
      return { success: false, busy: [], errorType, error: `FreeBusy API error: ${res.status}` };
    }

    const data: any = await res.json();
    const busyRaw = data.calendars?.[GOOGLE_CALENDAR_ID]?.busy || [];
    const busy: BusyInterval[] = busyRaw.map((b: any) => ({ startISO: b.start, endISO: b.end }));

    return { success: true, busy };
  } catch (error: any) {
    console.error('Google Calendar freeBusy failed:', error);
    return { success: false, busy: [], errorType: 'network', error: error?.message || 'FreeBusy request failed' };
  }
}

function slotOverlapsBusy(dateISO: string, timeSlot: string, busy: BusyInterval[]): boolean {
  const { startISO, endISO } = parseSlotToISO(dateISO, timeSlot);
  const slotStart = new Date(startISO).getTime();
  const slotEnd = new Date(endISO).getTime();

  return busy.some((b) => {
    const busyStart = new Date(b.startISO).getTime();
    const busyEnd = new Date(b.endISO).getTime();
    return slotStart < busyEnd && slotEnd > busyStart;
  });
}

export interface AvailabilityResult {
  success: boolean;
  slots: AvailabilitySlot[];
  dayFullyBooked: boolean;
  /** True when the date is today and every one of its slots has already started. */
  dayLapsed: boolean;
  degraded: boolean;
  message?: string;
}

/** Human-readable explanation for why booking a lapsed slot is refused. */
export const SLOT_LAPSED_MESSAGE =
  'That time has already passed — slots are disabled once their start time is reached. Please pick a later time or another date.';

/**
 * All bookable slots for a date, each flagged available/unavailable against
 * live Calendar data, already-passed time (for today), and — when a
 * doctorId is given — that doctor's own day-off/slot-off overrides.
 * doctorId is optional so callers that haven't collected a doctor yet
 * (or the general clinic-wide view) still get a sensible result; it's
 * threaded through everywhere a doctor is actually known at the call site.
 *
 * Lapsed slots are deliberately *returned as disabled* rather than dropped
 * from the list. Filtering them out made a half-elapsed day look like the
 * clinic simply opened late, and an entirely elapsed day was reported as
 * "Clinic is closed on this day" — which is a different fact, and a wrong
 * one. Callers that only want bookable times still just filter on
 * `available`; callers rendering a picker can now grey the past out and say
 * so. `dayLapsed` distinguishes "today is over" from "closed today".
 */
export async function computeAvailability(dateISO: string, doctorId?: string): Promise<AvailabilityResult> {
  const allSlots = getTimeSlotsForDate(dateISO);

  if (allSlots.length === 0) {
    return { success: true, slots: [], dayFullyBooked: true, dayLapsed: false, degraded: false, message: 'Clinic is closed on this day.' };
  }

  const lapsed = new Map(allSlots.map((time) => [time, isSlotInPast(dateISO, time)]));
  const dayLapsed = allSlots.every((time) => lapsed.get(time));
  const lapsedMessage = dayLapsed
    ? "Today's booking window has closed — every remaining slot has already started. Please choose another date."
    : undefined;

  const freeBusy = await getFreeBusyForDate(dateISO);

  if (!freeBusy.success) {
    // Degrade gracefully: show every slot as tentatively available rather than
    // blocking booking entirely because Calendar was briefly unreachable.
    // Doctor-specific day-off overrides still apply even in degraded mode —
    // those come from our own database, not Calendar, so there's no reason
    // to ignore them just because Calendar itself is unreachable. The lapsed
    // check is likewise local arithmetic, so it stays authoritative here too:
    // a Calendar outage must never re-open a time that has already passed.
    const slots: AvailabilitySlot[] = allSlots.map((time) => {
      if (lapsed.get(time)) return { time, available: false, reason: 'passed' };
      if (isSlotBlockedForDoctor(doctorId, dateISO, time)) return { time, available: false, reason: 'blocked' };
      return { time, available: true };
    });

    return {
      success: true,
      slots,
      dayFullyBooked: slots.every((s) => !s.available),
      dayLapsed,
      degraded: true,
      message: lapsedMessage || 'Live availability is temporarily unavailable — showing standard hours. We will confirm your exact slot manually if needed.'
    };
  }

  const slots: AvailabilitySlot[] = allSlots.map((time) => {
    if (lapsed.get(time)) return { time, available: false, reason: 'passed' };
    if (isSlotBlockedForDoctor(doctorId, dateISO, time)) return { time, available: false, reason: 'blocked' };
    if (slotOverlapsBusy(dateISO, time, freeBusy.busy)) return { time, available: false, reason: 'booked' };
    return { time, available: true };
  });

  return {
    success: true,
    slots,
    dayFullyBooked: slots.every((s) => !s.available),
    dayLapsed,
    degraded: false,
    message: lapsedMessage
  };
}

/** Re-check a single slot immediately before payment/Meet generation. */
export async function isSlotStillAvailable(dateISO: string, timeSlot: string, doctorId?: string): Promise<{ valid: boolean; degraded: boolean; message?: string }> {
  // Checked before anything else, and independently of Calendar: a lapsed
  // slot is refused even when availability is degraded, which is the one
  // case the "fail open on outage" rule must not cover.
  if (isSlotInPast(dateISO, timeSlot)) {
    return { valid: false, degraded: false, message: SLOT_LAPSED_MESSAGE };
  }

  const availability = await computeAvailability(dateISO, doctorId);
  const slot = availability.slots.find((s) => s.time === timeSlot);

  if (!slot) return { valid: false, degraded: availability.degraded, message: 'That time slot is outside clinic hours for this date.' };
  if (availability.degraded) return { valid: true, degraded: true, message: availability.message };

  return { valid: slot.available, degraded: false, message: slot.available ? undefined : 'That slot was just booked by someone else. Please pick another time.' };
}

// ---------------- Event creation / cancellation ----------------

export async function syncAppointmentToCalendar(appointment: Appointment): Promise<CalendarSyncResult> {
  const { startISO, endISO } = parseSlotToISO(appointment.date, appointment.timeSlot);
  const isOnline = appointment.consultationType === 'online-video';

  if (!isGoogleCalendarConfigured()) {
    const eventId = `gcal_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      synced: true,
      eventId,
      htmlLink: `https://calendar.google.com/calendar/event?eid=${eventId}`,
      // No mock Meet link either — online consults never get one at booking
      // time, only after the doctor approves (see approveOnlineConsult).
      meetLink: undefined,
      mock: true
    };
  }

  try {
    const eventBody: any = {
      summary: `${isOnline ? '⏳ PENDING APPROVAL — ' : ''}${appointment.serviceName} — ${appointment.patientName}`,
      description: `Vihana Dental Care appointment.\nDoctor: ${appointment.doctorName}\nPatient: ${appointment.patientName} (${appointment.patientPhone})\nNotes: ${appointment.notes || '—'}${
        isOnline ? '\n\nOnline consult — approve in /doctor-admin to generate the Google Meet link and notify the patient.' : ''
      }`,
      location: isOnline ? undefined : 'Vihana Dental Care, No 77, Post Office Street, Kalapatti, Coimbatore - 641048',
      start: { dateTime: startISO, timeZone: GOOGLE_CALENDAR_TIMEZONE },
      end: { dateTime: endISO, timeZone: GOOGLE_CALENDAR_TIMEZONE },
      attendees: appointment.patientEmail ? [{ email: appointment.patientEmail }] : undefined,
      // Online consults go in as 'tentative' — the doctor may not actually be
      // free at the slot the patient picked. No conferenceData is requested
      // here at all; a Meet link is only ever created once the doctor
      // approves (approveOnlineConsult below), so nothing gets handed to a
      // patient before the doctor has actually agreed to the slot.
      status: isOnline ? 'tentative' : 'confirmed'
    };

    // sendUpdates=all makes Google actually email the patient the invite —
    // the "automated Calendar invite to the patient" from the spec.
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?sendUpdates=all`;

    const res = await authorizedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventBody)
    });

    if (!res.ok) {
      const errorType = classifyError(res.status);
      const bodyText = await res.text();
      console.error(`Google Calendar create event failed (${res.status}):`, bodyText);
      return { synced: false, mock: false, errorType, error: friendlyErrorMessage(errorType) };
    }

    const event: any = await res.json();

    return { synced: true, eventId: event.id, htmlLink: event.htmlLink, meetLink: undefined, mock: false };
  } catch (error: any) {
    console.error('Google Calendar sync failed:', error);
    const errorType: CalendarSyncResult['errorType'] = 'network';
    return { synced: false, mock: false, errorType, error: friendlyErrorMessage(errorType) };
  }
}

export interface ApproveOnlineConsultResult {
  approved: boolean;
  meetLink?: string;
  mock: boolean;
  error?: string;
}

/**
 * Doctor-triggered from /doctor-admin once they've confirmed they're
 * actually free at the booked slot — flips the tentative event to confirmed
 * and, only now, requests a Google Meet conference. This is the one and only
 * place a Meet link ever gets created for an online consult.
 */
export async function approveOnlineConsult(eventId: string | undefined, cleanSummary: string): Promise<ApproveOnlineConsultResult> {
  if (!eventId) return { approved: false, mock: false, error: 'No calendar event to approve.' };

  if (!isGoogleCalendarConfigured() || eventId.startsWith('gcal_mock_')) {
    return { approved: true, meetLink: `https://meet.google.com/mock-${eventId.slice(-10)}`, mock: true };
  }

  try {
    const requestId = `vihana-approve-${eventId}-${Date.now()}`;
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}?sendUpdates=all&conferenceDataVersion=1`;

    const res = await authorizedFetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'confirmed',
        summary: cleanSummary, // drops the "⏳ PENDING APPROVAL —" prefix set at creation
        conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
      })
    });

    if (!res.ok) {
      const bodyText = await res.text();
      console.error(`Google Calendar approve event failed (${res.status}):`, bodyText);
      return { approved: false, mock: false, error: `Calendar API error: ${res.status}` };
    }

    const event: any = await res.json();
    const meetLink = event.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;

    return { approved: true, meetLink, mock: false };
  } catch (error: any) {
    console.error('Google Calendar approveOnlineConsult failed:', error);
    return { approved: false, mock: false, error: error?.message || 'Approval request failed' };
  }
}

export interface GenerateMeetLinkResult {
  success: boolean;
  meetLink?: string;
  mock: boolean;
  error?: string;
}

/**
 * Generalized version of the PATCH-for-conferenceData mechanics
 * `approveOnlineConsult` above already proved out — usable for ANY
 * appointment with a `googleCalendarEventId`, not just ones sitting in
 * `pending_doctor_approval`. Unlike `approveOnlineConsult`, this does NOT
 * touch the event's `status`/`summary` — an admin generating a Meet link
 * for an already-confirmed in-clinic appointment (converting it to a video
 * consult) shouldn't have its confirmation state or title altered as a
 * side effect.
 */
export async function generateMeetLinkForEvent(eventId?: string): Promise<GenerateMeetLinkResult> {
  if (!eventId) return { success: false, mock: false, error: 'No calendar event to attach a Meet link to.' };

  if (!isGoogleCalendarConfigured() || eventId.startsWith('gcal_mock_')) {
    return { success: true, meetLink: `https://meet.google.com/mock-${eventId.slice(-10)}`, mock: true };
  }

  try {
    const requestId = `vihana-meet-${eventId}-${Date.now()}`;
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}?conferenceDataVersion=1`;

    const res = await authorizedFetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conferenceData: { createRequest: { requestId, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
      })
    });

    if (!res.ok) {
      const bodyText = await res.text();
      console.error(`Google Calendar generateMeetLinkForEvent failed (${res.status}):`, bodyText);
      return { success: false, mock: false, error: `Calendar API error: ${res.status}` };
    }

    const event: any = await res.json();
    const meetLink = event.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri;
    return { success: true, meetLink, mock: false };
  } catch (error: any) {
    console.error('Google Calendar generateMeetLinkForEvent failed:', error);
    return { success: false, mock: false, error: error?.message || 'Meet link generation failed' };
  }
}

/**
 * Appends a timestamped note to an event's description — used by the admin
 * console's toggle switches (e.g. "Marked visited by admin") so anyone
 * looking at the doctor's actual Calendar sees why/when a change happened,
 * without needing to open /doctor-admin. Reads the current description
 * first since Calendar's PATCH replaces field values rather than merging
 * them. Best-effort — never throws, matching every other Calendar function
 * here (a failed note must never block the admin action that triggered it).
 */
export async function updateCalendarEventNote(eventId: string | undefined, note: string): Promise<{ success: boolean; mock: boolean }> {
  if (!eventId) return { success: false, mock: true };
  if (!isGoogleCalendarConfigured() || eventId.startsWith('gcal_mock_')) return { success: true, mock: true };

  try {
    const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}`;
    const getRes = await authorizedFetch(eventUrl);
    if (!getRes.ok) throw new Error(`Fetch event failed: ${getRes.status}`);
    const event: any = await getRes.json();

    const stamp = new Date().toLocaleString('en-IN', { timeZone: GOOGLE_CALENDAR_TIMEZONE });
    const existingDescription: string = event.description || '';
    const newDescription = `${existingDescription}${existingDescription ? '\n' : ''}[${stamp}] ${note}`;

    const patchRes = await authorizedFetch(eventUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newDescription })
    });
    if (!patchRes.ok) throw new Error(`Patch event failed: ${patchRes.status}`);

    return { success: true, mock: false };
  } catch (error: any) {
    console.error(`Google Calendar updateCalendarEventNote failed for ${eventId}:`, error?.message || error);
    return { success: false, mock: false };
  }
}

export async function cancelCalendarEvent(eventId?: string): Promise<{ cancelled: boolean; mock: boolean }> {
  if (!eventId) return { cancelled: false, mock: true };

  if (!isGoogleCalendarConfigured() || eventId.startsWith('gcal_mock_')) {
    return { cancelled: true, mock: true };
  }

  try {
    const res = await authorizedFetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events/${eventId}`,
      { method: 'DELETE' }
    );
    // Google returns 410 Gone if the event was already deleted — treat as cancelled.
    return { cancelled: res.ok || res.status === 410, mock: false };
  } catch (error) {
    console.error('Google Calendar cancel failed:', error);
    return { cancelled: false, mock: false };
  }
}
