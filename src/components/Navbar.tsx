import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Phone,
  Clock,
  MapPin,
  Calendar,
  Menu,
  X,
  MessageCircle
} from 'lucide-react';
import { CLINIC_INFO } from '../data/clinicData';

// Updated to point to the public/images folder
const vihanaLogo = '/images/vihana_dental_logo_1784918513788.jpg';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBooking: (serviceId?: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenBooking,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Matches the actual on-page section order in App.tsx's Home tab
  // (Hero -> Services -> About -> Team -> Gallery -> Blog -> Reviews ->
  // Contact), so the nav and scroll-spy agree with what the user actually
  // scrolls past instead of listing sections out of sequence.
  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'services', label: 'Services' },
    { id: 'about', label: 'About Us' },
    { id: 'team', label: 'Our Team' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'blog', label: 'Blog' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'location', label: 'Contact & Map' },
  ];

  const whatsappHref = `https://wa.me/${CLINIC_INFO.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    "Hi, I'd like to book a dental appointment at Vihana Dental Care."
  )}`;

  // Scroll-spy — only meaningful on the Home tab, where all sections are
  // stacked on one scrollable page (every other tab is a standalone single-
  // section view and is always correctly "active" by definition). Tracks
  // which section id is crossing a thin band near the sticky header height
  // and highlights that nav item instead of the literal activeTab.
  const [visibleSectionId, setVisibleSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'home') return;
    let observer: IntersectionObserver | undefined;
    let cancelled = false;

    // AnimatePresence's exit transition means the Home section divs may not
    // exist in the DOM yet on the same tick activeTab flips to 'home' —
    // retry briefly until they mount.
    const attach = (attempt = 0) => {
      if (cancelled) return;
      const elements = navItems
        .map((item) => document.getElementById(item.id))
        .filter((el): el is HTMLElement => el !== null);
      if (elements.length === 0 && attempt < 10) {
        setTimeout(() => attach(attempt + 1), 60);
        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((e) => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible[0]) setVisibleSectionId(visible[0].target.id);
        },
        { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
      );
      elements.forEach((el) => observer!.observe(el));
    };
    attach();

    return () => { cancelled = true; observer?.disconnect(); };
  }, [activeTab]);

  const highlightedTab = activeTab === 'home' ? (visibleSectionId ?? 'home') : activeTab;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-xs border-b border-slate-200">
      {/* Top Banner Bar */}
      <div className="bg-slate-900 text-slate-100 text-xs py-2 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <a
              href={`tel:${CLINIC_INFO.phone}`}
              className="flex items-center gap-1.5 hover:text-brand-500 transition-colors"
              id="top-bar-phone"
            >
              <Phone className="w-3.5 h-3.5 text-brand-600" />
              <span className="font-semibold">{CLINIC_INFO.phone}</span>
            </a>
            <a
              href={`https://wa.me/${CLINIC_INFO.whatsapp.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-emerald-300 transition-colors"
              id="top-bar-whatsapp"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold">WhatsApp Us</span>
            </a>
            <div className="hidden md:flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-brand-600" />
              <span>{CLINIC_INFO.address}, {CLINIC_INFO.city}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-brand-600" />
              <span>Mon-Sat: 9-1:30 & 5-8:30 PM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        {/* Logo with Motion */}
        <motion.div 
          onClick={() => setActiveTab('home')} 
          className="cursor-pointer flex items-center gap-3 group"
          id="navbar-logo-button"
          whileHover={{ scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shadow-xs flex items-center justify-center bg-white">
            <img 
              src={vihanaLogo} 
              alt="Vihana Dental Care Logo"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight flex items-center gap-1.5">
              <span>VIHANA</span>
              <span className="text-brand-900 font-light">DENTAL CARE</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">
              COIMBATORE
            </p>
          </div>
        </motion.div>

        {/* Desktop Links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all relative ${
                highlightedTab === item.id
                  ? 'text-brand-950 font-bold'
                  : 'text-slate-600 hover:text-brand-900 hover:bg-slate-50'
              }`}
              id={`nav-link-${item.id}`}
            >
              {item.label}
              {highlightedTab === item.id && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-brand-800 rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </nav>

        {/* CTA Actions */}
        <div className="hidden sm:flex items-center gap-3">
          <motion.button
            onClick={() => onOpenBooking()}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 bg-brand-900 hover:bg-brand-950 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all"
            id="navbar-book-now-button"
          >
            <Calendar className="w-4 h-4 text-brand-400" />
            <span>Book Appointment</span>
          </motion.button>
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
          id="mobile-menu-trigger"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-6 space-y-2 overflow-hidden"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${
                  highlightedTab === item.id ? 'bg-brand-200 text-brand-950 font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center gap-2 text-left px-4 py-2.5 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Book on WhatsApp</span>
            </a>

            <div className="pt-2">
              <button
                onClick={() => {
                  onOpenBooking();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-brand-900 text-white py-3 rounded-xl font-bold text-sm shadow-sm"
              >
                <Calendar className="w-4 h-4" />
                <span>Book Appointment Now</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};