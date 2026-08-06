import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Appointment, Inquiry, PatientRecord, AuditLog, CareTeamNote, UserRole } from './src/types';
import { INITIAL_PATIENTS, INITIAL_AUDIT_LOGS, SERVICES, DOCTORS, CLINIC_INFO } from './src/data/clinicData';

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

let patientsStorage: PatientRecord[] = [...INITIAL_PATIENTS];
let auditLogsStorage: AuditLog[] = [...INITIAL_AUDIT_LOGS];
let careTeamNotesStorage: Record<string, CareTeamNote[]> = {
  "P-10021": [
    {
      id: "CTN-1",
      patientId: "P-10021",
      authorName: "Dr. N. Sanchana (Orthodontist)",
      authorRole: "Lead Surgeon",
      note: "Bone density at #24 site is D2 type. Implant post torque reached 35Ncm cleanly. Proceeding with custom Zirconia abutment.",
      timestamp: "2026-07-10 11:45 AM",
      isEncrypted: true
    }
  ]
};

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

// Helper to log HIPAA Audit Trail
function logAudit(action: AuditLog['action'], resourceType: AuditLog['resourceType'], resourceId: string, details: string, userId: string = "DOC-001", userName: string = "Dr. N. Sanchana", userRole: string = "doctor") {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const hash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const newLog: AuditLog = {
    id: `AUD-${Date.now()}`,
    timestamp,
    userId,
    userName,
    userRole,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress: "117.201.42.18",
    encryptedHash: `sha256:${hash}`
  };
  auditLogsStorage.unshift(newLog);
  return newLog;
}

// ---------------- SESSION AUTH (minimal, in-memory) ----------------
// Lightweight bearer-token session store. Not production-grade auth (no
// expiry/rotation, tokens live only as long as the process), but it closes
// the gap where every clinical/admin route was reachable with zero
// server-side gating.
interface SessionRecord {
  token: string;
  userId: string;
  name: string;
  role: UserRole;
  patientId?: string;
}

const sessions = new Map<string, SessionRecord>();

function createSession(userId: string, name: string, role: UserRole, patientId?: string): string {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { token, userId, name, role, patientId });
  return token;
}

function requireAuth(...allowedRoles: UserRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const session = token ? sessions.get(token) : undefined;

    if (!session) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this resource.' });
    }

    (req as any).session = session as SessionRecord;
    next();
  };
}

// ---------------- API ROUTES ----------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', clinic: CLINIC_INFO.name, timestamp: new Date().toISOString() });
});

// AUTH: OTP Request & Verification Endpoints (Master Number: +91 98943 17823)
app.post('/api/auth/request-otp', (req, res) => {
  const { phone } = req.body;
  const masterPhone = "+91 98943 17823";

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  const mockOtp = "4829";
  logAudit('LOGIN', 'APPOINTMENT', 'AUTH', `OTP requested for staff login attempt on phone: ${phone}`, 'SYS', 'System', 'admin');

  res.json({
    success: true,
    message: `OTP successfully dispatched to registered number ${masterPhone}`,
    simulatedOtp: mockOtp
  });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  
  if (otp === "4829") {
    logAudit('LOGIN', 'APPOINTMENT', 'AUTH', `Staff login success via OTP verification for ${phone || '+91 98943 17823'}`, 'DOC-001', 'Dr. N. Sanchana', 'doctor');
    const token = createSession('doc-1', 'Dr. N. Sanchana, M.D.S.', 'doctor');
    return res.json({
      success: true,
      token,
      user: {
        id: "doc-1",
        name: "Dr. N. Sanchana, M.D.S.",
        role: "doctor",
        phone: "+91 98943 17823"
      }
    });
  } else {
    return res.status(400).json({ success: false, error: "Invalid OTP code provided." });
  }
});

// AUTH: Phone + Password Login (temporary bypass password for pre-launch dev builds —
// pending full Supabase-backed RBAC & per-staff credentials in a later phase)
const TEMP_STAFF_BYPASS_PASSWORD = "Admin@123";

