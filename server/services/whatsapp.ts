/**
 * Meta WhatsApp Business (Graph API) client — Module A's messaging layer.
 *
 * Requires a Meta Developer App + WhatsApp Business Account + verified
 * phone number, which is its own multi-step onboarding (separate from
 * everything else in this file — ask when you're ready to set it up).
 * Until META_WHATSAPP_ACCESS_TOKEN / META_WHATSAPP_PHONE_NUMBER_ID are
 * configured, every send is logged instead of actually sent — the webhook
 * handler, conversation flow, and Razorpay QR generation in server.ts all
 * work end-to-end against this mock today, and switch to real messages the
 * moment credentials are added, with no other code changes.
 */

import crypto from 'crypto';

const META_WHATSAPP_PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID || '';
const META_WHATSAPP_ACCESS_TOKEN = process.env.META_WHATSAPP_ACCESS_TOKEN || '';
const META_WHATSAPP_VERIFY_TOKEN = process.env.META_WHATSAPP_VERIFY_TOKEN || '';
const META_WHATSAPP_APP_SECRET = process.env.META_WHATSAPP_APP_SECRET || '';
// The Meta-registered WhatsApp number the automated assistant answers on
// (digits only, no "+"), used to build wa.me click-to-chat links that hand a
// patient off to the bot. Set this to the real Meta display number once live;
// callers pass CLINIC_INFO.whatsappBot as the fallback so those links still
// reach the bot's number before that's configured. This is deliberately NOT
// the clinic's public contact number (CLINIC_INFO.whatsapp) — the bot number
// is never shown to patients as text, only ever used as a link target.
const META_WHATSAPP_DISPLAY_NUMBER = process.env.META_WHATSAPP_DISPLAY_NUMBER || '';

// Meta only allows free-form text messages (sendTextMessage) inside the 24h
// customer-service session window opened by the PATIENT messaging first.
// The admin console's manual Send Confirmation/Reminder/Meet Link buttons
// are business-initiated — the doctor can click them at any time, almost
// always outside that window — so those sends need a pre-approved Message
// Template instead. Falls back to sendTextMessage when no template name is
// configured (works only while a live session happens to be open) so the
// buttons keep functioning during setup rather than hard-failing.
const META_WHATSAPP_TEMPLATE_LANGUAGE = process.env.META_WHATSAPP_TEMPLATE_LANGUAGE || 'en_US';
const META_WHATSAPP_TEMPLATE_CONFIRMATION = process.env.META_WHATSAPP_TEMPLATE_CONFIRMATION || '';
const META_WHATSAPP_TEMPLATE_REMINDER = process.env.META_WHATSAPP_TEMPLATE_REMINDER || '';
const META_WHATSAPP_TEMPLATE_MEET_LINK = process.env.META_WHATSAPP_TEMPLATE_MEET_LINK || '';

const GRAPH_API_VERSION = 'v20.0';

export function isWhatsAppConfigured(): boolean {
  return Boolean(META_WHATSAPP_PHONE_NUMBER_ID && META_WHATSAPP_ACCESS_TOKEN);
}

export function getWebhookVerifyToken(): string {
  return META_WHATSAPP_VERIFY_TOKEN;
}

/** Log-safe summary of an outgoing message: type and masked recipient only, never the body (patient data). */
export function maskPhone(phone: unknown): string {
  return `***${String(phone ?? '').slice(-4)}`;
}

function describeOutgoing(payload: Record<string, unknown>): string {
  const interactiveType = (payload.interactive as any)?.type;
  return `type=${payload.type}${interactiveType ? `/${interactiveType}` : ''} to=${maskPhone(payload.to)}`;
}

async function graphApiSend(payload: Record<string, unknown>): Promise<{ success: boolean; mock: boolean; error?: string }> {
  if (!isWhatsAppConfigured()) {
    console.log('[whatsapp mock] Would send:', JSON.stringify(payload));
    return { success: false, mock: true };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${META_WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${META_WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload })
    });

    if (!res.ok) {
      throw new Error(`WhatsApp Graph API error: ${res.status} ${await res.text()}`);
    }

    console.log(`[whatsapp] sent ${describeOutgoing(payload)} ok`);
    return { success: true, mock: false };
  } catch (error: any) {
    console.error(`WhatsApp send failed (${describeOutgoing(payload)}; conversation continues):`, error?.message || error);
    return { success: false, mock: false, error: error?.message || 'Unknown WhatsApp error' };
  }
}

