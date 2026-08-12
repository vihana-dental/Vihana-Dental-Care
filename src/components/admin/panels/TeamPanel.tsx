import React, { useEffect, useRef, useState } from 'react';
import { Users, Loader2, Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { Doctor, ConsultantDoctor } from '../../../types';
import {
  PanelCard, PanelHeader, LoadingRow, ErrorBanner, inputClass, labelClass,
  primaryButtonClass, ghostButtonClass, dangerButtonClass, ListFieldEditor
} from '../shared';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function readImageAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.readAsDataURL(file);
  });
}

const PhotoField: React.FC<{ photo: string; onChange: (dataUri: string) => void }> = ({ photo, onChange }) => {
  const [error, setError] = useState('');
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (file.size > MAX_IMAGE_BYTES) return setError('Image is too large — please use one under 3MB.');
    try {
      onChange(await readImageAsDataUri(file));
    } catch (err: any) {
      setError(err?.message || 'Could not read that image file.');
    }
  };
  return (
    <div>
      <label className={labelClass}>Photo *</label>
      <input type="file" accept="image/*" onChange={handleChange}
        className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:text-xs file:font-bold hover:file:bg-teal-700 file:cursor-pointer cursor-pointer" />
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
      {photo && <img src={photo} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-slate-200 mt-2" />}
    </div>
  );
};

// ---------------- Lead Doctors ----------------

type DoctorDraft = Omit<Doctor, 'id'>;
const EMPTY_DOCTOR: DoctorDraft = {
  name: '', title: '', qualification: '', specialization: '', experienceYears: 1,
  photo: '', bio: '', availableDays: [...WEEKDAYS], ugInstitution: '', pgInstitution: '', externalTraining: [], qualificationYear: ''
};

const DoctorForm: React.FC<{
  draft: DoctorDraft; onChange: (d: DoctorDraft) => void; onSubmit: () => void; onCancel?: () => void;
  submitting: boolean; submitLabel: string; error: string;
}> = ({ draft, onChange, onSubmit, onCancel, submitting, submitLabel, error }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className={labelClass}>Full Name *</label><input type="text" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} className={inputClass} placeholder="Dr. N. Sanchana, M.D.S." /></div>
      <div><label className={labelClass}>Title *</label><input type="text" value={draft.title} onChange={(e) => onChange({ ...draft, title: e.target.value })} className={inputClass} placeholder="Chief Consultant Orthodontist" /></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className={labelClass}>Qualification *</label><input type="text" value={draft.qualification} onChange={(e) => onChange({ ...draft, qualification: e.target.value })} className={inputClass} /></div>
      <div><label className={labelClass}>Years of Experience *</label><input type="number" min={0} value={draft.experienceYears} onChange={(e) => onChange({ ...draft, experienceYears: Number(e.target.value) })} className={inputClass} /></div>
    </div>
    <div><label className={labelClass}>Specialization *</label><input type="text" value={draft.specialization} onChange={(e) => onChange({ ...draft, specialization: e.target.value })} className={inputClass} placeholder="Comma-separated, shown as chips" /></div>
    <div><label className={labelClass}>Bio *</label><textarea value={draft.bio} onChange={(e) => onChange({ ...draft, bio: e.target.value })} rows={3} className={inputClass} /></div>
    <PhotoField photo={draft.photo} onChange={(photo) => onChange({ ...draft, photo })} />

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className={labelClass}>UG Institution</label><input type="text" value={draft.ugInstitution || ''} onChange={(e) => onChange({ ...draft, ugInstitution: e.target.value })} className={inputClass} /></div>
      <div><label className={labelClass}>PG Institution</label><input type="text" value={draft.pgInstitution || ''} onChange={(e) => onChange({ ...draft, pgInstitution: e.target.value })} className={inputClass} /></div>
    </div>
    <div><label className={labelClass}>Qualification Year <span className="font-normal text-slate-400">(optional, e.g. "2012–2017")</span></label><input type="text" value={draft.qualificationYear || ''} onChange={(e) => onChange({ ...draft, qualificationYear: e.target.value })} className={inputClass} /></div>
    <ListFieldEditor label="Specialized / External Training" items={draft.externalTraining || []} onChange={(externalTraining) => onChange({ ...draft, externalTraining })} placeholder="e.g. Invisalign Qualified" />

    <div>
      <label className={labelClass}>Available Days *</label>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => {
          const active = draft.availableDays.includes(day);
          return (
            <button key={day} type="button"
              onClick={() => onChange({ ...draft, availableDays: active ? draft.availableDays.filter((d) => d !== day) : [...draft.availableDays, day] })}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${active ? 'bg-teal-600 border-teal-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
            >
              {day.slice(0, 3)}
            </button>
          );
        })}
      </div>
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

