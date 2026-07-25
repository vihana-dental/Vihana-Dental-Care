import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SERVICES } from '../data/clinicData';
import { DentalService } from '../types';
import { 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  X
} from 'lucide-react';

interface ServicesViewProps {
  onSelectServiceToBook: (serviceId: string) => void;
}

export const ServicesView: React.FC<ServicesViewProps> = ({ onSelectServiceToBook }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedServiceModal, setSelectedServiceModal] = useState<DentalService | null>(null);

  const categories = ['All', 'Implants', 'Orthodontics', 'General', 'Cosmetic', 'Surgical', 'Pediatric'];

  const filteredServices = activeCategory === 'All'
    ? SERVICES
    : SERVICES.filter(s => s.category === activeCategory);

  return (
    <section className="py-20 bg-[#F5F5F7] text-slate-800">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-12">
        {/* Title */}
        <motion.div 
          className="text-center max-w-3xl mx-auto space-y-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        >
          <div className="inline-flex items-center gap-1.5 bg-teal-500/10 text-teal-800 text-xs font-bold px-4 py-1.5 rounded-full border border-teal-500/20 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            <span>Multispecialty Clinical Portfolio</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-sans">
            Precision Dental Care.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            From computer-guided implants to 3D clear aligners and painless laser endodontics, explore our complete treatment spectrum at Vihana Dental Care.
          </p>
        </motion.div>

        {/* Category Filter Pills */}
        <div className="flex items-center justify-center gap-2 flex-wrap pb-2">
          {categories.map((cat) => (
            <motion.button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 120, damping: 15 }}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                activeCategory === cat
                  ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/10'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              {cat}
            </motion.button>
          ))}
        </div>

        {/* Services Grid */}
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
                {/* Service Image */}
                <div className="relative h-56 overflow-hidden bg-slate-100">
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-teal-300 text-[11px] font-bold px-3 py-1 rounded-full border border-slate-700">
                    {service.category}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  <h3 className="text-xl font-extrabold text-slate-900 group-hover:text-teal-700 transition-colors">
                    {service.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                    {service.shortDescription}
                  </p>

                  {/* Highlights */}
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
                    <span className="font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-full">
                      {service.priceRange}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-6 pt-0 flex items-center gap-2.5">
                <motion.button
                  onClick={() => setSelectedServiceModal(service)}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-3 rounded-2xl transition-colors"
                >
                  View Details
                </motion.button>
                <motion.button
                  onClick={() => onSelectServiceToBook(service.id)}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-3 rounded-2xl shadow-md shadow-teal-600/20 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Book Now</span>
                </motion.button>
              </div>
            </motion.div>
          ))}
        </motion.div>
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
              className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100"
            >
              <div className="relative h-60 bg-slate-900">
                <img
                  src={selectedServiceModal.image}
                  alt={selectedServiceModal.title}
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
                  <span className="bg-teal-500 text-slate-950 text-xs font-bold px-2.5 py-1 rounded-full">
                    {selectedServiceModal.category}
                  </span>
                  <h3 className="text-2xl font-bold mt-2">{selectedServiceModal.title}</h3>
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
                    <p className="text-sm font-bold text-teal-700">{selectedServiceModal.priceRange}</p>
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
                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0 text-[11px]">
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
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs"
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
