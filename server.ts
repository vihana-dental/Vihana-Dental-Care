import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Appointment, Inquiry } from './src/types';
import { SERVICES, DOCTORS, CLINIC_INFO } from './src/data/clinicData';
import {
  getPublicKeyId,
  createOrder,
  createPaymentLink,
  verifyPaymentSignature,
  verifyWebhookSignature,
  isRazorpayConfigured,
  isRazorpayWebhookConfigured
} from './server/services/razorpay';
import {
  syncAppointmentToCalendar,
  cancelCalendarEvent,
  approveOnlineConsult,
  computeAvailability,
  isSlotStillAvailable,
  isGoogleCalendarConfigured,
  isGoogleOAuthClientConfigured,
  getGoogleOAuthConsentUrl,
  exchangeGoogleOAuthCode
} from './server/services/googleCalendar';
import { upsertPatient } from './server/services/supabase';
import {
  listBlogPosts,
  getBlogPostBySlug,
  getBlogPostById,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost
} from './server/services/blog';
import { appendAppointmentRow } from './server/services/googleSheets';
import { persistAppointment, loadAllAppointments, isAppointmentsPersistenceConfigured } from './server/services/appointmentsStore';
import { getServicePriceDisplay, getAllServicePriceDisplays, setServicePriceDisplay } from './server/services/pricing';
import {
  getWebhookVerifyToken,
  sendTextMessage,
  sendListMessage,
  sendReplyButtons,
  buildAppointmentWhatsAppLink,
  verifyWebhookSignature as verifyWhatsAppWebhookSignature,
  parseIncomingMessages
} from './server/services/whatsapp';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// `verify` captures the exact raw request bytes onto req.rawBody before JSON
// parsing — the Razorpay webhook signature is computed over those raw bytes,
// not a re-stringified version of the parsed object (which can differ in
// whitespace/key order and would silently break signature verification).
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

app.use(express.json({
  // Raised from the 100kb default so the blog admin's image upload (encoded
  // client-side as a base64 data: URI, no separate file storage service)
  // fits through — everything else in this app sends payloads far smaller
  // than this ceiling.
  limit: '6mb',
  verify: (req: express.Request, res, buf) => {
    req.rawBody = buf.toString('utf-8');
  }
}));

// Global Config for Separate In-Clinic & Online Consultation Fees
let clinicFeeConfig = {
  confirmationFeeEnabled: true,
  inClinicFeeINR: 300, // Default ₹300 advance for in-clinic visits
  onlineFeeINR: 500     // Default ₹500 advance for online video consults
};

// ---------------- MINIMAL DOCTOR ADMIN AUTH ----------------
// Lightweight PIN-based session, scoped to a single purpose: letting the
// doctor update the advance booking fee without touching code. Deliberately
// small — no patient records, staff accounts, or clinical data behind this.
const DOCTOR_ADMIN_PIN = process.env.DOCTOR_ADMIN_PIN || '2468';
const ADMIN_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const adminSessions = new Map<string, number>(); // token -> expiresAt

function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expiresAt = token ? adminSessions.get(token) : undefined;

  if (!token || !expiresAt || expiresAt < Date.now()) {
    if (token) adminSessions.delete(token);
    return res.status(401).json({ success: false, error: 'Session expired. Please log in again.' });
  }

  adminSessions.set(token, Date.now() + ADMIN_SESSION_TTL_MS); // sliding expiry
  next();
}

// In-memory data persistence for demo session
let appointmentsStorage: Appointment[] = [
  {
    id: "APT-1001",
    patientName: "Senthil Kumar",
    patientPhone: "+91 98421 88320",
    patientEmail: "senthil@example.com",
    doctorId: "doc-1",
    doctorName: "Dr. N. Sanchana, M.D.S.",
    serviceId: "dental-implants",
    serviceName: "Dental Implants & Full Mouth Rehab",
    date: "2026-08-10",
    timeSlot: "10:30 AM",
    notes: "Follow-up consultation for upper quadrant implant abutment.",
    status: "confirmed",
    googleCalendarEventId: "gcal_evt_998124",
    googleCalendarSynced: true,
    whatsappConfirmationSent: true,
    whatsappReminderScheduled: true,
    rescheduleToken: "RSC-88120",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    caregiverPhone: "+91 98421 88321",
    consultationType: "in-clinic",
    paymentStatus: "paid",
    feeAmount: 300,
    channel: "website_cta"
  },
  {
    id: "APT-1002",
    patientName: "Deepa Sundaram",
    patientPhone: "+91 97890 12345",
    patientEmail: "deepa.sun@yahoo.com",
    doctorId: "doc-1",
    doctorName: "Dr. N. Sanchana, M.D.S.",
    serviceId: "invisalign-aligners",
    serviceName: "Invisalign & Clear Aligners",
    date: "2026-08-11",
    timeSlot: "04:00 PM",
    notes: "Initial online assessment for clear aligner trays.",
    status: "pending_approval",
    googleCalendarSynced: false,
    whatsappConfirmationSent: false,
    whatsappReminderScheduled: false,
    rescheduleToken: "RSC-99125",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    consultationType: "online-video",
    paymentStatus: "paid",
    feeAmount: 500,
    channel: "chatbot"
  }
];

// Shared, daily-renumbered appointment ID generator — every creation point
// (Standard Checkout, payment-link/chatbot, WhatsApp, direct free booking)
// calls this instead of rolling its own ID, so the format ("2026-08-08-001",
// resetting to 001 each day) stays consistent everywhere. The `#` shown to
// patients ("#2026-08-08-001") is display-only — the stored ID has no `#`,
// since Razorpay's receipt/reference_id field and wa.me deep links both
// prefer plain alphanumeric-and-dashes strings.
const dailyIdCounters = new Map<string, number>();

function toISTDateString(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function generateDailyAppointmentId(): string {
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  if (!dailyIdCounters.has(todayIST)) {
    // First call for this date since the server started — seed the counter
    // from existing storage (this in-memory app has no other persistence
    // layer for appointments) so a mid-day restart doesn't reuse IDs.
    const existingCount = appointmentsStorage.filter(a => toISTDateString(a.createdAt) === todayIST).length;
    dailyIdCounters.set(todayIST, existingCount);
  }

  const next = dailyIdCounters.get(todayIST)! + 1;
  dailyIdCounters.set(todayIST, next);
  return `${todayIST}-${String(next).padStart(3, '0')}`;
}

// Razorpay Payment Links enforce a unique reference_id — but our daily ID
// counter is in-memory only and reseeds from (empty, post-restart)
// appointmentsStorage, so a server restart can hand out an ID that already
// has a real payment link attached to it from before the restart. Retries
// with a fresh ID on exactly that collision rather than failing the booking.
async function createPaymentLinkForAppointment(
  appointment: Appointment,
  params: Omit<Parameters<typeof createPaymentLink>[0], 'receipt' | 'referenceId'>
): Promise<Awaited<ReturnType<typeof createPaymentLink>>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await createPaymentLink({ ...params, receipt: appointment.id, referenceId: appointment.id });
    } catch (error: any) {
      const isDuplicateReferenceId = typeof error?.message === 'string' && error.message.includes('already exists');
      if (attempt < 2 && isDuplicateReferenceId) {
        appointment.id = generateDailyAppointmentId();
        continue;
      }
      throw error;
    }
  }
  throw new Error('Could not generate a unique appointment ID.');
}

let inquiriesStorage: Inquiry[] = [
  {
    id: "INQ-201",
    name: "Anand Viswanathan",
    email: "anand.v@techmail.com",
    phone: "+91 98940 55123",
    service: "Invisalign & Clear Aligners",
    message: "Hi, I want to know the approximate duration for Invisalign aligners for gap filling. Available for evening appointment?",
    status: "new",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: "INQ-202",
    name: "Meena Swaminathan",
    email: "meena.s@gmail.com",
    phone: "+91 94431 09876",
    service: "Cosmetic Dentistry",
    message: "Interested in laser teeth whitening cost before my wedding next month.",
    status: "contacted",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    notes: "Sent WhatsApp brochure on Laser Teeth Whitening package."
  }
];

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "dummy-key") {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

function getPublicFeeConfig() {
  return clinicFeeConfig;
}

// ---------------- API ROUTES ----------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', clinic: CLINIC_INFO.name, timestamp: new Date().toISOString() });
});

// GOOGLE PLACES: Live Reviews (server-side proxy — Places API has no CORS support for browsers)
let placesReviewsCache: { data: any; timestamp: number } | null = null;
const PLACES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Doctor-admin manual override for the rating/review-count shown across the
// site (Hero badge, Testimonials header) — takes priority over the live
// Places fetch when enabled. Useful when Places isn't configured yet, or the
// doctor just wants to set the number directly without waiting on Google.
let reviewOverrideConfig: { enabled: boolean; rating: number; totalReviews: number } = {
  enabled: false,
  rating: CLINIC_INFO.rating,
  totalReviews: CLINIC_INFO.totalReviews
};

