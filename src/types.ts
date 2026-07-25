/**
 * Vihanna Dental Clinic - Data Models and Interfaces
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
  status: 'pending' | 'confirmed' | 'rescheduled' | 'completed' | 'cancelled';
  googleCalendarEventId?: string;
  googleCalendarSynced: boolean;
  whatsappConfirmationSent: boolean;
  whatsappReminderScheduled: boolean;
  rescheduleToken: string;
  createdAt: string;
  updatedAt: string;
  caregiverPhone?: string;
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

export interface WhatsAppMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
  options?: string[];
  actionType?: 'BOOKING_CONFIRMED' | 'RESCHEDULE_PROMPTED' | 'TRIAGE';
}
