import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Star,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  MessageCircle
} from 'lucide-react';
import { CLINIC_INFO } from '../data/clinicData';
const vihanaOperatory = '/images/vihana_operatory_1784918541912.jpg';
const vihanaDoctor = '/images/Dr.Sanchana.jpeg';

interface HeroProps {
  onOpenBooking: () => void;
  setActiveTab: (tab: string) => void;
}

const whatsappBookingHref = `https://wa.me/${CLINIC_INFO.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
  "Hi, I'd like to book a dental appointment at Vihana Dental Care."
)}`;

export const Hero: React.FC<HeroProps> = ({
  onOpenBooking,
}) => {
  const springTransition = { type: 'spring', stiffness: 100, damping: 20 };

  // Live (or doctor-admin-overridden) rating/review count — same source as
  // TestimonialsView, so the two never disagree. Starts from the static
  // fallback and swaps in the live figure once it lands.
  const [rating, setRating] = useState<number>(CLINIC_INFO.rating);
  const [totalReviews, setTotalReviews] = useState<number>(CLINIC_INFO.totalReviews);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/google-reviews')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data.rating === 'number') setRating(data.rating);
        if (typeof data.totalReviews === 'number') setTotalReviews(data.totalReviews);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: springTransition },
  };

  return (
    <section className="relative overflow-hidden bg-[#0d1117] text-white pt-10 pb-16 lg:pt-16 lg:pb-24">
      {/* Diffuse Ambient Background Glow */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.12)_0%,rgba(16,185,129,0.05)_40%,transparent_70%)] pointer-events-none" />

      {/* Animated background — slow-drifting teal/emerald orbs, a faint
          scanning grid, and a large low-opacity "VIHANA DENTAL CARE"
          wordmark. Pure CSS/Framer Motion transforms only (no video/GIF), so
          it stays lightweight, and everything sits below z-10 so it never
          competes with the actual headline for legibility. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Faint animated grid texture */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(45,212,191,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.6) 1px, transparent 1px)',
            backgroundSize: '48px 48px'
          }}
        />

        {/* Large background wordmark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
          className="absolute inset-0 flex items-center justify-center select-none"
        >
          <span
            className="text-[16vw] sm:text-[13vw] lg:text-[10vw] font-extrabold tracking-tight whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-teal-500/25 via-emerald-400/20 to-teal-300/15"
            aria-hidden="true"
          >
            VIHANA DENTAL CARE
          </span>
        </motion.div>

        {/* Drifting glow orbs */}
        <motion.div
          className="absolute w-72 h-72 rounded-full bg-teal-500/10 blur-3xl"
          style={{ top: '10%', left: '8%' }}
          animate={{ x: [0, 40, 0], y: [0, 30, 0], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl"
          style={{ bottom: '5%', right: '10%' }}
          animate={{ x: [0, -50, 0], y: [0, -20, 0], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute w-56 h-56 rounded-full bg-cyan-400/10 blur-3xl"
          style={{ top: '45%', right: '25%' }}
          animate={{ x: [0, 25, 0], y: [0, -35, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 relative z-10 space-y-12">
        {/* Main Hero Header */}
        <motion.div 
          className="space-y-6 text-center max-w-4xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Rating Badge */}
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 bg-slate-900/90 border border-white/10 backdrop-blur-md text-teal-300 px-4 py-1.5 rounded-full text-xs font-semibold shadow-2xl">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{rating.toFixed(1)}★ Google Rating ({totalReviews} Reviews)</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">Kalapatti, Coimbatore</span>
          </motion.div>

          {/* Main Headline - Optimized for SEO */}
          <motion.h1 
            variants={itemVariants} 
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.08] font-sans"
          >
            Top-Rated Dental Clinic <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-emerald-300 to-teal-100">
              in Kalapatti, Coimbatore.
            </span>
          </motion.h1>

          {/* Subheading - Optimized for GEO */}
          <motion.p 
            variants={itemVariants} 
            className="text-slate-300 text-base sm:text-xl max-w-2xl mx-auto font-normal leading-relaxed tracking-wide"
          >
            Located in the heart of Kalapatti, Vihana Dental Care brings Swiss computer-guided implants, 3D Invisalign aligners, and microscopic laser root canals to Coimbatore. Experience 100% sterile, pain-free dentistry.
          </motion.p>

          {/* Action Button Group */}
          <motion.div variants={itemVariants} className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <motion.button
              onClick={onOpenBooking}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold px-8 py-4 rounded-2xl shadow-xl shadow-teal-500/20 flex items-center gap-2.5 text-base transition-all group"
              id="hero-book-now-button"
            >
              <Calendar className="w-5 h-5 text-slate-950" />
              <span>Book Appointment Online</span>
              <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </motion.button>

            <motion.a
              href={whatsappBookingHref}
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
              className="bg-slate-900/90 hover:bg-slate-800 border border-white/10 text-white font-semibold px-6 py-4 rounded-2xl shadow-lg flex items-center gap-2 text-sm transition-all"
              id="hero-whatsapp-bot-button"
            >
              <MessageCircle className="w-4 h-4 text-emerald-300" />
              <span>Book Appointment on WhatsApp</span>
            </motion.a>
          </motion.div>
        </motion.div>

        {/* Bento Box Layout Section */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-4"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={springTransition}
        >
          {/* Bento Card 1: Main Operatory Visual (7 Cols) */}
          <div className="md:col-span-7 bg-slate-900/80 border border-white/10 backdrop-blur-xl rounded-[28px] overflow-hidden p-2 flex flex-col justify-between group hover:border-teal-500/30 transition-colors shadow-2xl">
            <div className="relative h-64 sm:h-80 rounded-[22px] overflow-hidden bg-slate-950">
              <img
                src={vihanaOperatory}
                alt="Vihana Dental Care Operatory in Kalapatti"
                className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-white">
                <div>
                  <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Advanced Operatory
                  </span>
                  <h2 className="text-lg font-bold mt-1 text-white">German Class-B Sterilization & 3D Scanner</h2>
                </div>
              </div>
            </div>

            <div className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>100% Sterile & Pain-Free Dental Suite</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Microscopic Laser Technology</span>
              </div>
            </div>
          </div>

          {/* Bento Card 2: Lead Doctor Spotlight (5 Cols) */}
          <div className="md:col-span-5 bg-slate-900/80 border border-white/10 backdrop-blur-xl rounded-[28px] p-6 flex flex-col justify-between space-y-6 hover:border-teal-500/30 transition-colors shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={vihanaDoctor}
                  alt="Dr. N. Sanchana MDS - Orthodontist in Kalapatti"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-teal-500/40 shadow-lg"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <span className="bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Chief Orthodontist
                  </span>
                  <h2 className="text-lg font-bold text-white mt-0.5">Dr. N. Sanchana, M.D.S.</h2>
                  <p className="text-xs text-slate-400 font-medium">MDS (Orthodontics & Aligners)</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                5+ years of specialist experience in Invisalign, custom clear aligners, pediatric braces, and jaw alignment transformations in the Kalapatti region.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-center">
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5">
                <p className="text-2xl font-extrabold text-white">5,000+</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Smiles Designed</p>
              </div>
              <div className="bg-slate-950/60 p-3 rounded-2xl border border-white/5">
                <p className="text-2xl font-extrabold text-teal-300">100%</p>
                <p className="text-[11px] text-slate-400 font-medium mt-0.5">Digital 3D Workflow</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};