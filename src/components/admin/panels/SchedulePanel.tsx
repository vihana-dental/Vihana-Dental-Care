import React, { useEffect, useMemo, useState } from 'react';
import { CalendarOff, AlertTriangle, X, Plus, Pencil, Trash2, Check, ChevronLeft, ChevronRight, RotateCcw, Sparkles, Users } from 'lucide-react';
import {
  PanelCard, PanelHeader, LoadingRow, ErrorBanner, ToggleSwitch, ConfirmDialog,
  inputClass, labelClass, primaryButtonClass, ghostButtonClass,
  clinicToday, shiftDate, formatShortDate
} from '../shared';

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

interface DoctorOption {
  id: string;
  name: string;
  displayTitle: string;
}

interface ScheduleSlot {
  time: string;
  blocked: boolean;
  /** true for a slot the admin added (not part of the default weekly hours) */
  custom?: boolean;
  appointmentId?: string;
  patientName?: string;
  /** How many active appointments share this slot (more than 1 only when multiple-per-slot is on). */
  bookedCount?: number;
}

interface ConflictInfo {
  appointmentId: string;
  patientName: string;
  timeSlot: string;
}

/** "2:30 PM" -> "14:30", the value an <input type="time"> expects. */
const toTimeInput = (label: string): string => {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

// Per-doctor schedule editor for one date at a time. Everything here applies
// instantly across the website, chat widget and WhatsApp booking, because they
// all read the same availability check on the server.
//
// Three different actions on a slot, which are easy to confuse:
//   • Turn OFF (the switch)  — the slot stays on the day but shows as
//     unavailable. Use it for "I can't make this one" — it's one tap to undo.
//   • Edit (pencil)          — move the slot to a different time that day.
//   • Delete (bin)           — the slot no longer exists on that date. A slot
//     from the default weekly hours can be restored; one you added is gone.
// Adding a slot on a normally-closed day (e.g. a special Sunday session) opens
// that day for booking.
export const SchedulePanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [doctors, setDoctors] = useState<DoctorOption[] | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(clinicToday());
  const [slots, setSlots] = useState<ScheduleSlot[] | null>(null);
  const [removedSlots, setRemovedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [allowMultiple, setAllowMultiple] = useState<boolean | null>(null);
  const [rulesBusy, setRulesBusy] = useState(false);
  const [rulesNote, setRulesNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [dayBusy, setDayBusy] = useState(false);

  const [newTime, setNewTime] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ time: string; value: string } | null>(null);
  const [deleting, setDeleting] = useState<ScheduleSlot | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<ScheduleSlot[]>([]);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

  const today = clinicToday();
  const isPast = date < today;

  useEffect(() => {
    fetch('/api/bookable-doctors')
      .then((res) => res.json())
      .then((data) => {
        const list: DoctorOption[] = data.doctors || [];
        setDoctors(list);
        if (list.length > 0) setDoctorId((prev) => prev || list[0].id);
      })
      .catch(() => setDoctors([]));
  }, []);

  useEffect(() => {
    authedFetch('/api/admin/booking-rules')
      .then((res) => (res.status === 401 ? onSessionExpired() : res.json()))
      .then((data) => { if (data?.success) setAllowMultiple(Boolean(data.rules?.allowMultiplePerSlot)); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMultiple = async (next: boolean) => {
    setRulesBusy(true);
    setRulesNote(null);
    try {
      const res = await authedFetch('/api/admin/booking-rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowMultiplePerSlot: next })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save this setting.');
      setAllowMultiple(Boolean(data.rules.allowMultiplePerSlot));
      setRulesNote(
        data.persisted === false
          ? { ok: false, text: 'Applied now, but it could not be stored and may reset if the site restarts. Try again in a moment.' }
          : { ok: true, text: next ? 'On — patients can now book a time that already has an appointment.' : 'Off — a booked time slot now closes to other patients.' }
      );
      loadSchedule({ quiet: true });
    } catch (err: any) {
      setRulesNote({ ok: false, text: err?.message || 'Could not save this setting.' });
    } finally {
      setRulesBusy(false);
    }
  };

  const loadSchedule = async (opts: { quiet?: boolean } = {}) => {
    if (!doctorId) return;
    if (!opts.quiet) setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch(`/api/admin/doctor-schedule?doctorId=${encodeURIComponent(doctorId)}&date=${date}`);
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load schedule.');
      setSlots(data.slots);
      setRemovedSlots(data.removedSlots || []);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load schedule.');
      setSlots(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setEditing(null);
    setActionError('');
    loadSchedule();
  }, [doctorId, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const openConflict = (info: ConflictInfo) => {
    setConflict(info);
    setRescheduleDate(date);
    setRescheduleTime('');
    setRescheduleError('');
  };

  // One place for the "call an endpoint, then refresh the list" pattern.
  const callSlotApi = async (path: string, init: RequestInit): Promise<any> => {
    const res = await authedFetch(path, init);
    if (res.status === 401) { onSessionExpired(); return null; }
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'That change could not be saved.');
    return data;
  };

  const toggleSlot = async (slot: ScheduleSlot) => {
    const nextBlocked = !slot.blocked;
    setBusySlot(slot.time);
    setActionError('');
    try {
      const data = await callSlotApi('/api/admin/doctor-schedule/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, date, timeSlot: slot.time, blocked: nextBlocked })
      });
      if (!data) return;
      setSlots((prev) => prev && prev.map((s) => (s.time === slot.time ? { ...s, blocked: nextBlocked } : s)));
      if (data.conflict) openConflict({ appointmentId: data.conflict.appointmentId, patientName: data.conflict.patientName, timeSlot: slot.time });
    } catch (err: any) {
      setActionError(err?.message || 'Could not update this slot.');
    } finally {
      setBusySlot(null);
    }
  };

  const toggleDay = async (blocked: boolean) => {
    setDayBusy(true);
    setActionError('');
    try {
      const data = await callSlotApi('/api/admin/doctor-schedule/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, date, blocked })
      });
      if (!data) return;
      setSlots((prev) => prev && prev.map((s) => ({ ...s, blocked })));
      if (blocked && data.conflicts?.length > 0) {
        const first = data.conflicts[0];
        openConflict({ appointmentId: first.appointmentId, patientName: first.patientName, timeSlot: first.timeSlot });
      }
    } catch (err: any) {
      setActionError(err?.message || 'Could not update the day.');
    } finally {
      setDayBusy(false);
    }
  };

  const addSlot = async (timeValue: string) => {
    if (!timeValue) return;
    setAdding(true);
    setActionError('');
    try {
      const data = await callSlotApi('/api/admin/doctor-schedule/slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, date, timeSlot: timeValue })
      });
      if (!data) return;
      setNewTime('');
      await loadSchedule({ quiet: true });
    } catch (err: any) {
      setActionError(err?.message || 'Could not add the slot.');
    } finally {
      setAdding(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusySlot(editing.time);
    setActionError('');
    try {
      const data = await callSlotApi('/api/admin/doctor-schedule/slot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, date, timeSlot: editing.time, newTimeSlot: editing.value })
      });
      if (!data) return;
      const wasBooked = data.conflict;
      setEditing(null);
      await loadSchedule({ quiet: true });
      if (wasBooked) openConflict({ appointmentId: wasBooked.appointmentId, patientName: wasBooked.patientName, timeSlot: editing.time });
    } catch (err: any) {
      setActionError(err?.message || 'Could not change the slot.');
    } finally {
      setBusySlot(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      const data = await callSlotApi(
        `/api/admin/doctor-schedule/slot?doctorId=${encodeURIComponent(doctorId)}&date=${date}&timeSlot=${encodeURIComponent(deleting.time)}`,
        { method: 'DELETE' }
      );
      if (!data) return;
      const removed = deleting;
      setDeleting(null);
      await loadSchedule({ quiet: true });
      if (data.conflict) openConflict({ appointmentId: data.conflict.appointmentId, patientName: data.conflict.patientName, timeSlot: removed.time });
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete the slot.');
    } finally {
      setDeleteBusy(false);
    }
  };

  useEffect(() => {
    if (!conflict || !rescheduleDate) return;
    authedFetch(`/api/admin/doctor-schedule?doctorId=${encodeURIComponent(doctorId)}&date=${rescheduleDate}`)
      .then((res) => (res.status === 401 ? onSessionExpired() : res.json()))
      .then((data) => { if (data?.success) setRescheduleSlots(data.slots); })
      .catch(() => setRescheduleSlots([]));
    setRescheduleTime('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflict, rescheduleDate]);

  const submitReschedule = async () => {
    if (!conflict || !rescheduleDate || !rescheduleTime) return;
    setRescheduling(true);
    setRescheduleError('');
    try {
      const res = await authedFetch(`/api/admin/appointments/${conflict.appointmentId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: rescheduleDate, timeSlot: rescheduleTime })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not reschedule this appointment.');
      setConflict(null);
      loadSchedule({ quiet: true });
    } catch (err: any) {
      setRescheduleError(err?.message || 'Could not reschedule this appointment.');
    } finally {
      setRescheduling(false);
    }
  };

  const conflictSlots = rescheduleSlots.filter((s) => !s.blocked && !s.appointmentId);

  const summary = useMemo(() => {
    const list = slots || [];
    return {
      total: list.length,
      booked: list.filter((s) => s.appointmentId).length,
      off: list.filter((s) => s.blocked).length,
      open: list.filter((s) => !s.blocked && !s.appointmentId).length
    };
  }, [slots]);

  return (
    <div className="space-y-4">
      <PanelCard>
        <div className="p-4 sm:p-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-brand-200 border border-brand-300 flex items-center justify-center text-brand-900 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">Multiple appointments in the same time slot</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {allowMultiple
                  ? 'On: several patients can book the same time. A slot stays open after it is booked. Turn off to go back to one patient per slot.'
                  : 'Off: one patient per time slot — once a slot is booked it closes to everyone else. Turn on if you see more than one patient at a time.'}
              </p>
              {rulesNote && <p className={`text-[11px] mt-1.5 font-medium ${rulesNote.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{rulesNote.text}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <ToggleSwitch checked={Boolean(allowMultiple)} onChange={toggleMultiple} disabled={rulesBusy || allowMultiple === null} />
            <span className={`text-[10px] font-bold uppercase tracking-wide ${allowMultiple ? 'text-emerald-700' : 'text-slate-400'}`}>{allowMultiple ? 'Allowed' : 'One per slot'}</span>
          </div>
        </div>
      </PanelCard>

      <PanelCard>
        <PanelHeader
          icon={<CalendarOff className="w-5 h-5" />}
          title="Doctor Schedule"
          subtitle="Add, move, delete or switch off slots — applies instantly to website, chat and WhatsApp booking"
        />

        <div className="p-4 sm:p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Doctor / Consultant</label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputClass}>
                {(doctors || []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name} — {d.displayTitle}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Date</label>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setDate((d) => shiftDate(d, -1))} disabled={date <= today} className={ghostButtonClass + ' px-2.5 shrink-0 disabled:opacity-40'} aria-label="Previous day">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input type="date" value={date} min={today} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass} />
                <button type="button" onClick={() => setDate((d) => shiftDate(d, 1))} className={ghostButtonClass + ' px-2.5 shrink-0'} aria-label="Next day">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{formatShortDate(date)}{date === today ? ' · Today' : ''}</p>
              {slots && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {summary.total === 0
                    ? 'No slots on this day'
                    : `${summary.total} slot${summary.total === 1 ? '' : 's'} · ${summary.booked} booked · ${summary.open} open${summary.off ? ` · ${summary.off} switched off` : ''}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {date !== today && <button type="button" onClick={() => setDate(today)} className={ghostButtonClass + ' text-xs py-2'}>Jump to today</button>}
              <button onClick={() => toggleDay(true)} disabled={dayBusy || isPast || summary.total === 0} className={ghostButtonClass + ' text-xs py-2'}>Turn off whole day</button>
              <button onClick={() => toggleDay(false)} disabled={dayBusy || isPast || summary.total === 0} className={ghostButtonClass + ' text-xs py-2'}>Turn on whole day</button>
            </div>
          </div>

          {loading && <LoadingRow label="Loading schedule..." />}
          {loadError && <ErrorBanner message={loadError} onRetry={() => loadSchedule()} />}
          {actionError && <ErrorBanner message={actionError} />}

          {!loading && !loadError && slots && (
            <>
              {slots.length === 0 ? (
                <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50">
                  <p className="text-sm font-semibold text-slate-700">The clinic is closed on this day</p>
                  <p className="text-xs text-slate-500 mt-1">Add a slot below to open it for a special session — patients can then book it on every channel.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {slots.map((slot) => {
                    const isEditing = editing?.time === slot.time;
                    const busy = busySlot === slot.time;
                    return (
                      <li
                        key={slot.time}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border ${
                          slot.appointmentId ? 'border-amber-200 bg-amber-50' : slot.blocked ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="w-24 shrink-0">
                          {isEditing ? (
                            <input
                              type="time"
                              autoFocus
                              value={editing!.value}
                              onChange={(e) => setEditing({ time: slot.time, value: e.target.value })}
                              className={inputClass + ' py-1.5 text-xs'}
                            />
                          ) : (
                            <p className={`text-sm font-bold ${slot.blocked ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{slot.time}</p>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                          {slot.appointmentId && (
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 rounded-full px-2 py-0.5 truncate max-w-full">
                              Booked · {slot.patientName}{(slot.bookedCount ?? 1) > 1 ? ` +${(slot.bookedCount ?? 1) - 1} more` : ''}
                            </span>
                          )}
                          {slot.appointmentId && allowMultiple && !slot.blocked && (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Still open</span>
                          )}
                          {!slot.appointmentId && slot.blocked && (
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-200 rounded-full px-2 py-0.5">Switched off</span>
                          )}
                          {!slot.appointmentId && !slot.blocked && (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">Open for booking</span>
                          )}
                          {slot.custom && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-900 bg-brand-200 rounded-full px-2 py-0.5">
                              <Sparkles className="w-3 h-3" /> Added
                            </span>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={saveEdit} disabled={busy || !editing!.value} className={primaryButtonClass + ' px-2.5 py-1.5'} aria-label="Save time">
                              <Check className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => setEditing(null)} className={ghostButtonClass + ' px-2.5 py-1.5'} aria-label="Cancel edit">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditing({ time: slot.time, value: toTimeInput(slot.time) })}
                              disabled={isPast}
                              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                              aria-label={`Change time of ${slot.time}`}
                              title="Change time"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeleteError(''); setDeleting(slot); }}
                              disabled={isPast}
                              className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                              aria-label={`Delete ${slot.time}`}
                              title="Delete slot"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="pl-1.5" title={slot.blocked ? 'Switch on' : 'Switch off'}>
                              <ToggleSwitch checked={!slot.blocked} onChange={() => toggleSlot(slot)} disabled={busy || isPast} />
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {!isPast && (
                <form
                  onSubmit={(e) => { e.preventDefault(); addSlot(newTime); }}
                  className="flex flex-col sm:flex-row sm:items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3.5"
                >
                  <div className="flex-1">
                    <label className={labelClass}>Add a slot on {formatShortDate(date)}</label>
                    <input type="time" required value={newTime} onChange={(e) => setNewTime(e.target.value)} className={inputClass} />
                  </div>
                  <button type="submit" disabled={adding || !newTime} className={primaryButtonClass + ' sm:min-w-[140px]'}>
                    <Plus className="w-4 h-4" />
                    <span>{adding ? 'Adding...' : 'Add slot'}</span>
                  </button>
                </form>
              )}

              {removedSlots.length > 0 && !isPast && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Deleted from this day's default hours</p>
                  <div className="flex flex-wrap gap-1.5">
                    {removedSlots.map((time) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => addSlot(time)}
                        disabled={adding}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-dashed border-slate-300 hover:border-brand-400 hover:text-brand-900 rounded-full px-3 py-1.5 transition-colors"
                        title="Restore this slot"
                      >
                        <RotateCcw className="w-3 h-3" /> {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isPast && <p className="text-xs text-slate-400">This date has passed — its schedule is read-only.</p>}
            </>
          )}
        </div>
      </PanelCard>

      {deleting && (
        <ConfirmDialog
          title={`Delete the ${deleting.time} slot?`}
          message={
            deleting.appointmentId ? (
              <>
                <span className="font-semibold">{deleting.patientName}</span> is booked at this time. The slot will be removed from {formatShortDate(date)} and you'll be asked to reschedule them right away.
              </>
            ) : deleting.custom ? (
              <>This slot was added by you, so it will be removed for good. You can add it again anytime.</>
            ) : (
              <>It will disappear from {formatShortDate(date)} only. You can restore it from "Deleted from this day's default hours".</>
            )
          }
          confirmLabel="Delete slot"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}

      {conflict && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-900">Existing booking on this slot</p>
                  <p className="text-xs text-slate-600 mt-1">
                    <span className="font-semibold">{conflict.patientName}</span> is booked at {conflict.timeSlot}. Pick a new time to reschedule them — a WhatsApp notice will be sent automatically.
                  </p>
                </div>
              </div>
              <button onClick={() => setConflict(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 shrink-0" aria-label="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className={labelClass}>New date</label>
              <input type="date" value={rescheduleDate} min={today} onChange={(e) => setRescheduleDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>New time</label>
              <select value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className={inputClass}>
                <option value="">Select a time</option>
                {conflictSlots.map((s) => <option key={s.time} value={s.time}>{s.time}</option>)}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">Showing this doctor's open slots for the date above.</p>
            </div>

            {rescheduleError && <ErrorBanner message={rescheduleError} />}

            <div className="flex gap-2">
              <button onClick={() => setConflict(null)} className={ghostButtonClass + ' flex-1'}>Later</button>
              <button onClick={submitReschedule} disabled={rescheduling || !rescheduleTime} className={primaryButtonClass + ' flex-1'}>
                {rescheduling ? 'Rescheduling...' : 'Reschedule & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