// ---------------- Consultants ----------------

type ConsultantDraft = Omit<ConsultantDoctor, 'id'>;
const EMPTY_CONSULTANT: ConsultantDraft = {
  name: '', specialty: '', qualification: '', bio: '', photo: '',
  ugInstitution: '', pgInstitution: '', externalTraining: [], qualificationYear: '', experienceYears: undefined
};

const ConsultantForm: React.FC<{
  draft: ConsultantDraft; onChange: (d: ConsultantDraft) => void; onSubmit: () => void; onCancel?: () => void;
  submitting: boolean; submitLabel: string; error: string;
}> = ({ draft, onChange, onSubmit, onCancel, submitting, submitLabel, error }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className={labelClass}>Full Name *</label><input type="text" value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} className={inputClass} placeholder="Dr. R. Saraaj Bhuvan, M.D.S." /></div>
      <div><label className={labelClass}>Specialty *</label><input type="text" value={draft.specialty} onChange={(e) => onChange({ ...draft, specialty: e.target.value })} className={inputClass} placeholder="Consultant Periodontist & Oral Implantologist" /></div>
    </div>
    <div><label className={labelClass}>Qualification *</label><input type="text" value={draft.qualification} onChange={(e) => onChange({ ...draft, qualification: e.target.value })} className={inputClass} /></div>
    <div><label className={labelClass}>Bio *</label><textarea value={draft.bio} onChange={(e) => onChange({ ...draft, bio: e.target.value })} rows={3} className={inputClass} /></div>
    <PhotoField photo={draft.photo} onChange={(photo) => onChange({ ...draft, photo })} />

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className={labelClass}>UG Institution</label><input type="text" value={draft.ugInstitution || ''} onChange={(e) => onChange({ ...draft, ugInstitution: e.target.value })} className={inputClass} /></div>
      <div><label className={labelClass}>PG Institution</label><input type="text" value={draft.pgInstitution || ''} onChange={(e) => onChange({ ...draft, pgInstitution: e.target.value })} className={inputClass} /></div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div><label className={labelClass}>Qualification Year <span className="font-normal text-slate-400">(optional)</span></label><input type="text" value={draft.qualificationYear || ''} onChange={(e) => onChange({ ...draft, qualificationYear: e.target.value })} className={inputClass} /></div>
      <div><label className={labelClass}>Years of Experience <span className="font-normal text-slate-400">(optional)</span></label><input type="number" min={0} value={draft.experienceYears ?? ''} onChange={(e) => onChange({ ...draft, experienceYears: e.target.value ? Number(e.target.value) : undefined })} className={inputClass} /></div>
    </div>
    <ListFieldEditor label="Specialized / External Training" items={draft.externalTraining || []} onChange={(externalTraining) => onChange({ ...draft, externalTraining })} placeholder="e.g. RCT Certified" />

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

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const TeamPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [tab, setTab] = useState<'doctors' | 'consultants'>('doctors');

  const [doctors, setDoctors] = useState<Doctor[] | null>(null);
  const [consultants, setConsultants] = useState<ConsultantDoctor[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [showNewForm, setShowNewForm] = useState(false);
  const [newDoctorDraft, setNewDoctorDraft] = useState<DoctorDraft>(EMPTY_DOCTOR);
  const [newConsultantDraft, setNewConsultantDraft] = useState<ConsultantDraft>(EMPTY_CONSULTANT);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDoctorDraft, setEditDoctorDraft] = useState<DoctorDraft>(EMPTY_DOCTOR);
  const [editConsultantDraft, setEditConsultantDraft] = useState<ConsultantDraft>(EMPTY_CONSULTANT);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [dRes, cRes] = await Promise.all([
        authedFetch('/api/admin/team/doctors'),
        authedFetch('/api/admin/team/consultants')
      ]);
      if (dRes.status === 401 || cRes.status === 401) return onSessionExpired();
      const dData = await dRes.json();
      const cData = await cRes.json();
      if (!dData.success) throw new Error(dData.error || 'Failed to load doctors.');
      if (!cData.success) throw new Error(cData.error || 'Failed to load consultants.');
      setDoctors(dData.doctors);
      setConsultants(cData.consultants);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the team.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openNewForm = () => {
    setNewDoctorDraft(EMPTY_DOCTOR);
    setNewConsultantDraft(EMPTY_CONSULTANT);
    setCreateError('');
    setShowNewForm(true);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError('');
    try {
      const url = tab === 'doctors' ? '/api/admin/team/doctors' : '/api/admin/team/consultants';
      const body = tab === 'doctors' ? newDoctorDraft : newConsultantDraft;
      const res = await authedFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save.');
      if (tab === 'doctors') setDoctors((prev) => [...(prev || []), data.doctor]);
      else setConsultants((prev) => [...(prev || []), data.consultant]);
      setShowNewForm(false);
    } catch (err: any) {
      setCreateError(err?.message || 'Could not save. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const startEditingDoctor = (doc: Doctor) => {
    const { id, ...draft } = doc;
    setEditingId(id);
    setEditDoctorDraft(draft);
    setSaveError('');
  };

  const startEditingConsultant = (c: ConsultantDoctor) => {
    const { id, ...draft } = c;
    setEditingId(id);
    setEditConsultantDraft(draft);
    setSaveError('');
  };

  const handleSaveDoctorEdit = async (id: string) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await authedFetch(`/api/admin/team/doctors/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editDoctorDraft) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save changes.');
      setDoctors((prev) => prev && prev.map((d) => d.id === id ? data.doctor : d));
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveConsultantEdit = async (id: string) => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await authedFetch(`/api/admin/team/consultants/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editConsultantDraft) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save changes.');
      setConsultants((prev) => prev && prev.map((c) => c.id === id ? data.consultant : c));
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, kind: 'doctors' | 'consultants') => {
    if (!window.confirm('Remove this team member from the public site?')) return;
    setDeletingId(id);
    setActionError('');
    try {
      const res = await authedFetch(`/api/admin/team/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not delete.');
      if (kind === 'doctors') setDoctors((prev) => prev && prev.filter((d) => d.id !== id));
      else setConsultants((prev) => prev && prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setActionError(err?.message || 'Could not delete. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PanelCard>
      <PanelHeader
        icon={<Users className="w-5 h-5" />}
        title="Our Team"
        subtitle="Lead doctors (bookable) and visiting consultants (informational only)"
        action={!showNewForm && <button onClick={openNewForm} className={primaryButtonClass}><Plus className="w-4 h-4" /><span>Add</span></button>}
      />
      <div className="p-6 space-y-5">
        <div className="flex gap-1.5 bg-slate-100 rounded-xl p-1 w-fit">
          <button onClick={() => { setTab('doctors'); setShowNewForm(false); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === 'doctors' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>Lead Doctors</button>
          <button onClick={() => { setTab('consultants'); setShowNewForm(false); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${tab === 'consultants' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`}>Consultants</button>
        </div>

        {showNewForm && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">New {tab === 'doctors' ? 'Doctor' : 'Consultant'}</p>
            {tab === 'doctors' ? (
              <DoctorForm draft={newDoctorDraft} onChange={setNewDoctorDraft} onSubmit={handleCreate} onCancel={() => setShowNewForm(false)} submitting={creating} submitLabel="Add Doctor" error={createError} />
            ) : (
              <ConsultantForm draft={newConsultantDraft} onChange={setNewConsultantDraft} onSubmit={handleCreate} onCancel={() => setShowNewForm(false)} submitting={creating} submitLabel="Add Consultant" error={createError} />
            )}
          </div>
        )}

        {actionError && <ErrorBanner message={actionError} />}
        {loading && <LoadingRow label="Loading team..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {tab === 'doctors' && doctors && (
          <div className="space-y-3">
            {doctors.map((doc) => (
              <div key={doc.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                {editingId === doc.id ? (
                  <DoctorForm draft={editDoctorDraft} onChange={setEditDoctorDraft} onSubmit={() => handleSaveDoctorEdit(doc.id)} onCancel={() => setEditingId(null)} submitting={saving} submitLabel="Save Changes" error={saveError} />
                ) : (
                  <div className="flex items-start gap-3">
                    <img src={doc.photo} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{doc.name}</p>
                      <p className="text-xs text-slate-500">{doc.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{doc.experienceYears}+ years · {doc.qualification}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => startEditingDoctor(doc)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(doc.id, 'doctors')} disabled={deletingId === doc.id} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50" title="Delete">
                        {deletingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'consultants' && consultants && (
          <div className="space-y-3">
            {consultants.map((c) => (
              <div key={c.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                {editingId === c.id ? (
                  <ConsultantForm draft={editConsultantDraft} onChange={setEditConsultantDraft} onSubmit={() => handleSaveConsultantEdit(c.id)} onCancel={() => setEditingId(null)} submitting={saving} submitLabel="Save Changes" error={saveError} />
                ) : (
                  <div className="flex items-start gap-3">
                    <img src={c.photo} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.specialty}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.qualification}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => startEditingConsultant(c)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-200" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(c.id, 'consultants')} disabled={deletingId === c.id} className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-50" title="Delete">
                        {deletingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