app.get('/api/google-reviews', async (req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  const placeId = process.env.GOOGLE_PLACE_ID || '';

  if (reviewOverrideConfig.enabled) {
    return res.json({
      success: true,
      configured: Boolean(apiKey && placeId),
      overridden: true,
      rating: reviewOverrideConfig.rating,
      totalReviews: reviewOverrideConfig.totalReviews,
      reviews: []
    });
  }

  if (!apiKey || !placeId) {
    return res.json({
      success: false,
      configured: false,
      message: "Live Google Reviews are not configured. Set GOOGLE_PLACE_ID and GOOGLE_PLACES_API_KEY to enable.",
      rating: CLINIC_INFO.rating,
      totalReviews: CLINIC_INFO.totalReviews
    });
  }

  if (placesReviewsCache && (Date.now() - placesReviewsCache.timestamp) < PLACES_CACHE_TTL_MS) {
    return res.json(placesReviewsCache.data);
  }

  try {
    const placesRes = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews,googleMapsUri'
      }
    });

    if (!placesRes.ok) {
      throw new Error(`Google Places API error: ${placesRes.status} ${await placesRes.text()}`);
    }

    const place: any = await placesRes.json();

    const reviews = (place.reviews || []).map((r: any, idx: number) => ({
      id: `g-${idx}-${r.publishTime || Date.now()}`,
      authorName: r.authorAttribution?.displayName || 'Google User',
      authorPhoto: r.authorAttribution?.photoUri,
      rating: r.rating,
      relativeTimeDescription: r.relativePublishTimeDescription,
      text: r.text?.text || r.originalText?.text || '',
      date: r.publishTime,
      verifiedGoogle: true
    }));

    const payload = {
      success: true,
      configured: true,
      rating: place.rating ?? CLINIC_INFO.rating,
      totalReviews: place.userRatingCount ?? CLINIC_INFO.totalReviews,
      reviews
    };

    placesReviewsCache = { data: payload, timestamp: Date.now() };
    res.json(payload);
  } catch (error) {
    console.error("Google Places live review fetch failed:", error);
    res.json({
      success: false,
      configured: true,
      message: "Failed to fetch live reviews from Google. Showing curated reviews instead.",
      rating: CLINIC_INFO.rating,
      totalReviews: CLINIC_INFO.totalReviews
    });
  }
});

app.get('/api/admin/review-override', requireAdminAuth, (req, res) => {
  res.json({ success: true, override: reviewOverrideConfig });
});

app.patch('/api/admin/review-override', requireAdminAuth, (req, res) => {
  const { enabled, rating, totalReviews } = req.body;

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ success: false, error: 'enabled (boolean) is required.' });
  }
  if (typeof rating !== 'number' || rating < 0 || rating > 5) {
    return res.status(400).json({ success: false, error: 'rating must be a number between 0 and 5.' });
  }
  if (typeof totalReviews !== 'number' || totalReviews < 0 || !Number.isInteger(totalReviews)) {
    return res.status(400).json({ success: false, error: 'totalReviews must be a non-negative whole number.' });
  }

  reviewOverrideConfig = { enabled, rating, totalReviews };
  placesReviewsCache = null; // force the next /api/google-reviews call to re-evaluate
  res.json({ success: true, override: reviewOverrideConfig });
});

// GET Clinic Data
app.get('/api/clinic-info', async (req, res) => {
  // Overlays live, doctor-editable price ranges (Supabase-backed, see
  // server/services/pricing.ts) onto the static service catalog — display
  // only, matches whatever clinicData.ts says until Supabase is configured
  // and/or the doctor edits a price in /doctor-admin.
  const livePrices = await getAllServicePriceDisplays();
  const priceById = new Map(livePrices.map((p) => [p.serviceId, p.priceRangeDisplay]));
  const services = SERVICES.map((s) => ({ ...s, priceRange: priceById.get(s.id) ?? s.priceRange }));

  res.json({
    info: CLINIC_INFO,
    services,
    doctors: DOCTORS,
    feeConfig: getPublicFeeConfig()
  });
});

// ---------------- BLOG (public reads) ----------------
app.get('/api/blog', async (req, res) => {
  const posts = await listBlogPosts();
  res.json({ success: true, posts });
});

app.get('/api/blog/:slug', async (req, res) => {
  const post = await getBlogPostBySlug(req.params.slug);
  if (!post) {
    return res.status(404).json({ success: false, error: 'Post not found.' });
  }
  res.json({ success: true, post });
});

// GET Availability — live slot status for a date, synced against Google Calendar freebusy.
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

app.get('/api/availability', async (req, res) => {
  const { date } = req.query;

  if (typeof date !== 'string' || !DATE_RE.test(date)) {
    return res.status(400).json({ success: false, error: 'A valid date (YYYY-MM-DD) query param is required.' });
  }

  try {
    const result = await computeAvailability(date);
    res.json({
      success: true,
      date,
      slots: result.slots,
      dayFullyBooked: result.dayFullyBooked,
      degraded: result.degraded,
      message: result.message
    });
  } catch (error) {
    console.error('Availability lookup failed:', error);
    res.json({
      success: true,
      date,
      slots: [],
      dayFullyBooked: false,
      degraded: true,
      message: 'Live availability is temporarily unavailable. We will confirm your exact slot manually if needed.'
    });
  }
});

// POST Availability Confirm — re-check one slot immediately before payment/Meet generation.
app.post('/api/availability/confirm', async (req, res) => {
  const { date, timeSlot } = req.body;

  if (typeof date !== 'string' || !DATE_RE.test(date) || typeof timeSlot !== 'string' || !timeSlot.trim()) {
    return res.status(400).json({ success: false, valid: false, message: 'date and timeSlot are required.' });
  }

  try {
    const result = await isSlotStillAvailable(date, timeSlot);
    res.json({ success: true, valid: result.valid, message: result.message });
  } catch (error) {
    console.error('Availability confirm failed:', error);
    // Fail open on the pre-payment check — a transient Calendar error shouldn't
    // block a booking outright; the appointment creation step is the final gate.
    res.json({ success: true, valid: true, message: 'Could not fully verify live availability, proceeding.' });
  }
});

// ---------------- RAZORPAY STANDARD CHECKOUT (order -> verify -> webhook) ----------------

function findAppointmentByOrderId(orderId: string): Appointment | undefined {
  return appointmentsStorage.find(a => a.razorpayOrderId === orderId);
}

function findAppointmentById(id: string): Appointment | undefined {
  return appointmentsStorage.find(a => a.id === id);
}

// Supabase patient upsert + Google Sheets row append — additive alongside
// Calendar sync, called at the exact same "this booking is now confirmed"
// moment, regardless of which of the three channels produced it. Both calls
// are internally wrapped (they log and return a status object instead of
// throwing), so a Supabase or Sheets outage never breaks a confirmed
// booking — this function itself also never throws, as a second layer of
// the same guarantee.
async function recordConfirmedAppointment(appointment: Appointment): Promise<void> {
  try {
    const [patientResult, sheetsResult] = await Promise.all([
      upsertPatient({
        name: appointment.patientName,
        phone: appointment.patientPhone,
        email: appointment.patientEmail,
        sourceChannel: appointment.channel
      }),
      appendAppointmentRow({
        patientName: appointment.patientName,
        phone: appointment.patientPhone,
        service: appointment.serviceName,
        date: appointment.date,
        time: appointment.timeSlot,
        channel: appointment.channel,
        paymentStatus: appointment.paymentStatus,
        amountPaid: appointment.feeAmount || 0
      }),
      persistAppointment(appointment)
    ]);

    if (!patientResult.success && !patientResult.mock) {
      console.error(`Supabase patient record failed for appointment ${appointment.id}:`, patientResult.error);
    }
    if (!sheetsResult.success && !sheetsResult.mock) {
      console.error(`Google Sheets row append failed for appointment ${appointment.id}:`, sheetsResult.error);
    }
  } catch (error: any) {
    // Should be unreachable (both calls already catch internally), but this
    // is the "log without crashing" backstop the CRM/log layer must never
    // violate — a booking that already succeeded must never fail here.
    console.error(`recordConfirmedAppointment unexpected error for appointment ${appointment.id}:`, error?.message || error);
  }
}

// De-dupes concurrent confirmations of the same appointment (e.g. the
// frontend's /verify call and the async webhook both landing around the same
// time) so calendar sync / Meet-link creation only ever runs once per booking.
const confirmationInFlight = new Map<string, Promise<{ appointment: Appointment; calendarSync: any; alreadyConfirmed: boolean }>>();

async function confirmAppointmentPayment(appointment: Appointment, paymentId: string) {
  if (appointment.status === 'confirmed') {
    return { appointment, calendarSync: null as any, alreadyConfirmed: true };
  }

  const existing = confirmationInFlight.get(appointment.id);
  if (existing) return existing;

  const promise = (async () => {
    if (appointment.status === 'confirmed') {
      return { appointment, calendarSync: null as any, alreadyConfirmed: true };
    }

    appointment.paymentId = paymentId;
    appointment.paymentStatus = 'paid';
    appointment.status = 'confirmed';
    appointment.whatsappConfirmationSent = true;
    appointment.whatsappReminderScheduled = true;
    appointment.updatedAt = new Date().toISOString();

    const calendarSync = await syncAppointmentToCalendar(appointment);
    appointment.googleCalendarEventId = calendarSync.eventId;
    appointment.googleCalendarSynced = calendarSync.synced;
    appointment.videoRoomUrl = calendarSync.meetLink;
    if (appointment.consultationType === 'online-video') {
      appointment.onlineConsultStatus = 'pending_doctor_approval';
    }

    await recordConfirmedAppointment(appointment);

    return { appointment, calendarSync, alreadyConfirmed: false };
  })();

  confirmationInFlight.set(appointment.id, promise);
  try {
    return await promise;
  } finally {
    confirmationInFlight.delete(appointment.id);
  }
}

