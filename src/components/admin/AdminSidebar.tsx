import React from 'react';
import {
  LayoutGrid, IndianRupee, Video, Stethoscope, Users, Image as ImageIcon,
  Newspaper, HelpCircle, Star, CalendarCheck2, LogOut, ShieldCheck, CalendarDays, CalendarRange, UserCog, CalendarOff, Award
} from 'lucide-react';

export type AdminSection =
  | 'overview' | 'appointments' | 'live-calendar' | 'schedule' | 'patients' | 'fees' | 'consults' | 'services' | 'team'
  | 'gallery' | 'certificates' | 'blog' | 'faqs' | 'reviews' | 'calendar';

const NAV_ITEMS: { id: AdminSection; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Dashboard', icon: <LayoutGrid className="w-4 h-4" /> },
  { id: 'appointments', label: 'Appointments', icon: <CalendarDays className="w-4 h-4" /> },
  { id: 'live-calendar', label: 'Live Calendar', icon: <CalendarRange className="w-4 h-4" /> },
  { id: 'schedule', label: 'Doctor Schedule', icon: <CalendarOff className="w-4 h-4" /> },
  { id: 'patients', label: 'Patient Database', icon: <UserCog className="w-4 h-4" /> },
  { id: 'fees', label: 'Booking Fees', icon: <IndianRupee className="w-4 h-4" /> },
  { id: 'consults', label: 'Online Consults', icon: <Video className="w-4 h-4" /> },
  { id: 'services', label: 'Services', icon: <Stethoscope className="w-4 h-4" /> },
  { id: 'team', label: 'Our Team', icon: <Users className="w-4 h-4" /> },
  { id: 'gallery', label: 'Gallery', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'certificates', label: 'Certificates', icon: <Award className="w-4 h-4" /> },
  { id: 'blog', label: 'Blog', icon: <Newspaper className="w-4 h-4" /> },
  { id: 'faqs', label: 'FAQs', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'reviews', label: 'Reviews', icon: <Star className="w-4 h-4" /> },
  { id: 'calendar', label: 'Calendar & Sheets', icon: <CalendarCheck2 className="w-4 h-4" /> },
];

interface AdminSidebarProps {
  active: AdminSection;
  onSelect: (section: AdminSection) => void;
  onLogout: () => void;
}

// Desktop: fixed left column. Mobile: horizontal scrollable pill bar up
// top instead of a full drawer — simpler, and this console is an internal
// tool the doctor mostly uses on a laptop.
export const AdminSidebar: React.FC<AdminSidebarProps> = ({ active, onSelect, onLogout }) => {
  return (
    <>
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-white border-r border-slate-200 h-screen sticky top-0">
        <div className="px-5 py-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-brand-900">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs font-extrabold tracking-wide uppercase">Vihana Admin</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Doctor Console</p>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin py-3 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors border-l-[3px] ${
                active === item.id
                  ? 'bg-brand-200 text-brand-950 font-bold border-brand-accent'
                  : 'text-slate-600 hover:bg-slate-50 border-transparent'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <div className="lg:hidden sticky top-0 z-20 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-brand-900">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs font-extrabold tracking-wide uppercase">Vihana Admin</span>
          </div>
          <button onClick={onLogout} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Log out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 px-3 pb-3 overflow-x-auto scroll-thin">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-colors ${
                active === item.id ? 'bg-brand-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
