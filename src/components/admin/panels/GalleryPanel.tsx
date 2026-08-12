import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { GalleryItem } from '../../../types';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, inputClass, labelClass, primaryButtonClass, ghostButtonClass } from '../shared';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const CATEGORIES = ['facilities', 'treatments', 'sterilization', 'smiles', 'posters'] as const;

function readImageAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.readAsDataURL(file);
  });
}

type ItemDraft = Omit<GalleryItem, 'id'>;
const EMPTY_DRAFT: ItemDraft = { title: '', category: 'facilities', imageUrl: '', caption: '' };

const ItemForm: React.FC<{
  draft: ItemDraft; onChange: (d: ItemDraft) => void; onSubmit: () => void; onCancel?: () => void;
  submitting: boolean; submitLabel: string; error: string;
}> = ({ draft, onChange, onSubmit, onCancel, submitting, submitLabel, error }) => {
  const [imageError, setImageError] = useState('');
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    if (file.size > MAX_IMAGE_BYTES) return setImageError('Image is too large — please use one under 3MB.');
    try {
      onChange({ ...draft, imageUrl: await readImageAsDataUri(file) });
    } catch (err: any) {
      setImageError(err?.message || 'Could not read that image file.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className={labelClass}>Title *</label><input type="text" value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} className={inputClass} /></div>
        <div>
          <label className={labelClass}>Category *</label>
          <select value={draft.category} onChange={(e) => onChange({ ...draft, category: e.target.value as GalleryItem['category'] })} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div><label className={labelClass}>Caption *</label><textarea value={draft.caption} onChange={(e) => onChange({ ...draft, caption: e.target.value })} rows={2} className={inputClass} /></div>
      <div>
        <label className={labelClass}>Image *</label>
        <input type="file" accept="image/*" onChange={handleImageChange}
          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:text-xs file:font-bold hover:file:bg-teal-700 file:cursor-pointer cursor-pointer" />
        {imageError && <p className="text-xs text-rose-600 mt-1">{imageError}</p>}
        {draft.imageUrl && <img src={draft.imageUrl} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-slate-200 mt-2" />}
      </div>
      {error && <ErrorBanner message={error} />}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={onSubmit} disabled={submitting} className={primaryButtonClass + ' flex-1'}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{submitting ? 'Saving...' : submitLabel}</span>
        </button>
        {onCancel && <button onClick={onCancel} className={ghostButtonClass}>Cancel</button>}
      </div>
    </div>
  );
};

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const GalleryPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [items, setItems] = useState<GalleryItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [showNewForm, setShowNewForm] = useState(false);
  const [newDraft, setNewDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ItemDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/gallery');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load gallery.');
      setItems(data.items);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the gallery.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const res = await authedFetch('/api/admin/gallery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDraft) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save this item.');
      setItems((prev) => [...(prev || []), data.item]);
      setNewDraft(EMPTY_DRAFT);
      setShowNewForm(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Could not save this item. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (item: GalleryItem) => {
    const { id, ...draft } = item;
    setEditingId(id);
    setEditDraft(draft);
    setSaveError('');
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await authedFetch(`/api/admin/gallery/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editDraft) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save changes.');
      setItems((prev) => prev && prev.map((i) => i.id === id ? data.item : i));
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remove this photo from the public Gallery page?')) return;
    setDeletingId(id);
    setActionError('');
    try {
      const res = await authedFetch(`/api/admin/gallery/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not delete this item.');
      setItems((prev) => prev && prev.filter((i) => i.id !== id));
    } catch (err: any) {
      setActionError(err?.message || 'Could not delete this item. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PanelCard>
      <PanelHeader
        icon={<ImageIcon className="w-5 h-5" />}
        title="Gallery"
        subtitle="Photos & clinical posters shown on the public Gallery page"
        action={!showNewForm && <button onClick={() => setShowNewForm(true)} className={primaryButtonClass}><Plus className="w-4 h-4" /><span>Add Photo</span></button>}
      />
      <div className="p-6 space-y-5">
        {showNewForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">New Photo</p>
            <ItemForm draft={newDraft} onChange={setNewDraft} onSubmit={handleCreate} onCancel={() => { setShowNewForm(false); setNewDraft(EMPTY_DRAFT); }} submitting={creating} submitLabel="Add Photo" error={createError} />
          </div>
        )}

        {actionError && <ErrorBanner message={actionError} />}
        {loading && <LoadingRow label="Loading gallery..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {items && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((item) => (
              <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                {editingId === item.id ? (
                  <ItemForm draft={editDraft} onChange={setEditDraft} onSubmit={() => handleSaveEdit(item.id)} onCancel={() => setEditingId(null)} submitting={saving} submitLabel="Save Changes" error={saveError} />
                ) : (
                  <>
                    <img src={item.imageUrl} alt="" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                    <div className="pt-2.5">
                      <p className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</p>
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full inline-block mt-1">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <button onClick={() => startEditing(item)} className={ghostButtonClass + ' flex-1 text-xs py-2'}><Pencil className="w-3.5 h-3.5" /><span>Edit</span></button>
                      <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} className="flex items-center justify-center p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 disabled:opacity-50">
                        {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </PanelCard>
  );
};
