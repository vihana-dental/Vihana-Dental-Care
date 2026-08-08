/**
 * Google Sheets appointment log — additive alongside Google Calendar (which
 * remains the real scheduling source of truth) and the in-memory appointment
 * store. This is a human-readable export/audit trail the clinic staff can
 * open directly, appended to on every confirmed booking across all channels.
 *
 * Authenticated via OAuth 2.0, reusing the *exact same* client credentials
 * and refresh token as Google Calendar (server/services/googleCalendar.ts) —
 * a service account was tried first here too, but that key lived in a
 * separate, now-inaccessible Google Cloud project once the client's own
 * account took over the app, and Google scopes API-enablement to the
 * *calling credential's* project, not the target spreadsheet's owner — so
 * enabling Sheets API on the client's project did nothing for a service
 * account that belonged to someone else's project. OAuth as the client's
 * real account sidesteps that entirely: one "Connect Google Calendar" click
 * in /doctor-admin (which now requests both the Calendar and Sheets scopes
 * together) authorizes this file too, no separate credential needed. If the
 * target spreadsheet is owned by that same Google account, no sharing step
 * is needed either — only share it if the sheet lives in a *different*
 * account than the one that clicked "Connect".
 *
 * Falls back to a clearly-flagged mock (logs the row, never throws) whenever
 * the OAuth client / GOOGLE_SHEETS_SPREADSHEET_ID aren't configured.
 */

import { OAuth2Client } from 'google-auth-library';

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || '';
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || '';
const GOOGLE_OAUTH_REDIRECT_URI = process.env.GOOGLE_OAUTH_REDIRECT_URI || '';
const GOOGLE_CALENDAR_REFRESH_TOKEN = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || '';
const GOOGLE_SHEETS_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const GOOGLE_SHEETS_TAB_NAME = process.env.GOOGLE_SHEETS_TAB_NAME || 'Appointments';

export function isGoogleSheetsConfigured(): boolean {
  return Boolean(
    GOOGLE_OAUTH_CLIENT_ID && GOOGLE_OAUTH_CLIENT_SECRET && GOOGLE_OAUTH_REDIRECT_URI &&
    GOOGLE_CALENDAR_REFRESH_TOKEN && GOOGLE_SHEETS_SPREADSHEET_ID
  );
}

let cachedClient: OAuth2Client | null = null;

function getAuthClient(): OAuth2Client {
  if (cachedClient) return cachedClient;
  cachedClient = new OAuth2Client({
    clientId: GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
    redirectUri: GOOGLE_OAUTH_REDIRECT_URI
  });
  cachedClient.setCredentials({ refresh_token: GOOGLE_CALENDAR_REFRESH_TOKEN });
  return cachedClient;
}

/** Same Headers-flattening fix required for every google-auth-library caller in this project. */
async function authorizedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const client = getAuthClient();
  const authHeaders = await client.getRequestHeaders();
  const headers: Record<string, string> = {};
  authHeaders.forEach((value, key) => { headers[key] = value; });
  return fetch(url, { ...options, headers: { ...headers, ...options.headers } });
}

export interface AppointmentRowParams {
  patientName: string;
  phone: string;
  service: string;
  date: string;
  time: string;
  channel: 'whatsapp' | 'chatbot' | 'website_cta';
  paymentStatus: string;
  amountPaid: number;
}

const CHANNEL_LABELS: Record<AppointmentRowParams['channel'], string> = {
  whatsapp: 'WhatsApp',
  chatbot: 'Chatbot',
  website_cta: 'Website CTA'
};

export interface AppendRowResult {
  success: boolean;
  mock: boolean;
  error?: string;
}

/** Appends one row matching the sheet's fixed column order — never throws. */
export async function appendAppointmentRow(params: AppointmentRowParams): Promise<AppendRowResult> {
  const row = [
    new Date().toISOString(),
    params.patientName,
    params.phone,
    params.service,
    params.date,
    // Leading apostrophe forces Sheets to store this as literal text under
    // USER_ENTERED — without it, "10:30 AM" gets silently reparsed as a time
    // value and displayed using the column's inherited number format, which
    // typically strips the AM/PM suffix entirely.
    `'${params.time}`,
    CHANNEL_LABELS[params.channel],
    params.paymentStatus,
    params.amountPaid
  ];

  if (!isGoogleSheetsConfigured()) {
    console.log('[google sheets mock] Would append row:', row);
    return { success: false, mock: true };
  }

  try {
    const range = `${encodeURIComponent(GOOGLE_SHEETS_TAB_NAME)}!A:I`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await authorizedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    });

    if (!res.ok) {
      throw new Error(`Sheets API error: ${res.status} ${await res.text()}`);
    }

    return { success: true, mock: false };
  } catch (error: any) {
    console.error('Google Sheets appendAppointmentRow failed (booking still proceeds):', error?.message || error);
    return { success: false, mock: false, error: error?.message || 'Unknown Sheets error' };
  }
}
