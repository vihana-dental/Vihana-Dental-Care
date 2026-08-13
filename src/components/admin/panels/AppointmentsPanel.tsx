import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Plus, Search, X, ChevronDown, MessageCircleMore, BellRing, Video, PhoneForwarded, CheckCircle2, Send, ExternalLink } from 'lucide-react';
import { Appointment, Doctor, DentalService } from '../../../types';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, SuccessBanner, inputClass, labelClass, primaryButtonClass, ghostButtonClass, ToggleSwitch } from '../shared';

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

// Exported — reused by LiveCalendarPanel.tsx so both views agree on what
// each status/payment state looks like.
export const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  pending_approval: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-brand-300 text-brand-900',
  rescheduled: 'bg-sky-100 text-sky-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-rose-100 text-rose-700',
  payment_failed: 'bg-rose-100 text-rose-700'
};

export const PAYMENT_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  paid: 'bg-emerald-100 text-emerald-700',
  waived: 'bg-sky-100 text-sky-700',
  failed: 'bg-rose-100 text-rose-700'
};

// This is an additive tracking layer only — it reads appointment data that
// Google Calendar and Google Sheets already receive through the existing
// booking flows; nothing here writes to or replaces either integration.
export const AppointmentsPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [query, setQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/appointments');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load appointments.');
      setAppointments(data.appointments);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load appointments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Applied after any toggle/button action in the expanded detail panel so
  // the row updates immediately without a full reload round-trip.
  const patchLocalAppointment = (updated: Appointment) => {
    setAppointments((prev) => prev && prev.map((a) => a.id === updated.id ? updated : a));
  };

  const filtered = useMemo(() => {
    if (!appointments) return [];
    const needle = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (paymentFilter && a.paymentStatus !== paymentFilter) return false;
      if (channelFilter && a.channel !== channelFilter) return false;
      if (needle && !(
        a.patientName.toLowerCase().includes(needle) ||
        a.patientPhone.includes(needle) ||
        a.id.toLowerCase().includes(needle)
      )) return false;
      return true;
    });
  }, [appointments, statusFilter, paymentFilter, channelFilter, query]);

  return (
    <div className="space-y-4">
      <PanelCard>
        <PanelHeader
          icon={<CalendarDays className="w-5 h-5" />}
          title="Appointments & Payments"
          subtitle="Every booking across website, WhatsApp, and chat — an additional tracking layer, Calendar and Sheets stay exactly as they are"
          action={
            <button onClick={() => setShowForm((v) => !v)} className={primaryButtonClass}>
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showForm ? 'Close' : 'New Appointment'}</span>
            </button>
          }
        />

        {showForm && (
          <DirectBookingForm
            authedFetch={authedFetch}
            onSessionExpired={onSessionExpired}
            onBooked={() => { setShowForm(false); load(); }}
          />
        )}

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="relative col-span-2 sm:col-span-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, phone, or ID"
                className={inputClass + ' pl-8 text-xs'}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass + ' text-xs'}>
              <option value="">All statuses</option>
              {['pending', 'pending_approval', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'payment_failed'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className={inputClass + ' text-xs'}>
              <option value="">All payments</option>
              {['pending', 'paid', 'waived', 'failed'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className={inputClass + ' text-xs'}>
              <option value="">All channels</option>
              {['website_cta', 'whatsapp', 'chatbot', 'admin_direct'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          {loading && <LoadingRow label="Loading appointments..." />}
          {loadError && <ErrorBanner message={loadError} onRetry={load} />}

          {appointments && !loading && filtered.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No appointments match these filters.</p>
          )}

          {filtered.length > 0 && (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[720px]">
                <thead>
                  <tr className="text-left text-slate-400 uppercase tracking-wide text-[10px]">
                    <th className="px-2 py-2">Patient</th>
                    <th className="px-2 py-2">Doctor / Service</th>
                    <th className="px-2 py-2">When</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Payment</th>
                    <th className="px-2 py-2">Channel</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <React.Fragment key={a.id}>
                      <tr
                        className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => setExpandedId((prev) => prev === a.id ? null : a.id)}
                      >
                        <td className="px-2 py-2.5">
                          <p className="font-bold text-slate-900">{a.patientName}</p>
                          <p className="text-slate-400 font-mono text-[10px]">{a.patientPhone} · #{a.id}</p>
                        </td>
                        <td className="px-2 py-2.5">
                          <p className="text-slate-700">{a.doctorName}</p>
                          <p className="text-slate-400">{a.serviceName}</p>
                        </td>
                        <td className="px-2 py-2.5 whitespace-nowrap">
                          <p className="text-slate-700">{a.date}</p>
                          <p className="text-slate-400">{a.timeSlot}</p>
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${STATUS_BADGE[a.status] || 'bg-slate-100 text-slate-600'}`}>
                            {a.status.replace(/_/g, ' ')}
                          </span>
                          {a.patientVisited && (
                            <span className="inline-flex items-center gap-0.5 ml-1 text-emerald-600" title="Patient visited">
                              <CheckCircle2 className="w-3 h-3" />
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${PAYMENT_BADGE[a.paymentStatus] || 'bg-slate-100 text-slate-600'}`}>
                            {a.paymentStatus}
                          </span>
                          {typeof a.feeAmount === 'number' && a.feeAmount > 0 && (
                            <span className="text-slate-400 ml-1">₹{a.feeAmount}</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-slate-500">{a.channel.replace(/_/g, ' ')}</td>
                        <td className="px-2 py-2.5 text-slate-400">
                          <ChevronDown className={`w-4 h-4 transition-transform ${expandedId === a.id ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {expandedId === a.id && (
                        <tr className="border-t border-slate-100 bg-slate-50/60">
                          <td colSpan={7} className="p-4">
                            <AppointmentDetailPanel
                              appointment={a}
                              authedFetch={authedFetch}
                              onSessionExpired={onSessionExpired}
                              onUpdated={patchLocalAppointment}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PanelCard>
    </div>
  );
};

// The centralized action panel for one appointment — every toggle and
// button here hits an endpoint that updates appointmentsStorage, persists
// to Supabase, and best-effort mirrors the change into Google Sheets (and,
// for meaningful field changes, a note on the Google Calendar event) —
// see server.ts's syncAppointmentEverywhere/the /api/admin/appointments/:id
// action routes. Nothing here ever replaces Calendar/Sheets as the
// doctor's real scheduling record; this is the single place those changes
// get triggered from.
export const AppointmentDetailPanel: React.FC<{
  appointment: Appointment;
  authedFetch: Props['authedFetch'];
  onSessionExpired: () => void;
  onUpdated: (updated: Appointment) => void;
}> = ({ appointment: a, authedFetch, onSessionExpired, onUpdated }) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [customResult, setCustomResult] = useState<{ ok: boolean; text: string } | null>(null);

  const patchField = async (field: 'status' | 'paymentStatus' | 'patientVisited', value: unknown) => {
    setBusyKey(field);
    setError('');
    try {
      const res = await authedFetch(`/api/admin/appointments/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not update.');
      onUpdated(data.appointment);
    } catch (err: any) {
      setError(err?.message || 'Could not update.');
    } finally {
      setBusyKey(null);
    }
  };

  const runAction = async (key: string, path: string) => {
    setBusyKey(key);
    setError('');
    try {
      const res = await authedFetch(`/api/admin/appointments/${encodeURIComponent(a.id)}/${path}`, { method: 'POST' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Action failed.');
      if (data.appointment) onUpdated(data.appointment);
    } catch (err: any) {
      setError(err?.message || 'Action failed.');
    } finally {
      setBusyKey(null);
    }
  };

  const sendCustomMessage = async () => {
    if (!customMessage.trim()) return;
    setBusyKey('custom-message');
    setCustomResult(null);
    try {
      const res = await authedFetch(`/api/admin/appointments/${encodeURIComponent(a.id)}/send-custom-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: customMessage.trim() })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not send message.');
      setCustomResult({ ok: true, text: data.mock ? 'Logged (WhatsApp not configured yet — no real message sent).' : 'Sent.' });
      setCustomMessage('');
    } catch (err: any) {
      setCustomResult({ ok: false, text: err?.message || 'Could not send message.' });
    } finally {
      setBusyKey(null);
    }
  };

  const whatsappFallbackHref = `https://wa.me/${a.patientPhone.replace(/[^0-9]/g, '')}`;

  const actionButtonClass = ghostButtonClass + ' text-[11px] py-2 px-3';

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2.5">
          <span className="text-xs font-semibold text-slate-700">Patient Visited</span>
          <ToggleSwitch checked={a.patientVisited} disabled={busyKey === 'patientVisited'} onChange={(v) => patchField('patientVisited', v)} />
        </div>
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2.5">
          <span className="text-xs font-semibold text-slate-700">Payment Paid</span>
          <ToggleSwitch
            checked={a.paymentStatus === 'paid'}
            disabled={busyKey === 'paymentStatus'}
            onChange={(v) => patchField('paymentStatus', v ? 'paid' : 'pending')}
          />
        </div>
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2.5">
          <span className="text-xs font-semibold text-slate-700">Confirmed</span>
          <ToggleSwitch
            checked={a.status === 'confirmed'}
            disabled={busyKey === 'status'}
            onChange={(v) => patchField('status', v ? 'confirmed' : 'pending')}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => runAction('send-confirmation', 'send-confirmation')} disabled={busyKey === 'send-confirmation'} className={actionButtonClass}>
          {busyKey === 'send-confirmation' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircleMore className="w-3.5 h-3.5" />}
          <span>Send Confirmation</span>
          {a.whatsappConfirmationSent && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
        </button>
        <button onClick={() => runAction('send-reminder', 'send-reminder')} disabled={busyKey === 'send-reminder'} className={actionButtonClass}>
          {busyKey === 'send-reminder' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
          <span>Send Reminder</span>
          {a.whatsappReminderScheduled && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
        </button>
        {a.consultationType === 'online-video' && !a.videoRoomUrl && (
          <button onClick={() => runAction('generate-meet-link', 'generate-meet-link')} disabled={busyKey === 'generate-meet-link'} className={actionButtonClass}>
            {busyKey === 'generate-meet-link' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
            <span>Generate Meet Link</span>
          </button>
        )}
        {a.videoRoomUrl && (
          <button onClick={() => runAction('send-meet-reminder', 'send-meet-reminder')} disabled={busyKey === 'send-meet-reminder'} className={actionButtonClass}>
            {busyKey === 'send-meet-reminder' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneForwarded className="w-3.5 h-3.5" />}
            <span>Send Meet Reminder</span>
          </button>
        )}
      </div>

      {a.videoRoomUrl && (
        <p className="text-[11px] text-slate-500">
          Meet link: <a href={a.videoRoomUrl} target="_blank" rel="noreferrer" className="text-brand-900 underline break-all">{a.videoRoomUrl}</a>
        </p>
      )}
      {a.notes && <p className="text-[11px] text-slate-500">Notes: {a.notes}</p>}

      {/* Direct WhatsApp send from the console — WhatsApp's rules mean free-
          text only reaches the patient if they've messaged the bot number in
          the last 24h (Meta blocks business-initiated free text otherwise;
          only pre-approved templates, used by the buttons above, work
          outside that window). "Open in WhatsApp" is the always-available
          fallback — it hands off to the doctor's own WhatsApp/WhatsApp Web
          to message the patient manually when the API can't. */}
      <div className="border-t border-slate-100 pt-4 space-y-2">
        <p className="text-xs font-bold text-slate-700">Send a WhatsApp message directly</p>
        <p className="text-[11px] text-slate-400">
          Only delivers if the patient has messaged this number within the last 24 hours — otherwise use the buttons above, or open WhatsApp and message them yourself.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Type a message to send to the patient's WhatsApp..."
            rows={2}
            className={inputClass + ' resize-none flex-1'}
          />
          <div className="flex sm:flex-col gap-2 shrink-0">
            <button
              onClick={sendCustomMessage}
              disabled={busyKey === 'custom-message' || !customMessage.trim()}
              className={ghostButtonClass + ' text-[11px] py-2 px-3 whitespace-nowrap'}
            >
              {busyKey === 'custom-message' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Send</span>
            </button>
            <a
              href={whatsappFallbackHref}
              target="_blank"
              rel="noopener noreferrer"
              className={ghostButtonClass + ' text-[11px] py-2 px-3 whitespace-nowrap'}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in WhatsApp</span>
            </a>
          </div>
        </div>
        {customResult && (
          <p className={`text-[11px] ${customResult.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{customResult.text}</p>
        )}
      </div>
    </div>
  );
};

// Admin-only direct booking — creates a confirmed appointment straight away,
// bypassing Razorpay entirely (paymentStatus: 'waived'). Still syncs to
// Calendar and logs to Sheets/Supabase like any other booking.
const DirectBookingForm: React.FC<{
  authedFetch: Props['authedFetch'];
  onSessionExpired: () => void;
  onBooked: () => void;
}> = ({ authedFetch, onSessionExpired, onBooked }) => {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<DentalService[]>([]);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [consultationType, setConsultationType] = useState<'in-clinic' | 'online-video'>('in-clinic');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    authedFetch('/api/admin/team/doctors')
      .then((res) => (res.status === 401 ? onSessionExpired() : res.json()))
      .then((data) => { if (data?.success) setDoctors(data.doctors); })
      .catch(() => {});
    authedFetch('/api/admin/services')
      .then((res) => (res.status === 401 ? onSessionExpired() : res.json()))
      .then((data) => { if (data?.success) setServices(data.services); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await authedFetch('/api/admin/appointments/direct-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientName, patientPhone, patientEmail, doctorId, serviceId, date, timeSlot, consultationType, notes })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not book appointment.');
      setSuccess(`Booked #${data.appointment.id} — payment bypassed.`);
      setPatientName(''); setPatientPhone(''); setPatientEmail(''); setDate(''); setTimeSlot(''); setNotes('');
      onBooked();
    } catch (err: any) {
      setError(err?.message || 'Could not book appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="px-6 pb-6 space-y-3 border-b border-slate-100">
      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Patient name</label>
          <input required value={patientName} onChange={(e) => setPatientName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input required value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Email (optional)</label>
          <input type="email" value={patientEmail} onChange={(e) => setPatientEmail(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Doctor</label>
          <select required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
            <option value="">Select a doctor</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Service</label>
          <select required value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={inputClass}>
            <option value="">Select a service</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Date</label>
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Time slot</label>
          <input required placeholder="e.g. 10:30 AM" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Consultation type</label>
          <select value={consultationType} onChange={(e) => setConsultationType(e.target.value as 'in-clinic' | 'online-video')} className={inputClass}>
            <option value="in-clinic">In-clinic</option>
            <option value="online-video">Online video</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="submit" disabled={submitting} className={primaryButtonClass}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>{submitting ? 'Booking...' : 'Book (No Payment Required)'}</span>
        </button>
      </div>
    </form>
  );
};