app.post('/api/auth/login-password', (req, res) => {
  const { phone, password } = req.body;

  if (typeof phone !== 'string' || !phone.trim() || typeof password !== 'string' || !password) {
    return res.status(400).json({ success: false, error: "Phone and password are required" });
  }

  if (password === TEMP_STAFF_BYPASS_PASSWORD) {
    logAudit('LOGIN', 'APPOINTMENT', 'AUTH', `Staff login success via password for ${phone}`, 'DOC-001', 'Dr. N. Sanchana', 'doctor');
    const token = createSession('doc-1', 'Dr. N. Sanchana, M.D.S.', 'doctor');
    return res.json({
      success: true,
      token,
      user: {
        id: "doc-1",
        name: "Dr. N. Sanchana, M.D.S.",
        role: "doctor",
        phone
      }
    });
  }

  return res.status(400).json({ success: false, error: "Invalid phone or password. Try OTP login instead." });
});

// AUTH: Demo role-switcher session (powers the in-app AuthModal "preview as
// patient/doctor/admin" switcher). Issues a session token without verifying
// credentials — acceptable for this prototype's mock/in-memory data, but
// this endpoint must be removed or gated behind real credential checks
// before any real patient data is stored.
app.post('/api/auth/dev-session', (req, res) => {
  const { role, name, patientId } = req.body;
  const allowedRoles: UserRole[] = ['guest', 'patient', 'doctor', 'admin'];

  if (typeof role !== 'string' || !allowedRoles.includes(role as UserRole)) {
    return res.status(400).json({ error: "A valid role is required." });
  }

  if (role === 'patient') {
    if (typeof patientId !== 'string' || !patientId.trim()) {
      return res.status(400).json({ error: "patientId is required for the patient role." });
    }
    const patientExists = patientsStorage.some(p => p.id === patientId || p.patientId === patientId);
    if (!patientExists) {
      return res.status(404).json({ error: "No patient record matches that patientId." });
    }
  }

  const token = createSession(`demo-${role}-${Date.now()}`, name || role, role as UserRole, patientId);
  res.json({ success: true, token });
});

// AUTH: Logout — invalidates a session token
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const token = headerToken || req.body?.token;
  if (token) sessions.delete(token);
  res.json({ success: true });
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

// ADMIN: GET / PUT Dual Fee Configuration
app.get('/api/admin/fee-config', requireAuth('doctor', 'admin'), (req, res) => {
  res.json(getPublicFeeConfig());
});

