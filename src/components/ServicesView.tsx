import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SERVICES as STATIC_SERVICES } from '../data/clinicData';
import { DentalService, FAQ, ServicesSectionConfig, DEFAULT_SERVICES_SECTION } from '../types';
import { STATIC_FAQS } from '../data/staticFaqs';
import { fixCopy, servicePagePath } from '../seo/site';
import { imgDims } from '../seo/imageSizes';
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Calendar,
  Star,
  X,
  MessageCircleQuestion
} from 'lucide-react';

const FAQ_JSON_LD_SCRIPT_ID = 'faq-json-ld';

interface ServicesViewProps {
  onSelectServiceToBook: (serviceId: string) => void;
}

export const ServicesView: React.FC<ServicesViewProps> = ({ onSelectServiceToBook }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedServiceModal, setSelectedServiceModal] = useState<DentalService | null>(null);

  // Starts from the static catalog so the page renders immediately, then
  // swaps in the full live, doctor-editable catalog from /api/clinic-info
  // (Supabase-backed — see server/services/services.ts) once loaded. Falls
  // back to the static catalog on any fetch error.
  const [services, setServices] = useState<DentalService[]>(STATIC_SERVICES);
  const [faqs, setFaqs] = useState<FAQ[]>(STATIC_FAQS);
  // Which services are highlighted as Signature Services, and the two headings
  // (edited in /doctor-admin). Defaults match a fresh install.
  const [section, setSection] = useState<ServicesSectionConfig>(DEFAULT_SERVICES_SECTION);

  useEffect(() => {
    fetch('/api/clinic-info')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.services)) setServices(data.services);
        if (data.servicesSection && Array.isArray(data.servicesSection.signatureIds)) setSection({ ...DEFAULT_SERVICES_SECTION, ...data.servicesSection });
      })
      .catch(() => {});

    fetch('/api/faqs')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data.faqs) && data.faqs.length > 0) setFaqs(data.faqs); })
      .catch(() => {});
  }, []);

  // Keeps the FAQPage JSON-LD structured data in sync with whatever FAQs
  // are actually rendered below, instead of the static block that used to
  // live in index.html and could drift from admin edits — this is now the
  // single source of truth for that markup.
  useEffect(() => {
    const existing = document.getElementById(FAQ_JSON_LD_SCRIPT_ID);
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = FAQ_JSON_LD_SCRIPT_ID;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [...faqs]
        .sort((a, b) => a.order - b.order)
        .map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer }
        }))
    });
    document.head.appendChild(script);

    return () => { document.getElementById(FAQ_JSON_LD_SCRIPT_ID)?.remove(); };
  }, [faqs]);

  // Signature services are shown in their own highlighted block; the regular
  // grid (with its category filter) holds everything else.
  const signatureServices = services.filter((svc) => section.signatureIds.includes(svc.id));
  const regularServices = services.filter((svc) => !section.signatureIds.includes(svc.id));

  const categoryOrder = ['Implants', 'Orthodontics', 'General', 'Cosmetic', 'Surgical', 'Pediatric', 'Family', 'Dental Tourism'];
  const present = new Set<string>(regularServices.map((svc) => svc.category));
  const categories = ['All', ...categoryOrder.filter((c) => present.has(c)), ...Array.from(present).filter((c) => !categoryOrder.includes(c))];
  const shownCategory = categories.includes(activeCategory) ? activeCategory : 'All';

  const filteredServices = shownCategory === 'All'
    ? regularServices
    : regularServices.filter((svc) => svc.category === shownCategory);

  /** "View Details" goes to the treatment's own page when it has one, otherwise opens the popup. */
  const detailsAction = (service: DentalService, dark: boolean) => {
    const cls = `flex-1 text-center text-xs font-bold py-3 rounded-2xl transition-colors ${
      dark ? 'bg-white/10 hover:bg-white/20 text-white border border-white/20' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
    }`;
    return servicePagePath(service.id) ? (
      <a href={servicePagePath(service.id)} className={cls}>View Details</a>
    ) : (
      <motion.button onClick={() => setSelectedServiceModal(service)} whileTap={{ scale: 0.97 }} className={cls}>
        View Details
      </motion.button>
    );
  };

  return (
    <section className="py-20 bg-[#F5F5F7] text-slate-800">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-12">
        {/* Title - Optimized for SEO */}
        <motion.div 
          className="text-center max-w-3xl mx-auto space-y-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        >
          <div className="inline-flex items-center gap-1.5 bg-brand-700/10 text-brand-950 text-xs font-bold px-4 py-1.5 rounded-full border border-brand-700/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-brand-800" />
            <span>Multispecialty Clinical Portfolio</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-sans">
            Specialized Dental Services in Kalapatti.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            From computer-guided implants to 3D clear aligners and painless laser endodontics, explore our complete treatment spectrum at Kalapatti's premier dental center.
          </p>
        </motion.div>

        {/* Signature Services — the highlighted treatments */}
        {signatureServices.length > 0 && (
          <div className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 bg-brand-700 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                <Star className="w-3 h-3 fill-current" />
                <span>Signature</span>
              </div>
              <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{section.signatureTitle}</h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">{section.signatureIntro}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {signatureServices.map((service) => (
                <article
                  key={service.id}
                  className="group rounded-[28px] overflow-hidden bg-slate-900 text-white shadow-xl shadow-slate-900/10 flex flex-col"
                >
                  <div className="relative h-60 overflow-hidden bg-slate-800">
                    <img loading="lazy" decoding="async"
                      src={service.image}
                      alt={`${fixCopy(service.title)} in Kalapatti`}
                      {...imgDims(service.image)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/20 to-transparent" />
                    <span className="absolute top-4 left-4 inline-flex items-center gap-1 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full border border-white/20">
                      <Star className="w-3 h-3 fill-current text-amber-300" />
                      {service.category}
                    </span>
                    <h4 className="absolute bottom-4 left-6 right-6 text-xl sm:text-2xl font-extrabold leading-tight">{fixCopy(service.title)}</h4>
                  </div>

                  <div className="p-6 flex flex-col flex-1 gap-4">
                    <p className="text-sm text-slate-300 leading-relaxed">{service.shortDescription}</p>
                    <div className="space-y-2">
                      {service.benefits.slice(0, 2).map((benefit, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-200 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                          <span>{benefit}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-auto pt-4 border-t border-white/10 flex items-center justify-between gap-3 text-xs text-slate-300">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {service.durationMinutes} mins
                      </span>
                      <span className="font-bold text-slate-900 bg-white px-3 py-1 rounded-full text-right">{service.priceRange}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      {detailsAction(service, true)}
                      <motion.button
                        onClick={() => onSelectServiceToBook(service.id)}
                        whileTap={{ scale: 0.97 }}
                        className="flex-1 bg-white hover:bg-slate-100 text-slate-900 text-xs font-bold py-3 rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Book Now</span>
                      </motion.button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Services — everything else, with the category filter */}
        {regularServices.length > 0 && (
          <div className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <h3 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">{section.servicesTitle}</h3>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">{section.servicesIntro}</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap pb-1">
              {categories.map((cat) => (
                <motion.button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  whileTap={{ scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 120, damping: 15 }}
                  className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                    shownCategory === cat
                      ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10'
                      : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  {cat}
                </motion.button>
              ))}
            </div>

            <motion.div
              layout
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredServices.map((service, index) => (
                <motion.div
                  key={service.id}
                  layout
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-30px" }}
                  transition={{ type: "spring", stiffness: 100, damping: 20, delay: (index % 3) * 0.08 }}
                  whileHover={{ y: -6 }}
                  className="bg-white rounded-[28px] border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div>
                    <div className="relative h-56 overflow-hidden bg-slate-100">
                      <img loading="lazy" decoding="async"
                        src={service.image}
                        alt={`${fixCopy(service.title)} in Kalapatti`}
                        {...imgDims(service.image)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full border border-slate-700">
                        {service.category}
                      </div>
                    </div>

                    <div className="p-6 space-y-4">
                      <h4 className="text-xl font-extrabold text-slate-900 group-hover:text-brand-900 transition-colors">
                        {fixCopy(service.title)}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                        {service.shortDescription}
                      </p>

                      <div className="space-y-2 pt-1">
                        {service.benefits.slice(0, 2).map((benefit, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs text-slate-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {service.durationMinutes} mins per session
                        </span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full text-right">
                          {service.priceRange}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 pt-0 flex items-center gap-2.5">
                    {detailsAction(service, false)}
                    <motion.button
                      onClick={() => onSelectServiceToBook(service.id)}
                      whileTap={{ scale: 0.97 }}
                      className="flex-1 bg-brand-800 hover:bg-brand-700 text-white text-xs font-bold py-3 rounded-2xl shadow-md shadow-brand-800/20 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Book Now</span>
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}

        {/* AEO Voice Search Optimization Block */}
        <section className="mt-20 pt-16 border-t border-slate-200">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-xl bg-brand-300 flex items-center justify-center">
                <MessageCircleQuestion className="w-6 h-6 text-brand-900" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Common Patient Questions</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[...faqs].sort((a, b) => a.order - b.order).map((faq) => (
                <article key={faq.id}>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{faq.question}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Service Detail Modal */}
      <AnimatePresence>
        {selectedServiceModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto scroll-thin shadow-2xl border border-slate-100"
            >
              <div className="relative h-60 bg-slate-900">
                <img loading="lazy" decoding="async"
                  src={selectedServiceModal.image}
                  alt={fixCopy(selectedServiceModal.title)}
                  {...imgDims(selectedServiceModal.image)}
                  className="w-full h-full object-cover opacity-90"
                  referrerPolicy="no-referrer"
                />
                <button
                  onClick={() => setSelectedServiceModal(null)}
                  className="absolute top-4 right-4 bg-slate-900/80 text-white p-2 rounded-full hover:bg-slate-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="absolute bottom-4 left-6 right-6 text-white">
                  {/* Near-black on brand-700 measured 2.5:1 — well under the
                      4.5:1 minimum. White on the same fill is ~9:1. */}
                  <span className="bg-brand-700 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    {selectedServiceModal.category}
                  </span>
                  <h3 className="text-2xl font-bold mt-2">{fixCopy(selectedServiceModal.title)}</h3>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">About Treatment</h4>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{selectedServiceModal.fullDescription}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Session Duration</p>
                    <p className="text-sm font-bold text-slate-800">{selectedServiceModal.durationMinutes} Minutes</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Estimated Cost Range</p>
                    <p className="text-sm font-bold text-brand-900">{selectedServiceModal.priceRange}</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Key Benefits</h4>
                  <div className="space-y-2">
                    {selectedServiceModal.benefits.map((b, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Procedure Steps</h4>
                  <div className="space-y-2">
                    {selectedServiceModal.procedures.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs text-slate-700">
                        <span className="w-5 h-5 rounded-full bg-brand-300 text-brand-950 font-bold flex items-center justify-center shrink-0 text-[11px]">
                          {i + 1}
                        </span>
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    onClick={() => setSelectedServiceModal(null)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      const sid = selectedServiceModal.id;
                      setSelectedServiceModal(null);
                      onSelectServiceToBook(sid);
                    }}
                    className="bg-brand-900 hover:bg-brand-950 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs"
                  >
                    Book This Procedure Now
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};