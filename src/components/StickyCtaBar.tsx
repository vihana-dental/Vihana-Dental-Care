import React from 'react';
import { motion } from 'motion/react';
import { Phone, MessageCircle, Calendar } from 'lucide-react';
import { CLINIC_INFO, whatsAppBotHref } from '../data/clinicData';

interface StickyCtaBarProps {
  onOpenBooking: () => void;
}

export const StickyCtaBar: React.FC<StickyCtaBarProps> = ({ onOpenBooking }) => {
  // Both of these are booking CTAs, so they open the automated assistant
  // rather than the clinic's own line. Neither renders the number itself.
  const whatsappHref = whatsAppBotHref("Hi Vihana Dental Care, I'd like to book an appointment.");

  return (
    <>
      {/* Mobile Sticky Bottom CTA Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.1)] pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-3 gap-2 p-2.5">
          <a
            href={`tel:${CLINIC_INFO.phone}`}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-slate-700 bg-slate-100 active:bg-slate-200 transition-colors"
            id="sticky-call-now"
          >
            <Phone className="w-5 h-5 text-brand-900" />
            <span className="text-[11px] font-bold">Call Now</span>
          </a>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-emerald-800 bg-emerald-50 active:bg-emerald-100 transition-colors"
            id="sticky-whatsapp"
          >
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            <span className="text-[11px] font-bold">WhatsApp</span>
          </a>
          <motion.button
            onClick={onOpenBooking}
            whileTap={{ scale: 0.96 }}
            className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-white bg-brand-800 shadow-lg shadow-brand-800/30"
            id="sticky-book-now"
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[11px] font-bold">Book Now</span>
          </motion.button>
        </div>
      </div>

      {/* Desktop Floating WhatsApp Bubble */}
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        className="hidden lg:flex fixed bottom-24 right-6 z-50 items-center gap-2 pl-4 pr-5 h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm shadow-2xl shadow-emerald-500/30 transition-all hover:scale-105"
        id="desktop-whatsapp-bubble"
        aria-label="Book Appointments on Whatsapp"
      >
        <MessageCircle className="w-6 h-6 shrink-0" />
        <span>Book Appointments on Whatsapp</span>
      </a>
    </>
  );
};
