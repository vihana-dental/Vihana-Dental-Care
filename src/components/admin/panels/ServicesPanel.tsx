import React, { useEffect, useRef, useState } from 'react';
import { Stethoscope, Loader2, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { DentalService } from '../../../types';
import {
  PanelCard, PanelHeader, LoadingRow, ErrorBanner, inputClass, labelClass,
  primaryButtonClass, ghostButtonClass, dangerButtonClass, ListFieldEditor
} from '../shared';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const CATEGORIES = ['General', 'Cosmetic', 'Orthodontics', 'Implants', 'Surgical', 'Pediatric'] as const;

function readImageAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.readAsDataURL(file);
  });
}

type ServiceDraft = Omit<DentalService, 'id'>;

const EMPTY_DRAFT: ServiceDraft = {
  title: '', category: 'General', shortDescription: '', fullDescription: '',
  image: '', durationMinutes: 30, priceRange: '', benefits: [], procedures: [], iconName: 'Stethoscope'
};

const ServiceForm: React.FC<{
  draft: ServiceDraft;
  onChange: (draft: ServiceDraft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitting: boolean;
  submitLabel: string;
  error: string;
}> = ({ draft, onChange, onSubmit, onCancel, submitting, submitLabel, error }) => {
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    if (file.size > MAX_IMAGE_BYTES) return setImageError('Image is too large — please use one under 3MB.');
    try {
      onChange({ ...draft, image: await readImageAsDataUri(file) });
    } catch (err: any) {
      setImageError(err?.message || 'Could not read that image file.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Title *</label>
          <input type="text" value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} className={inputClass} placeholder="e.g. Dental Implants & Full Mouth Rehab" />
        </div>
        <div>
          <label className={labelClass}>Category *</label>
          <select value={draft.category} onChange={(e) => onChange({ ...draft, category: e.target.value as DentalService['category'] })} className={inputClass}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Short Description * <span className="font-normal text-slate-400">(shown on the service card)</span></label>
        <textarea value={draft.shortDescription} onChange={(e) => onChange({ ...draft, shortDescription: e.target.value })} rows={2} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Full Description * <span className="font-normal text-slate-400">(shown in the detail modal)</span></label>
        <textarea value={draft.fullDescription} onChange={(e) => onChange({ ...draft, fullDescription: e.target.value })} rows={3} className={inputClass} />
      </div>

      <div>
        <label className={labelClass}>Image *</label>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange}
          className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:text-xs file:font-bold hover:file:bg-teal-700 file:cursor-pointer cursor-pointer" />
        {imageError && <p className="text-xs text-rose-600 mt-1">{imageError}</p>}
        {draft.image && <img src={draft.image} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-slate-200 mt-2" />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Duration (minutes) *</label>
          <input type="number" min={1} value={draft.durationMinutes} onChange={(e) => onChange({ ...draft, durationMinutes: Number(e.target.value) })} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Estimated Cost Range *</label>
          <input type="text" value={draft.priceRange} onChange={(e) => onChange({ ...draft, priceRange: e.target.value })} className={inputClass} placeholder="e.g. ₹22,000 - ₹45,000 per implant" />
        </div>
      </div>

      <ListFieldEditor label="Key Benefits" items={draft.benefits} onChange={(benefits) => onChange({ ...draft, benefits })} placeholder="e.g. Painless single-sitting procedure" />
      <ListFieldEditor label="Procedure Steps" items={draft.procedures} onChange={(procedures) => onChange({ ...draft, procedures })} placeholder="e.g. Digital OPG X-Ray & Bite Assessment" />

      <div>
        <label className={labelClass}>Icon Name <span className="font-normal text-slate-400">(a lucide-react icon name, e.g. "Tooth", "Sparkles")</span></label>
        <input type="text" value={draft.iconName} onChange={(e) => onChange({ ...draft, iconName: e.target.value })} className={inputClass} />
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

export const ServicesPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [services, setServices] = useState<DentalService[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [showNewForm, setShowNewForm] = useState(false);
  const [newDraft, setNewDraft] = useState<ServiceDraft>(EMPTY_DRAFT);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ServiceDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/services');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load services.');
      setServices(data.services);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const res = await authedFetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDraft)
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save this service.');
      setServices((prev) => [...(prev || []), data.service]);
      setNewDraft(EMPTY_DRAFT);
      setShowNewForm(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Could not save this service. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const startEditing = (service: DentalService) => {
    setEditingId(service.id);
    const { id, ...draft } = service;
    setEditDraft(draft);
    setSaveError('');
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await authedFetch(`/api/admin/services/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editDraft)
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save changes.');
      setServices((prev) => prev && prev.map((s) => s.id === id ? data.service : s));
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this service? It will disappear from the public Services page and booking flow immediately.')) return;
    setDeletingId(id);
    setActionError('');
    try {
      const res = await authedFetch(`/api/admin/services/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not delete this service.');
      setServices((prev) => prev && prev.filter((s) => s.id !== id));
    } catch (err: any) {
      setActionError(err?.message || 'Could not delete this service. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PanelCard>
      <PanelHeader
        icon={<Stethoscope className="w-5 h-5" />}
        title="Services"
        subtitle="Full treatment catalog — shown on the public Services page & booking flow"
        action={
          !showNewForm && (
            <button onClick={() => setShowNewForm(true)} className={primaryButtonClass}>
              <Plus className="w-4 h-4" /><span>Add Service</span>
            </button>
          )
        }
      />
      <div className="p-6 space-y-5">
        {showNewForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">New Service</p>
            <ServiceForm
              draft={newDraft} onChange={setNewDraft} onSubmit={handleCreate}
              onCancel={() => { setShowNewForm(false); setNewDraft(EMPTY_DRAFT); setCreateError(''); }}
              submitting={creating} submitLabel="Create Service" error={createError}
            />
          </div>
        )}

        {actionError && <ErrorBanner message={actionError} />}
        {loading && <LoadingRow label="Loading services..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {services && services.length > 0 && (
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                {editingId === service.id ? (
                  <ServiceForm
                    draft={editDraft} onChange={setEditDraft} onSubmit={() => handleSaveEdit(service.id)}
                    onCancel={() => setEditingId(null)} submitting={saving} submitLabel="Save Changes" error={saveError}
                  />
                ) : (
                  <div className="flex items-start gap-3">
                    <img src={service.image} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900">{service.title}</p>
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full">{service.category}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{service.shortDescription}</p>
                      <p className="text-xs text-slate-400 mt-1">{service.durationMinutes} min · {service.priceRange}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => startEditing(service)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200" aria-label={`Edit ${service.title}`} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(service.id)} disabled={deletingId === service.id} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50" aria-label={`Delete ${service.title}`} title="Delete">
                        {deletingId === service.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