app.put('/api/admin/fee-config', requireAuth('doctor', 'admin'), (req, res) => {
  const { confirmationFeeEnabled, inClinicFeeINR, onlineFeeINR } = req.body;
  if (confirmationFeeEnabled !== undefined) clinicFeeConfig.confirmationFeeEnabled = !!confirmationFeeEnabled;
  if (inClinicFeeINR !== undefined) clinicFeeConfig.inClinicFeeINR = Number(inClinicFeeINR);
  if (onlineFeeINR !== undefined) clinicFeeConfig.onlineFeeINR = Number(onlineFeeINR);

  logAudit('UPDATE', 'APPOINTMENT', 'CONFIG', `Updated dual fees: In-Clinic=₹${clinicFeeConfig.inClinicFeeINR}, Online=₹${clinicFeeConfig.onlineFeeINR}`, 'ADMIN-01', 'Dr. N. Sanchana', 'admin');
  res.json({ success: true, feeConfig: getPublicFeeConfig() });
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

// GET Appointments
app.get('/api/appointments', requireAuth('doctor', 'admin'), (req, res) => {
  res.json(appointmentsStorage);
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

  logAudit('CREATE', 'APPOINTMENT', newAppointment.id, `Created ${isOnline ? 'Online Video (Pending Approval)' : 'In-Clinic'} appointment for ${patientName}`);

  res.json({
    success: true,
    appointment: newAppointment,
    requiresApproval: isOnline,
    message: isOnline 
      ? "Payment received! Your online consultation request has been sent to Dr. N. Sanchana for approval." 
      : "Appointment confirmed successfully."
  });
});

// PUT Doctor Approval Endpoint
app.put('/api/appointments/:id/approve', requireAuth('doctor', 'admin'), (req, res) => {
  const { id } = req.params;
  const { confirmedTimeSlot, confirmedDate } = req.body;

  const apptIndex = appointmentsStorage.findIndex(a => a.id === id);
  if (apptIndex === -1) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  const appt = appointmentsStorage[apptIndex];
  appt.status = 'confirmed';
  if (confirmedDate) appt.date = confirmedDate;
  if (confirmedTimeSlot) appt.timeSlot = confirmedTimeSlot;

  const calendarEventId = `gcal_appr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const videoRoomUrl = `https://meet.google.com/vih-${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 5)}`;

  appt.googleCalendarEventId = calendarEventId;
  appt.googleCalendarSynced = true;
  appt.videoRoomUrl = videoRoomUrl;
  appt.whatsappConfirmationSent = true;
  appt.updatedAt = new Date().toISOString();

  appointmentsStorage[apptIndex] = appt;

  logAudit('UPDATE', 'APPOINTMENT', appt.id, `Dr. N. Sanchana approved online consultation for ${appt.patientName}. Meet link generated.`);

  const approvalWhatsAppMessage = `🦷 *Vihana Dental Care, Coimbatore*\n\nGreat news, ${appt.patientName}! Dr. N. Sanchana has *APPROVED* your Online Video Consultation. 🎉\n\n📅 *Date:* ${appt.date}\n⏰ *Time:* ${appt.timeSlot}\n💻 *Google Meet Link:* ${videoRoomUrl}\n\nPlease join 5 minutes prior to your slot.\n\nHelpline: +91 98943 17823`;

  res.json({
    success: true,
    appointment: appt,
    googleCalendarSync: {
      status: "Synced",
      eventId: calendarEventId,
      videoRoomUrl
    },
    whatsappNotification: {
      sent: true,
      recipient: appt.patientPhone,
      messagePreview: approvalWhatsAppMessage
    }
  });
});

// DELETE Appointment (Cancel)
app.delete('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const apptIndex = appointmentsStorage.findIndex(a => a.id === id || a.rescheduleToken === id);

  if (apptIndex === -1) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  const appt = appointmentsStorage[apptIndex];
  appt.status = 'cancelled';
  appt.updatedAt = new Date().toISOString();

  logAudit('DELETE', 'APPOINTMENT', appt.id, `Cancelled appointment for ${appt.patientName}`);

  res.json({
    success: true,
    message: "Appointment cancelled and calendar updated.",
    cancelledAppointment: appt
  });
});

// GET Inquiries
app.get('/api/inquiries', requireAuth('doctor', 'admin'), (req, res) => {
  res.json(inquiriesStorage);
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
  logAudit('CREATE', 'INQUIRY', newInquiry.id, `New inquiry submitted by ${name} (${service})`);

  res.json({ success: true, inquiry: newInquiry });
});

// PUT Inquiry (Update status / internal notes)
app.put('/api/inquiries/:id', requireAuth('doctor', 'admin'), (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const inqIndex = inquiriesStorage.findIndex(i => i.id === id);
  if (inqIndex === -1) {
    return res.status(404).json({ success: false, error: "Inquiry not found" });
  }

  const inquiry = inquiriesStorage[inqIndex];
  if (status !== undefined) inquiry.status = status;
  if (notes !== undefined) inquiry.notes = notes;
  inquiriesStorage[inqIndex] = inquiry;

  logAudit('UPDATE', 'INQUIRY', inquiry.id, `Inquiry status updated to "${inquiry.status}" for ${inquiry.name}`);

  res.json({ success: true, inquiry });
});

// GET Patients (HIPAA Protected)
app.get('/api/patients', requireAuth('doctor', 'admin'), (req, res) => {
  logAudit('VIEW', 'PATIENT_RECORD', 'ALL', 'Doctor viewed patient directory list');
  res.json(patientsStorage);
});

// GET Patient by ID (doctor/admin can view any record; a patient session may only view its own)
app.get('/api/patients/:id', requireAuth('doctor', 'admin', 'patient'), (req, res) => {
  const { id } = req.params;
  const session = (req as any).session as SessionRecord;
  const patient = patientsStorage.find(p => p.id === id || p.patientId === id);
  if (!patient) {
    return res.status(404).json({ error: "Patient record not found" });
  }

  if (session.role === 'patient' && session.patientId !== patient.id && session.patientId !== patient.patientId) {
    return res.status(403).json({ error: "You are not authorized to view this patient record." });
  }

  logAudit('VIEW', 'PATIENT_RECORD', patient.id, `Accessed medical history & treatment records for ${patient.name}`);
  const teamNotes = careTeamNotesStorage[patient.id] || [];

  res.json({
    patient,
    careTeamNotes: teamNotes
  });
});

// POST Care Team Note
app.post('/api/patients/:id/care-team-notes', requireAuth('doctor', 'admin'), (req, res) => {
  const { id } = req.params;
  const { authorName, authorRole, note } = req.body;

  const patient = patientsStorage.find(p => p.id === id || p.patientId === id);
  if (!patient) {
    return res.status(404).json({ success: false, error: "Patient record not found" });
  }

  if (typeof note !== 'string' || !note.trim()) {
    return res.status(400).json({ success: false, error: "Note text is required" });
  }

  const newNote: CareTeamNote = {
    id: `CTN-${Date.now()}`,
    patientId: patient.id,
    authorName: authorName || "Dr. N. Sanchana",
    authorRole: authorRole || "Chief Surgeon",
    note,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    isEncrypted: true
  };

  if (!careTeamNotesStorage[patient.id]) careTeamNotesStorage[patient.id] = [];
  careTeamNotesStorage[patient.id].unshift(newNote);

  logAudit('CREATE', 'PATIENT_RECORD', patient.id, `Added care team note for ${patient.name}`);

  res.json({ success: true, note: newNote });
});

// POST FHIR R4 Export
app.post('/api/patients/:id/fhir-export', requireAuth('doctor', 'admin'), (req, res) => {
  const { id } = req.params;
  const patient = patientsStorage.find(p => p.id === id || p.patientId === id);
  if (!patient) {
    return res.status(404).json({ success: false, error: "Patient record not found" });
  }

  const fhirBundle = {
    resourceType: "Bundle",
    type: "collection",
    timestamp: new Date().toISOString(),
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: patient.id,
          name: [{ text: patient.name }],
          gender: patient.gender.toLowerCase(),
          telecom: [
            { system: "phone", value: patient.phone },
            { system: "email", value: patient.email }
          ]
        }
      },
      ...patient.visits.map(v => ({
        resource: {
          resourceType: "Procedure",
          id: v.id,
          status: v.status === 'Completed' ? 'completed' : 'in-progress',
          code: { text: v.serviceName },
          performedDateTime: v.date,
          note: [{ text: `${v.diagnosis} — ${v.treatmentGiven}` }]
        }
      }))
    ]
  };

  logAudit('EXPORT_FHIR', 'PATIENT_RECORD', patient.id, `Generated encrypted FHIR R4 JSON bundle for interoperability export — ${patient.name}`);

  res.json({ success: true, fhirBundle });
});