export function sendTextMessage(to: string, body: string) {
  return graphApiSend({ to, type: 'text', text: { body } });
}

export function sendImageMessage(to: string, imageUrl: string, caption?: string) {
  return graphApiSend({ to, type: 'image', image: { link: imageUrl, caption } });
}

/**
 * Sends an approved Message Template — the only message type Meta allows
 * for business-initiated sends outside the 24h session window. `bodyParams`
 * fill the template's {{1}}, {{2}}, ... placeholders in order, as plain text.
 * The template itself must already exist and be Approved in Meta's WhatsApp
 * Manager > Message Templates before this will succeed (Graph API rejects
 * unknown/pending template names).
 *
 * `buttonPayloads`, if given, fills the template's Quick Reply buttons in
 * order (index 0 = first button, etc.) — the button TEXT is fixed at
 * template-approval time in Meta's UI, but the payload that comes back on
 * the webhook when tapped is set fresh on every send. This is how a
 * template's Reschedule/Cancel buttons get wired to a specific appointment:
 * pass `[\`reschedule:${id}\`, \`cancel:${id}\`]` and a tap lands on the SAME
 * webhook handler (server.ts, matches on the "reschedule:"/"cancel:" prefix)
 * already used by the live-session interactive buttons — no separate
 * handling needed for the template-triggered case.
 */
export function sendTemplateMessage(to: string, templateName: string, bodyParams: string[] = [], buttonPayloads: string[] = []) {
  const components: Record<string, unknown>[] = [];
  if (bodyParams.length > 0) {
    components.push({ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) });
  }
  buttonPayloads.forEach((payload, index) => {
    components.push({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload }] });
  });

  return graphApiSend({
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: META_WHATSAPP_TEMPLATE_LANGUAGE },
      ...(components.length > 0 ? { components } : {})
    }
  });
}

/**
 * Business-initiated confirmation/reminder/Meet-link sends — used by the
 * admin console's manual action buttons, which can fire at any time (not
 * just while a patient session is open). Uses the matching approved template
 * when configured; falls back to free-form text otherwise, which only
 * succeeds if the patient has messaged the bot number in the last 24h.
 */
export function sendConfirmationMessage(to: string, body: string, params: string[], buttonPayloads: string[] = []) {
  if (META_WHATSAPP_TEMPLATE_CONFIRMATION) return sendTemplateMessage(to, META_WHATSAPP_TEMPLATE_CONFIRMATION, params, buttonPayloads);
  return sendTextMessage(to, body);
}

export function sendReminderMessage(to: string, body: string, params: string[], buttonPayloads: string[] = []) {
  if (META_WHATSAPP_TEMPLATE_REMINDER) return sendTemplateMessage(to, META_WHATSAPP_TEMPLATE_REMINDER, params, buttonPayloads);
  return sendTextMessage(to, body);
}

export function sendMeetLinkMessage(to: string, body: string, params: string[]) {
  if (META_WHATSAPP_TEMPLATE_MEET_LINK) return sendTemplateMessage(to, META_WHATSAPP_TEMPLATE_MEET_LINK, params);
  return sendTextMessage(to, body);
}

/**
 * Builds a wa.me click-to-chat link with pre-filled text — the mechanism
 * every booking confirmation UI (website CTA, chatbot, WhatsApp bot itself)
 * uses to get appointment details onto the patient's WhatsApp. Deliberately
 * NOT a business-initiated message: the patient taps this link themselves,
 * which opens their WhatsApp with the text pre-typed, and sending it is what
 * starts a valid 24-hour customer-service window — sidesteps Meta's
 * business-initiated messaging restrictions/template requirements entirely.
 */
