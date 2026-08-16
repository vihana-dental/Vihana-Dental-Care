import React, { useEffect, useState } from 'react';
import { Award, Loader2, Plus, Pencil, Trash2, CheckCircle2, FileText, Image as ImageIcon, ExternalLink, ShieldCheck } from 'lucide-react';
import { ClinicCertificate } from '../../../types';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, inputClass, labelClass, primaryButtonClass, ghostButtonClass } from '../shared';

// Kept in step with server/services/certificates.ts — the server is the
// authority and re-checks all of this (including the file's actual magic
// bytes, which a browser can't be trusted to report). Validating here too
// just means the doctor finds out before a 4MB upload round-trips.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';
const EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png']
};

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

/** Returns an error message, or '' when the picked file is acceptable. */
function validatePickedFile(file: File): string {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Only PDF, JPG, JPEG and PNG files can be uploaded.';
  }
  const extension = (file.name.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase();
  if (!EXTENSIONS_BY_TYPE[file.type].includes(extension)) {
    return `A ${file.type} file must have a ${EXTENSIONS_BY_TYPE[file.type].join(' or ')} extension.`;
  }
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_FILE_BYTES) {
    return `That file is ${(file.size / (1024 * 1024)).toFixed(1)}MB — please upload one under ${MAX_FILE_BYTES / (1024 * 1024)}MB.`;
  }
  return '';
}

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const CertificatesPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [certificates, setCertificates] = useState<ClinicCertificate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [showUpload, setShowUpload] = useState(false);
  const [title, setTitle] = useState('');
  const [displayOrder, setDisplayOrder] = useState(100);
  const [fileName, setFileName] = useState('');
  const [fileDataUri, setFileDataUri] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [fileError, setFileError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editOrder, setEditOrder] = useState(100);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/certificates');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load certificates.');
      setCertificates(data.certificates);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the certificates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetUploadForm = () => {
    setTitle('');
    setDisplayOrder(100);
    setFileName('');
    setFileDataUri('');
    setFileSize(0);
    setFileError('');
    setUploadError('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError('');
    setFileDataUri('');
    setFileName('');
    setFileSize(0);

    const problem = validatePickedFile(file);
    if (problem) return setFileError(problem);

    try {
      setFileDataUri(await readFileAsDataUri(file));
      setFileName(file.name);
      setFileSize(file.size);
      // A sensible default title so the doctor rarely has to type one —
      // the filename without its extension, underscores turned into spaces.
      if (!title.trim()) setTitle(file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim());
    } catch (err: any) {
      setFileError(err?.message || 'Could not read that file.');
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) return setUploadError('Please give this document a title.');
    if (!fileDataUri) return setUploadError('Please choose a PDF or image file to upload.');

    setUploading(true);
    setUploadError('');
    try {
      const res = await authedFetch('/api/admin/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), fileName, fileDataUri, displayOrder })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not upload this document.');
      // Reload rather than appending — the list is sorted by display order,
      // so a new document rarely belongs at the end.
      await load();
      resetUploadForm();
      setShowUpload(false);
    } catch (err: any) {
      setUploadError(err?.message || 'Could not upload this document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const startEditing = (cert: ClinicCertificate) => {
    setEditingId(cert.id);
    setEditTitle(cert.title);
    setEditOrder(cert.displayOrder);
    setActionError('');
  };

  const handleSaveEdit = async (id: string) => {
    setSavingId(id);
    setActionError('');
    try {
      const res = await authedFetch(`/api/admin/certificates/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), displayOrder: editOrder })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save changes.');
      setEditingId(null);
      await load();
    } catch (err: any) {
      setActionError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (cert: ClinicCertificate) => {
    if (!window.confirm(`Remove "${cert.title}" from the public Certifications list?`)) return;
    setDeletingId(cert.id);
    setActionError('');
    try {
      const res = await authedFetch(`/api/admin/certificates/${encodeURIComponent(cert.id)}`, { method: 'DELETE' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not delete this document.');
      setCertificates((prev) => prev && prev.filter((c) => c.id !== cert.id));
    } catch (err: any) {
      setActionError(err?.message || 'Could not delete this document. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // The bundled documents are seeded into the database as ordinary,
  // fully-editable rows on first run. They only appear with a `static-` id in
  // the fallback listing served when the database isn't reachable — and in
  // that state there is no row to delete, so the action is disabled.
  const isBuiltIn = (cert: ClinicCertificate) => cert.id.startsWith('static-');

  return (
    <PanelCard>
      <PanelHeader
        icon={<Award className="w-5 h-5" />}
        title="Certificates & Documents"
        subtitle="Licences, registrations and qualifications shown behind the footer's Certifications link"
        action={!showUpload && (
          <button onClick={() => setShowUpload(true)} className={primaryButtonClass}>
            <Plus className="w-4 h-4" /><span>Upload Document</span>
          </button>
        )}
      />

      <div className="p-6 space-y-5">
        {showUpload && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">New Document</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className={labelClass}>Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Clinic Registration Certificate"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Display order</label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>File * — PDF, JPG, JPEG or PNG, up to {MAX_FILE_BYTES / (1024 * 1024)}MB</label>
              <input
                type="file"
                accept={ACCEPT_ATTR}
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-800 file:text-white file:text-xs file:font-bold hover:file:bg-brand-900 file:cursor-pointer cursor-pointer"
              />
              {fileError && <p className="text-xs text-rose-600 mt-1">{fileError}</p>}
              {fileDataUri && !fileError && (
                <div className="flex items-center gap-2 mt-2 text-xs text-slate-600">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{fileName}</span>
                  <span className="text-slate-400 shrink-0">({formatBytes(fileSize)})</span>
                </div>
              )}
            </div>

            {uploadError && <ErrorBanner message={uploadError} />}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleUpload} disabled={uploading} className={primaryButtonClass + ' flex-1'}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{uploading ? 'Uploading...' : 'Upload Document'}</span>
              </button>
              <button onClick={() => { setShowUpload(false); resetUploadForm(); }} className={ghostButtonClass}>Cancel</button>
            </div>
          </div>
        )}

        {actionError && <ErrorBanner message={actionError} />}
        {loading && <LoadingRow label="Loading certificates..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {certificates && certificates.length === 0 && !loading && (
          <p className="text-sm text-slate-500 py-6 text-center">No documents uploaded yet.</p>
        )}

        {certificates && certificates.length > 0 && (
          <div className="space-y-2">
            {certificates.map((cert) => (
              <div key={cert.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                {editingId === cert.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Title *</label>
                        <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className={labelClass}>Display order</label>
                        <input type="number" value={editOrder} onChange={(e) => setEditOrder(Number(e.target.value))} className={inputClass} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSaveEdit(cert.id)} disabled={savingId === cert.id} className={primaryButtonClass + ' flex-1'}>
                        {savingId === cert.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Save Changes</span>
                      </button>
                      <button onClick={() => setEditingId(null)} className={ghostButtonClass}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                      cert.mimeType === 'application/pdf'
                        ? 'bg-rose-50 border-rose-100 text-rose-600'
                        : 'bg-sky-50 border-sky-100 text-sky-600'
                    }`}>
                      {cert.mimeType === 'application/pdf' ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{cert.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {cert.fileName}
                        {cert.fileSizeBytes > 0 && ` • ${formatBytes(cert.fileSizeBytes)}`}
                        {` • order ${cert.displayOrder}`}
                      </p>
                    </div>

                    <a
                      href={cert.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl text-slate-500 hover:bg-white border border-slate-200 shrink-0"
                      aria-label={`Open ${cert.title} (opens in a new tab)`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => startEditing(cert)}
                      className="p-2 rounded-xl text-slate-500 hover:bg-white border border-slate-200 shrink-0"
                      aria-label={`Rename ${cert.title}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cert)}
                      disabled={deletingId === cert.id || isBuiltIn(cert)}
                      title={isBuiltIn(cert) ? 'Bundled document — not deletable while the certificates database is unreachable' : 'Delete'}
                      className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 disabled:opacity-40 shrink-0"
                      aria-label={`Delete ${cert.title}`}
                    >
                      {deletingId === cert.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 text-[11px] text-slate-500 p-3 rounded-xl">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-brand-700" />
          <p>
            Every upload, rename and deletion here is logged server-side with your admin email, and documents are transmitted over HTTPS and stored encrypted at rest.
            Only PDF, JPG, JPEG and PNG files are accepted — each one is checked by type, extension and file signature before it is stored.
            Publish practice credentials only; never upload a document containing patient information.
          </p>
        </div>
      </div>
    </PanelCard>
  );
};
