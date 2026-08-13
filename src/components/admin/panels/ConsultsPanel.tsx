import React, { useEffect, useState } from 'react';
import { Video, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Appointment } from '../../../types';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner } from '../shared';

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const ConsultsPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [consults, setConsults] = useState<Appointment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/pending-online-consults');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load pending consults.');
      setConsults(data.appointments);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load pending online consults.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id: string, action: 'approve' | 'reschedule') => {
    setActioningId(id);
    setActionError('');
    try {
      const res = await authedFetch(`/api/admin/online-consults/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Action failed.');
      setConsults((prev) => prev && prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setActionError(err?.message || 'Action failed. Please try again.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <PanelCard>
      <PanelHeader icon={<Video className="w-5 h-5" />} title="Pending Online Consults" subtitle="Approve to generate the Meet link (sent on WhatsApp) or release the slot" />
      <div className="p-6 space-y-3">
        {loading && <LoadingRow label="Loading pending consults..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}
        {actionError && <ErrorBanner message={actionError} />}

        {consults && !loading && consults.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Nothing waiting — all online consults are confirmed.</p>
        )}

        {consults && consults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {consults.map((appt) => (
              <div key={appt.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{appt.patientName}</p>
                  <p className="text-xs text-slate-500">{appt.serviceName}</p>
                  <p className="text-xs text-brand-900 font-semibold mt-0.5">{appt.date} at {appt.timeSlot}</p>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">#{appt.id} · {appt.patientPhone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => act(appt.id, 'approve')}
                    disabled={actioningId === appt.id}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-brand-800 hover:bg-brand-900 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-colors"
                  >
                    {actioningId === appt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => act(appt.id, 'reschedule')}
                    disabled={actioningId === appt.id}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-bold py-2.5 rounded-lg border border-slate-200 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Release Slot</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelCard>
  );
};