export function buildAppointmentWhatsAppLink(appointmentId: string, fallbackDisplayNumber?: string): string {
  const digitsOnly = (META_WHATSAPP_DISPLAY_NUMBER || fallbackDisplayNumber || '').replace(/[^\d]/g, '');
  const prefilledText = `Show my appointment details #${appointmentId}`;
  return `https://wa.me/${digitsOnly}?text=${encodeURIComponent(prefilledText)}`;
}

export interface ListRow {
  id: string;
  title: string; // WhatsApp hard-truncates at 24 characters
  description?: string; // truncates at 72 characters
}

export interface ListSection {
  title: string; // truncates at 24 characters
  rows: ListRow[];
}

/**
 * Interactive List Message — the tap-to-select menu that replaces free-text
 * parsing for anything with more than 3 options. WhatsApp hard-caps this at
 * **10 rows total across all sections combined** (not 10 per section) — the
 * caller is responsible for staying under that; server.ts's conversation
 * flow handles it via category/time-period drill-down rather than ever
 * building a single list bigger than 10 rows.
 */
export function sendListMessage(to: string, bodyText: string, buttonLabel: string, sections: ListSection[]) {
  return graphApiSend({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: sections.map((s) => ({
          title: s.title.slice(0, 24),
          rows: s.rows.map((r) => ({ id: r.id, title: r.title.slice(0, 24), description: r.description?.slice(0, 72) }))
        }))
      }
    }
  });
}

export interface ReplyButton {
  id: string;
  title: string; // WhatsApp hard-truncates at 20 characters
}

/** Quick-reply buttons — WhatsApp caps this at 3 buttons per message. */
export function sendReplyButtons(to: string, bodyText: string, buttons: ReplyButton[]) {
  return graphApiSend({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } }))
      }
    }
  });
}

// The published WhatsApp Flow that shows the native calendar popup (see
// docs/whatsapp-date-flow.json). Optional: without it the "Pick a date" button
// falls back to asking for a typed date.
// Quotes and stray whitespace are stripped: dashboards such as Render keep
// quote characters literally, and Meta then rejects the id as invalid.
const META_WHATSAPP_DATE_FLOW_ID = (process.env.META_WHATSAPP_DATE_FLOW_ID || '').trim().replace(/^["']+|["']+$/g, '').trim();

export function isDateFlowConfigured(): boolean {
  return Boolean(META_WHATSAPP_DATE_FLOW_ID);
}

/**
 * Sends the booking WhatsApp Flow as a tappable button message. The Flow opens
 * as native full-screen popup screens inside WhatsApp (date -> time -> confirm).
 * It is an endpoint Flow: WhatsApp calls POST /api/whatsapp/flow after each
 * screen, which is where live availability is computed — so this message
 * carries no data of its own (`data_exchange` action).
 */
export function sendFlowMessage(to: string, bodyText: string, ctaLabel: string) {
  return graphApiSend({
    to,
    type: 'interactive',
    interactive: {
      type: 'flow',
      body: { text: bodyText },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_id: META_WHATSAPP_DATE_FLOW_ID,
          flow_token: `vihana-booking-${Date.now()}`,
          flow_cta: ctaLabel.slice(0, 30),
          flow_action: 'data_exchange'
        }
      }
    }
  });
}

/**
 * Attaches the data endpoint and the Meta app to a DRAFT Flow through the
 * Graph API. This does what the Flow editor's "Set endpoint URI" and "Connect
 * Meta app" steps do, for cases where the editor's app picker lists nothing.
 * Only draft Flows can be updated; a published Flow is immutable.
 */
export async function configureFlowEndpoint(flowId: string, appId: string, endpointUri: string): Promise<{ success: boolean; detail: string }> {
  if (!isWhatsAppConfigured()) return { success: false, detail: 'WhatsApp credentials not configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${flowId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${META_WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ application_id: appId, endpoint_uri: endpointUri }).toString()
    });
    const body = await res.text();
    return { success: res.ok, detail: `${res.status} ${body.slice(0, 400)}` };
  } catch (error: any) {
    return { success: false, detail: error?.message || 'Unknown error' };
  }
}

