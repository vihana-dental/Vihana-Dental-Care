import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Appointment, Inquiry } from './src/types';
import { SERVICES, DOCTORS, CLINIC_INFO } from './src/data/clinicData';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Global Config for Separate In-Clinic & Online Consultation Fees
let clinicFeeConfig = {
  confirmationFeeEnabled: true,
  inClinicFeeINR: 300, // Default ₹300 advance for in-clinic visits
  onlineFeeINR: 500,     // Default ₹500 advance for online video consults
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || "rzp_test_mockkey123",
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || "mocksecretkeyabc"
};

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
    feeAmount: 300
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
    feeAmount: 500
  }
];

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

// Strips server-only secrets before any fee config is sent to a client
function getPublicFeeConfig() {
  const { razorpayKeySecret, ...publicConfig } = clinicFeeConfig;
  return publicConfig;
}

// ---------------- API ROUTES ----------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', clinic: CLINIC_INFO.name, timestamp: new Date().toISOString() });
});

// GOOGLE PLACES: Live Reviews (server-side proxy — Places API has no CORS support for browsers)
let placesReviewsCache: { data: any; timestamp: number } | null = null;
const PLACES_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

app.get('/api/google-reviews', async (req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
  const placeId = process.env.GOOGLE_PLACE_ID || '';

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

// GET Clinic Data
app.get('/api/clinic-info', (req, res) => {
  res.json({
    info: CLINIC_INFO,
    services: SERVICES,
    doctors: DOCTORS,
    feeConfig: getPublicFeeConfig()
  });
});

// RAZORPAY: Create Order Endpoint with Dual Fee Support
app.post('/api/razorpay/create-order', (req, res) => {
  const { consultationType, receipt } = req.body;

  const fee = consultationType === 'online-video'
    ? clinicFeeConfig.onlineFeeINR
    : clinicFeeConfig.inClinicFeeINR;

  const orderAmount = fee * 100; // Amount in paisa
  const mockOrderId = `order_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;

  res.json({
    success: true,
    order: {
      id: mockOrderId,
      amount: orderAmount,
      currency: "INR",
      receipt: receipt || `rcpt_${Date.now()}`
    },
    keyId: clinicFeeConfig.razorpayKeyId
  });
});

// POST Appointment (Create pending online consultation or direct confirmed in-clinic booking)
app.post('/api/appointments', (req, res) => {
  const {
    patientName, patientPhone, patientEmail, doctorId, serviceId,
    date, timeSlot, notes, caregiverPhone, consultationType,
    razorpayPaymentId, razorpayOrderId
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
  let paymentStatus: 'paid' | 'pending' | 'waived' = 'waived';
  let feeAmount = 0;

  if (clinicFeeConfig.confirmationFeeEnabled) {
    feeAmount = isOnline ? clinicFeeConfig.onlineFeeINR : clinicFeeConfig.inClinicFeeINR;
    if (razorpayPaymentId) {
      paymentStatus = 'paid';
    } else {
      paymentStatus = 'pending';
    }
  }

  const doctor = DOCTORS.find(d => d.id === doctorId) || DOCTORS[0];
  const service = SERVICES.find(s => s.id === serviceId) || SERVICES[0];
  const rescheduleToken = `RSC-${Math.floor(10000 + Math.random() * 90000)}`;

  const initialStatus = isOnline ? 'pending_approval' : 'confirmed';
  const calendarEventId = isOnline ? undefined : `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const videoRoomUrl = undefined;

  const newAppointment: Appointment = {
    id: `APT-${Math.floor(1000 + Math.random() * 9000)}`,
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
    status: initialStatus,
    googleCalendarEventId: calendarEventId,
    googleCalendarSynced: !isOnline,
    whatsappConfirmationSent: !isOnline,
    whatsappReminderScheduled: !isOnline,
    rescheduleToken,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    caregiverPhone,
    consultationType: isOnline ? 'online-video' : 'in-clinic',
    videoRoomUrl,
    paymentStatus,
    paymentId: razorpayPaymentId || `pay_mock_${Date.now()}`,
    feeAmount
  };

  appointmentsStorage.unshift(newAppointment);

  res.json({
    success: true,
    appointment: newAppointment,
    requiresApproval: isOnline,
    message: isOnline
      ? "Payment received! Your online consultation request has been sent to Dr. N. Sanchana for approval."
      : "Appointment confirmed successfully."
  });
});

// DELETE Appointment (Cancel via ID or self-service reschedule token)
app.delete('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const apptIndex = appointmentsStorage.findIndex(a => a.id === id || a.rescheduleToken === id);

  if (apptIndex === -1) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  const appt = appointmentsStorage[apptIndex];
  appt.status = 'cancelled';
  appt.updatedAt = new Date().toISOString();

  res.json({
    success: true,
    message: "Appointment cancelled and calendar updated.",
    cancelledAppointment: appt
  });
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

// POST Gemini Patient Symptom Advice (AI Triage Assistant)
app.post('/api/gemini/patient-advice', async (req, res) => {
  const { symptomDescription } = req.body;

  if (typeof symptomDescription !== 'string' || !symptomDescription.trim()) {
    return res.status(400).json({ error: "symptomDescription is required" });
  }

  const fallbackAdvice = `Thank you for describing your symptoms. While we can't provide a diagnosis online, we recommend booking an in-person or online video consultation with Dr. N. Sanchana at Vihana Dental Care so we can assess this properly. Call ${CLINIC_INFO.phone} for urgent concerns.`;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("Gemini API key is not configured.");
    }

    const systemInstruction = `You are a preliminary dental triage assistant for Vihana Dental Care, Kalapatti, Coimbatore. Given a patient's described symptoms, provide brief, cautious, non-diagnostic guidance (2-4 sentences): possible general causes, simple safe home-care tips if appropriate, and urgency level. Always end by recommending an in-person or online consultation with Dr. N. Sanchana — never provide a definitive diagnosis or prescribe medication.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Patient describes: "${symptomDescription}"`,
      config: { systemInstruction, temperature: 0.6 }
    });

    res.json({ advice: response.text || fallbackAdvice });
  } catch (error) {
    console.error("Gemini patient-advice failed:", error);
    res.json({ advice: fallbackAdvice });
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
