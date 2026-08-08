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
  whatsapp: string;
  email: string;
  googleBusinessUrl: string;
  rating: number;
  totalReviews: number;
  workingHours: {
    weekdays: string;
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
}

// Visiting specialists shown for informational purposes only — deliberately
// NOT part of the Doctor/DOCTORS shape, so they never show up as a
// selectable option in the booking flows (AppointmentBookingModal,
// ChatBookingWidget), which only ever read from DOCTORS.
export interface ConsultantDoctor {
  id: string;
  name: string;
  specialty: string;
  qualification: string;
  bio: string;
  photo: string;
}

export interface GalleryItem {
  id: string;
  title: string;
  category: 'facilities' | 'treatments' | 'sterilization' | 'smiles' | 'posters';
  imageUrl: string;
  caption: string;
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

  // Which intake channel produced this booking — drives the "Channel" column
  // in the Google Sheets appointment log and the source_channel on the
  // Supabase patient record.
  channel: 'whatsapp' | 'chatbot' | 'website_cta';
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

export interface AvailabilitySlot {
  time: string;
  available: boolean;
}

export interface AvailabilityResponse {
  success: boolean;
  date: string;
  dayFullyBooked: boolean;
  slots: AvailabilitySlot[];
  degraded?: boolean; // true when Calendar couldn't be reached and slots are shown as tentative
  message?: string;
}

export interface AvailabilityConfirmResponse {
  success: boolean;
  valid: boolean;
  message?: string;
}