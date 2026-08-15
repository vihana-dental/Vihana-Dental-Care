import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { DOCTORS as STATIC_DOCTORS, CONSULTANT_DOCTORS as STATIC_CONSULTANTS } from '../data/clinicData';
import { Doctor, ConsultantDoctor } from '../types';
import { UserCheck, Stethoscope, Sparkles } from 'lucide-react';

// Uniform credentials block shared by the lead-doctor card and every
// consultant card: Qualification -> Specialized Training -> UG -> PG ->
// Year of Qualification & Experience. Each line only renders when the data
// exists, so doctors with pending fields still get the same layout rather
// than showing blank placeholders.
const CredentialsBlock: React.FC<{
  qualification: string;
  externalTraining?: string[];
  ugInstitution?: string;
  pgInstitution?: string;
  qualificationYear?: string;
  experienceYears?: number;
}> = ({ qualification, externalTraining, ugInstitution, pgInstitution, qualificationYear, experienceYears }) => {
  const experienceLine = [
    qualificationYear,
    experienceYears ? `${experienceYears}+ Years Clinical Experience` : undefined
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-slate-800">{qualification}</p>
      {externalTraining && externalTraining.length > 0 && (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-600">Specialized Training: </span>
          {externalTraining.join(', ')}
        </p>
      )}
      {ugInstitution && (
        <p className="text-[11px] text-slate-500"><span className="font-semibold text-slate-600">UG: </span>{ugInstitution}</p>
      )}
      {pgInstitution && (
        <p className="text-[11px] text-slate-500"><span className="font-semibold text-slate-600">PG: </span>{pgInstitution}</p>
      )}
      {experienceLine && <p className="text-[11px] text-brand-900 font-semibold pt-0.5">{experienceLine}</p>}
    </div>
  );
};

export const TeamSection: React.FC = () => {
  const springTransition = { type: 'spring', stiffness: 100, damping: 20 };

  // Starts from the static roster so the page renders immediately, then
  // swaps in the live, doctor-editable team from /api/team (Supabase-
  // backed — see server/services/team.ts) once loaded. Falls back to the
  // static roster on any fetch error.
  const [doctors, setDoctors] = useState<Doctor[]>(STATIC_DOCTORS);
  const [consultants, setConsultants] = useState<ConsultantDoctor[]>(STATIC_CONSULTANTS);

  useEffect(() => {
    fetch('/api/team')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.doctors)) setDoctors(data.doctors);
        if (Array.isArray(data.consultants)) setConsultants(data.consultants);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="py-20 bg-white text-slate-800">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-16">
        <motion.div
          className="text-center max-w-3xl mx-auto space-y-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={springTransition}
        >
          <div className="inline-flex items-center gap-1.5 bg-brand-700/10 text-brand-950 text-xs font-bold px-4 py-1.5 rounded-full border border-brand-700/20">
            <Sparkles className="w-3.5 h-3.5 text-brand-800" />
            <span>Meet Our Team</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-sans">
            The People Behind Your Smile.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-normal">
            Our lead orthodontist and a network of visiting specialists, all dedicated to your family's oral health in Kalapatti, Coimbatore.
          </p>
        </motion.div>

        {/* Doctor Profile Section */}
        <div className="space-y-8">
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
            {doctors.map((doc) => (
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
                  <img loading="lazy" decoding="async"
                    src={doc.photo}
                    alt={doc.name}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700 ease-out"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-slate-900/90 text-brand-500 text-xs font-bold px-3.5 py-1.5 rounded-full border border-slate-700 shadow-lg backdrop-blur-md">
                    {doc.experienceYears}+ Years Clinical Excellence
                  </div>
                </div>

                {/* Details Column */}
                <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-1.5 bg-brand-700/10 text-brand-950 text-xs font-bold px-3 py-1 rounded-full border border-brand-700/20">
                      <UserCheck className="w-3.5 h-3.5 text-brand-800" />
                      <span>Lead Orthodontist & Founder</span>
                    </div>
                    <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{doc.name}</h4>
                    <p className="text-sm font-bold text-brand-900">{doc.title}</p>
                    <CredentialsBlock
                      qualification={doc.qualification}
                      externalTraining={doc.externalTraining}
                      ugInstitution={doc.ugInstitution}
                      pgInstitution={doc.pgInstitution}
                      qualificationYear={doc.qualificationYear}
                      experienceYears={doc.experienceYears}
                    />
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal pt-2">{doc.bio}</p>
                  </div>

                  <div className="pt-4 border-t border-slate-200 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Stethoscope className="w-4 h-4 text-brand-800" />
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
            ))}
          </div>
        </div>

        {/* Consultant Doctors Section — informational only, no booking */}
        <div className="space-y-8">
          <motion.div
            className="text-center max-w-2xl mx-auto space-y-2"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={springTransition}
          >
            <div className="inline-flex items-center gap-1.5 bg-brand-700/10 text-brand-950 text-xs font-bold px-4 py-1.5 rounded-full border border-brand-700/20 mb-2">
              <UserCheck className="w-3.5 h-3.5 text-brand-800" />
              <span>Visiting Specialists</span>
            </div>
            <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Our Consultant Doctors
            </h3>
            <p className="text-slate-600 text-sm sm:text-base font-normal">
              Specialist consultants who visit Vihana Dental Care for referral-based cases.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {consultants.map((doc, i) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...springTransition, delay: i * 0.1 }}
                whileHover={{ y: -6 }}
                className="bg-[#F5F5F7] rounded-[28px] overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-xl transition-all flex flex-col"
              >
                <div className="relative h-56 bg-slate-200 overflow-hidden">
                  <img loading="lazy" decoding="async"
                    src={doc.photo}
                    alt={doc.name}
                    className="w-full h-full object-cover object-top"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-5 sm:p-6 space-y-2 flex-1 flex flex-col">
                  <h4 className="text-lg font-extrabold text-slate-900 tracking-tight">{doc.name}</h4>
                  <p className="text-xs font-bold text-brand-900">{doc.specialty}</p>
                  <CredentialsBlock
                    qualification={doc.qualification}
                    externalTraining={doc.externalTraining}
                    ugInstitution={doc.ugInstitution}
                    pgInstitution={doc.pgInstitution}
                    qualificationYear={doc.qualificationYear}
                    experienceYears={doc.experienceYears}
                  />
                  <p className="text-xs text-slate-600 leading-relaxed font-normal pt-2">{doc.bio}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
