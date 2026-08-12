import React, { useEffect, useState } from 'react';
import { CalendarCheck2, Loader2, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
import { PanelCard, PanelHeader, ErrorBanner } from '../shared';

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const CalendarPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [status, setStatus] = useState<{ connected: boolean; clientConfigured: boolean } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState('');

  const load = async () => {
    setStatusLoading(true);
    try {
      const res = await authedFetch('/api/admin/google-status');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (data.success) setStatus({ connected: data.connected, clientConfigured: data.clientConfigured });
    } catch {
      // Non-critical — the connect button will surface its own error if clicked.
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setConnectLoading(true);
    setConnectError('');
    try {
      const res = await authedFetch('/api/admin/google-connect');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not start the Google connection.');
      window.location.href = data.url;
    } catch (err: any) {
      setConnectError(err?.message || 'Could not start the Google connection.');
      setConnectLoading(false);
    }
  };

  return (
    <PanelCard>
      <PanelHeader icon={<CalendarCheck2 className="w-5 h-5" />} title="Google Calendar & Sheets" subtitle="Powers availability sync, event creation, Meet links & the appointment log sheet" />
      <div className="p-6 space-y-3 max-w-md">
        {statusLoading && (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
            <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
            <span>Checking connection...</span>
          </div>
        )}

        {!statusLoading && status && (
          <>
            <div className={`flex items-center gap-2 text-sm rounded-xl p-3 border ${
              status.connected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
            }`}>
              {status.connected ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{status.connected ? 'Connected — bookings sync live.' : 'Not connected — bookings use placeholder data until connected.'}</span>
            </div>

            {!status.clientConfigured && (
              <p className="text-xs text-slate-400">
                GOOGLE_OAUTH_CLIENT_ID / SECRET / REDIRECT_URI aren't set in .env yet — add those first.
              </p>
            )}

            {connectError && <ErrorBanner message={connectError} />}

            <button
              onClick={handleConnect}
              disabled={connectLoading || !status.clientConfigured}
              className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-sm font-bold py-2.5 rounded-xl border border-slate-200 transition-colors"
            >
              {connectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              <span>{connectLoading ? 'Redirecting to Google...' : status.connected ? 'Reconnect / Switch Google Account' : 'Connect Google Calendar'}</span>
            </button>
          </>
        )}
      </div>
    </PanelCard>
  );
};