/** Non-secret identifiers, logged at startup so a wrong phone-number/Flow id is obvious from the logs. */
export function describeWhatsAppConfig(): string {
  return `phoneNumberId=${META_WHATSAPP_PHONE_NUMBER_ID || '(unset)'} flowId=${META_WHATSAPP_DATE_FLOW_ID || '(unset)'} token=${META_WHATSAPP_ACCESS_TOKEN ? 'set' : 'unset'}`;
}

/**
 * Registers the public half of the Flow endpoint's RSA key with Meta for this
 * phone number. WhatsApp encrypts every request it sends to the Flow endpoint
 * with this key; without it registered, the endpoint can't be used. Safe to
 * call on every boot — re-registering the same key is a no-op on Meta's side.
 */
export async function registerFlowEncryptionKey(publicKeyPem: string): Promise<{ success: boolean; error?: string }> {
  if (!isWhatsAppConfigured()) return { success: false, error: 'WhatsApp credentials not configured' };
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${META_WHATSAPP_PHONE_NUMBER_ID}/whatsapp_business_encryption`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${META_WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ business_public_key: publicKeyPem }).toString()
    });
    if (!res.ok) return { success: false, error: `${res.status} ${await res.text()}` };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

/**
 * Verifies Meta's X-Hub-Signature-256 header (format: "sha256=<hex>") against
 * the raw request body, using the app secret. Skips verification (returns
 * true) when META_WHATSAPP_APP_SECRET isn't configured yet, so the webhook
 * can still be exercised in mock mode before that credential exists —
 * matches the same mock-fallback shape as every other integration here, but
 * this one MUST be configured before going live (an unverified webhook
 * accepts payloads from anyone who finds the URL).
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
  if (!META_WHATSAPP_APP_SECRET) return true; // dev/mock mode only

  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
  const receivedSignature = signatureHeader.slice('sha256='.length);

  const expected = crypto.createHmac('sha256', META_WHATSAPP_APP_SECRET).update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(receivedSignature, 'hex');
  if (expectedBuf.length !== receivedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Shape of the bits we actually need from Meta's deeply-nested webhook
 * payload. `text` is populated for both plain text messages AND interactive
 * replies (set to the tapped row/button's title) so free-text matching logic
 * works uniformly either way — `interactiveReplyId` is set only for taps,
 * letting the conversation handler match precisely by ID when available and
 * fall back to fuzzy text matching only for genuinely typed input.
 */
export interface IncomingWhatsAppMessage {
  from: string; // phone number, no "+"
  text: string;
  contactName?: string; // from the payload's contacts[].profile.name, when present
  interactiveReplyId?: string; // the row/button id, only present for list_reply/button_reply taps
  flowResponse?: Record<string, any>; // the submitted Flow form, only present for nfm_reply
}

/** Meta batches messages inside entry[].changes[].value.messages[] — pulls out text and interactive replies. */
export function parseIncomingMessages(webhookBody: any): IncomingWhatsAppMessage[] {
  const messages: IncomingWhatsAppMessage[] = [];

  for (const entry of webhookBody?.entry || []) {
    for (const change of entry?.changes || []) {
      const contacts = change?.value?.contacts || [];
      for (const msg of change?.value?.messages || []) {
        const contact = contacts.find((c: any) => c.wa_id === msg.from);
        const contactName = contact?.profile?.name;

        if (msg.type === 'text' && msg.text?.body) {
          messages.push({ from: msg.from, text: msg.text.body, contactName });
        } else if (msg.type === 'interactive' && msg.interactive?.type === 'list_reply') {
          const reply = msg.interactive.list_reply;
          messages.push({ from: msg.from, text: reply.title, contactName, interactiveReplyId: reply.id });
        } else if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
          const reply = msg.interactive.button_reply;
          messages.push({ from: msg.from, text: reply.title, contactName, interactiveReplyId: reply.id });
        } else if (msg.type === 'interactive' && msg.interactive?.type === 'nfm_reply') {
          let flowResponse: Record<string, any> = {};
          try {
            flowResponse = JSON.parse(msg.interactive.nfm_reply?.response_json || '{}');
          } catch {
            // malformed payload — treated as an empty submission by the handler
          }
          messages.push({ from: msg.from, text: '', contactName, flowResponse });
        }
      }
    }
  }

  return messages;
}
