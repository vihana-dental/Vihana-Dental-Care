import React, { useEffect, useMemo, useState } from 'react';
import {
  IndianRupee, Video, Stethoscope, Users, Image as ImageIcon,
  Newspaper, HelpCircle, Star, CalendarCheck2, LayoutGrid, CalendarRange, UserCog, CalendarOff,
  Phone, Plus, ArrowRight, Sunrise, MessageCircle
} from 'lucide-react';
import { Appointment, FeeConfig, feeForType, normalizeFeeConfig } from '../../../types';
import { AdminSection } from '../AdminSidebar';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, StatTile, clinicToday, shiftDate, slotMinutes, APPOINTMENT_TAB_HANDOFF_KEY } from '../shared';
import { STATUS_BADGE, paymentLabel } from './AppointmentsPanel';

const SHORTCUTS: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
  { id: 'live-calendar', label: 'Live Calendar', icon: <CalendarRange className="w-4 h-4" /> },
  { id: 'patients', label: 'Patients', icon: <UserCog className="w-4 h-4" /> },
  { id: 'consults', label: 'Online Consults', icon: <Video className="w-4 h-4" /> },
  { id: 'services', label: 'Services', icon: <Stethoscope className="w-4 h-4" /> },
  { id: 'team', label: 'Our Team', icon: <Users className="w-4 h-4" /> },
  { id: 'gallery', label: 'Gallery', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'blog', label: 'Blog', icon: <Newspaper className="w-4 h-4" /> },
  { id: 'faqs', label: 'FAQs', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'reviews', label: 'Reviews', icon: <Star className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendar & Sheets', icon: <CalendarCheck2 className="w-4 h-4" /> }
];

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
  onNavigate: (section: AdminSection) => void;
}

const greeting = () => {
  const hour = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }));
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