// Creates the appointment as PENDING *before* talking to Razorpay, then
// creates the order against it. The fee is computed server-side from the
// live fee config — never trusted from the client.
app.post('/api/payments/create-order', async (req, res) => {
  const {
    patientName, patientPhone, patientEmail, doctorId, serviceId,
    date, timeSlot, notes, caregiverPhone, consultationType
  } = req.body;

  if (
    typeof patientName !== 'string' || !patientName.trim() ||
    typeof patientPhone !== 'string' || !patientPhone.trim() ||
    typeof date !== 'string' || !date.trim() ||
    typeof timeSlot !== 'string' || !timeSlot.trim()
  ) {
    return res.status(400).json({ success: false, error: 'Missing or invalid required fields: patientName, patientPhone, date, timeSlot' });
  }

  const slotCheck = await isSlotStillAvailable(date, timeSlot);
  if (!slotCheck.valid && !slotCheck.degraded) {
    return res.status(409).json({ success: false, error: slotCheck.message || 'That time slot is no longer available. Please pick another.' });
  }

  const isOnline = consultationType === 'online-video';
  const fee = clinicFeeConfig.confirmationFeeEnabled
    ? (isOnline ? clinicFeeConfig.onlineFeeINR : clinicFeeConfig.inClinicFeeINR)
    : 0;

  if (fee <= 0) {
    return res.status(400).json({ success: false, error: 'No advance fee is currently configured for this consultation type.' });
  }

  const doctor = DOCTORS.find(d => d.id === doctorId) || DOCTORS[0];
  const service = SERVICES.find(s => s.id === serviceId) || SERVICES[0];
  const appointmentId = generateDailyAppointmentId();

  const pendingAppointment: Appointment = {
    id: appointmentId,
    patientName,
    patientPhone,
    patientEmail: patientEmail || `${patientName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    serviceId: service.id,
    serviceName: service.title,
    date,
    timeSlot,
    notes: notes || '',
    status: 'pending',
    googleCalendarSynced: false,
    whatsappConfirmationSent: false,
    whatsappReminderScheduled: false,
    rescheduleToken: `RSC-${Math.floor(10000 + Math.random() * 90000)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    caregiverPhone,
    consultationType: isOnline ? 'online-video' : 'in-clinic',
    paymentStatus: 'pending',
    feeAmount: fee,
    channel: 'website_cta'
  };

  let order;
  try {
    order = await createOrder({ amountINR: fee, receipt: appointmentId });
  } catch (error: any) {
    console.error('Razorpay order creation failed:', error?.message || error);
    return res.status(502).json({ success: false, error: 'Could not initiate the payment gateway right now. Please try again in a moment.' });
  }
  pendingAppointment.razorpayOrderId = order.id;

  appointmentsStorage.unshift(pendingAppointment);
  await persistAppointment(pendingAppointment);

  res.json({
    success: true,
    appointmentId,
    order,
    keyId: getPublicKeyId(),
    // Tells the frontend whether to open a real Razorpay Checkout popup or
    // run the simulated success path — explicit flag, not inferred from
    // window.Razorpay presence (the SDK script is always loaded now, so its
    // mere presence no longer means real keys are configured).
    mock: !isRazorpayConfigured()
  });
});

// Frontend's post-checkout callback. Verifies the HMAC signature Razorpay
// signs `order_id|payment_id` with, then flips PENDING -> CONFIRMED.
app.post('/api/payments/verify', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (typeof razorpay_order_id !== 'string' || typeof razorpay_payment_id !== 'string') {
    return res.status(400).json({ success: false, error: 'razorpay_order_id and razorpay_payment_id are required.' });
  }

  const appointment = findAppointmentByOrderId(razorpay_order_id);
  if (!appointment) {
    return res.status(404).json({ success: false, error: 'No pending booking found for this order.' });
  }

  if (appointment.status === 'confirmed') {
    return res.json({
      success: true,
      alreadyConfirmed: true,
      appointment,
      calendarSync: { synced: appointment.googleCalendarSynced, meetLink: appointment.videoRoomUrl, mock: !isRazorpayConfigured() },
      whatsappLink: buildAppointmentWhatsAppLink(appointment.id, CLINIC_INFO.whatsapp)
    });
  }

  // Without live keys there's no real signature to check — mock mode
  // auto-confirms so the full UX still works end-to-end.
  const mockMode = !isRazorpayConfigured();
  const signatureValid = mockMode || (
    typeof razorpay_signature === 'string' &&
    verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)
  );

  if (!signatureValid) {
    appointment.status = 'payment_failed';
    appointment.paymentStatus = 'failed';
    appointment.updatedAt = new Date().toISOString();
    await persistAppointment(appointment);

    console.error('Razorpay signature verification failed:', {
      appointmentId: appointment.id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      hasSignature: Boolean(razorpay_signature)
    });

    return res.status(400).json({
      success: false,
      error: 'Payment verification failed. If any amount was deducted, it will be auto-refunded within 5-7 business days. Please try booking again.'
    });
  }

  const result = await confirmAppointmentPayment(appointment, razorpay_payment_id);

  res.json({
    success: true,
    alreadyConfirmed: result.alreadyConfirmed,
    appointment: result.appointment,
    calendarSync: result.calendarSync || { synced: result.appointment.googleCalendarSynced, meetLink: result.appointment.videoRoomUrl, mock: mockMode },
    whatsappLink: buildAppointmentWhatsAppLink(result.appointment.id, CLINIC_INFO.whatsapp)
  });
});

// Fallback path for when the frontend's /verify call never lands (closed tab,
// dropped network, etc.) — Razorpay calls this directly once the payment
// actually captures on their side.
app.post('/api/payments/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];

  if (isRazorpayWebhookConfigured()) {
    if (typeof signature !== 'string' || !req.rawBody || !verifyWebhookSignature(req.rawBody, signature)) {
      console.error('Razorpay webhook signature verification failed.');
      return res.status(400).json({ success: false, error: 'Invalid webhook signature.' });
    }
  }
  // No RAZORPAY_WEBHOOK_SECRET configured yet (dev/mock) — accept unsigned
  // events so this path can still be exercised. Must be set before go-live.

  const event = req.body;

  // Standard Checkout (website CTA, popup flow) confirms via order_id.
  if (event?.event === 'payment.captured') {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;

    if (!orderId || !paymentId) {
      return res.status(400).json({ success: false, error: 'Malformed webhook payload.' });
    }

    const appointment = findAppointmentByOrderId(orderId);
    if (!appointment) {
      return res.json({ success: true, ignored: true, reason: 'No matching appointment for this order.' });
    }

    const result = await confirmAppointmentPayment(appointment, paymentId);
    return res.json({ success: true, alreadyConfirmed: result.alreadyConfirmed });
  }

  // Payment Links (chatbot + WhatsApp channels) confirm via reference_id,
  // which we set to our own appointment ID when the link was created —
  // there's no browser popup/signature callback for these two channels, so
  // this webhook is the *only* way those bookings ever get confirmed.
  if (event?.event === 'payment_link.paid') {
    const referenceId = event.payload?.payment_link?.entity?.reference_id;
    const paymentId = event.payload?.payment?.entity?.id;

    if (!referenceId || !paymentId) {
      return res.status(400).json({ success: false, error: 'Malformed webhook payload.' });
    }

    const appointment = findAppointmentById(referenceId);
    if (!appointment) {
      return res.json({ success: true, ignored: true, reason: 'No matching appointment for this reference_id.' });
    }

    const result = await confirmAppointmentPayment(appointment, paymentId);

    // WhatsApp-originated bookings have no polling UI on the other end —
    // this webhook firing IS the moment to actually message the patient.
    if (appointment.channel === 'whatsapp' && !result.alreadyConfirmed) {
      await sendTextMessage(
        appointment.patientPhone,
        `✅ Payment received! Your ${appointment.serviceName} appointment on ${appointment.date} at ${appointment.timeSlot} is confirmed. Reschedule/cancel code: ${appointment.rescheduleToken}`
      );
    }

    return res.json({ success: true, alreadyConfirmed: result.alreadyConfirmed });
  }

  // Link expired before the patient paid — flip to payment_failed so the
  // "show my appointment details" reply and any polling UI can offer a
  // retry, and (for WhatsApp bookings, where there's no browser UI to show a
  // retry button in) proactively push a fresh link since the 24h session
  // from the original booking conversation is still open.
  if (event?.event === 'payment_link.expired') {
    const referenceId = event.payload?.payment_link?.entity?.reference_id;
    const appointment = referenceId ? findAppointmentById(referenceId) : undefined;

    if (appointment && appointment.status !== 'confirmed') {
      appointment.status = 'payment_failed';
      appointment.paymentStatus = 'failed';
      appointment.updatedAt = new Date().toISOString();
      await persistAppointment(appointment);

      if (appointment.channel === 'whatsapp') {
        await retryWhatsAppPaymentLink(appointment.patientPhone, appointment.id);
      }
    }

    return res.json({ success: true, ignored: !appointment });
  }

  res.json({ success: true, ignored: true });
});

