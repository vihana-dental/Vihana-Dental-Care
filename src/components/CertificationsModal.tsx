import React from 'react';
import { X, FileText, ExternalLink, Award } from 'lucide-react';

interface CertificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Filenames match the actual PDFs in public/certifications/ exactly —
// including the trailing space before ".pdf" on the clinic registration
// file — encodeURIComponent handles that (and the spaces/underscore in the
// others) correctly in one pass.
const CERTIFICATIONS: { label: string; filename: string }[] = [
  { label: "Dr. N. Sanchana — MDS Orthodontics & Dentofacial Orthopaedics", filename: 'MDS Orthodontics and Dentofacial Orthopaedics.pdf' },
  { label: 'Clinic Registration Certificate', filename: 'Clinic registration .pdf' },
  { label: 'Kovai Bio Medical Waste Management Enrollment', filename: 'Kovai Bio waste enrollment form.pdf' },
  { label: 'Udyam (MSME) Registration', filename: 'Print _ Udyam Registration.pdf' }
];

export const CertificationsModal: React.FC<CertificationsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-slate-950 text-white px-6 py-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center shrink-0">
              <Award className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <p className="text-sm font-bold">Certifications & Registrations</p>
              <p className="text-[11px] text-slate-400">Clinic licensing and doctor qualifications</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2">
          {CERTIFICATIONS.map((cert) => (
            <a
              key={cert.filename}
              href={`/certifications/${encodeURIComponent(cert.filename)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-teal-300 hover:bg-teal-50/60 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800 flex-1">{cert.label}</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};
