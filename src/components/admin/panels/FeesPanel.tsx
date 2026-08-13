import React, { useEffect, useState } from 'react';
import { IndianRupee, Loader2, CheckCircle2 } from 'lucide-react';
import { FeeConfig } from '../../../types';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, SuccessBanner, inputClass, labelClass, primaryButtonClass } from '../shared';

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const FeesPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/fee-config');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load fee settings.');
      setFeeConfig(data.feeConfig);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load current fee settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeConfig) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const res = await authedFetch('/api/admin/fee-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feeConfig)
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save.');
      setFeeConfig(data.feeConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PanelCard>
      <PanelHeader icon={<IndianRupee className="w-5 h-5" />} title="Booking Advance Fees" subtitle="Changes apply to new bookings immediately" />
      <div className="p-6 space-y-4 max-w-md">
        {loading && <LoadingRow label="Loading current fees..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {feeConfig && !loading && (
          <form onSubmit={handleSave} className="space-y-4">
            <label className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer">
              <span className="text-sm font-semibold text-slate-700">Require advance fee to confirm booking</span>
              <input
                type="checkbox"
                checked={feeConfig.confirmationFeeEnabled}
                onChange={(e) => setFeeConfig({ ...feeConfig, confirmationFeeEnabled: e.target.checked })}
                className="w-4 h-4 accent-brand-800"
              />
            </label>

            <div>
              <label className={labelClass}>In-Clinic Visit Fee (₹)</label>
              <input
                type="number"
                min={0}
                value={feeConfig.inClinicFeeINR}
                onChange={(e) => setFeeConfig({ ...feeConfig, inClinicFeeINR: Number(e.target.value) })}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Online Video Consult Fee (₹)</label>
              <input
                type="number"
                min={0}
                value={feeConfig.onlineFeeINR}
                onChange={(e) => setFeeConfig({ ...feeConfig, onlineFeeINR: Number(e.target.value) })}
                className={inputClass}
              />
            </div>

            {saveError && <ErrorBanner message={saveError} />}
            {saveSuccess && <SuccessBanner message="Saved. New fees are live." />}

            <button type="submit" disabled={saving} className={primaryButtonClass + ' w-full'}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </form>
        )}
      </div>
    </PanelCard>
  );
};