// RAZORPAY: Create Payment Link + QR code (Module B — website chatbot channel).
// Creates the appointment as PENDING immediately (same pattern as
// /api/payments/create-order), then generates a Razorpay Payment Link whose
// reference_id is that appointment's ID — the payment_link.paid webhook
// above uses that to confirm it once Razorpay notifies us, since a payment
// link has no in-browser popup/signature callback to verify synchronously.
app.post('/api/razorpay/create-payment-link', async (req, res) => {
  const {
    patientName, patientPhone, patientEmail, doctorId, serviceId,
    date, timeSlot, notes, consultationType
  } = req.body;

  if (
    typeof patientName !== 'string' || !patientName.trim() ||
    typeof patientPhone !== 'string' || !patientPhone.trim() ||
    typeof date !== 'string' || !date.trim() ||
    typeof timeSlot !== 'string' || !timeSlot.trim()
  ) {
    return res.status(400).json({ success: false, error: 'Missing or invalid required fields: patientName, patientPhone, date, timeSlot' });
  }

  const slotCheck = await isSlotStillAvailable(date, timeSlot);
  if (!slotCheck.valid && !slotCheck.degraded) {
    return res.status(409).json({ success: false, error: slotCheck.message || 'That time slot is no longer available. Please pick another.' });
  }

  const isOnline = consultationType === 'online-video';
  const fee = clinicFeeConfig.confirmationFeeEnabled
    ? (isOnline ? clinicFeeConfig.onlineFeeINR : clinicFeeConfig.inClinicFeeINR)
    : 0;

  if (fee <= 0) {
    return res.status(400).json({ success: false, error: 'No advance fee is currently configured for this consultation type.' });
  }

  const doctor = DOCTORS.find(d => d.id === doctorId) || DOCTORS[0];
  const service = SERVICES.find(s => s.id === serviceId) || SERVICES[0];
  const appointmentId = generateDailyAppointmentId();

  const pendingAppointment: Appointment = {
    id: appointmentId,
    patientName,
    patientPhone,
    patientEmail: patientEmail || `${patientName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    serviceId: service.id,
    serviceName: service.title,
    date,
    timeSlot,
    notes: notes || '',
    status: 'pending',
    googleCalendarSynced: false,
    whatsappConfirmationSent: false,
    whatsappReminderScheduled: false,
    rescheduleToken: `RSC-${Math.floor(10000 + Math.random() * 90000)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    consultationType: isOnline ? 'online-video' : 'in-clinic',
    paymentStatus: 'pending',
    feeAmount: fee,
    channel: 'chatbot'
  };

  try {
    const link = await createPaymentLinkForAppointment(pendingAppointment, {
      amountINR: fee,
      description: `Vihana Dental Care — Appointment Advance (${consultationType === 'online-video' ? 'Online Consult' : 'In-Clinic Visit'})`,
      patientName,
      patientPhone,
      patientEmail
    });

    pendingAppointment.razorpayPaymentLinkId = link.paymentLinkId;
    appointmentsStorage.unshift(pendingAppointment);
    await persistAppointment(pendingAppointment);

    res.json({ ...link, appointmentId: pendingAppointment.id, whatsappLink: buildAppointmentWhatsAppLink(pendingAppointment.id, CLINIC_INFO.whatsapp) });
  } catch (error: any) {
    console.error('Razorpay payment link creation failed:', error?.message || error);
    res.status(502).json({ success: false, error: 'Could not generate a payment link right now. Please try again in a moment.' });
  }
});

// Dev/mock-mode helper: without live Razorpay keys there's no real webhook
// to wait for, so this lets the chat widget's "I've completed the payment"
// button simulate what the webhook would do. With live keys configured,
// this deliberately does NOT fake a confirmation — real confirmation only
// ever comes from the webhook above, so it just reports current status.
app.post('/api/payments/confirm-payment-link', async (req, res) => {
  const { appointmentId } = req.body;
  if (typeof appointmentId !== 'string') {
    return res.status(400).json({ success: false, error: 'appointmentId is required.' });
  }

  const appointment = findAppointmentById(appointmentId);
  if (!appointment) {
    return res.status(404).json({ success: false, error: 'Booking not found.' });
  }

  if (appointment.status === 'confirmed') {
    return res.json({
      success: true,
      alreadyConfirmed: true,
      appointment,
      calendarSync: { synced: appointment.googleCalendarSynced, meetLink: appointment.videoRoomUrl },
      whatsappLink: buildAppointmentWhatsAppLink(appointment.id, CLINIC_INFO.whatsapp)
    });
  }

  // Previously this fell straight through to "pending" forever, even after
  // a real failure (bad signature, payment_link.expired) — the frontend's
  // auto-poll would spin indefinitely instead of ever telling the patient
  // to retry.
  if (appointment.status === 'payment_failed') {
    return res.json({
      success: true,
      failed: true,
      message: 'Payment did not go through. Please try again.'
    });
  }

  if (isRazorpayConfigured()) {
    return res.json({
      success: true,
      pending: true,
      message: "Payment not confirmed yet. We'll confirm automatically the moment Razorpay notifies us — you'll get a WhatsApp/email confirmation.",
      whatsappLink: buildAppointmentWhatsAppLink(appointment.id, CLINIC_INFO.whatsapp)
    });
  }

  const result = await confirmAppointmentPayment(appointment, `pay_mocklink_${Date.now()}`);
  res.json({
    success: true,
    alreadyConfirmed: result.alreadyConfirmed,
    appointment: result.appointment,
    calendarSync: result.calendarSync || { synced: result.appointment.googleCalendarSynced, meetLink: result.appointment.videoRoomUrl, mock: true },
    whatsappLink: buildAppointmentWhatsAppLink(result.appointment.id, CLINIC_INFO.whatsapp)
  });
});

// ---------------- WHATSAPP BUSINESS API (Module A) ----------------
// A simple in-memory step machine per phone number. Good enough for a
// single-clinic, moderate-volume booking flow; if conversation state ever
// needs to survive a server restart, this Map is the one thing that'd need
// to move to Supabase too — everything else here is already stateless.
//
// Uses WhatsApp's native interactive List/Button messages instead of
// free-text parsing wherever there's more than a couple of options — no more
// "type the exact time as shown" friction. WhatsApp hard-caps list messages
// at 10 rows TOTAL (not per section), so with 13 services and up to 16 time
// slots on a weekday, both need a drill-down instead of one flat list:
// category -> service, and morning/evening -> time.

interface WhatsAppConversationState {
  step: 'awaiting_category' | 'awaiting_service' | 'awaiting_date' | 'awaiting_time_period' | 'awaiting_time' | 'awaiting_payment';
  contactName?: string;
  category?: string;
  serviceId?: string;
  date?: string;
  timePeriod?: 'Morning' | 'Evening';
  appointmentId?: string;
}

const whatsappConversations = new Map<string, WhatsAppConversationState>();

const SERVICE_CATEGORIES = Array.from(new Set(SERVICES.map((s) => s.category)));

/**
 * Resolves a tapped list/button reply OR a typed fallback (numeric index or
 * fuzzy label match) against a set of options — so the flow works whether
 * the patient taps the menu or just types, without maintaining two separate
 * code paths per step.
 */
function resolveSelection<T extends { id: string; label: string }>(
  msg: { text: string; interactiveReplyId?: string },
  options: T[]
): T | undefined {
  if (msg.interactiveReplyId) {
    const byId = options.find((o) => o.id === msg.interactiveReplyId);
    if (byId) return byId;
  }
  const normalized = msg.text.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) {
    const index = parseInt(normalized, 10) - 1;
    if (index >= 0 && index < options.length) return options[index];
  }
  return (
    options.find((o) => o.label.toLowerCase() === normalized) ||
    options.find((o) => o.label.toLowerCase().includes(normalized))
  );
}

