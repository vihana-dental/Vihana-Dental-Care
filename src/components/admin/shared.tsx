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
      <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
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
    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
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

export const inputClass = "w-full bg-white text-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 placeholder:text-slate-400";
export const labelClass = "text-xs font-semibold text-slate-600 block mb-1.5";
export const primaryButtonClass = "flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold py-2.5 px-4 rounded-xl transition-colors";
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
