import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, 
  Clock, 
  MapPin, 
  Calendar, 
  Menu, 
  X
} from 'lucide-react';
import { CLINIC_INFO } from '../data/clinicData';
import { AuthUser } from '../types';

// Updated to point to the public/images folder
const vihannaLogo = '/images/vihanna_dental_logo_1784918513788.jpg';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBooking: (serviceId?: string) => void;
  currentUser: AuthUser;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenBooking,
  currentUser,
  onOpenAuthModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'about', label: 'About Us' },
    { id: 'services', label: 'Services' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'reviews', label: 'Reviews' },
    { id: 'location', label: 'Contact & Map' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-xs border-b border-slate-200">
      {/* Top Banner Bar */}
      <div className="bg-slate-900 text-slate-100 text-xs py-2 px-4 sm:px-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-4 flex-wrap">
            <a 
              href={`tel:${CLINIC_INFO.phone}`} 
              className="flex items-center gap-1.5 hover:text-teal-300 transition-colors"
              id="top-bar-phone"
            >
              <Phone className="w-3.5 h-3.5 text-teal-400" />
              <span className="font-semibold">{CLINIC_INFO.phone}</span>
            </a>
            <div className="hidden md:flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-teal-400" />
              <span>{CLINIC_INFO.address}, {CLINIC_INFO.city}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-teal-400" />
              <span>Mon-Sat: 9 AM - 8:30 PM</span>
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
              src={vihannaLogo} 
              alt="Vihanna Dental Clinic Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-tight flex items-center gap-1.5">
              <span>VIHANNA</span>
              <span className="text-teal-700 font-light">DENTAL</span>
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
                activeTab === item.id
                  ? 'text-teal-800 font-bold'
                  : 'text-slate-600 hover:text-teal-700 hover:bg-slate-50'
              }`}
              id={`nav-link-${item.id}`}
            >
              {item.label}
              {activeTab === item.id && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-teal-600 rounded-full"
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
            className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all"
            id="navbar-book-now-button"
          >
            <Calendar className="w-4 h-4 text-teal-200" />
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
                  activeTab === item.id ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                setActiveTab('whatsapp-simulator');
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-emerald-700 bg-emerald-50"
            >
              WhatsApp Auto-Booking Bot
            </button>

            <div className="pt-2">
              <button
                onClick={() => {
                  onOpenBooking();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-teal-700 text-white py-3 rounded-xl font-bold text-sm shadow-sm"
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