// GET — Meta's one-time webhook verification handshake, performed when you
// register this URL in the Meta App Dashboard (Webhooks > Configure).
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === getWebhookVerifyToken() && typeof challenge === 'string') {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST — incoming message events. Always acknowledges 200 immediately (Meta
// retries aggressively on non-200 responses, which would otherwise cause
// duplicate message processing) and does the actual conversation handling
// after responding.
app.post('/api/whatsapp/webhook', async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  if (req.rawBody && !verifyWhatsAppWebhookSignature(req.rawBody, signature)) {
    console.error('WhatsApp webhook signature verification failed.');
    return res.sendStatus(403);
  }

  res.sendStatus(200);

  try {
    const messages = parseIncomingMessages(req.body);
    for (const msg of messages) {
      await handleIncomingWhatsAppMessage(msg.from, msg.text, msg.contactName, msg.interactiveReplyId);
    }
  } catch (error: any) {
    console.error('WhatsApp webhook message processing failed:', error?.message || error);
  }
});

/**
 * "Show my appointment details" — the reply half of the click-to-chat deep
 * link (see buildAppointmentWhatsAppLink) that every booking confirmation UI
 * shows across ALL channels, not just WhatsApp. This is checked before
 * anything else, regardless of conversation state, since a patient can send
 * it at any time (it's how they retrieve a website/chatbot booking's
 * confirmation on WhatsApp) — and critically, it's the PATIENT initiating,
 * so the bot's reply is a normal free-form session message, not a
 * business-initiated one requiring a pre-approved template.
 */
async function tryHandleShowAppointmentIntent(from: string, text: string): Promise<boolean> {
  const match = text.match(/show my appointment details\s*#?\s*([\d-]{10,})/i);
  if (!match) return false;

  const appointmentId = match[1];
  const appointment = findAppointmentById(appointmentId);

  if (!appointment) {
    await sendTextMessage(from, `Sorry, I couldn't find an appointment with ID #${appointmentId}. Please double-check the ID from your confirmation screen.`);
    return true;
  }

  if (appointment.status === 'confirmed') {
    let meetLine = '';
    if (appointment.consultationType === 'online-video') {
      meetLine = appointment.videoRoomUrl
        ? `\nGoogle Meet: ${appointment.videoRoomUrl}`
        : "\nGoogle Meet: pending — Dr. N. Sanchana is confirming availability for this slot and the link will be sent here the moment it's ready.";
    }
    await sendTextMessage(
      from,
      `✅ Appointment #${appointment.id}\n${appointment.serviceName}\n${appointment.doctorName}\n${appointment.date} at ${appointment.timeSlot}${meetLine}`
    );
    // A tappable choice instead of making the patient copy/remember a
    // reschedule code and type it back in.
    await sendReplyButtons(from, 'Need to make a change?', [
      { id: `reschedule:${appointment.id}`, title: 'Reschedule' },
      { id: `cancel:${appointment.id}`, title: 'Cancel Appointment' }
    ]);
  } else if (appointment.status === 'payment_failed') {
    await sendTextMessage(from, `Appointment #${appointment.id}: your payment didn't go through. Reply "retry" and I'll send a fresh payment link.`);
  } else {
    await sendTextMessage(from, `Appointment #${appointment.id} is still awaiting payment confirmation. This can take a minute after paying — try again shortly, or reply "retry" for a fresh payment link.`);
  }
  return true;
}

/**
 * Handles taps on the Reschedule / Cancel Appointment buttons sent above.
 * Checked by interactiveReplyId prefix rather than text, so it only fires on
 * an actual button tap, never on a coincidentally similar typed message.
 */
async function tryHandleAppointmentActionButton(from: string, interactiveReplyId: string | undefined): Promise<boolean> {
  if (!interactiveReplyId) return false;

  if (interactiveReplyId.startsWith('cancel:')) {
    const appointmentId = interactiveReplyId.slice('cancel:'.length);
    const result = await cancelAppointmentById(appointmentId);
    if (!result) {
      await sendTextMessage(from, "Sorry, I couldn't find that appointment to cancel.");
      return true;
    }
    await sendTextMessage(from, `Your appointment #${result.appointment.id} has been cancelled. Send "hi" anytime to book a new one.`);
    return true;
  }

  if (interactiveReplyId.startsWith('reschedule:')) {
    const appointmentId = interactiveReplyId.slice('reschedule:'.length);
    const result = await cancelAppointmentById(appointmentId);
    if (!result) {
      await sendTextMessage(from, "Sorry, I couldn't find that appointment to reschedule.");
      return true;
    }
    await sendTextMessage(from, `No problem — appointment #${result.appointment.id} has been released. Let's pick a new time.`);
    whatsappConversations.delete(from);
    await handleIncomingWhatsAppMessage(from, 'hi');
    return true;
  }

  return false;
}

async function handleIncomingWhatsAppMessage(from: string, text: string, contactName?: string, interactiveReplyId?: string): Promise<void> {
  if (await tryHandleAppointmentActionButton(from, interactiveReplyId)) return;
  if (await tryHandleShowAppointmentIntent(from, text)) return;

  const normalized = text.trim().toLowerCase();
  let state = whatsappConversations.get(from);
  const msg = { text, interactiveReplyId };

  const isGreeting = /\b(hi|hello|hey)\b/.test(normalized) || normalized.includes('book') || normalized.includes('appointment');

  if (!state || isGreeting) {
    state = { step: 'awaiting_category', contactName };
    whatsappConversations.set(from, state);
    await sendListMessage(
      from,
      "👋 Welcome to Vihana Dental Care! What kind of treatment are you looking for?",
      'Choose Category',
      [{ title: 'Treatment Categories', rows: SERVICE_CATEGORIES.map((c) => ({ id: `cat:${c}`, title: c })) }]
    );
    return;
  }

  if (state.step === 'awaiting_category') {
    const options = SERVICE_CATEGORIES.map((c) => ({ id: `cat:${c}`, label: c }));
    const picked = resolveSelection(msg, options);
    if (!picked) {
      await sendTextMessage(from, "Sorry, I didn't catch that — please tap one of the categories above.");
      return;
    }
    const category = picked.id.replace('cat:', '');
    const servicesInCategory = SERVICES.filter((s) => s.category === category);

    state.category = category;
    state.step = 'awaiting_service';
    await sendListMessage(
      from,
      `${category} treatments — which one?`,
      'Choose Treatment',
      [{ title: category, rows: servicesInCategory.map((s) => ({ id: `svc:${s.id}`, title: s.title, description: s.shortDescription })) }]
    );
    return;
  }

  if (state.step === 'awaiting_service') {
    const servicesInCategory = SERVICES.filter((s) => s.category === state!.category);
    const options = servicesInCategory.map((s) => ({ id: `svc:${s.id}`, label: s.title }));
    const picked = resolveSelection(msg, options);
    if (!picked) {
      await sendTextMessage(from, "Sorry, I didn't catch that — please tap one of the treatments above.");
      return;
    }
    const service = servicesInCategory.find((s) => `svc:${s.id}` === picked.id)!;

    state.serviceId = service.id;
    state.step = 'awaiting_date';
    await sendReplyButtons(
      from,
      `Great choice — ${service.title}. When would you like to come in?`,
      [
        { id: 'date:today', title: 'Today' },
        { id: 'date:tomorrow', title: 'Tomorrow' },
        { id: 'date:other', title: 'Pick a date' }
      ]
    );
    return;
  }

  if (state.step === 'awaiting_date') {
    let dateStr: string | undefined;

    if (interactiveReplyId === 'date:today') {
      dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    } else if (interactiveReplyId === 'date:tomorrow') {
      dateStr = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    } else if (interactiveReplyId === 'date:other') {
      await sendTextMessage(from, 'Sure — reply with the date as YYYY-MM-DD, e.g. 2026-08-20.');
      return;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      dateStr = normalized;
    } else {
      await sendTextMessage(from, 'Please send the date as YYYY-MM-DD, e.g. 2026-08-20, or tap one of the options above.');
      return;
    }

    const availability = await computeAvailability(dateStr);
    const availableSlots = availability.slots.filter((s) => s.available);
    if (availableSlots.length === 0) {
      await sendTextMessage(from, "We're fully booked that day. Please try a different date (reply YYYY-MM-DD).");
      return;
    }

    state.date = dateStr;

    // Split into Morning (before noon) / Evening so the time list always
    // fits WhatsApp's 10-row cap — skip straight to the list if only one
    // half has slots (e.g. Sundays only run a morning window).
    const morning = availableSlots.filter((s) => s.time.includes('AM') || s.time.startsWith('12:00 PM'));
    const evening = availableSlots.filter((s) => !morning.includes(s));

    if (morning.length > 0 && evening.length > 0) {
      state.step = 'awaiting_time_period';
      await sendReplyButtons(from, `Available on ${dateStr}. Morning or evening?`, [
        { id: 'period:Morning', title: 'Morning' },
        { id: 'period:Evening', title: 'Evening' }
      ]);
      return;
    }

    state.timePeriod = morning.length > 0 ? 'Morning' : 'Evening';
    state.step = 'awaiting_time';
    await sendListMessage(
      from,
      `Available times on ${dateStr}:`,
      'Choose Time',
      [{ title: state.timePeriod, rows: availableSlots.map((s) => ({ id: `time:${s.time}`, title: s.time })) }]
    );
    return;
  }

  if (state.step === 'awaiting_time_period') {
    const period = interactiveReplyId === 'period:Morning' ? 'Morning' : interactiveReplyId === 'period:Evening' ? 'Evening' : undefined;
    if (!period) {
      await sendTextMessage(from, 'Please tap "Morning" or "Evening" above.');
      return;
    }

    const availability = await computeAvailability(state.date!);
    const availableSlots = availability.slots.filter((s) => s.available);
    const filtered = period === 'Morning'
      ? availableSlots.filter((s) => s.time.includes('AM') || s.time.startsWith('12:00 PM'))
      : availableSlots.filter((s) => !(s.time.includes('AM') || s.time.startsWith('12:00 PM')));

    if (filtered.length === 0) {
      await sendTextMessage(from, `No ${period.toLowerCase()} slots left on ${state.date} — try the other half of the day.`);
      return;
    }

    state.timePeriod = period;
    state.step = 'awaiting_time';
    await sendListMessage(
      from,
      `${period} times on ${state.date}:`,
      'Choose Time',
      [{ title: period, rows: filtered.map((s) => ({ id: `time:${s.time}`, title: s.time })) }]
    );
    return;
  }

  if (state.step === 'awaiting_time') {
    const timeSlot = interactiveReplyId?.startsWith('time:') ? interactiveReplyId.slice('time:'.length) : text.trim();
    const slotCheck = await isSlotStillAvailable(state.date!, timeSlot);
    if (!slotCheck.valid && !slotCheck.degraded) {
      await sendTextMessage(from, 'Sorry, that slot was just taken. Please pick another time from the list above.');
      return;
    }

    const service = SERVICES.find((s) => s.id === state!.serviceId) || SERVICES[0];
    // Estimated treatment cost is pulled from the centralized pricing table
    // purely for display/transparency in the chat — matches the confirmed
    // product decision to charge the same small refundable slot-booking
    // deposit everywhere (website, chatbot, WhatsApp), not the full
    // treatment price, up front through an automated bot flow.
    const estimatedTreatmentCostDisplay = await getServicePriceDisplay(service.id);
    const depositINR = clinicFeeConfig.confirmationFeeEnabled ? clinicFeeConfig.inClinicFeeINR : 0;
    const appointmentId = generateDailyAppointmentId();
    const patientName = state.contactName || `WhatsApp Patient ${from.slice(-4)}`;

    if (depositINR <= 0) {
      await sendTextMessage(from, "Sorry, online booking deposits are temporarily disabled. Please call the clinic to book this appointment.");
      return;
    }

    const pendingAppointment: Appointment = {
      id: appointmentId,
      patientName,
      patientPhone: from,
      patientEmail: '',
      doctorId: DOCTORS[0].id,
      doctorName: DOCTORS[0].name,
      serviceId: service.id,
      serviceName: service.title,
      date: state.date!,
      timeSlot,
      notes: '',
      status: 'pending',
      googleCalendarSynced: false,
      whatsappConfirmationSent: false,
      whatsappReminderScheduled: false,
      rescheduleToken: `RSC-${Math.floor(10000 + Math.random() * 90000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      consultationType: 'in-clinic',
      paymentStatus: 'pending',
      feeAmount: depositINR,
      channel: 'whatsapp'
    };

    try {
      const link = await createPaymentLinkForAppointment(pendingAppointment, {
        amountINR: depositINR,
        description: `Vihana Dental Care — Appointment Deposit (${service.title})`,
        patientName,
        patientPhone: from
      });

      pendingAppointment.razorpayPaymentLinkId = link.paymentLinkId;
      appointmentsStorage.unshift(pendingAppointment);
      await persistAppointment(pendingAppointment);

      state.appointmentId = pendingAppointment.id;
      state.step = 'awaiting_payment';

      const costLine = estimatedTreatmentCostDisplay ? ` (estimated treatment cost: ${estimatedTreatmentCostDisplay})` : '';
      await sendTextMessage(
        from,
        `${service.title}${costLine} on ${state.date} at ${timeSlot}.\n\nAppointment ID: #${pendingAppointment.id}\nA refundable deposit of ₹${depositINR} confirms your slot — tap below to pay securely:\n${link.shortUrl}`
      );
    } catch (error: any) {
      console.error('WhatsApp payment link creation failed:', error?.message || error);
      await sendTextMessage(from, "Sorry, we couldn't generate a payment link right now. Please try again shortly or call the clinic directly.");
    }
    return;
  }

  if (state.step === 'awaiting_payment') {
    if (normalized === 'cancel') {
      whatsappConversations.delete(from);
      await sendTextMessage(from, 'No problem — booking cancelled. Send "hi" anytime to start again.');
      return;
    }

    if (normalized === 'retry' && state.appointmentId) {
      await retryWhatsAppPaymentLink(from, state.appointmentId);
      return;
    }

    await sendTextMessage(from, "We're still waiting for your payment to confirm this appointment. Complete the payment link sent above, reply \"retry\" for a fresh link, or \"cancel\" to start over.");
  }
}

/** Regenerates a payment link for a still-pending WhatsApp booking — used both by the patient typing "retry" and by the payment_link.expired webhook handler. */
async function retryWhatsAppPaymentLink(to: string, appointmentId: string): Promise<void> {
  const appointment = findAppointmentById(appointmentId);
  if (!appointment || appointment.status === 'confirmed') return;

  try {
    const link = await createPaymentLink({
      amountINR: appointment.feeAmount || clinicFeeConfig.inClinicFeeINR,
      description: `Vihana Dental Care — Appointment Deposit (${appointment.serviceName})`,
      patientName: appointment.patientName,
      patientPhone: to,
      receipt: appointment.id,
      referenceId: appointment.id
    });

    appointment.razorpayPaymentLinkId = link.paymentLinkId;
    appointment.paymentStatus = 'pending';
    appointment.updatedAt = new Date().toISOString();
    await persistAppointment(appointment);

    await sendTextMessage(to, `Here's a fresh payment link for appointment #${appointment.id} — ₹${link.amount / 100}.\n${link.shortUrl}`);
  } catch (error: any) {
    console.error('WhatsApp payment link retry failed:', error?.message || error);
    await sendTextMessage(to, "Sorry, we couldn't generate a new payment link right now. Please try again shortly or call the clinic directly.");
  }
}

// POST Appointment (Create pending online consultation or direct confirmed in-clinic booking)
// Direct/free booking path only (Module C — website CTA, no advance fee
// currently configured). Deliberately does NOT accept a client-supplied
// razorpayPaymentId/status — a booking that requires payment must go through
// /api/payments/create-order + /verify or /api/razorpay/create-payment-link
// + the webhook, both of which confirm payment server-side. Trusting a
// client-asserted "I paid" flag here would let anyone book for free.
app.post('/api/appointments', async (req, res) => {
  const {
    patientName, patientPhone, patientEmail, doctorId, serviceId,
    date, timeSlot, notes, caregiverPhone, consultationType, channel
  } = req.body;

  if (
    typeof patientName !== 'string' || !patientName.trim() ||
    typeof patientPhone !== 'string' || !patientPhone.trim() ||
    typeof date !== 'string' || !date.trim() ||
    typeof timeSlot !== 'string' || !timeSlot.trim()
  ) {
    return res.status(400).json({ error: "Missing or invalid required fields: patientName, patientPhone, date, timeSlot" });
  }

  const isOnline = consultationType === 'online-video';
  const feeAmount = clinicFeeConfig.confirmationFeeEnabled
    ? (isOnline ? clinicFeeConfig.onlineFeeINR : clinicFeeConfig.inClinicFeeINR)
    : 0;

  if (feeAmount > 0) {
    return res.status(400).json({
      success: false,
      error: 'An advance payment is required for this booking. Use the payment flow instead of booking directly.'
    });
  }

  const paymentStatus: 'waived' = 'waived';
  const bookingChannel: Appointment['channel'] = channel === 'whatsapp' || channel === 'chatbot' ? channel : 'website_cta';

  // Final server-side guard against a double-booked slot (the frontend already
  // calls /api/availability/confirm before payment, but that's a UX nicety —
  // this is the actual gate). Fails open on a degraded/unreachable Calendar so
  // a transient outage never blocks a booking outright.
  const slotCheck = await isSlotStillAvailable(date, timeSlot);
  if (!slotCheck.valid && !slotCheck.degraded) {
    return res.status(409).json({ success: false, error: slotCheck.message || 'That time slot is no longer available. Please pick another.' });
  }

  const doctor = DOCTORS.find(d => d.id === doctorId) || DOCTORS[0];
  const service = SERVICES.find(s => s.id === serviceId) || SERVICES[0];
  const rescheduleToken = `RSC-${Math.floor(10000 + Math.random() * 90000)}`;

  const newAppointment: Appointment = {
    id: generateDailyAppointmentId(),
    patientName,
    patientPhone,
    patientEmail: patientEmail || `${patientName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    serviceId: service.id,
    serviceName: service.title,
    date,
    timeSlot,
    notes: notes || '',
    status: 'confirmed',
    googleCalendarSynced: false,
    whatsappConfirmationSent: true,
    whatsappReminderScheduled: true,
    rescheduleToken,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    caregiverPhone,
    consultationType: isOnline ? 'online-video' : 'in-clinic',
    videoRoomUrl: undefined,
    onlineConsultStatus: isOnline ? 'pending_doctor_approval' : undefined,
    paymentStatus,
    paymentId: undefined,
    feeAmount,
    channel: bookingChannel
  };

  // Both consultation types sync to the calendar immediately on confirmation.
  // Online consults do NOT get a Meet link yet — the doctor may not actually
  // be free at the slot the patient picked, so the event goes in as
  // 'tentative' and a Meet link is only created once the doctor approves in
  // /doctor-admin (see approveOnlineConsult).
  const calendarSync = await syncAppointmentToCalendar(newAppointment);
  newAppointment.googleCalendarEventId = calendarSync.eventId;
  newAppointment.googleCalendarSynced = calendarSync.synced;
  newAppointment.videoRoomUrl = calendarSync.meetLink;

  appointmentsStorage.unshift(newAppointment);

  await recordConfirmedAppointment(newAppointment);

  res.json({
    success: true,
    appointment: newAppointment,
    calendarSync,
    message: "Appointment confirmed successfully.",
    whatsappLink: buildAppointmentWhatsAppLink(newAppointment.id, CLINIC_INFO.whatsapp)
  });
});

// Shared by the DELETE route (website self-service cancel/reschedule) and
// the WhatsApp bot's Reschedule/Cancel Appointment buttons.
async function cancelAppointmentById(idOrToken: string): Promise<{ appointment: Appointment } | null> {
  const appt = appointmentsStorage.find(a => a.id === idOrToken || a.rescheduleToken === idOrToken);
  if (!appt) return null;

  appt.status = 'cancelled';
  appt.updatedAt = new Date().toISOString();

  if (appt.googleCalendarSynced) {
    await cancelCalendarEvent(appt.googleCalendarEventId);
    appt.googleCalendarSynced = false;
  }

  await persistAppointment(appt);

  return { appointment: appt };
}

// DELETE Appointment (Cancel via ID or self-service reschedule token)
app.delete('/api/appointments/:id', async (req, res) => {
  const result = await cancelAppointmentById(req.params.id);

  if (!result) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  res.json({
    success: true,
    message: "Appointment cancelled and calendar updated.",
    cancelledAppointment: result.appointment
  });
});

// ---------------- DOCTOR ADMIN (fee editing only) ----------------

// Simple rate limiting for PIN attempts to slow down brute-forcing a 4-digit PIN.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  const ip = req.ip || 'unknown';

  const attempt = loginAttempts.get(ip);
  const now = Date.now();
  if (attempt && attempt.resetAt > now && attempt.count >= LOGIN_MAX_ATTEMPTS) {
    return res.status(429).json({ success: false, error: 'Too many attempts. Try again in a few minutes.' });
  }

  if (typeof pin !== 'string' || pin !== DOCTOR_ADMIN_PIN) {
    loginAttempts.set(ip, {
      count: attempt && attempt.resetAt > now ? attempt.count + 1 : 1,
      resetAt: attempt && attempt.resetAt > now ? attempt.resetAt : now + LOGIN_WINDOW_MS
    });
    return res.status(401).json({ success: false, error: 'Incorrect PIN.' });
  }

  loginAttempts.delete(ip);
  const token = crypto.randomBytes(24).toString('hex');
  adminSessions.set(token, now + ADMIN_SESSION_TTL_MS);
  res.json({ success: true, token, expiresInMs: ADMIN_SESSION_TTL_MS });
});

app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  adminSessions.delete(token);
  res.json({ success: true });
});

app.get('/api/admin/fee-config', requireAdminAuth, (req, res) => {
  res.json({ success: true, feeConfig: clinicFeeConfig });
});

app.patch('/api/admin/fee-config', requireAdminAuth, (req, res) => {
  const { confirmationFeeEnabled, inClinicFeeINR, onlineFeeINR } = req.body;

  if (inClinicFeeINR !== undefined && (typeof inClinicFeeINR !== 'number' || inClinicFeeINR < 0)) {
    return res.status(400).json({ success: false, error: 'inClinicFeeINR must be a non-negative number' });
  }
  if (onlineFeeINR !== undefined && (typeof onlineFeeINR !== 'number' || onlineFeeINR < 0)) {
    return res.status(400).json({ success: false, error: 'onlineFeeINR must be a non-negative number' });
  }

  clinicFeeConfig = {
    confirmationFeeEnabled: confirmationFeeEnabled !== undefined ? Boolean(confirmationFeeEnabled) : clinicFeeConfig.confirmationFeeEnabled,
    inClinicFeeINR: inClinicFeeINR !== undefined ? inClinicFeeINR : clinicFeeConfig.inClinicFeeINR,
    onlineFeeINR: onlineFeeINR !== undefined ? onlineFeeINR : clinicFeeConfig.onlineFeeINR
  };

  res.json({ success: true, feeConfig: clinicFeeConfig });
});

// ---------------- SERVICE PRICING (admin, Supabase-backed) ----------------
// DISPLAY ONLY — the treatment cost range shown on the public website and in
// the WhatsApp bot's "estimated cost" line. Never charged through any route;
// the only amount ever actually charged anywhere is clinicFeeConfig's flat
// advance booking fee (the separate "Booking Advance Fees" admin card).
// Falls back to the static map in server/services/pricing.ts when Supabase
// isn't configured, so GET still works (read-only) before credentials exist.
app.get('/api/admin/service-pricing', requireAdminAuth, async (req, res) => {
  const prices = await getAllServicePriceDisplays();
  res.json({ success: true, prices });
});

app.patch('/api/admin/service-pricing', requireAdminAuth, async (req, res) => {
  const { serviceId, priceRangeDisplay } = req.body;

  if (typeof serviceId !== 'string' || !serviceId.trim()) {
    return res.status(400).json({ success: false, error: 'serviceId is required.' });
  }
  if (typeof priceRangeDisplay !== 'string' || !priceRangeDisplay.trim()) {
    return res.status(400).json({ success: false, error: 'priceRangeDisplay must be a non-empty string, e.g. "₹22,000 - ₹45,000 per implant".' });
  }

  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) {
    return res.status(404).json({ success: false, error: `Unknown serviceId: ${serviceId}` });
  }

  const result = await setServicePriceDisplay(serviceId, service.title, priceRangeDisplay.trim());
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error || 'Supabase is not configured yet — set SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY to enable editing prices.' });
  }

  res.json({ success: true, serviceId, priceRangeDisplay: priceRangeDisplay.trim() });
});

// ---------------- BLOG (admin writes) ----------------
app.get('/api/admin/blog', requireAdminAuth, async (req, res) => {
  const posts = await listBlogPosts();
  res.json({ success: true, posts });
});

app.post('/api/admin/blog', requireAdminAuth, async (req, res) => {
  const { title, content, author, imageUrl } = req.body;

  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ success: false, error: 'title is required.' });
  }
  if (typeof content !== 'string' || !content.trim()) {
    return res.status(400).json({ success: false, error: 'content is required.' });
  }
  if (typeof author !== 'string' || !author.trim()) {
    return res.status(400).json({ success: false, error: 'author is required.' });
  }
  if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
    return res.status(400).json({ success: false, error: 'imageUrl is required.' });
  }

  const result = await createBlogPost({ title: title.trim(), content: content.trim(), author: author.trim(), imageUrl });
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error || 'Could not save this post.' });
  }
  res.json({ success: true, post: result.post });
});

app.patch('/api/admin/blog/:id', requireAdminAuth, async (req, res) => {
  const { title, content, author, imageUrl } = req.body;
  const existing = await getBlogPostById(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Post not found.' });
  }

  const result = await updateBlogPost(req.params.id, {
    ...(typeof title === 'string' && title.trim() ? { title: title.trim() } : {}),
    ...(typeof content === 'string' && content.trim() ? { content: content.trim() } : {}),
    ...(typeof author === 'string' && author.trim() ? { author: author.trim() } : {}),
    ...(typeof imageUrl === 'string' && imageUrl.trim() ? { imageUrl } : {})
  });
  if (!result.success) {
    return res.status(502).json({ success: false, error: result.error || 'Could not save changes.' });
  }
  res.json({ success: true, post: result.post });
});

app.delete('/api/admin/blog/:id', requireAdminAuth, async (req, res) => {
  const result = await deleteBlogPost(req.params.id);
  if (!result.success) {
    return res.status(404).json({ success: false, error: result.error || 'Post not found.' });
  }
  res.json({ success: true });
});

// ---------------- ONLINE CONSULT APPROVAL ----------------
// Online video consults never get an auto-generated Meet link at booking
// time — the doctor may not actually be free at the slot the patient picked.
// The calendar event goes in as 'tentative'; these endpoints let the doctor
// review and either approve (generates the Meet link, notifies the patient
// on WhatsApp) or release the slot so the patient can pick another time.

app.get('/api/admin/pending-online-consults', requireAdminAuth, (req, res) => {
  const pending = appointmentsStorage.filter(
    (a) => a.consultationType === 'online-video' && a.status === 'confirmed' && a.onlineConsultStatus === 'pending_doctor_approval'
  );
  res.json({ success: true, appointments: pending });
});

app.post('/api/admin/online-consults/:id/approve', requireAdminAuth, async (req, res) => {
  const appointment = findAppointmentById(req.params.id);
  if (!appointment) {
    return res.status(404).json({ success: false, error: 'Appointment not found.' });
  }
  if (appointment.consultationType !== 'online-video') {
    return res.status(400).json({ success: false, error: 'Not an online consultation.' });
  }

  const result = await approveOnlineConsult(appointment.googleCalendarEventId, `${appointment.serviceName} — ${appointment.patientName}`);
  if (!result.approved) {
    return res.status(502).json({ success: false, error: result.error || 'Could not approve this consult right now.' });
  }

  appointment.onlineConsultStatus = 'approved';
  appointment.videoRoomUrl = result.meetLink;
  appointment.updatedAt = new Date().toISOString();
  await persistAppointment(appointment);

  // Best-effort — only lands if the patient's WhatsApp session is open
  // (e.g. they booked via the WhatsApp bot, or already sent "Show my
  // appointment details" recently). Either way, the Meet link is now saved
  // on the appointment, so the same "Show my appointment details" retrieval
  // flow will include it from this point on regardless of channel.
  if (result.meetLink) {
    await sendTextMessage(
      appointment.patientPhone,
      `✅ Dr. ${appointment.doctorName.replace(/^Dr\.?\s*/i, '')} has confirmed your online consult on ${appointment.date} at ${appointment.timeSlot}.\n\nGoogle Meet: ${result.meetLink}`
    );
  }

  res.json({ success: true, appointment });
});

app.post('/api/admin/online-consults/:id/reschedule', requireAdminAuth, async (req, res) => {
  const result = await cancelAppointmentById(req.params.id);
  if (!result) {
    return res.status(404).json({ success: false, error: 'Appointment not found.' });
  }

  await sendTextMessage(
    result.appointment.patientPhone,
    `We're sorry — Dr. ${result.appointment.doctorName.replace(/^Dr\.?\s*/i, '')} isn't available at the time you picked for appointment #${result.appointment.id}. Your slot has been released — please send "hi" here to pick a new time, or book again on our website.`
  );

  res.json({ success: true, appointment: result.appointment });
});

// ---------------- GOOGLE CALENDAR CONNECT (OAuth one-time setup) ----------------
// GET, not POST: the browser navigates here directly (Google's own redirect
// flow), so it can't carry an Authorization header. Auth is instead enforced
// by requiring the caller to have first hit /google-connect (which IS
// PIN-gated) to mint a valid `state` — the callback below rejects anything
// without a state it issued itself.
const oauthStates = new Map<string, number>(); // state -> expiresAt
const OAUTH_STATE_TTL_MS = 5 * 60 * 1000;

app.get('/api/admin/google-status', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    connected: isGoogleCalendarConfigured(),
    clientConfigured: isGoogleOAuthClientConfigured()
  });
});

