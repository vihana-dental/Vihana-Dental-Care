import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Plus, Search, X, ChevronDown, MessageCircleMore, BellRing, Video, PhoneForwarded, CheckCircle2, Send, ExternalLink, Download, Trash2, Ban, CalendarClock, Phone, Check } from 'lucide-react';
import { Appointment, Doctor, DentalService } from '../../../types';
import {
  PanelCard, PanelHeader, LoadingRow, ErrorBanner, SuccessBanner, ConfirmDialog,
  inputClass, labelClass, primaryButtonClass, ghostButtonClass, dangerButtonClass, ToggleSwitch,
  clinicToday, formatShortDate, slotMinutes, APPOINTMENT_TAB_HANDOFF_KEY
} from '../shared';

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

/** Human wording for the payment column — a fee-waived booking with no fee reads "No fee", not a mysterious "waived". */
export const paymentLabel = (a: Pick<Appointment, 'paymentStatus' | 'feeAmount'>): string =>
  a.paymentStatus === 'waived' ? (a.feeAmount ? 'waived' : 'no fee') : a.paymentStatus;

type ViewTab = 'today' | 'upcoming' | 'action' | 'past' | 'all';

const VIEW_TABS: { id: ViewTab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'action', label: 'Needs action' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' }
];

const isLive = (a: Appointment) => a.status !== 'cancelled' && a.status !== 'completed';
const needsAction = (a: Appointment) =>
  a.status === 'pending_approval' ||
  a.status === 'payment_failed' ||
  (a.status === 'pending' && (a.feeAmount ?? 0) > 0);

const belongsToTab = (a: Appointment, tab: ViewTab, today: string): boolean => {
  switch (tab) {
    case 'today': return a.date === today && a.status !== 'cancelled';
    case 'upcoming': return a.date >= today && isLive(a);
    case 'action': return needsAction(a);
    case 'past': return a.date < today || a.status === 'completed';
    default: return true;
  }
};

const byTimeAsc = (a: Appointment, b: Appointment) => a.date.localeCompare(b.date) || slotMinutes(a.timeSlot) - slotMinutes(b.timeSlot);

