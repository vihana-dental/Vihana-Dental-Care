import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { AdminSidebar, AdminSection } from './admin/AdminSidebar';
import { OverviewPanel } from './admin/panels/OverviewPanel';
import { AppointmentsPanel } from './admin/panels/AppointmentsPanel';
import { LiveCalendarPanel } from './admin/panels/LiveCalendarPanel';
import { SchedulePanel } from './admin/panels/SchedulePanel';
import { PatientsPanel } from './admin/panels/PatientsPanel';
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
const GOOGLE_LOGIN_CLIENT_ID = import.meta.env.VITE_GOOGLE_LOGIN_CLIENT_ID as string | undefined;

// Google Identity Services loads as a global script, not an npm package —
// no first-party types ship for it, so this is deliberately typed loosely
// rather than hand-rolling a full ambient declaration for a handful of calls.
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SECTION_TITLES: Record<AdminSection, string> = {
  overview: 'Dashboard',
  appointments: 'Appointments',
  'live-calendar': 'Live Calendar',
  schedule: 'Doctor Schedule',
  patients: 'Patient Database',
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
  const [loginError, setLoginError] = useState('');
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const authedFetch = (url: string, options: RequestInit = {}) =>
    fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });

  const handleCredentialResponse = async (response: { credential: string }) => {
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Login failed.');
      sessionStorage.setItem(SESSION_STORAGE_KEY, data.token);
      setToken(data.token);
    } catch (err: any) {
      setLoginError(err?.message || 'Could not log in. Please try again.');
    }
  };

  // Google Identity Services is a global script (not an npm package) — load
  // it once, then initialize + render the "Sign in with Google" button into
  // googleButtonRef once both the script and the ref are ready.
  useEffect(() => {
    if (token || !GOOGLE_LOGIN_CLIENT_ID) return;

    const setup = () => {
      if (!window.google || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_LOGIN_CLIENT_ID,
        callback: handleCredentialResponse
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        width: 280
      });
    };

    if (window.google) {
      setup();
      return;
    }

    const existing = document.getElementById('google-identity-script');
    if (existing) {
      existing.addEventListener('load', setup, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-identity-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = setup;
    document.head.appendChild(script);
  }, [token]);

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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="text-center pb-2">
              <p className="text-sm font-bold">Doctor Login</p>
              <p className="text-[10px] text-slate-400 mt-1">Sign in with an authorized Google account</p>
            </div>

            <div className="flex justify-center" ref={googleButtonRef} />

            {!GOOGLE_LOGIN_CLIENT_ID && (
              <div className="flex items-center gap-2 bg-amber-950/50 border border-amber-900 text-amber-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Google sign-in isn't configured yet.</span>
              </div>
            )}

            {loginError && (
              <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}
          </div>
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
          {activeSection === 'appointments' && <AppointmentsPanel {...panelProps} />}
          {activeSection === 'live-calendar' && <LiveCalendarPanel {...panelProps} />}
          {activeSection === 'schedule' && <SchedulePanel {...panelProps} />}
          {activeSection === 'patients' && <PatientsPanel {...panelProps} />}
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
