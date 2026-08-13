import React, { useEffect, useState } from 'react';
import { Star, Loader2, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { Review } from '../../../types';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, inputClass, labelClass, primaryButtonClass, ghostButtonClass } from '../shared';

type ReviewDraft = Omit<Review, 'id'>;
const EMPTY_DRAFT: ReviewDraft = {
  authorName: '', authorPhoto: '', rating: 5, relativeTimeDescription: '1 week ago',
  text: '', date: new Date().toISOString().slice(0, 10), verifiedGoogle: true, clinicReply: ''
};

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const ReviewsPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [showNewForm, setShowNewForm] = useState(false);
  const [newDraft, setNewDraft] = useState<ReviewDraft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ReviewDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/reviews');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load reviews.');
      setReviews(data.reviews);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const res = await authedFetch('/api/admin/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDraft) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save this review.');
      setReviews((prev) => [data.review, ...(prev || [])]);
      setNewDraft(EMPTY_DRAFT);
      setShowNewForm(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Could not save this review. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (review: Review) => {
    const { id, ...draft } = review;
    setEditingId(id);
    setEditDraft(draft);
    setSaveError('');
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await authedFetch(`/api/admin/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editDraft) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save changes.');
      setReviews((prev) => prev && prev.map((r) => r.id === id ? data.review : r));
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this testimonial from the public Reviews page?')) return;
    setDeletingId(id);
    setActionError('');
    try {
      const res = await authedFetch(`/api/admin/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not delete this review.');
      setReviews((prev) => prev && prev.filter((r) => r.id !== id));
    } catch (err: any) {
      setActionError(err?.message || 'Could not delete this review. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const renderForm = (draft: ReviewDraft, onChange: (d: ReviewDraft) => void, onSubmit: () => void, onCancel: () => void, submitting: boolean, submitLabel: string, error: string) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={labelClass}>Author Name *</label><input type="text" value={draft.authorName} onChange={(e) => onChange({ ...draft, authorName: e.target.value })} className={inputClass} /></div>
        <div><label className={labelClass}>Rating (1–5) *</label><input type="number" min={1} max={5} value={draft.rating} onChange={(e) => onChange({ ...draft, rating: Number(e.target.value) })} className={inputClass} /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={labelClass}>Relative Time *</label><input type="text" value={draft.relativeTimeDescription} onChange={(e) => onChange({ ...draft, relativeTimeDescription: e.target.value })} className={inputClass} placeholder="e.g. 1 week ago" /></div>
        <div><label className={labelClass}>Date *</label><input type="date" value={draft.date} onChange={(e) => onChange({ ...draft, date: e.target.value })} className={inputClass} /></div>
      </div>
      <div><label className={labelClass}>Review Text *</label><textarea value={draft.text} onChange={(e) => onChange({ ...draft, text: e.target.value })} rows={3} className={inputClass} /></div>
      <div><label className={labelClass}>Author Photo URL <span className="font-normal text-slate-400">(optional)</span></label><input type="text" value={draft.authorPhoto || ''} onChange={(e) => onChange({ ...draft, authorPhoto: e.target.value })} className={inputClass} /></div>
      <div><label className={labelClass}>Clinic Reply <span className="font-normal text-slate-400">(optional)</span></label><textarea value={draft.clinicReply || ''} onChange={(e) => onChange({ ...draft, clinicReply: e.target.value })} rows={2} className={inputClass} /></div>
      <label className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 cursor-pointer">
        <span className="text-sm font-semibold text-slate-700">Show "Google Verified" badge</span>
        <input type="checkbox" checked={draft.verifiedGoogle} onChange={(e) => onChange({ ...draft, verifiedGoogle: e.target.checked })} className="w-4 h-4 accent-brand-800" />
      </label>
      {error && <ErrorBanner message={error} />}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onSubmit} disabled={submitting} className={primaryButtonClass + ' flex-1'}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{submitting ? 'Saving...' : submitLabel}</span>
        </button>
        <button onClick={onCancel} className={ghostButtonClass}>Cancel</button>
      </div>
    </div>
  );

  return (
    <PanelCard>
      <PanelHeader
        icon={<Star className="w-5 h-5" />}
        title="Curated Reviews"
        subtitle="Shown while live Google reviews load, and as the fallback if that fetch fails"
        action={!showNewForm && <button onClick={() => setShowNewForm(true)} className={primaryButtonClass}><Plus className="w-4 h-4" /><span>Add Review</span></button>}
      />
      <div className="p-6 space-y-5">
        {showNewForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">New Review</p>
            {renderForm(newDraft, setNewDraft, handleCreate, () => setShowNewForm(false), creating, 'Add Review', createError)}
          </div>
        )}

        {actionError && <ErrorBanner message={actionError} />}
        {loading && <LoadingRow label="Loading reviews..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {reviews && reviews.length > 0 && (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                {editingId === review.id ? (
                  renderForm(editDraft, setEditDraft, () => handleSaveEdit(review.id), () => setEditingId(null), saving, 'Save Changes', saveError)
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-slate-900">{review.authorName}</p>
                        <span className="text-amber-500 text-xs">{'★'.repeat(review.rating)}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{review.text}</p>
                      <p className="text-[11px] text-slate-400 mt-1">{review.relativeTimeDescription}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => startEditing(review)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(review.id)} disabled={deletingId === review.id} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50" title="Delete">
                        {deletingId === review.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelCard>
  );
};
