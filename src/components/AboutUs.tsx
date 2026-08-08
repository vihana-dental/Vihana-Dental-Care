import React from 'react';
import { motion } from 'motion/react';
import { Award, ShieldCheck, HeartPulse, Sparkles, CheckCircle2 } from 'lucide-react';

export const AboutUs: React.FC = () => {
  const springTransition = { type: 'spring', stiffness: 100, damping: 20 };

  return (
    <section className="py-20 bg-white text-slate-800">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-16">
        {/* Header Title */}
        <motion.div 
          className="text-center max-w-3xl mx-auto space-y-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={springTransition}
        >
          <div className="inline-flex items-center gap-1.5 bg-teal-500/10 text-teal-800 text-xs font-bold px-4 py-1.5 rounded-full border border-teal-500/20">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Pioneering Dental Care in Kalapatti</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-sans">
            Your Trusted Partner for a Confident, Radiant Smile.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-normal">
            At Vihana Dental Care, we pair Swiss computer-guided implant dentistry with gentle human care, establishing new standards for clinical precision in Coimbatore.
          </p>
        </motion.div>

        {/* Why Choose Us */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={springTransition}
          className="bg-[#F5F5F7] text-slate-800 rounded-[32px] p-8 sm:p-12 space-y-8 border border-slate-200/60"
        >
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-1.5 bg-teal-500/10 text-teal-800 text-xs font-bold px-4 py-1.5 rounded-full border border-teal-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Why Kalapatti Chooses Vihana</span>
            </div>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Modern Dentistry, Delivered Without the Anxiety.
            </h3>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Vihana Dental Care is a modern dental clinic in Kalapatti, Coimbatore, built around painless dentistry and advanced digital diagnostics. From root canal treatment and crowns &amp; bridges to cosmetic dentistry, pediatric care, and same-day emergency appointments — our patient-first approach means transparent pricing, minimal wait times, and dedicated follow-up care for every single procedure.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Root canal treatment (RCT), crowns & bridges',
              'Cosmetic dentistry & smile makeovers',
              'Pediatric dental care for kids of all ages',
              'Emergency treatment with same-day appointments',
              'Transparent, upfront pricing — no surprises',
              'Minimal wait times & dedicated follow-up care',
              'Walk-ins welcome, or book online in advance',
              'Comfortable, anxiety-free visits for every patient'
            ].map((point) => (
              <div key={point} className="flex items-start gap-2.5 text-sm text-slate-700 bg-white border border-slate-200/80 rounded-2xl px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                <span>{point}</span>
              </div>
            ))}
          </div>

          <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
            Whether it's a routine checkup or a complex treatment plan, our experienced team ensures every visit is comfortable from start to finish. Visit us in Kalapatti for a healthier smile today.
          </p>
        </motion.div>

        {/* 4 Pillars Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={springTransition}
            whileHover={{ y: -6 }}
            className="bg-[#F5F5F7] p-8 rounded-[28px] border border-slate-200/60 shadow-xs hover:shadow-xl transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-800 flex items-center justify-center mb-5 border border-teal-500/20">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">5+ Years Experience</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Over 5,000 successful computer-guided implants, Invisalign cases, and laser root canals delivered in Coimbatore.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ...springTransition, delay: 0.1 }}
            whileHover={{ y: -6 }}
            className="bg-[#F5F5F7] p-8 rounded-[28px] border border-slate-200/60 shadow-xs hover:shadow-xl transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-800 flex items-center justify-center mb-5 border border-emerald-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">German Class-B Suite</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              100% sterile 6-stage hospital autoclave protocol adhering strictly to global infection control protocols.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ...springTransition, delay: 0.2 }}
            whileHover={{ y: -6 }}
            className="bg-[#F5F5F7] p-8 rounded-[28px] border border-slate-200/60 shadow-xs hover:shadow-xl transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-800 flex items-center justify-center mb-5 border border-cyan-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">3D Scanner & Laser</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              3D CBCT ultra-low radiation scanners, iTero intraoral aligner cameras, and soft-tissue dental lasers.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ ...springTransition, delay: 0.3 }}
            whileHover={{ y: -6 }}
            className="bg-[#F5F5F7] p-8 rounded-[28px] border border-slate-200/60 shadow-xs hover:shadow-xl transition-all"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-800 flex items-center justify-center mb-5 border border-indigo-500/20">
              <HeartPulse className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">100% Pain-Free Care</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              Computer-controlled targeted local anesthesia guaranteeing completely comfortable, anxiety-free visits.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