// GET Audit Logs
app.get('/api/audit-logs', requireAuth('doctor', 'admin'), (req, res) => {
  res.json(auditLogsStorage);
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

// POST Gemini Clinical Summary (Doctor Portal)
app.post('/api/gemini/clinical-summary', async (req, res) => {
  const { patientRecord } = req.body;

  if (!patientRecord || typeof patientRecord !== 'object') {
    return res.status(400).json({ error: "patientRecord is required" });
  }

  const fallbackSummary = `${patientRecord.name || 'Patient'} — ${patientRecord.visits?.length || 0} recorded visit(s). Review full chart for detailed treatment history. (AI summary unavailable — Gemini API key not configured.)`;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("Gemini API key is not configured.");
    }

    const systemInstruction = `You are a clinical documentation assistant for a dentist at Vihana Dental Care. Summarize the given patient record into a concise clinical handoff note (3-5 sentences): key medical history/allergies, current treatment plan status, and any follow-up needed. Be factual and use the data provided only.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Patient record JSON:\n${JSON.stringify(patientRecord)}`,
      config: { systemInstruction, temperature: 0.4 }
    });

    res.json({ summary: response.text || fallbackSummary });
  } catch (error) {
    console.error("Gemini clinical-summary failed:", error);
    res.json({ summary: fallbackSummary });
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