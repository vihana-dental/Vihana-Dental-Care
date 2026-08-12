import React, { useEffect, useState } from 'react';
import { HelpCircle, Loader2, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { FAQ } from '../../../types';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, inputClass, labelClass, primaryButtonClass, ghostButtonClass } from '../shared';

type FAQDraft = Omit<FAQ, 'id'>;

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const FAQPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [faqs, setFaqs] = useState<FAQ[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [showNewForm, setShowNewForm] = useState(false);
  const [newDraft, setNewDraft] = useState<FAQDraft>({ question: '', answer: '', order: 0 });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<FAQDraft>({ question: '', answer: '', order: 0 });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/faqs');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load FAQs.');
      setFaqs(data.faqs);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load FAQs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openNewForm = () => {
    setNewDraft({ question: '', answer: '', order: (faqs?.length || 0) + 1 });
    setCreateError('');
    setShowNewForm(true);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const res = await authedFetch('/api/admin/faqs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDraft) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save this FAQ.');
      setFaqs((prev) => [...(prev || []), data.faq].sort((a, b) => a.order - b.order));
      setShowNewForm(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Could not save this FAQ. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (faq: FAQ) => {
    const { id, ...draft } = faq;
    setEditingId(id);
    setEditDraft(draft);
    setSaveError('');
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await authedFetch(`/api/admin/faqs/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editDraft) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save changes.');
      setFaqs((prev) => prev && prev.map((f) => f.id === id ? data.faq : f).sort((a, b) => a.order - b.order));
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this FAQ from the public Services page?')) return;
    setDeletingId(id);
    setActionError('');
    try {
      const res = await authedFetch(`/api/admin/faqs/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not delete this FAQ.');
      setFaqs((prev) => prev && prev.filter((f) => f.id !== id));
    } catch (err: any) {
      setActionError(err?.message || 'Could not delete this FAQ. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const renderForm = (draft: FAQDraft, onChange: (d: FAQDraft) => void, onSubmit: () => void, onCancel: () => void, submitting: boolean, submitLabel: string, error: string) => (
    <div className="space-y-3">
      <div><label className={labelClass}>Question *</label><input type="text" value={draft.question} onChange={(e) => onChange({ ...draft, question: e.target.value })} className={inputClass} /></div>
      <div><label className={labelClass}>Answer *</label><textarea value={draft.answer} onChange={(e) => onChange({ ...draft, answer: e.target.value })} rows={3} className={inputClass} /></div>
      <div className="max-w-[160px]"><label className={labelClass}>Display Order</label><input type="number" value={draft.order} onChange={(e) => onChange({ ...draft, order: Number(e.target.value) })} className={inputClass} /></div>
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
        icon={<HelpCircle className="w-5 h-5" />}
        title="FAQs"
        subtitle="Shown on the Services page & mirrored into FAQ search rich results"
        action={!showNewForm && <button onClick={openNewForm} className={primaryButtonClass}><Plus className="w-4 h-4" /><span>Add FAQ</span></button>}
      />
      <div className="p-6 space-y-5">
        {showNewForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">New FAQ</p>
            {renderForm(newDraft, setNewDraft, handleCreate, () => setShowNewForm(false), creating, 'Add FAQ', createError)}
          </div>
        )}

        {actionError && <ErrorBanner message={actionError} />}
        {loading && <LoadingRow label="Loading FAQs..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {faqs && faqs.length > 0 && (
          <div className="space-y-3">
            {[...faqs].sort((a, b) => a.order - b.order).map((faq) => (
              <div key={faq.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                {editingId === faq.id ? (
                  renderForm(editDraft, setEditDraft, () => handleSaveEdit(faq.id), () => setEditingId(null), saving, 'Save Changes', saveError)
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold flex items-center justify-center mt-0.5">{faq.order}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{faq.question}</p>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{faq.answer}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => startEditing(faq)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(faq.id)} disabled={deletingId === faq.id} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50" title="Delete">
                        {deletingId === faq.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