const csvCell = (value: unknown): string => {
  const s = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exportAppointmentsCsv = (rows: Appointment[]) => {
  const header = ['ID', 'Patient', 'Phone', 'Date', 'Time', 'Service', 'Doctor', 'Type', 'Status', 'Payment', 'Fee (INR)', 'Channel', 'Visited', 'Notes'];
  const lines = rows.map((a) => [
    a.id, a.patientName, a.patientPhone, a.date, a.timeSlot, a.serviceName, a.doctorName, a.consultationType,
    a.status, paymentLabel(a), a.feeAmount ?? 0, a.channel, a.patientVisited ? 'Yes' : 'No', a.notes ?? ''
  ].map(csvCell).join(','));
  // The BOM makes Excel read the file as UTF-8 (patient names, ₹, etc.).
  const blob = new Blob(['﻿' + [header.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `vihana-appointments-${clinicToday()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// This is an additive tracking layer only — it reads appointment data that
// Google Calendar and Google Sheets already receive through the existing
// booking flows; nothing here writes to or replaces either integration.
export const AppointmentsPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // A dashboard tile can pre-select a tab; read it once, then clear it.
  const [tab, setTab] = useState<ViewTab | null>(() => {
    try {
      const handed = sessionStorage.getItem(APPOINTMENT_TAB_HANDOFF_KEY);
      sessionStorage.removeItem(APPOINTMENT_TAB_HANDOFF_KEY);
      return VIEW_TABS.some((v) => v.id === handed) ? (handed as ViewTab) : null;
    } catch {
      return null;
    }
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [query, setQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = clinicToday();

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

  const removeLocalAppointment = (id: string) => {
    setAppointments((prev) => prev && prev.filter((a) => a.id !== id));
    setExpandedId(null);
  };

  const counts = useMemo(() => {
    const result: Record<ViewTab, number> = { today: 0, upcoming: 0, action: 0, past: 0, all: 0 };
    for (const a of appointments || []) {
      for (const t of VIEW_TABS) if (belongsToTab(a, t.id, today)) result[t.id]++;
    }
    return result;
  }, [appointments, today]);

  // Land on what the doctor most likely wants: today's list if there is one,
  // otherwise what's coming up, otherwise everything.
  useEffect(() => {
    if (tab !== null || !appointments) return;
    setTab(counts.today > 0 ? 'today' : counts.upcoming > 0 ? 'upcoming' : 'all');
  }, [appointments, counts, tab]);

  const activeTab: ViewTab = tab ?? 'today';

  const filtered = useMemo(() => {
    if (!appointments) return [];
    const needle = query.trim().toLowerCase();
    const rows = appointments.filter((a) => {
      if (!belongsToTab(a, activeTab, today)) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      if (channelFilter && a.channel !== channelFilter) return false;
      if (needle && !(
        a.patientName.toLowerCase().includes(needle) ||
        a.patientPhone.includes(needle) ||
        a.id.toLowerCase().includes(needle)
      )) return false;
      return true;
    });
    // Forward-looking views read top-to-bottom in time order; history newest-first.
    const forward = activeTab === 'today' || activeTab === 'upcoming' || activeTab === 'action';
    return rows.sort((a, b) => (forward ? byTimeAsc(a, b) : byTimeAsc(b, a)));
  }, [appointments, activeTab, statusFilter, channelFilter, query, today]);

  const hasFilters = Boolean(statusFilter || channelFilter || query);

  return (
    <div className="space-y-4">
      <PanelCard>
        <PanelHeader
          icon={<CalendarDays className="w-5 h-5" />}
          title="Appointments"
          subtitle="Every booking from the website, WhatsApp and chat, in one place"
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

        <div className="p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-1.5 overflow-x-auto scroll-thin -mx-1 px-1 pb-1" role="tablist" aria-label="Appointment views">
            {VIEW_TABS.map((t) => {
              const selected = activeTab === t.id;
              const attention = t.id === 'action' && counts.action > 0;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => { setTab(t.id); setExpandedId(null); }}
                  className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-bold transition-colors ${
                    selected ? 'bg-brand-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className={`min-w-[1.25rem] text-center rounded-full px-1.5 py-0.5 text-[10px] ${
                    selected ? 'bg-white/20 text-white' : attention ? 'bg-amber-200 text-amber-900' : 'bg-white text-slate-500'
                  }`}>{counts[t.id]}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="relative col-span-2">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone or ID"
                className={inputClass + ' pl-8 text-xs'}
              />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputClass + ' text-xs'}>
              <option value="">Any status</option>
              {['pending', 'pending_approval', 'confirmed', 'rescheduled', 'completed', 'cancelled', 'payment_failed'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className={inputClass + ' text-xs'}>
              <option value="">Any channel</option>
              {['website_cta', 'whatsapp', 'chatbot', 'admin_direct'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <p>
              {appointments ? `${filtered.length} appointment${filtered.length === 1 ? '' : 's'}` : ''}
              {hasFilters && <button onClick={() => { setQuery(''); setStatusFilter(''); setChannelFilter(''); }} className="ml-2 underline font-semibold text-brand-900">Clear filters</button>}
            </p>
            <button
              onClick={() => exportAppointmentsCsv(filtered)}
              disabled={filtered.length === 0}
              className={ghostButtonClass + ' text-xs py-1.5 px-3 disabled:opacity-40'}
              title="Download the list below as a spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          {loading && <LoadingRow label="Loading appointments..." />}
          {loadError && <ErrorBanner message={loadError} onRetry={load} />}

          {appointments && !loading && filtered.length === 0 && (
            <div className="text-center py-10 space-y-1">
              <p className="text-sm font-semibold text-slate-600">
                {hasFilters ? 'No appointments match these filters.' : activeTab === 'today' ? 'No appointments today.' : activeTab === 'action' ? 'Nothing needs your attention. 🎉' : 'No appointments here yet.'}
              </p>
              {!hasFilters && activeTab === 'today' && counts.upcoming > 0 && (
                <button onClick={() => setTab('upcoming')} className="text-xs underline font-semibold text-brand-900">See {counts.upcoming} upcoming</button>
              )}
            </div>
          )}

          {filtered.length > 0 && (
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-xs min-w-[720px]">
                <thead>
                  <tr className="text-left text-slate-400 uppercase tracking-wide text-[10px]">
                    <th className="px-2 py-2">When</th>
                    <th className="px-2 py-2">Patient</th>
                    <th className="px-2 py-2">Doctor / Service</th>
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
                        className={`border-t border-slate-100 hover:bg-slate-50 cursor-pointer ${a.status === 'cancelled' ? 'opacity-60' : ''}`}
                        onClick={() => setExpandedId((prev) => prev === a.id ? null : a.id)}
                      >
                        <td className="px-2 py-2.5 whitespace-nowrap">
                          <p className="font-bold text-slate-900">{a.timeSlot}</p>
                          <p className="text-slate-400">{a.date === today ? 'Today' : formatShortDate(a.date)}</p>
                        </td>
                        <td className="px-2 py-2.5">
                          <p className="font-bold text-slate-900">{a.patientName}</p>
                          <p className="text-slate-400 font-mono text-[10px]">{a.patientPhone} · #{a.id}</p>
                        </td>
                        <td className="px-2 py-2.5">
                          <p className="text-slate-700">{a.doctorName}</p>
                          <p className="text-slate-400">{a.serviceName}</p>
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
                            {paymentLabel(a)}
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
                              onDeleted={removeLocalAppointment}
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
  /** Called after the appointment is permanently deleted, so the parent list can drop the row. */
  onDeleted?: (id: string) => void;
}> = ({ appointment: a, authedFetch, onSessionExpired, onUpdated, onDeleted }) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<'cancel' | 'delete' | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [notifyPatient, setNotifyPatient] = useState(true);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(a.date);
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<{ time: string; blocked: boolean; appointmentId?: string }[]>([]);
  const [rescheduleBusy, setRescheduleBusy] = useState(false);

  const isCancelled = a.status === 'cancelled';
  const isFinished = a.status === 'completed';

  // Open slots for the chosen date, for the inline reschedule picker.
  useEffect(() => {
    if (!showReschedule || !rescheduleDate) return;
    let cancelled = false;
    authedFetch(`/api/admin/doctor-schedule?doctorId=${encodeURIComponent(a.doctorId)}&date=${rescheduleDate}`)
      .then((res) => (res.status === 401 ? onSessionExpired() : res.json()))
      .then((data) => { if (!cancelled && data?.success) setRescheduleSlots(data.slots); })
      .catch(() => { if (!cancelled) setRescheduleSlots([]); });
    setRescheduleTime('');
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReschedule, rescheduleDate]);

  const submitReschedule = async () => {
    if (!rescheduleDate || !rescheduleTime) return;
    setRescheduleBusy(true);
    setError('');
    try {
      const res = await authedFetch(`/api/admin/appointments/${encodeURIComponent(a.id)}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: rescheduleDate, timeSlot: rescheduleTime })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not reschedule.');
      onUpdated(data.appointment);
      setShowReschedule(false);
    } catch (err: any) {
      setError(err?.message || 'Could not reschedule.');
    } finally {
      setRescheduleBusy(false);
    }
  };

  const runConfirmed = async () => {
    if (!confirming) return;
    setConfirmBusy(true);
    setConfirmError('');
    try {
      const isDelete = confirming === 'delete';
      const res = await authedFetch(
        `/api/admin/appointments/${encodeURIComponent(a.id)}${isDelete ? '' : '/cancel'}`,
        isDelete
          ? { method: 'DELETE' }
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notify: notifyPatient }) }
      );
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'That did not go through.');
      setConfirming(null);
      if (isDelete) onDeleted?.(a.id);
      else onUpdated(data.appointment);
    } catch (err: any) {
      setConfirmError(err?.message || 'That did not go through.');
    } finally {
      setConfirmBusy(false);
    }
  };
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

      <div className="flex flex-wrap items-center gap-2">
        <a href={`tel:${a.patientPhone.replace(/[^0-9+]/g, '')}`} className={ghostButtonClass + ' text-[11px] py-2 px-3'}>
          <Phone className="w-3.5 h-3.5" />
          <span>Call {a.patientPhone}</span>
        </a>
        {!isCancelled && !isFinished && (
          <button onClick={() => patchField('status', 'completed')} disabled={busyKey === 'status'} className={ghostButtonClass + ' text-[11px] py-2 px-3'}>
            <Check className="w-3.5 h-3.5" />
            <span>Mark completed</span>
          </button>
        )}
        {!isCancelled && !isFinished && (
          <button onClick={() => setShowReschedule((v) => !v)} className={ghostButtonClass + ' text-[11px] py-2 px-3'}>
            <CalendarClock className="w-3.5 h-3.5" />
            <span>{showReschedule ? 'Close reschedule' : 'Reschedule'}</span>
          </button>
        )}
        {!isCancelled && (
          <button onClick={() => { setConfirmError(''); setConfirming('cancel'); }} className={dangerButtonClass + ' text-[11px] py-2 px-3'}>
            <Ban className="w-3.5 h-3.5" />
            <span>Cancel appointment</span>
          </button>
        )}
        <button onClick={() => { setConfirmError(''); setConfirming('delete'); }} className={dangerButtonClass + ' text-[11px] py-2 px-3 ml-auto'}>
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>

      {showReschedule && (
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
          <p className="text-xs font-bold text-slate-700">Move this appointment</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className={labelClass}>New date</label>
              <input type="date" value={rescheduleDate} min={clinicToday()} onChange={(e) => setRescheduleDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>New time</label>
              <select value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className={inputClass}>
                <option value="">{rescheduleSlots.length === 0 ? 'No slots on this date' : 'Select a time'}</option>
                {rescheduleSlots.filter((s) => !s.blocked && !s.appointmentId).map((s) => <option key={s.time} value={s.time}>{s.time}</option>)}
              </select>
            </div>
            <button onClick={submitReschedule} disabled={rescheduleBusy || !rescheduleTime} className={primaryButtonClass}>
              {rescheduleBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              <span>{rescheduleBusy ? 'Moving...' : 'Reschedule & notify'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400">The patient gets a WhatsApp message with the new time, and the calendar event moves with it.</p>
        </div>
      )}

      {confirming === 'cancel' && (
        <ConfirmDialog
          title={`Cancel ${a.patientName}'s appointment?`}
          tone="danger"
          message={
            <div className="space-y-2.5">
              <p>{formatShortDate(a.date)} at {a.timeSlot}. The slot is freed for other patients and the booking stays on record as cancelled.</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={notifyPatient} onChange={(e) => setNotifyPatient(e.target.checked)} className="w-4 h-4 accent-brand-800" />
                <span className="font-medium text-slate-700">Tell the patient on WhatsApp</span>
              </label>
            </div>
          }
          confirmLabel="Cancel appointment"
          busy={confirmBusy}
          error={confirmError}
          onConfirm={runConfirmed}
          onCancel={() => setConfirming(null)}
        />
      )}

      {confirming === 'delete' && (
        <ConfirmDialog
          title="Delete this appointment permanently?"
          tone="danger"
          message={
            <p>
              <span className="font-semibold">{a.patientName}</span> · {formatShortDate(a.date)} at {a.timeSlot} (#{a.id}) will be erased from the console and database and its calendar event removed. This can't be undone. To keep a record, use <span className="font-semibold">Cancel appointment</span> instead.
            </p>
          }
          requirePhrase="delete"
          confirmLabel="Delete forever"
          busy={confirmBusy}
          error={confirmError}
          onConfirm={runConfirmed}
          onCancel={() => setConfirming(null)}
        />
      )}

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
