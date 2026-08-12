import React from 'react';
import {
  IndianRupee, Video, Stethoscope, Users, Image as ImageIcon,
  Newspaper, HelpCircle, Star, CalendarCheck2, LayoutGrid
} from 'lucide-react';
import { AdminSection } from '../AdminSidebar';
import { PanelCard, PanelHeader } from '../shared';

const TILES: { id: AdminSection; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'fees', label: 'Booking Fees', description: 'In-clinic & online consult advance fees', icon: <IndianRupee className="w-5 h-5" /> },
  { id: 'consults', label: 'Online Consults', description: 'Approve or release pending video consults', icon: <Video className="w-5 h-5" /> },
  { id: 'services', label: 'Services', description: 'Full treatment catalog — pricing, benefits, procedures', icon: <Stethoscope className="w-5 h-5" /> },
  { id: 'team', label: 'Our Team', description: 'Lead doctors & visiting consultants', icon: <Users className="w-5 h-5" /> },
  { id: 'gallery', label: 'Gallery', description: 'Clinic photos & clinical posters', icon: <ImageIcon className="w-5 h-5" /> },
  { id: 'blog', label: 'Blog', description: 'Doctor-authored articles', icon: <Newspaper className="w-5 h-5" /> },
  { id: 'faqs', label: 'FAQs', description: 'Common patient questions', icon: <HelpCircle className="w-5 h-5" /> },
  { id: 'reviews', label: 'Reviews', description: 'Curated testimonials & live rating display', icon: <Star className="w-5 h-5" /> },
  { id: 'calendar', label: 'Calendar & Sheets', description: 'Google Calendar connection status', icon: <CalendarCheck2 className="w-5 h-5" /> },
];

interface Props {
  onNavigate: (section: AdminSection) => void;
}

export const OverviewPanel: React.FC<Props> = ({ onNavigate }) => (
  <PanelCard>
    <PanelHeader icon={<LayoutGrid className="w-5 h-5" />} title="Dashboard" subtitle="Everything on the public site, in one place" />
    <div className="p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TILES.map((tile) => (
          <button
            key={tile.id}
            onClick={() => onNavigate(tile.id)}
            className="text-left bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-200 rounded-xl p-4 transition-colors group"
          >
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 group-hover:border-teal-200 flex items-center justify-center text-teal-700 mb-3">
              {tile.icon}
            </div>
            <p className="text-sm font-bold text-slate-900">{tile.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{tile.description}</p>
          </button>
        ))}
      </div>
    </div>
  </PanelCard>
);