app.get('/api/admin/google-connect', requireAdminAuth, (req, res) => {
  if (!isGoogleOAuthClientConfigured()) {
    return res.status(400).json({
      success: false,
      error: 'GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REDIRECT_URI are not set yet.'
    });
  }

  const state = crypto.randomBytes(16).toString('hex');
  oauthStates.set(state, Date.now() + OAUTH_STATE_TTL_MS);
  res.json({ success: true, url: getGoogleOAuthConsentUrl(state) });
});

app.get('/api/admin/google-oauth-callback', async (req, res) => {
  const { code, state, error } = req.query;

  const htmlPage = (title: string, bodyHtml: string) => `<!doctype html>
<html><head><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 60px auto; padding: 0 20px; color: #1e293b;">
${bodyHtml}
</body></html>`;

  if (error) {
    return res.status(400).send(htmlPage('Connection cancelled', `<h2>Connection cancelled</h2><p>${error}</p><p>Close this tab and try again from the doctor admin panel.</p>`));
  }

  if (typeof state !== 'string' || !oauthStates.has(state)) {
    return res.status(400).send(htmlPage('Link expired', `<h2>This connection link has expired or was already used</h2><p>Go back to the doctor admin panel and click "Connect Google Calendar" again.</p>`));
  }
  oauthStates.delete(state);

  if (typeof code !== 'string') {
    return res.status(400).send(htmlPage('Missing authorization code', `<h2>Something went wrong</h2><p>Google did not return an authorization code. Please try again.</p>`));
  }

  const result = await exchangeGoogleOAuthCode(code);
  if (result.error || !result.refreshToken) {
    return res.status(500).send(htmlPage('Connection failed', `<h2>Could not complete the connection</h2><p>${result.error || 'Unknown error.'}</p>`));
  }

  res.send(htmlPage('Google Calendar Connected', `
    <h2>✅ Google Calendar Connected</h2>
    <p>Copy this value into your <code>.env</code> file as <code>GOOGLE_CALENDAR_REFRESH_TOKEN</code>, then restart the server:</p>
    <pre style="background:#f1f5f9;padding:16px;border-radius:8px;word-break:break-all;white-space:pre-wrap;">${result.refreshToken}</pre>
    <p style="color:#b91c1c;font-weight:600;">Treat this like a password — don't share it or commit it to version control.</p>
    <p>You can close this tab once it's saved.</p>
  `));
});

