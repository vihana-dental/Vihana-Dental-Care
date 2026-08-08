import React from 'react';
import { motion } from 'motion/react';
import { Home, Calendar, MessageCircle } from 'lucide-react';
import { CLINIC_INFO } from '../data/clinicData';

interface NotFoundPageProps {
  onGoHome: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onGoHome }) => {
  const whatsappHref = `https://wa.me/${CLINIC_INFO.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
    "Hi, I'd like to book a dental appointment at Vihana Dental Care."
  )}`;

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="max-w-lg w-full text-center space-y-6"
      >
        <p className="text-8xl sm:text-9xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-600 via-emerald-500 to-teal-700">
          404
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          This page took an unscheduled trip.
        </h1>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
          The page you're looking for doesn't exist or may have moved. Let's get you back to a healthy smile.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onGoHome}
            className="w-full sm:w-auto bg-teal-700 hover:bg-teal-800 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2 text-sm transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
          <button
            onClick={onGoHome}
            className="w-full sm:w-auto bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-bold px-6 py-3.5 rounded-2xl shadow-sm flex items-center justify-center gap-2 text-sm transition-colors"
          >
            <Calendar className="w-4 h-4 text-teal-600" />
            <span>Book an Appointment</span>
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto bg-[#25D366] hover:bg-[#1ebd5a] text-white font-bold px-6 py-3.5 rounded-2xl shadow-sm flex items-center justify-center gap-2 text-sm transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>WhatsApp Us</span>
          </a>
        </div>
      </motion.div>
    </div>
  );
};
