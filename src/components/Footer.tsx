import React from 'react';
import { CLINIC_INFO, SERVICES } from '../data/clinicData';
import { MapPin, Phone, Clock, ExternalLink, ShieldCheck, MessageCircle, Mail } from 'lucide-react';
const vihanaLogo = '/images/vihana_dental_logo_1784918513788.jpg';

interface FooterProps {
  setActiveTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveTab }) => {
  return (
    <footer className="bg-slate-950 text-slate-300 pt-16 pb-28 lg:pb-24 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Col 1: Brand Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-800 bg-white">
                <img 
                  src={vihanaLogo} 
                  alt="Vihana Dental Care Logo"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white tracking-tight">VIHANA DENTAL CARE</h3>
                <p className="text-[10px] text-teal-400 font-mono font-semibold">COIMBATORE • TAMIL NADU</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Vihana Dental Care is Coimbatore's premier multispecialty center specializing in computer-guided implants, 3D Invisalign aligners, and laser root canal therapy.
            </p>

            <div className="pt-2 flex items-center gap-2">
              <span className="bg-slate-900 text-teal-300 text-[11px] font-medium px-2.5 py-1 rounded-full border border-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" /> HIPAA Encrypted Practice
              </span>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button onClick={() => setActiveTab('home')} className="hover:text-teal-400 transition-colors">
                  Home Page
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('about')} className="hover:text-teal-400 transition-colors">
                  About Specialist Doctors
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('services')} className="hover:text-teal-400 transition-colors">
                  Dental Services & Pricing
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('gallery')} className="hover:text-teal-400 transition-colors">
                  Clinic Photo Gallery
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('reviews')} className="hover:text-teal-400 transition-colors">
                  Google Patient Reviews (4.9★)
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Services */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Core Treatments</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              {SERVICES.slice(0, 5).map((s) => (
                <li key={s.id}>
                  <button onClick={() => setActiveTab('services')} className="hover:text-teal-300 transition-colors text-left">
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Contact & Hours */}
          <div className="space-y-3 text-xs">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Contact & Location</h4>
            <p className="flex items-start gap-2 text-slate-300">
              <MapPin className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <span>{CLINIC_INFO.address}, Coimbatore - {CLINIC_INFO.pincode}</span>
            </p>
            <a href={`tel:${CLINIC_INFO.phone}`} className="flex items-center gap-2 text-slate-300 hover:text-teal-300 transition-colors">
              <Phone className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{CLINIC_INFO.phone}</span>
            </a>
            <a
              href={`https://wa.me/${CLINIC_INFO.whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-300 hover:text-emerald-300 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{CLINIC_INFO.whatsapp} (WhatsApp)</span>
            </a>
            <a href={`mailto:${CLINIC_INFO.email}`} className="flex items-center gap-2 text-slate-300 hover:text-teal-300 transition-colors">
              <Mail className="w-4 h-4 text-teal-400 shrink-0" />
              <span>{CLINIC_INFO.email}</span>
            </a>
            <p className="flex items-start gap-2 text-slate-300">
              <Clock className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
              <span>{CLINIC_INFO.workingHours.weekdays}</span>
            </p>

            <a
              href={CLINIC_INFO.googleBusinessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-teal-400 hover:underline pt-1 text-xs"
            >
              <span>View Google My Business Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Vihana Dental Care, Coimbatore. All Rights Reserved.</p>
          <a
            href="https://www.thepaperplane.co.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-teal-400 transition-colors"
          >
            Designed &amp; Developed by <span className="font-semibold">The Paper Plane</span>
          </a>
        </div>
      </div>
    </footer>
  );
};

