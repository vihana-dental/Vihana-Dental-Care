import React, { useEffect, useState } from 'react';
import { Star, Loader2, CheckCircle2 } from 'lucide-react';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, SuccessBanner, inputClass, labelClass, primaryButtonClass } from '../shared';

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const GoogleReviewsOverridePanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [override, setOverride] = useState<{ enabled: boolean; rating: number; totalReviews: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/review-override');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load review settings.');
      setOverride(data.override);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load review settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!override) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const res = await authedFetch('/api/admin/review-override', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(override)
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save.');
      setOverride(data.override);
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
      <PanelHeader icon={<Star className="w-5 h-5" />} title="Live Rating Display" subtitle="Shown in the Hero badge & Testimonials header" />
      <div className="p-6 space-y-4 max-w-md">
        {loading && <LoadingRow label="Loading review settings..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {override && !loading && (
          <div className="space-y-4">
            <label className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer">
              <span className="text-sm font-semibold text-slate-700">Use manual override (instead of live Google rating)</span>
              <input
                type="checkbox"
                checked={override.enabled}
                onChange={(e) => setOverride({ ...override, enabled: e.target.checked })}
                className="w-4 h-4 accent-brand-800"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Rating (0–5)</label>
                <input type="number" min={0} max={5} step={0.1} value={override.rating} onChange={(e) => setOverride({ ...override, rating: Number(e.target.value) })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Total Reviews</label>
                <input type="number" min={0} step={1} value={override.totalReviews} onChange={(e) => setOverride({ ...override, totalReviews: Number(e.target.value) })} className={inputClass} />
              </div>
            </div>

            {!override.enabled && (
              <p className="text-xs text-slate-400">
                Currently pulling live from Google Places (or the static fallback if that isn't configured). Turn the toggle on to set these numbers manually instead.
              </p>
            )}

            {saveError && <ErrorBanner message={saveError} />}
            {saveSuccess && <SuccessBanner message="Saved. Live on the site now." />}

            <button onClick={handleSave} disabled={saving} className={primaryButtonClass + ' w-full'}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        )}
      </div>
    </PanelCard>
  );
};