// POST Inquiry
app.post('/api/inquiries', (req, res) => {
  const { name, email, phone, service, message } = req.body;
  if (
    typeof name !== 'string' || !name.trim() ||
    typeof phone !== 'string' || !phone.trim() ||
    typeof message !== 'string' || !message.trim()
  ) {
    return res.status(400).json({ error: "Name, phone and message are required" });
  }

  const newInquiry: Inquiry = {
    id: `INQ-${Math.floor(100 + Math.random() * 900)}`,
    name,
    email: email || '',
    phone,
    service: service || 'General Consultation',
    message,
    status: 'new',
    createdAt: new Date().toISOString()
  };

  inquiriesStorage.unshift(newInquiry);

  res.json({ success: true, inquiry: newInquiry });
});

// POST Gemini WhatsApp Bot API Endpoint
app.post('/api/gemini/whatsapp-bot', async (req, res) => {
  const { userMessage, conversationHistory } = req.body;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("Gemini API key is not configured.");
    }

    const systemInstruction = `You are VihanaBot, the official AI WhatsApp assistant for Vihana Dental Care in Kalapatti, Coimbatore.
Clinic Details:
- Name: Vihana Dental Care
- Location: No 77, Post Office Street, Kalapatti, Coimbatore
- Phone: +91 98943 17823
- Chief Doctor: Dr. N. Sanchana (Orthodontist & Aligner Specialist)
- Services offered: Dental Implants, Invisalign Aligners, Laser Root Canal, Cosmetic Smile Design, Teeth Whitening, Pediatric Care, Wisdom Tooth Surgery, Zirconia Crowns, Online Video Consultations.`;

    const prompt = `User WhatsApp Message: "${userMessage}"
Conversation context: ${JSON.stringify(conversationHistory || [])}
Provide a helpful, friendly WhatsApp auto-reply.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    const replyText = response.text || "Hello! Thank you for reaching out to Vihana Dental Care, Coimbatore. How can we assist with your smile today?";

    res.json({
      replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  } catch (error) {
    let fallbackReply = `Hello! Thank you for contacting *Vihana Dental Care, Kalapatti, Coimbatore*. 🦷\n\nHow can we assist you today? You can book an in-clinic or online video consultation, check our services, or speak with our team at *+91 98943 17823*.`;

    const msg = (userMessage || "").toLowerCase();
    if (msg.includes("book") || msg.includes("appointment") || msg.includes("timing") || msg.includes("video")) {
      fallbackReply = `🦷 *Vihana Dental Care Booking*\n\nWe offer both In-Clinic visits and Secure Online Video Consultations with Dr. N. Sanchana, MDS.\n\nClick [ACTION:BOOK_APPOINTMENT] below to pick your slot!`;
    }

    res.json({
      replyText: fallbackReply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }
});

// POST Gemini Booking Widget Intent Endpoint — strictly scoped to appointment
// booking. Only classifies free-text into one of a fixed set of actions the
// widget's own deterministic state machine already knows how to handle; the
// model never invents dates, fees, or appointment details itself.
const BOOKING_BOT_ALLOWED_ACTIONS = ['START_BOOKING', 'CHECK_AVAILABILITY', 'RESCHEDULE_CANCEL', 'FAQ_ANSWER', 'OFF_TOPIC_REDIRECT'] as const;

app.post('/api/gemini/booking-bot', async (req, res) => {
  const { userMessage } = req.body;

  if (typeof userMessage !== 'string' || !userMessage.trim()) {
    return res.status(400).json({ error: "userMessage is required" });
  }

  const fallback = {
    action: 'OFF_TOPIC_REDIRECT' as const,
    reply: "I can help with booking, availability, rescheduling, or cancelling your Vihana Dental Care appointment. What would you like to do?"
  };

  try {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("Gemini API key is not configured.");
    }

    const systemInstruction = `You are the appointment-booking assistant for Vihana Dental Care, Kalapatti, Coimbatore. You ONLY help with: booking appointments, checking availability, rescheduling/cancelling, and short factual FAQ about the clinic's services, doctor, hours, or fees.

You must NEVER invent appointment details, dates, prices, or medical advice. You do not have live calendar or pricing data — the app UI shows that separately.

Respond ONLY with strict JSON: {"action": one of ${JSON.stringify(BOOKING_BOT_ALLOWED_ACTIONS)}, "reply": a short (1-2 sentence) friendly reply}.
- Use START_BOOKING if the user wants to book/schedule an appointment.
- Use CHECK_AVAILABILITY if they ask about open slots/timings.
- Use RESCHEDULE_CANCEL if they want to change or cancel an existing appointment.
- Use FAQ_ANSWER for general questions about services, the doctor, hours, or location — answer briefly and factually using only: Services — Dental Implants, Invisalign, Laser Root Canal, Cosmetic Smile Design, Teeth Whitening, Pediatric Care, Wisdom Tooth Surgery, Zirconia Crowns, Braces; Doctor — Dr. N. Sanchana, MDS (Orthodontist); Hours — Mon-Sat 9:00 AM-1:30 PM & 5:00 PM-8:30 PM, Sun 10:30 AM-1:00 PM.
- Use OFF_TOPIC_REDIRECT for anything unrelated to this clinic's appointment booking (including medical diagnosis requests, unrelated small talk, or requests outside this scope) — politely redirect back to booking topics without answering the off-topic part.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `User message: "${userMessage}"`,
      config: {
        systemInstruction,
        temperature: 0.3,
        responseMimeType: "application/json"
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    if (!BOOKING_BOT_ALLOWED_ACTIONS.includes(parsed.action) || typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
      throw new Error('Malformed model response');
    }

    res.json({ action: parsed.action, reply: parsed.reply });
  } catch (error) {
    console.error("Booking bot intent classification failed:", error);
    res.json(fallback);
  }
});

// Global JSON error handler — catches synchronous throws in route handlers
// (e.g. malformed request bodies) so callers always get a clean JSON error
// instead of Express's default HTML stack-trace page. Must be registered
// after every route above, since Express only routes errors to handlers
// declared later in the middleware chain.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled API error:', err);
  if (res.headersSent) return next(err);
  res.status(err?.status || 500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ---------------- VITE & EXPRESS BOOT ----------------

async function startServer() {
  // Rehydrate from Supabase before accepting any requests — without this,
  // every restart/redeploy would silently wipe the in-memory appointment
  // list back to the two static demo entries. Once real persisted data
  // exists, it fully replaces the demo seed rather than merging with it.
  if (isAppointmentsPersistenceConfigured()) {
    appointmentsStorage = await loadAllAppointments();
    console.log(`Loaded ${appointmentsStorage.length} persisted appointment(s) from Supabase.`);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vihana Dental Care App server running on http://localhost:${PORT}`);
  });
}

startServer();
