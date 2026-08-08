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
import { Appointment } from '../../src/types';
import { getTimeSlotsForDate } from '../../src/data/clinicData';

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
  // timeSlot format: "10:30 AM" — combine with date and the fixed appointment duration.
  const [time, meridiem] = timeSlot.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const start = new Date(`${date}T00:00:00`);
  start.setHours(hours, minutes, 0, 0);
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

  const dayStart = new Date(`${dateISO}T00:00:00`);
  const dayEnd = new Date(`${dateISO}T23:59:59`);

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
  slots: { time: string; available: boolean }[];
  dayFullyBooked: boolean;
  degraded: boolean;
  message?: string;
}

/** All bookable slots for a date, each flagged available/unavailable against live Calendar data. */
export async function computeAvailability(dateISO: string): Promise<AvailabilityResult> {
  const allSlots = getTimeSlotsForDate(dateISO);

  if (allSlots.length === 0) {
    return { success: true, slots: [], dayFullyBooked: true, degraded: false, message: 'Clinic is closed on this day.' };
  }

  const freeBusy = await getFreeBusyForDate(dateISO);

  if (!freeBusy.success) {
    // Degrade gracefully: show every slot as tentatively available rather than
    // blocking booking entirely because Calendar was briefly unreachable.
    return {
      success: true,
      slots: allSlots.map((time) => ({ time, available: true })),
      dayFullyBooked: false,
      degraded: true,
      message: 'Live availability is temporarily unavailable — showing standard hours. We will confirm your exact slot manually if needed.'
    };
  }

  const slots = allSlots.map((time) => ({ time, available: !slotOverlapsBusy(dateISO, time, freeBusy.busy) }));
  const dayFullyBooked = slots.every((s) => !s.available);

  return { success: true, slots, dayFullyBooked, degraded: false };
}

/** Re-check a single slot immediately before payment/Meet generation. */
export async function isSlotStillAvailable(dateISO: string, timeSlot: string): Promise<{ valid: boolean; degraded: boolean; message?: string }> {
  const availability = await computeAvailability(dateISO);
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