// The screen the doctor lands on: what is happening today and what needs a
// decision, rather than a menu of links (the sidebar already is that). Every
// number is computed from the same appointments list the Appointments panel
// uses, so the two never disagree.
export const OverviewPanel: React.FC<Props> = ({ authedFetch, onSessionExpired, onNavigate }) => {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [pendingConsults, setPendingConsults] = useState<number | null>(null);
  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = clinicToday();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authedFetch('/api/admin/appointments');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not load appointments.');
      setAppointments(data.appointments);
    } catch (err: any) {
      setError(err?.message || 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }

    // Secondary data — a failure here must not blank the whole dashboard.
    authedFetch('/api/admin/pending-online-consults')
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((d) => setPendingConsults(Array.isArray(d?.appointments) ? d.appointments.length : Array.isArray(d?.consults) ? d.consults.length : null))
      .catch(() => setPendingConsults(null));
    authedFetch('/api/admin/fee-config')
      .then((r) => (r.status === 401 ? null : r.json()))
      .then((d) => d?.success && setFeeConfig(normalizeFeeConfig(d.feeConfig)))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const list = appointments || [];
    const live = (a: Appointment) => a.status !== 'cancelled' && a.status !== 'completed';
    const todays = list.filter((a) => a.date === today && a.status !== 'cancelled').sort((a, b) => slotMinutes(a.timeSlot) - slotMinutes(b.timeSlot));
    const weekEnd = shiftDate(today, 7);
    const nowMinutes = (() => {
      const [h, m] = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }).split(':').map(Number);
      return h * 60 + m;
    })();
    return {
      todays,
      next: todays.find((a) => live(a) && slotMinutes(a.timeSlot) >= nowMinutes),
      upcoming7: list.filter((a) => a.date > today && a.date <= weekEnd && live(a)).length,
      needsAction: list.filter((a) => a.status === 'payment_failed' || a.status === 'pending_approval' || (a.status === 'pending' && (a.feeAmount ?? 0) > 0)).length,
      newFromWhatsApp: list.filter((a) => a.channel === 'whatsapp' && Date.now() - new Date(a.createdAt).getTime() < 24 * 3600 * 1000).length,
      visitedToday: todays.filter((a) => a.patientVisited).length
    };
  }, [appointments, today]);

  const openAppointments = (tab?: 'today' | 'upcoming' | 'action') => {
    try { if (tab) sessionStorage.setItem(APPOINTMENT_TAB_HANDOFF_KEY, tab); } catch { /* storage unavailable — the panel just opens on its default tab */ }
    onNavigate('appointments');
  };

  return (
    <div className="space-y-4">
      <PanelCard>
        <PanelHeader
          icon={<Sunrise className="w-5 h-5" />}
          title={`${greeting()}, Doctor`}
          subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
          action={
            <button onClick={() => openAppointments()} className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-brand-900 hover:underline">
              All appointments <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        />

        <div className="p-4 sm:p-6 space-y-6">
          {loading && <LoadingRow label="Loading today's schedule..." />}
          {error && <ErrorBanner message={error} onRetry={load} />}

          {appointments && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile
                  label="Today"
                  value={stats.todays.length}
                  hint={stats.todays.length ? `${stats.visitedToday} seen so far` : 'A free day'}
                  onClick={() => openAppointments('today')}
                />
                <StatTile
                  label="Next up"
                  value={stats.next ? stats.next.timeSlot : '—'}
                  hint={stats.next ? stats.next.patientName : 'Nothing left today'}
                  tone={stats.next ? 'good' : 'default'}
                  onClick={() => openAppointments('today')}
                />
                <StatTile
                  label="Next 7 days"
                  value={stats.upcoming7}
                  hint="Booked after today"
                  onClick={() => openAppointments('upcoming')}
                />
                <StatTile
                  label="Needs action"
                  value={stats.needsAction + (pendingConsults ?? 0)}
                  hint={
                    stats.needsAction + (pendingConsults ?? 0) === 0
                      ? 'All clear'
                      : [stats.needsAction ? `${stats.needsAction} booking${stats.needsAction === 1 ? '' : 's'}` : '', pendingConsults ? `${pendingConsults} video consult${pendingConsults === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')
                  }
                  tone={stats.needsAction + (pendingConsults ?? 0) > 0 ? 'attention' : 'default'}
                  onClick={() => (pendingConsults && !stats.needsAction ? onNavigate('consults') : openAppointments('action'))}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-bold text-slate-900">Today's appointments</h3>
                  {stats.newFromWhatsApp > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-full px-2.5 py-1">
                      <MessageCircle className="w-3 h-3" /> {stats.newFromWhatsApp} new from WhatsApp in the last 24h
                    </span>
                  )}
                </div>

                {stats.todays.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-2xl p-6 text-center bg-slate-50">
                    <p className="text-sm font-semibold text-slate-700">No appointments today</p>
                    <p className="text-xs text-slate-500 mt-1">New bookings from the website and WhatsApp will show up here as they come in.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                    {stats.todays.map((a) => (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50">
                        <button onClick={() => openAppointments('today')} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                          <span className="w-20 shrink-0 text-sm font-extrabold text-slate-900">{a.timeSlot}</span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900 truncate">{a.patientName}</span>
                            <span className="block text-[11px] text-slate-500 truncate">
                              {a.serviceName} · {a.consultationType === 'online-video' ? 'Video' : 'In clinic'} · {paymentLabel(a)}
                            </span>
                          </span>
                        </button>
                        <span className={`hidden sm:inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[a.status] || 'bg-slate-100 text-slate-600'}`}>
                          {a.status.replace(/_/g, ' ')}
                        </span>
                        <a href={`tel:${a.patientPhone.replace(/[^0-9+]/g, '')}`} className="p-2 rounded-lg text-slate-400 hover:text-brand-900 hover:bg-brand-200 shrink-0" aria-label={`Call ${a.patientName}`}>
                          <Phone className="w-4 h-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button onClick={() => openAppointments()} className="flex items-center gap-2.5 text-left bg-brand-800 hover:bg-brand-900 text-white rounded-xl px-4 py-3 transition-colors">
                  <Plus className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-bold">New appointment</span>
                </button>
                <button onClick={() => onNavigate('schedule')} className="flex items-center gap-2.5 text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 transition-colors">
                  <CalendarOff className="w-4 h-4 shrink-0 text-brand-900" />
                  <span className="text-sm font-bold text-slate-800">Manage today's schedule</span>
                </button>
                <button onClick={() => onNavigate('fees')} className="flex items-center gap-2.5 text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 transition-colors">
                  <IndianRupee className="w-4 h-4 shrink-0 text-brand-900" />
                  <span className="text-sm font-bold text-slate-800">Booking fees</span>
                </button>
              </div>

              {feeConfig && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <span className="font-semibold text-slate-700">Advance fees right now:</span>{' '}
                  in-clinic {feeForType(feeConfig, false) > 0 ? `₹${feeForType(feeConfig, false)}` : 'none'} · online video {feeForType(feeConfig, true) > 0 ? `₹${feeForType(feeConfig, true)}` : 'none'} (website) · WhatsApp bookings never need payment.
                </p>
              )}
            </>
          )}
        </div>
      </PanelCard>

      <PanelCard>
        <PanelHeader icon={<LayoutGrid className="w-5 h-5" />} title="Shortcuts" subtitle="Everything else in the console" />
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {SHORTCUTS.map((s) => (
              <button
                key={s.id}
                onClick={() => onNavigate(s.id)}
                className="flex items-center gap-2 text-left bg-slate-50 hover:bg-brand-200 border border-slate-200 hover:border-brand-400 rounded-xl px-3 py-2.5 transition-colors text-slate-700"
              >
                <span className="text-brand-900 shrink-0">{s.icon}</span>
                <span className="text-xs font-semibold truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </PanelCard>
    </div>
  );
};
