import React, { useState } from 'react';
import { ShieldCheck, Lock, Loader2, AlertTriangle } from 'lucide-react';
import { AdminSidebar, AdminSection } from './admin/AdminSidebar';
import { OverviewPanel } from './admin/panels/OverviewPanel';
import { FeesPanel } from './admin/panels/FeesPanel';
import { ConsultsPanel } from './admin/panels/ConsultsPanel';
import { ServicesPanel } from './admin/panels/ServicesPanel';
import { TeamPanel } from './admin/panels/TeamPanel';
import { GalleryPanel } from './admin/panels/GalleryPanel';
import { BlogPanel } from './admin/panels/BlogPanel';
import { FAQPanel } from './admin/panels/FAQPanel';
import { ReviewsPanel } from './admin/panels/ReviewsPanel';
import { GoogleReviewsOverridePanel } from './admin/panels/GoogleReviewsOverridePanel';
import { CalendarPanel } from './admin/panels/CalendarPanel';

const SESSION_STORAGE_KEY = 'vihana_doctor_admin_token';

const SECTION_TITLES: Record<AdminSection, string> = {
  overview: 'Dashboard',
  fees: 'Booking Fees',
  consults: 'Online Consults',
  services: 'Services',
  team: 'Our Team',
  gallery: 'Gallery',
  blog: 'Blog',
  faqs: 'FAQs',
  reviews: 'Reviews',
  calendar: 'Calendar & Sheets'
};

// Redesigned as a proper dashboard — sidebar navigation between panels
// instead of one long stacked-card scroll, light/minimalist theme to match
// a professional admin console rather than the marketing site's dark
// hero styling. Every panel is its own component under ./admin/panels/,
// each self-contained (loads its own data on mount, manages its own save
// state), sharing only the authedFetch/onSessionExpired contract and the
// visual primitives in ./admin/shared.tsx.
export const DoctorAdminPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_STORAGE_KEY));
  const [pin, setPin] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  const authedFetch = (url: string, options: RequestInit = {}) =>
    fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Login failed.');
      sessionStorage.setItem(SESSION_STORAGE_KEY, data.token);
      setToken(data.token);
      setPin('');
    } catch (err: any) {
      setLoginError(err?.message || 'Could not log in. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setToken(null);
    setActiveSection('overview');
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-6 text-teal-300">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs font-bold tracking-widest uppercase">Vihana Dental Care — Doctor Admin</span>
          </div>
          <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 pb-2">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Lock className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Doctor Login</p>
                <p className="text-[10px] text-slate-400">Enter your PIN to manage the dashboard</p>
              </div>
            </div>

            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              className="w-full bg-slate-950 text-white text-center tracking-[0.4em] text-lg px-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:border-teal-500"
            />

            {loginError && (
              <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading || !pin.trim()}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{loginLoading ? 'Verifying...' : 'Unlock'}</span>
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-600 mt-6">Vihana Dental Care internal tool. Not linked from the public site.</p>
        </div>
      </div>
    );
  }

  const panelProps = { authedFetch, onSessionExpired: handleLogout };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      <AdminSidebar active={activeSection} onSelect={setActiveSection} onLogout={handleLogout} />

      <main className="flex-1 min-w-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="hidden lg:block mb-6">
            <h1 className="text-xl font-extrabold text-slate-900">{SECTION_TITLES[activeSection]}</h1>
          </div>

          {activeSection === 'overview' && <OverviewPanel onNavigate={setActiveSection} />}
          {activeSection === 'fees' && <FeesPanel {...panelProps} />}
          {activeSection === 'consults' && <ConsultsPanel {...panelProps} />}
          {activeSection === 'services' && <ServicesPanel {...panelProps} />}
          {activeSection === 'team' && <TeamPanel {...panelProps} />}
          {activeSection === 'gallery' && <GalleryPanel {...panelProps} />}
          {activeSection === 'blog' && <BlogPanel {...panelProps} />}
          {activeSection === 'faqs' && <FAQPanel {...panelProps} />}
          {activeSection === 'reviews' && (
            <div className="space-y-6">
              <ReviewsPanel {...panelProps} />
              <GoogleReviewsOverridePanel {...panelProps} />
            </div>
          )}
          {activeSection === 'calendar' && <CalendarPanel {...panelProps} />}
        </div>
      </main>
    </div>
  );
};
