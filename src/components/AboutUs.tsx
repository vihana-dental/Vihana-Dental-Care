import React from 'react';
import { motion } from 'motion/react';
import { DOCTORS, CLINIC_INFO } from '../data/clinicData';
import { Award, ShieldCheck, HeartPulse, Sparkles, CheckCircle2, UserCheck, Stethoscope } from 'lucide-react';
const vihanaDoctor = '/images/vihana_doctor_1784918556857.jpg';

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
            Your Trusted Partner for a Confident, Healthy Smile.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-normal">
            At Vihana Dental Care, we pair Swiss computer-guided implant dentistry with gentle human care, establishing new standards for clinical precision in Coimbatore.
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

        {/* Doctor Profile Section */}
        <div className="space-y-8 pt-8">
          <motion.div 
            className="text-center max-w-2xl mx-auto space-y-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={springTransition}
          >
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Lead Doctor & Specialist
            </h3>
            <p className="text-slate-600 text-sm sm:text-base font-normal">
              Experienced, board-certified care dedicated to your family's oral health in Kalapatti, Coimbatore.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {DOCTORS.map((doc) => {
              const photo = doc.id === 'doc-1' ? vihanaDoctor : doc.photo;
              return (
                <motion.div 
                  key={doc.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={springTransition}
                  className="bg-[#F5F5F7] rounded-[32px] overflow-hidden border border-slate-200/80 shadow-lg hover:shadow-2xl transition-all duration-300 grid grid-cols-1 md:grid-cols-12 gap-0 group"
                >
                  {/* Photo Column */}
                  <div className="md:col-span-5 relative min-h-[320px] md:min-h-[420px] bg-slate-200 overflow-hidden">
                    <img
                      src={photo}
                      alt={doc.name}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700 ease-out"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4 bg-slate-900/90 text-teal-300 text-xs font-bold px-3.5 py-1.5 rounded-full border border-slate-700 shadow-lg backdrop-blur-md">
                      {doc.experienceYears}+ Years Clinical Excellence
                    </div>
                  </div>

                  {/* Details Column */}
                  <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-1.5 bg-teal-500/10 text-teal-800 text-xs font-bold px-3 py-1 rounded-full border border-teal-500/20">
                        <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                        <span>Lead Orthodontist & Founder</span>
                      </div>
                      <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{doc.name}</h4>
                      <p className="text-sm font-bold text-teal-700">{doc.title}</p>
                      <p className="text-xs text-slate-500 font-mono">{doc.qualification}</p>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal pt-2">{doc.bio}</p>
                    </div>

                    <div className="pt-4 border-t border-slate-200 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                        <Stethoscope className="w-4 h-4 text-teal-600" />
                        <span>Clinical Focus & Specializations:</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {doc.specialization.split(',').map((spec, i) => (
                          <span key={i} className="bg-white text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs">
                            {spec.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
