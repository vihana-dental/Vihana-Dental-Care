/**
 * vihana Dental Clinic - Data Models and Interfaces (Updated for Online Consult & Razorpay)
 */

export type UserRole = 'guest' | 'patient' | 'doctor' | 'admin' | 'caregiver';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
  phone?: string;
  patientId?: string;
  avatar?: string;
  doctorSpecialization?: string;
  patientRecordId?: string;
  token?: string;
}

export interface ClinicInfo {
  name: string;
  tagline: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  alternatePhone: string;
  /**
   * The clinic's own WhatsApp number — the ONLY WhatsApp number that is ever
   * rendered as visible text anywhere on the public site.
   */
  whatsapp: string;
  /**
   * The automated booking bot's WhatsApp number. Deliberately NOT a display
   * value: it exists solely as the wa.me target behind "Book on WhatsApp"
   * CTAs, which is what starts an automated conversation with the bot. Never
   * print this in a header, footer, contact card, or anywhere else — use
   * `whatsapp` for anything a patient reads.
   */
  whatsappBot: string;
  email: string;
  googleBusinessUrl: string;
  /** Deep link to the clinic pin on Google Maps (address/hours links point here). */
  googleMapsUrl: string;
  instagramUrl: string;
  rating: number;
  totalReviews: number;
  workingHours: {
    weekdays: string;
    /** Condensed weekday hours for the header bar; still carries AM/PM. */
    weekdaysShort: string;
    sundays: string;
    emergency: string;
  };
  location: {
    lat: number;
    lng: number;
  };
}

export interface DentalService {
  id: string;
  title: string;
  category: 'General' | 'Cosmetic' | 'Orthodontics' | 'Implants' | 'Surgical' | 'Pediatric';
  shortDescription: string;
  fullDescription: string;
  image: string;
  durationMinutes: number;
  priceRange: string;
  benefits: string[];
  procedures: string[];
  iconName: string;
}

export interface Doctor {
  id: string;
  name: string;
  title: string;
  qualification: string;
  specialization: string;
  experienceYears: number;
  photo: string;
  bio: string;
  availableDays: string[];
  ugInstitution?: string;
  pgInstitution?: string;
  externalTraining?: string[];
  qualificationYear?: string;
  // Whether this doctor appears as a selectable option in the booking
  // flows (website, WhatsApp bot, chat widget). Defaults true for lead
  // doctors — toggled per-doctor from the Team panel.
  bookable: boolean;
}

// Visiting specialists, shown on the public Team page for informational
// purposes. Historically never bookable by design — now optionally
// bookable via the same `bookable` toggle used on Doctor, so a consultant
// can be switched on to appear in the booking flows alongside lead doctors
// (see getBookableDoctors() in server.ts, which merges both pools filtered
// by this flag). Defaults false — no consultant becomes bookable until a
// doctor explicitly turns it on from the Team panel.
export interface ConsultantDoctor {
  id: string;
  name: string;
  specialty: string;
  qualification: string;
  bio: string;
  photo: string;
  ugInstitution?: string;
  pgInstitution?: string;
  externalTraining?: string[];
  qualificationYear?: string;
  experienceYears?: number;
  bookable: boolean;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: 'facilities' | 'treatments' | 'sterilization' | 'smiles' | 'posters';
  imageUrl: string;
  caption: string;
}

// Doctor-editable FAQ entries — shown on the Services page and mirrored
// into that page's FAQPage JSON-LD structured data. `order` controls
// display order (lower first); admin-assigned on create, editable.
export interface FAQ {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export interface Review {
  id: string;
  authorName: string;
  authorPhoto?: string;
  rating: number;
  relativeTimeDescription: string;
  text: string;
  date: string;
  verifiedGoogle: boolean;
  clinicReply?: string;
}

export interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  doctorId: string;
  doctorName: string;
  serviceId: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // e.g. "10:30 AM"
  notes?: string;
  status: 'pending' | 'pending_approval' | 'confirmed' | 'rescheduled' | 'completed' | 'cancelled' | 'payment_failed';
  googleCalendarEventId?: string;
  googleCalendarSynced: boolean;
  whatsappConfirmationSent: boolean;
  whatsappReminderScheduled: boolean;
  rescheduleToken: string;
  createdAt: string;
  updatedAt: string;
  caregiverPhone?: string;
  
  // NEW: Online Consultation & Razorpay Fields
  consultationType: 'in-clinic' | 'online-video';
  videoRoomUrl?: string;
  // Online consults never get an auto-generated Meet link — the doctor may
  // not actually be free at the slot the patient picked. The calendar event
  // is created as 'tentative' with no conferenceData; only once the doctor
  // approves in /doctor-admin does a Meet link get created (videoRoomUrl
  // populated) and pushed to the patient over WhatsApp. Irrelevant/undefined
  // for in-clinic visits.
  onlineConsultStatus?: 'pending_doctor_approval' | 'approved';
  paymentStatus: 'pending' | 'paid' | 'waived' | 'failed';
  paymentId?: string;
  razorpayOrderId?: string;
  razorpayPaymentLinkId?: string;
  feeAmount?: number;
  // Doctor-toggled from the admin console once the patient has actually
  // shown up — purely a tracking flag, independent of `status`.
  patientVisited: boolean;

  // Which intake channel produced this booking — drives the "Channel" column
  // in the Google Sheets appointment log and the source_channel on the
  // Supabase patient record. 'admin_direct' = doctor booked it directly from
  // the admin console, bypassing payment entirely.
  channel: 'whatsapp' | 'chatbot' | 'website_cta' | 'admin_direct';
}

export interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  status: 'new' | 'contacted' | 'resolved';
  createdAt: string;
  notes?: string;
  /**
   * DPDP Act, 2023 §6 — the notice-and-consent record for this submission.
   * `consentGiven` is what the patient actually ticked; `consentText` stores
   * the exact wording they were shown, and `consentedAt` when, so the record
   * of consent stands on its own even after the form copy is reworded.
   */
  consentGiven?: boolean;
  consentText?: string;
  consentedAt?: string;
}

/**
 * A clinic licence / registration / qualification document, uploaded by the
 * doctor in the admin console and listed publicly behind the footer's
 * "Certifications" link. These are practice credentials, not patient data —
 * they are meant to be public — but uploads and deletions are still audited
 * (see the DPDP notes on the certificates routes in server.ts).
 */
export interface ClinicCertificate {
  id: string;
  title: string;
  /** Original filename as uploaded, kept for display and download naming. */
  fileName: string;
  /** One of the accepted document types: application/pdf, image/jpeg, image/png. */
  mimeType: string;
  fileSizeBytes: number;
  /** Where the public gallery loads the document from. */
  fileUrl: string;
  /** Lower sorts first in the public list. */
  displayOrder: number;
  uploadedAt: string;
}

export interface VisitRecord {
  id: string;
  date: string;
  doctorName: string;
  serviceName: string;
  diagnosis: string;
  treatmentGiven: string;
  prescription?: string;
  cost: number;
  status: 'Completed' | 'Follow-up Needed';
  nextFollowUpDate?: string;
}

export interface TreatmentStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: 'completed' | 'in-progress' | 'scheduled';
  scheduledDate?: string;
}

export interface PatientRecord {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  email: string;
  bloodGroup: string;
  medicalHistory: string[];
  allergies: string[];
  emergencyContact: {
    name: string;
    relationship: string;
    phone: string;
  };
  currentTreatmentPlan?: {
    id: string;
    title: string;
    startDate: string;
    estimatedCompletion: string;
    totalCost: number;
    paidAmount: number;
    steps: TreatmentStep[];
  };
  visits: VisitRecord[];
  caregiver?: {
    name: string;
    phone: string;
    receiveAlerts: boolean;
  };
  postOpStatus?: {
    painLevel: number; // 0-10
    medicationTaken: boolean;
    lastUpdated: string;
    notes: string;
  };
}

export interface CareTeamNote {
  id: string;
  patientId: string;
  authorName: string;
  authorRole: string;
  note: string;
  timestamp: string;
  isEncrypted: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT_FHIR' | 'LOGIN';
  resourceType: 'PATIENT_RECORD' | 'APPOINTMENT' | 'INQUIRY' | 'TREATMENT_PLAN';
  resourceId: string;
  details: string;
  ipAddress: string;
  encryptedHash: string;
}

// ---------------- Chat Booking Widget ----------------

export type ChatFlowStep =
  | 'menu'
  | 'consultation_type'
  | 'category'
  | 'service'
  | 'doctor'
  | 'datetime'
  | 'patient_details'
  | 'payment'
  | 'confirmed'
  | 'reschedule'
  | 'free_chat';

export interface ChatBubble {
  id: string;
  sender: 'bot' | 'user';
  kind: 'text' | 'chips' | 'card' | 'form' | 'payment' | 'confirmation' | 'error';
  text?: string;
  chips?: string[];
  timestamp: string;
}

export interface BookingDraft {
  consultationType?: 'in-clinic' | 'online-video';
  serviceId?: string;
  doctorId?: string;
  date?: string;
  timeSlot?: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  notes?: string;
}

export interface RazorpayPaymentLinkResult {
  success: boolean;
  paymentLinkId: string;
  shortUrl: string;
  qrImageUrl: string;
  amount: number;
  currency: string;
  status: 'created' | 'paid';
  mock: boolean;
}

export type CalendarErrorType = 'auth' | 'rate_limit' | 'network' | 'unknown';

export interface GoogleCalendarSyncResult {
  synced: boolean;
  eventId?: string;
  htmlLink?: string;
  meetLink?: string;
  mock: boolean;
  error?: string;
  errorType?: CalendarErrorType;
}

export interface BookingBotIntentResponse {
  action: 'START_BOOKING' | 'CHECK_AVAILABILITY' | 'RESCHEDULE_CANCEL' | 'FAQ_ANSWER' | 'OFF_TOPIC_REDIRECT';
  reply: string;
}

export interface FeeConfig {
  confirmationFeeEnabled: boolean;
  inClinicFeeINR: number;
  onlineFeeINR: number;
}

/**
 * `reason` explains *why* an unavailable slot can't be booked, so the UI can
 * say "Passed" rather than the misleading "Already booked" it used to show
 * for every disabled chip. Absent when the slot is available.
 */
export type SlotUnavailableReason = 'passed' | 'booked' | 'blocked';

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  reason?: SlotUnavailableReason;
}

export interface AvailabilityResponse {
  success: boolean;
  date: string;
  dayFullyBooked: boolean;
  slots: AvailabilitySlot[];
  dayLapsed?: boolean; // true when the date is today and every slot has already started
  degraded?: boolean; // true when Calendar couldn't be reached and slots are shown as tentative
  message?: string;
}

export interface AvailabilityConfirmResponse {
  success: boolean;
  valid: boolean;
  message?: string;
}