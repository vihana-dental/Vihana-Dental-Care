/**
 * Razorpay integration service.
 *
 * Real credentials are supplied later via RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.
 * Until then every function falls back to a clearly-flagged mock so the full
 * checkout UX (order → payment link → QR → webhook confirmation) can be built
 * and demoed end-to-end without live keys.
 *
 * Swap-in path once real keys are provided:
 *   - Replace the mock branches with calls to the Razorpay Node SDK
 *     (`new Razorpay({ key_id, key_secret })`) or direct REST calls to
 *     https://api.razorpay.com/v1/orders and /v1/payment_links.
 *   - Verify webhook signatures in the /api/razorpay/webhook handler using
 *     RAZORPAY_WEBHOOK_SECRET (crypto.createHmac('sha256', secret)).
 */

import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

export function isRazorpayConfigured(): boolean {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

export function isRazorpayWebhookConfigured(): boolean {
  return Boolean(RAZORPAY_WEBHOOK_SECRET);
}

/**
 * Standard Checkout signature check: Razorpay signs `order_id|payment_id`
 * with the account's key secret (HMAC-SHA256). Constant-time compare avoids
 * leaking timing info about how much of the signature matched.
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  if (!RAZORPAY_KEY_SECRET || !orderId || !paymentId || !signature) return false;

  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

/**
 * Webhook signature check: Razorpay signs the raw request body with the
 * separate webhook secret (configured in Dashboard > Settings > Webhooks).
 * Must be computed over the exact raw bytes — parsed/re-stringified JSON
 * will not reproduce the same signature.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  if (!RAZORPAY_WEBHOOK_SECRET || !rawBody || !signature) return false;

  const expected = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export function getPublicKeyId(): string {
  return RAZORPAY_KEY_ID || 'rzp_test_mockkey123';
}

/** Razorpay's REST API auth: HTTP Basic with key_id as username, key_secret as password. */
async function razorpayFetch(path: string, body: Record<string, unknown>): Promise<any> {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');

  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.description || `Razorpay API error (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export interface CreateOrderParams {
  amountINR: number;
  receipt: string;
}

export interface CreateOrderResult {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
}

export async function createOrder({ amountINR, receipt }: CreateOrderParams): Promise<CreateOrderResult> {
  if (!isRazorpayConfigured()) {
    return {
      id: `order_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`,
      amount: amountINR * 100,
      currency: 'INR',
      receipt
    };
  }

  // payment_capture: 1 auto-captures on successful authorization, matching
  // the webhook handler which listens for "payment.captured" (not
  // "payment.authorized") — without this, a real payment would sit
  // authorized-but-uncaptured and never fire the event we're listening for.
  const order = await razorpayFetch('/orders', {
    amount: amountINR * 100,
    currency: 'INR',
    receipt,
    payment_capture: 1
  });

  return {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    receipt: order.receipt
  };
}

export interface CreatePaymentLinkParams {
  amountINR: number;
  description: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  receipt: string;
  /**
   * Our own appointment ID, passed through as Razorpay's `reference_id`.
   * The `payment_link.paid` webhook event echoes this back — it's how the
   * WhatsApp booking flow (which has no browser/signature callback to work
   * with) matches an incoming payment to the right pending appointment.
   */
  referenceId?: string;
}

export interface CreatePaymentLinkResult {
  success: boolean;
  paymentLinkId: string;
  shortUrl: string;
  qrImageUrl: string;
  amount: number;
  currency: string;
  status: 'created';
  mock: boolean;
}

/**
 * Generates a Razorpay Payment Link + a scannable QR code pointing at it.
 * The QR is rendered via a lightweight public QR image endpoint (no new
 * dependency needed) so the widget/WhatsApp message can display it
 * immediately — this works identically for both mock and real short URLs,
 * since it's just encoding whatever URL it's given.
 */
export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<CreatePaymentLinkResult> {
  if (!isRazorpayConfigured()) {
    const paymentLinkId = `plink_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
    const shortUrl = `https://rzp.io/i/mock-${paymentLinkId}`;
    return {
      success: true,
      paymentLinkId,
      shortUrl,
      qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(shortUrl)}`,
      amount: params.amountINR * 100,
      currency: 'INR',
      status: 'created',
      mock: true
    };
  }

  const link = await razorpayFetch('/payment_links', {
    amount: params.amountINR * 100,
    currency: 'INR',
    description: params.description,
    customer: {
      name: params.patientName,
      contact: params.patientPhone,
      ...(params.patientEmail ? { email: params.patientEmail } : {})
    },
    notify: { sms: true, email: Boolean(params.patientEmail) },
    reference_id: params.referenceId || params.receipt
  });

  return {
    success: true,
    paymentLinkId: link.id,
    shortUrl: link.short_url,
    qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(link.short_url)}`,
    amount: link.amount,
    currency: link.currency,
    status: 'created',
    mock: false
  };
}
