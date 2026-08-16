import React, { useEffect, useState } from 'react';
import { X, FileText, ExternalLink, Award, Loader2, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { ClinicCertificate } from '../types';

interface CertificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// The four documents that ship with the site under public/certifications/.
// The server returns exactly these from /api/certificates until the doctor
// uploads something in the admin console; they are repeated here purely as
// an offline fallback for when that request fails outright, so the modal
// never opens onto an empty box.
//
// Filenames match the files on disk exactly — including the trailing space
// before ".pdf" on the clinic registration one — and encodeURIComponent
// handles that (and the spaces/underscore in the others) in one pass.
const FALLBACK_CERTIFICATES: { label: string; filename: string }[] = [
  { label: 'Dr. N. Sanchana — MDS Orthodontics & Dentofacial Orthopaedics', filename: 'MDS Orthodontics and Dentofacial Orthopaedics.pdf' },
  { label: 'Clinic Registration Certificate', filename: 'Clinic registration .pdf' },
  { label: 'Kovai Bio Medical Waste Management Enrollment', filename: 'Kovai Bio waste enrollment form.pdf' },
  { label: 'Udyam (MSME) Registration', filename: 'Print _ Udyam Registration.pdf' }
];

const fallbackList = (): ClinicCertificate[] =>
  FALLBACK_CERTIFICATES.map((cert, i) => ({
    id: `fallback-${i}`,
    title: cert.label,
    fileName: cert.filename,
    mimeType: 'application/pdf',
    fileSizeBytes: 0,
    fileUrl: `/certifications/${encodeURIComponent(cert.filename)}`,
    displayOrder: i,
    uploadedAt: ''
  }));

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CertificationsModal: React.FC<CertificationsModalProps> = ({ isOpen, onClose }) => {
  const [certificates, setCertificates] = useState<ClinicCertificate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load on open rather than on mount — this modal lives in the footer of
  // every page, and the list is only worth a request once someone asks for it.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/certificates');
        const data = await res.json();
        if (cancelled) return;
        if (!data.success || !Array.isArray(data.certificates)) throw new Error('Unexpected response');
        setCertificates(data.certificates);
      } catch {
        if (cancelled) return;
        // Anything uploaded since the last deploy won't be in the bundled
        // fallback, so say so rather than presenting a stale list as complete.
        setCertificates(fallbackList());
        setError("Couldn't load the latest list — showing the documents bundled with the site.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen]);

  // Escape closes, matching the click-outside behaviour below.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isImage = (cert: ClinicCertificate) => cert.mimeType.startsWith('image/');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="certifications-modal-title"
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-950 text-white px-6 py-5 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-700/20 border border-brand-700/30 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <p id="certifications-modal-title" className="text-sm font-bold">Certifications & Registrations</p>
              <p className="text-[11px] text-slate-400">Clinic licensing and doctor qualifications</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-10">
              <Loader2 className="w-4 h-4 animate-spin text-brand-800" />
              <span>Loading certificates...</span>
            </div>
          )}

          {error && (
            <p className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2.5 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </p>
          )}

          {!loading && certificates && certificates.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-10">No certificates have been published yet.</p>
          )}

          {!loading && certificates?.map((cert) => (
            <a
              key={cert.id}
              href={cert.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${cert.title} (opens in a new tab)`}
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-brand-500 hover:bg-brand-200/60 transition-colors"
            >
              {isImage(cert) ? (
                <img
                  src={cert.fileUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
              )}

              <span className="flex-1 min-w-0">
                <span className="block text-xs font-semibold text-slate-800">{cert.title}</span>
                <span className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                  {isImage(cert) ? <ImageIcon className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  <span>
                    {cert.mimeType === 'application/pdf' ? 'PDF' : cert.mimeType.replace('image/', '').toUpperCase()}
                    {cert.fileSizeBytes > 0 && ` • ${formatBytes(cert.fileSizeBytes)}`}
                  </span>
                </span>
              </span>

              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
