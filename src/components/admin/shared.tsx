import React from 'react';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

// Shared visual language for every admin dashboard panel — light,
// minimalist, professional. Every panel imports from here instead of
// repeating className strings, so the whole console stays visually
// consistent as new panels get added.

export const PanelCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>{children}</div>
);

export const PanelHeader: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }> = ({ icon, title, subtitle, action }) => (
  <div className="flex items-center justify-between gap-3 px-6 py-5 border-b border-slate-100">
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-xl bg-brand-200 border border-brand-300 flex items-center justify-center text-brand-900 shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
        <p className="text-xs text-slate-500 truncate">{subtitle}</p>
      </div>
    </div>
    {action}
  </div>
);

export const LoadingRow: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-10">
    <Loader2 className="w-4 h-4 animate-spin text-brand-800" />
    <span>{label}</span>
  </div>
);

export const ErrorBanner: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">
    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
    <div>
      <p>{message}</p>
      {onRetry && <button onClick={onRetry} className="underline font-semibold mt-1">Retry</button>}
    </div>
  </div>
);

export const SuccessBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-3 rounded-xl">
    <CheckCircle2 className="w-4 h-4 shrink-0" />
    <span>{message}</span>
  </div>
);

// Compact on/off switch, used across admin panels for any boolean toggle
// (doctor/consultant `bookable`, appointment `patientVisited`/payment/
// confirmation state, etc.) — one visual language for every switch in the
// console instead of each panel rolling its own.
export const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }> = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-6 rounded-full transition-colors shrink-0 disabled:opacity-50 ${checked ? 'bg-brand-800' : 'bg-slate-300'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

/** The Appointments panel reads this once on mount so a dashboard tile can open it on the right tab. */
export const APPOINTMENT_TAB_HANDOFF_KEY = 'vihana_admin_appt_tab';

/** Today's date (YYYY-MM-DD) in the clinic's timezone — not UTC, which is a day behind for the first hours of every IST morning. */
export const clinicToday = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** Shifts a YYYY-MM-DD date by whole days without any timezone drift. */
export const shiftDate = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** "Sat, 26 Sep" — compact, unambiguous date label for lists and headers. */
export const formatShortDate = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Minutes since midnight for a slot label like "2:30 PM" — for sorting a day's appointments in time order. */
export const slotMinutes = (label: string): number => {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === 'PM') h += 12;
  return h * 60 + Number(m[2]);
};

/**
 * Modal confirmation for anything destructive. `requirePhrase` adds a
 * type-to-confirm box for the irreversible ones, so a stray click can't
 * erase a record.
 */
export const ConfirmDialog: React.FC<{
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  requirePhrase?: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, confirmLabel, tone = 'danger', requirePhrase, busy, error, onConfirm, onCancel }) => {
  const [typed, setTyped] = React.useState('');
  const blocked = Boolean(requirePhrase) && typed.trim().toLowerCase() !== requirePhrase!.toLowerCase();

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-2">
          <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${tone === 'danger' ? 'text-rose-600' : 'text-amber-600'}`} />
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <div className="text-xs text-slate-600 leading-relaxed">{message}</div>
          </div>
        </div>

        {requirePhrase && (
          <div>
            <label className={labelClass}>Type <span className="font-mono text-slate-900">{requirePhrase}</span> to confirm</label>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} autoFocus />
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={ghostButtonClass + ' flex-1'}>Keep it</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || blocked}
            className={(tone === 'danger' ? dangerButtonClass : primaryButtonClass) + ' flex-1'}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/** A single headline number on the dashboard. Clickable when `onClick` is given. */
export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'attention' | 'good';
  onClick?: () => void;
}> = ({ label, value, hint, tone = 'default', onClick }) => {
  const toneClass = tone === 'attention' ? 'border-amber-200 bg-amber-50' : tone === 'good' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white';
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-extrabold text-slate-900 mt-1 leading-none">{value}</p>
      {hint && <p className="text-[11px] text-slate-500 mt-1.5">{hint}</p>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={`text-left border rounded-2xl p-4 transition-colors hover:border-brand-400 ${toneClass}`}>{body}</button>
  ) : (
    <div className={`border rounded-2xl p-4 ${toneClass}`}>{body}</div>
  );
};

export const inputClass = "w-full bg-white text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-brand-700 focus:ring-1 focus:ring-brand-700 placeholder:text-slate-400";
export const labelClass = "text-xs font-semibold text-slate-600 block mb-1.5";
export const primaryButtonClass = "flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-900 disabled:opacity-50 text-white text-sm font-bold py-2.5 px-4 rounded-xl transition-colors";
export const ghostButtonClass = "flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold py-2.5 px-4 rounded-xl border border-slate-200 transition-colors";
export const dangerButtonClass = "flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 text-sm font-semibold py-2.5 px-4 rounded-xl border border-rose-200 transition-colors";

/** Small pill-list editor for array fields (benefits, procedures, external training, available days). */
export const ListFieldEditor: React.FC<{
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}> = ({ label, items, onChange, placeholder }) => {
  const [draft, setDraft] = React.useState('');

  const addItem = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft('');
  };

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full">
            {item}
            <button
              type="button"
              onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="w-4 h-4 rounded-full hover:bg-slate-300 flex items-center justify-center text-slate-500"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
        {items.length === 0 && <span className="text-xs text-slate-400 py-1">None added yet.</span>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }}
          placeholder={placeholder || 'Type and press Enter to add'}
          className={inputClass}
        />
        <button type="button" onClick={addItem} className={ghostButtonClass + ' shrink-0'}>Add</button>
      </div>
    </div>
  );
};
