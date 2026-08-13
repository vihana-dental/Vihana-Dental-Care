import React, { useEffect, useState } from 'react';
import { CalendarOff, AlertTriangle, X } from 'lucide-react';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, ToggleSwitch, inputClass, labelClass, primaryButtonClass, ghostButtonClass } from '../shared';

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
  appointmentId?: string;
  patientName?: string;
}

interface ConflictInfo {
  appointmentId: string;
  patientName: string;
  timeSlot: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

// Per-doctor day-off / slot-off schedule editor. A slot is bookable by
// default — toggling it off here is what makes it unavailable across every
// booking channel (website, chat widget, WhatsApp bot), since they all read
// through the same computeAvailability() check on the server. If a slot
// being blocked already has a live appointment on it, this surfaces a
// reschedule prompt right there rather than silently leaving a booked
// patient on a slot the doctor just said they can't make.
export const SchedulePanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [doctors, setDoctors] = useState<DoctorOption[] | null>(null);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState<ScheduleSlot[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [dayBusy, setDayBusy] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleSlots, setRescheduleSlots] = useState<ScheduleSlot[]>([]);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

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

  const loadSchedule = async () => {
    if (!doctorId) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch(`/api/admin/doctor-schedule?doctorId=${encodeURIComponent(doctorId)}&date=${date}`);
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load schedule.');
      setSlots(data.slots);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load schedule.');
      setSlots(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSchedule(); }, [doctorId, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSlot = async (slot: ScheduleSlot) => {
    const nextBlocked = !slot.blocked;
    setBusySlot(slot.time);
    try {
      const res = await authedFetch('/api/admin/doctor-schedule/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, date, timeSlot: slot.time, blocked: nextBlocked })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not update this slot.');

      setSlots((prev) => prev && prev.map((s) => (s.time === slot.time ? { ...s, blocked: nextBlocked } : s)));

      if (data.conflict) {
        setConflict({ appointmentId: data.conflict.appointmentId, patientName: data.conflict.patientName, timeSlot: slot.time });
        setRescheduleDate(date);
        setRescheduleTime('');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Could not update this slot.');
    } finally {
      setBusySlot(null);
    }
  };

  const toggleDay = async (blocked: boolean) => {
    setDayBusy(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/doctor-schedule/day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId, date, blocked })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not update the day.');

      setSlots((prev) => prev && prev.map((s) => ({ ...s, blocked })));

      if (blocked && data.conflicts?.length > 0) {
        const first = data.conflicts[0];
        setConflict({ appointmentId: first.appointmentId, patientName: first.patientName, timeSlot: first.timeSlot });
        setRescheduleDate(date);
        setRescheduleTime('');
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Could not update the day.');
    } finally {
      setDayBusy(false);
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
    } catch (err: any) {
      setRescheduleError(err?.message || 'Could not reschedule this appointment.');
    } finally {
      setRescheduling(false);
    }
  };

  const conflictSlots = rescheduleSlots.filter((s) => !s.blocked);

  return (
    <div className="space-y-4">
      <PanelCard>
        <PanelHeader
          icon={<CalendarOff className="w-5 h-5" />}
          title="Doctor Schedule"
          subtitle="Turn off individual slots or a whole day when a doctor is unavailable — applies instantly across the website, chat, and WhatsApp booking"
        />

        <div className="p-4 sm:p-6 space-y-4">
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
              <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => toggleDay(true)} disabled={dayBusy} className={ghostButtonClass}>Block whole day</button>
            <button onClick={() => toggleDay(false)} disabled={dayBusy} className={ghostButtonClass}>Unblock whole day</button>
          </div>

          {loading && <LoadingRow label="Loading schedule..." />}
          {loadError && <ErrorBanner message={loadError} onRetry={loadSchedule} />}

          {!loading && !loadError && slots && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {slots.map((slot) => (
                <div key={slot.time} className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border ${slot.appointmentId ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{slot.time}</p>
                    {slot.patientName && <p className="text-[10px] text-amber-700 truncate">{slot.patientName}</p>}
                  </div>
                  <ToggleSwitch checked={!slot.blocked} onChange={() => toggleSlot(slot)} disabled={busySlot === slot.time} />
                </div>
              ))}
              {slots.length === 0 && <p className="col-span-full text-sm text-slate-400 py-6 text-center">Clinic is closed this day.</p>}
            </div>
          )}
        </div>
      </PanelCard>

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
              <input type="date" value={rescheduleDate} min={todayISO()} onChange={(e) => setRescheduleDate(e.target.value)} className={inputClass} />
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
