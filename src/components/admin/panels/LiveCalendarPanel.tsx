import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { Appointment } from '../../../types';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner } from '../shared';
import { STATUS_BADGE, AppointmentDetailPanel } from './AppointmentsPanel';

// "10:30 AM" -> 630 (minutes since midnight), for sorting a day's
// appointments chronologically in the day view.
const timeToMinutes = (timeSlot: string): number => {
  const match = timeSlot.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  return hours * 60 + parseInt(match[2], 10);
};

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const pad = (n: number) => n.toString().padStart(2, '0');
// Builds a YYYY-MM-DD string from local date parts — deliberately not
// Date.toISOString(), which converts to UTC and can silently shift the
// date by a day depending on the browser's timezone offset. Appointment
// dates are plain local-date strings (Asia/Kolkata), so this has to match
// that exactly to group correctly.
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// "2026-01-15" -> "Wednesday, 15 January 2026" — parsed from the parts
// rather than `new Date("2026-01-15")` for the same local-timezone-shift
// reason as dateKey above.
const formatDayViewHeading = (key: string): string => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAY_FULL[date.getDay()]}, ${d} ${MONTH_LABELS[m - 1]} ${y}`;
};

// A second view over exactly the same data and actions AppointmentsPanel.tsx
// already built (Phase 5) — a calendar grid instead of a filterable table.
// Deliberately a separate sidebar entry from CalendarPanel.tsx, which is
// about the Google Calendar OAuth *connection status*, not an appointments
// view — conflating the two would make "is Calendar connected" and "show me
// my appointments" the same screen when they're not the same question.
export const LiveCalendarPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dayViewDate, setDayViewDate] = useState<string | null>(null);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

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

  const byDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    (appointments || []).forEach((a) => {
      (map[a.date] ||= []).push(a);
    });
    return map;
  }, [appointments]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const list: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [viewYear, viewMonth]);

  const goToMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
  };

  const selected = appointments?.find((a) => a.id === selectedId) || null;
  const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div className="space-y-4">
      <PanelCard>
        <PanelHeader
          icon={<CalendarRange className="w-5 h-5" />}
          title="Live Calendar"
          subtitle="Every appointment, laid out on a calendar — the same data and actions as the Appointments list"
          action={
            <div className="flex items-center gap-1.5">
              <button onClick={() => goToMonth(-1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Previous month"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={goToToday} className="px-3 py-1.5 rounded-lg text-xs font-bold text-brand-900 hover:bg-brand-200">Today</button>
              <button onClick={() => goToMonth(1)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Next month"><ChevronRight className="w-4 h-4" /></button>
            </div>
          }
        />

        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-sm font-bold text-slate-900">{MONTH_LABELS[viewMonth]} {viewYear}</p>

          {loading && <LoadingRow label="Loading appointments..." />}
          {loadError && <ErrorBanner message={loadError} onRetry={load} />}

          {!loading && !loadError && (
            <div className="overflow-x-auto -mx-2">
              <div className="min-w-[640px] grid grid-cols-7 gap-1.5 px-2">
                {WEEKDAY_LABELS.map((w) => (
                  <div key={w} className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center py-1">{w}</div>
                ))}
                {cells.map((day, i) => {
                  if (day === null) return <div key={`empty-${i}`} className="min-h-[92px]" />;
                  const key = dateKey(viewYear, viewMonth, day);
                  const dayAppointments = byDate[key] || [];
                  const isToday = key === todayKey;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setDayViewDate(key)}
                      className={`min-h-[92px] rounded-lg border p-1.5 text-left transition-colors hover:border-brand-500 hover:bg-brand-50 ${isToday ? 'border-brand-500 bg-brand-200/40' : 'border-slate-100 bg-white'}`}
                    >
                      <p className={`text-[11px] font-bold ${isToday ? 'text-brand-900' : 'text-slate-500'}`}>{day}</p>
                      <div className="space-y-1 mt-1">
                        {dayAppointments.slice(0, 3).map((a) => (
                          <span
                            key={a.id}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setSelectedId(a.id); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedId(a.id); } }}
                            className={`block w-full text-left px-1.5 py-1 rounded text-[10px] font-semibold truncate ${STATUS_BADGE[a.status] || 'bg-slate-100 text-slate-600'} ${selectedId === a.id ? 'ring-2 ring-brand-700' : ''}`}
                            title={`${a.patientName} — ${a.timeSlot}`}
                          >
                            {a.timeSlot.replace(' ', '')} {a.patientName}
                          </span>
                        ))}
                        {dayAppointments.length > 3 && (
                          <p className="text-[9px] text-slate-400 pl-1">+{dayAppointments.length - 3} more</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </PanelCard>

      {selected && (
        <PanelCard>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-900">{selected.patientName} · #{selected.id}</p>
              <p className="text-xs text-slate-500">{selected.date} at {selected.timeSlot} — {selected.serviceName}</p>
            </div>
            <button onClick={() => setSelectedId(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 sm:p-6">
            <AppointmentDetailPanel
              appointment={selected}
              authedFetch={authedFetch}
              onSessionExpired={onSessionExpired}
              onUpdated={(updated) => setAppointments((prev) => prev && prev.map((a) => a.id === updated.id ? updated : a))}
            />
          </div>
        </PanelCard>
      )}

      {dayViewDate && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setDayViewDate(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <p className="text-sm font-bold text-slate-900">{formatDayViewHeading(dayViewDate)}</p>
                <p className="text-xs text-slate-500">
                  {(byDate[dayViewDate] || []).length} appointment{(byDate[dayViewDate] || []).length === 1 ? '' : 's'}
                </p>
              </div>
              <button onClick={() => setDayViewDate(null)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close day view">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto scroll-thin space-y-2">
              {(byDate[dayViewDate] || []).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-8">No appointments booked for this day.</p>
              )}
              {[...(byDate[dayViewDate] || [])]
                .sort((a, b) => timeToMinutes(a.timeSlot) - timeToMinutes(b.timeSlot))
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => { setSelectedId(a.id); setDayViewDate(null); }}
                    className="w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-xl border border-slate-100 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-brand-800 shrink-0 w-16">
                      <Clock className="w-3.5 h-3.5" />
                      {a.timeSlot}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{a.patientName}</p>
                      <p className="text-xs text-slate-500 truncate">{a.serviceName}</p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${STATUS_BADGE[a.status] || 'bg-slate-100 text-slate-600'}`}>
                      {a.status}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
