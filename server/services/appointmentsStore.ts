/**
 * Appointment persistence — Supabase-backed, additive alongside Google
 * Calendar (still the scheduling source of truth) and Google Sheets (the
 * human-readable log). This exists purely so the app's own in-memory
 * appointment array (server.ts's `appointmentsStorage` — used for
 * confirm/cancel logic, the WhatsApp bot's conversation flow, and the
 * /doctor-admin pending-online-consults list) survives a server restart
 * instead of being silently wiped, which it was before this file existed.
 *
 * Pattern matches every other Supabase integration in this project:
 * `persistAppointment` is called after every create/update, fire-and-forget
 * from the caller's perspective (awaited, but a failure is logged and never
 * thrown — a Supabase outage must never block a booking that already
 * succeeded). `loadAllAppointments` is called once at server startup to
 * rehydrate the in-memory array. Falls back to a no-op when Supabase isn't
 * configured, so local dev without credentials still works exactly as
 * before (appointments just live only in memory again).
 */

import { Appointment } from '../../src/types';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function isAppointmentsPersistenceConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function appointmentToRow(a: Appointment): Record<string, unknown> {
  return {
    id: a.id,
    patient_name: a.patientName,
    patient_phone: a.patientPhone,
    patient_email: a.patientEmail,
    doctor_id: a.doctorId,
    doctor_name: a.doctorName,
    service_id: a.serviceId,
    service_name: a.serviceName,
    date: a.date,
    time_slot: a.timeSlot,
    notes: a.notes ?? null,
    status: a.status,
    google_calendar_event_id: a.googleCalendarEventId ?? null,
    google_calendar_synced: a.googleCalendarSynced,
    whatsapp_confirmation_sent: a.whatsappConfirmationSent,
    whatsapp_reminder_scheduled: a.whatsappReminderScheduled,
    reschedule_token: a.rescheduleToken,
    caregiver_phone: a.caregiverPhone ?? null,
    consultation_type: a.consultationType,
    video_room_url: a.videoRoomUrl ?? null,
    online_consult_status: a.onlineConsultStatus ?? null,
    payment_status: a.paymentStatus,
    payment_id: a.paymentId ?? null,
    razorpay_order_id: a.razorpayOrderId ?? null,
    razorpay_payment_link_id: a.razorpayPaymentLinkId ?? null,
    fee_amount: a.feeAmount ?? null,
    channel: a.channel,
    patient_visited: a.patientVisited,
    created_at: a.createdAt,
    updated_at: a.updatedAt
  };
}

function rowToAppointment(r: any): Appointment {
  return {
    id: r.id,
    patientName: r.patient_name,
    patientPhone: r.patient_phone,
    patientEmail: r.patient_email,
    doctorId: r.doctor_id,
    doctorName: r.doctor_name,
    serviceId: r.service_id,
    serviceName: r.service_name,
    date: r.date,
    timeSlot: r.time_slot,
    notes: r.notes ?? undefined,
    status: r.status,
    googleCalendarEventId: r.google_calendar_event_id ?? undefined,
    googleCalendarSynced: r.google_calendar_synced,
    whatsappConfirmationSent: r.whatsapp_confirmation_sent,
    whatsappReminderScheduled: r.whatsapp_reminder_scheduled,
    rescheduleToken: r.reschedule_token,
    caregiverPhone: r.caregiver_phone ?? undefined,
    consultationType: r.consultation_type,
    videoRoomUrl: r.video_room_url ?? undefined,
    onlineConsultStatus: r.online_consult_status ?? undefined,
    paymentStatus: r.payment_status,
    paymentId: r.payment_id ?? undefined,
    razorpayOrderId: r.razorpay_order_id ?? undefined,
    razorpayPaymentLinkId: r.razorpay_payment_link_id ?? undefined,
    feeAmount: r.fee_amount ?? undefined,
    channel: r.channel,
    patientVisited: r.patient_visited ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}

/** Upserts one appointment row — call after every create/status-change. Never throws. */
export async function persistAppointment(appointment: Appointment): Promise<void> {
  if (!isAppointmentsPersistenceConfigured()) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?on_conflict=id`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(appointmentToRow(appointment))
    });
    if (!res.ok) {
      throw new Error(`Supabase appointments upsert failed: ${res.status} ${await res.text()}`);
    }
  } catch (error: any) {
    console.error(`Supabase persistAppointment failed for ${appointment.id} (booking still proceeds):`, error?.message || error);
  }
}

/** Rehydrates the in-memory appointment list at server startup. Returns [] (never throws) when unconfigured or on error. */
export async function loadAllAppointments(): Promise<Appointment[]> {
  if (!isAppointmentsPersistenceConfigured()) return [];

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?select=*&order=created_at.desc`, {
      headers: supabaseHeaders()
    });
    if (!res.ok) throw new Error(`Supabase appointments read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows.map(rowToAppointment);
  } catch (error: any) {
    console.error('Supabase loadAllAppointments failed (starting with an empty in-memory list):', error?.message || error);
    return [];
  }
}
