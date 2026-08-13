import React, { useEffect, useMemo, useState } from 'react';
import { Users, Search, Trash2, ShieldCheck, X } from 'lucide-react';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner } from '../shared';

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

interface PatientRecord {
  id: string;
  name: string;
  phone: string;
  email?: string;
  sourceChannel: string;
  createdAt: string;
  updatedAt: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  chatbot: 'Chat Widget',
  website_cta: 'Website',
  admin_direct: 'Admin Direct'
};

// A view over the `patients` table that's already populated on every
// booking — this panel adds no new data collection, only visibility plus
// the DPDP-aligned "right to erasure" delete action. These are real,
// reviewable technical safeguards (access control via the existing
// Google Sign-In allowlist, erasure, server-side audit logging, no new
// data collected) — not a substitute for actual legal review.
export const PatientsPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [patients, setPatients] = useState<PatientRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/patients');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load patients.');
      setPatients(data.patients);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load patients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!patients) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return patients;
    return patients.filter((p) =>
      p.name.toLowerCase().includes(needle) ||
      p.phone.includes(needle) ||
      (p.email || '').toLowerCase().includes(needle)
    );
  }, [patients, query]);

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await authedFetch(`/api/admin/patients/${confirmDeleteId}`, { method: 'DELETE' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to delete patient.');
      setPatients((prev) => prev && prev.filter((p) => p.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete patient.');
    } finally {
      setDeleting(false);
    }
  };

  const confirmTarget = patients?.find((p) => p.id === confirmDeleteId) || null;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-brand-200 border border-brand-400 text-brand-950 text-xs p-3 rounded-xl">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Every view and deletion here is logged server-side with your admin email. Deleting a patient removes their contact record only — their appointment history is kept as a clinical/financial record. This panel is a technical safeguard aligned with DPDP Act principles, not a substitute for legal review.</p>
      </div>

      <PanelCard>
        <PanelHeader
          icon={<Users className="w-5 h-5" />}
          title="Patient Database"
          subtitle={`${patients?.length ?? 0} patient record(s)`}
        />

        <div className="p-4 sm:p-6 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, phone, or email"
              className="w-full bg-white text-slate-900 pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700 placeholder:text-slate-400"
            />
          </div>

          {loading && <LoadingRow label="Loading patients..." />}
          {loadError && <ErrorBanner message={loadError} onRetry={load} />}

          {!loading && !loadError && (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-[11px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th className="py-2 px-4 sm:px-0">Name</th>
                    <th className="py-2 px-2">Phone</th>
                    <th className="py-2 px-2">Email</th>
                    <th className="py-2 px-2">Source</th>
                    <th className="py-2 px-2">Added</th>
                    <th className="py-2 px-4 sm:px-0 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 px-4 sm:px-0 font-semibold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-2 text-slate-600">{p.phone}</td>
                      <td className="py-2.5 px-2 text-slate-600">{p.email || '—'}</td>
                      <td className="py-2.5 px-2 text-slate-600">{CHANNEL_LABEL[p.sourceChannel] || p.sourceChannel}</td>
                      <td className="py-2.5 px-2 text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 px-4 sm:px-0 text-right">
                        <button
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-800 text-xs font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-sm">No patients found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </PanelCard>

      {confirmTarget && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">Delete patient record?</p>
              <button onClick={() => setConfirmDeleteId(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              This permanently removes <span className="font-semibold text-slate-900">{confirmTarget.name}</span>'s contact record ({confirmTarget.phone}) from the patient database. Their appointment history will not be affected. This cannot be undone.
            </p>
            {deleteError && <ErrorBanner message={deleteError} />}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-sm font-bold"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
