import React, { useEffect, useMemo, useState } from 'react';
import { IndianRupee, Loader2, CheckCircle2, Building2, Video, MessageCircle } from 'lucide-react';
import { FeeConfig, feeForType, normalizeFeeConfig } from '../../../types';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, SuccessBanner, ToggleSwitch, inputClass, labelClass, primaryButtonClass } from '../shared';

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

// One advance-fee card per consultation type. Each has its own on/off switch
// and its own amount, so the clinic can, for example, take a deposit for online
// video consults while leaving in-clinic visits free. Turning a switch off
// keeps the amount saved, so switching it back on doesn't mean retyping it.
const FeeCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  amount: number;
  amountLabel: string;
  onToggle: (on: boolean) => void;
  onAmount: (amount: number) => void;
}> = ({ icon, title, description, enabled, amount, amountLabel, onToggle, onAmount }) => (
  <div className={`border rounded-2xl p-4 space-y-4 transition-colors ${enabled ? 'border-brand-300 bg-white' : 'border-slate-200 bg-slate-50'}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-brand-200 border border-brand-300 flex items-center justify-center text-brand-900 shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <ToggleSwitch checked={enabled} onChange={onToggle} />
        <span className={`text-[10px] font-bold uppercase tracking-wide ${enabled ? 'text-emerald-700' : 'text-slate-400'}`}>{enabled ? 'Fee required' : 'No fee'}</span>
      </div>
    </div>

    <div>
      <label className={labelClass}>{amountLabel}</label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">₹</span>
        <input
          type="number"
          min={0}
          step={50}
          inputMode="numeric"
          value={Number.isFinite(amount) ? amount : 0}
          disabled={!enabled}
          onChange={(e) => onAmount(Math.max(0, Number(e.target.value)))}
          className={inputClass + ' pl-8 disabled:bg-slate-100 disabled:text-slate-400'}
        />
      </div>
      {enabled && amount <= 0 && (
        <p className="text-[11px] text-amber-700 mt-1.5">The fee is switched on but set to ₹0, so bookings of this type will be confirmed without payment.</p>
      )}
    </div>
  </div>
);

export const FeesPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<FeeConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveNote, setSaveNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/fee-config');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load fee settings.');
      const normalized = normalizeFeeConfig(data.feeConfig);
      setFeeConfig(normalized);
      setSavedConfig(normalized);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load current fee settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(
    () => Boolean(feeConfig && savedConfig && JSON.stringify(feeConfig) !== JSON.stringify(savedConfig)),
    [feeConfig, savedConfig]
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeConfig) return;
    setSaving(true);
    setSaveError('');
    setSaveNote(null);
    try {
      const res = await authedFetch('/api/admin/fee-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inClinicFeeEnabled: feeConfig.inClinicFeeEnabled,
          inClinicFeeINR: feeConfig.inClinicFeeINR,
          onlineFeeEnabled: feeConfig.onlineFeeEnabled,
          onlineFeeINR: feeConfig.onlineFeeINR
        })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save.');
      const normalized = normalizeFeeConfig(data.feeConfig);
      setFeeConfig(normalized);
      setSavedConfig(normalized);
      setSaveNote(
        data.persisted === false
          ? { ok: false, text: 'Live now, but it could not be stored — it may reset if the site restarts. Save again in a moment.' }
          : { ok: true, text: 'Saved. The new fees are live on the website and chat widget.' }
      );
      setTimeout(() => setSaveNote((n) => (n?.ok ? null : n)), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inClinic = feeConfig ? feeForType(feeConfig, false) : 0;
  const online = feeConfig ? feeForType(feeConfig, true) : 0;

  return (
    <PanelCard>
      <PanelHeader icon={<IndianRupee className="w-5 h-5" />} title="Booking Advance Fees" subtitle="Set the advance fee for each consultation type separately — changes apply to new bookings immediately" />
      <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
        {loading && <LoadingRow label="Loading current fees..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {feeConfig && !loading && (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FeeCard
                icon={<Building2 className="w-4 h-4" />}
                title="In-Clinic Visit"
                description="Patients visiting the Kalapatti clinic in person."
                enabled={feeConfig.inClinicFeeEnabled}
                amount={feeConfig.inClinicFeeINR}
                amountLabel="In-Clinic Visit Fee (₹)"
                onToggle={(on) => setFeeConfig({ ...feeConfig, inClinicFeeEnabled: on })}
                onAmount={(amount) => setFeeConfig({ ...feeConfig, inClinicFeeINR: amount })}
              />
              <FeeCard
                icon={<Video className="w-4 h-4" />}
                title="Online Video Consult"
                description="Patients consulting by Google Meet video call."
                enabled={feeConfig.onlineFeeEnabled}
                amount={feeConfig.onlineFeeINR}
                amountLabel="Online Video Consult Fee (₹)"
                onToggle={(on) => setFeeConfig({ ...feeConfig, onlineFeeEnabled: on })}
                onAmount={(amount) => setFeeConfig({ ...feeConfig, onlineFeeINR: amount })}
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs text-slate-600">
              <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">What patients will see</p>
              <p>
                <span className="font-semibold">In-clinic bookings:</span>{' '}
                {inClinic > 0 ? `pay a refundable ₹${inClinic} to confirm.` : 'confirmed straight away, no payment.'}
              </p>
              <p>
                <span className="font-semibold">Online consult bookings:</span>{' '}
                {online > 0 ? `pay a refundable ₹${online} to confirm.` : 'confirmed straight away, no payment.'}
              </p>
              <p className="flex items-start gap-1.5 pt-1 border-t border-slate-200 text-slate-500">
                <MessageCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
                <span>Appointments booked on WhatsApp are always confirmed directly with no payment, regardless of these settings.</span>
              </p>
            </div>

            {saveError && <ErrorBanner message={saveError} />}
            {saveNote && (saveNote.ok ? <SuccessBanner message={saveNote.text} /> : <ErrorBanner message={saveNote.text} />)}

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving || !dirty} className={primaryButtonClass + ' sm:min-w-[180px]'}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
              {dirty && !saving && <span className="text-xs text-amber-700 font-medium">You have unsaved changes</span>}
            </div>
          </form>
        )}
      </div>
    </PanelCard>
  );
};
