import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GALLERY_ITEMS } from '../data/clinicData';
import { GalleryItem } from '../types';
import { Maximize2, X, Image as ImageIcon } from 'lucide-react';

export const GalleryView: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeImage, setActiveImage] = useState<GalleryItem | null>(null);

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 };

  const categories = [
    { id: 'all', label: 'All Photos & Guides' },
    { id: 'facilities', label: 'Clinic & Operatories' },
    { id: 'smiles', label: 'Smile Transformations' },
    { id: 'posters', label: 'Clinical Posters' }
  ];

  const filteredItems = activeCategory === 'all'
    ? GALLERY_ITEMS
    : GALLERY_ITEMS.filter(item => item.category === activeCategory);

  return (
    <section className="py-20 bg-[#0d1117] text-white">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-12">
        {/* Header */}
        <motion.div 
          className="text-center max-w-3xl mx-auto space-y-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={springTransition}
        >
          <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-white/10 text-teal-300 text-xs font-bold px-4 py-1.5 rounded-full shadow-xl">
            <ImageIcon className="w-3.5 h-3.5 text-teal-400" />
            <span>Verified Clinic Gallery & Visual Guides</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-sans">
            Inside Vihana Dental Care.
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
            Explore authentic photos of our operatory, Dr. N. Sanchana's consultation office, Invisalign aligner suites, and patient guides in Kalapatti, Coimbatore.
          </p>
        </motion.div>

        {/* Category Tabs */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <motion.button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 120, damping: 15 }}
              className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${
                activeCategory === cat.id
                  ? 'bg-teal-400 text-slate-950 font-extrabold shadow-xl shadow-teal-400/20'
                  : 'bg-slate-900/80 text-slate-300 border border-white/10 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {cat.label}
            </motion.button>
          ))}
        </div>

        {/* Gallery Bento Grid */}
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ ...springTransition, delay: (index % 3) * 0.08 }}
              whileHover={{ y: -6 }}
              onClick={() => setActiveImage(item)}
              className="group relative h-72 rounded-[28px] overflow-hidden bg-slate-900 border border-white/10 cursor-pointer shadow-xl hover:border-teal-500/40 transition-all duration-300"
            >
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

              <div className="absolute bottom-0 inset-x-0 p-6 flex items-end justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300 bg-teal-950/90 px-2.5 py-1 rounded-full border border-teal-500/30">
                    {item.category}
                  </span>
                  <h3 className="text-lg font-bold text-white mt-2 leading-snug">{item.title}</h3>
                  <p className="text-xs text-slate-300 line-clamp-1 mt-0.5 font-normal">{item.caption}</p>
                </div>
                <div className="p-3 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30 group-hover:scale-110 transition-transform shadow-lg">
                  <Maximize2 className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {activeImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={springTransition}
              className="relative max-w-4xl w-full bg-slate-900 border border-white/10 rounded-[32px] overflow-hidden shadow-2xl"
            >
              <button
                onClick={() => setActiveImage(null)}
                className="absolute top-5 right-5 z-10 bg-slate-800/80 text-white p-2.5 rounded-full hover:bg-slate-700 transition-colors border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative max-h-[70vh] overflow-hidden bg-slate-950 flex items-center justify-center p-2">
                <img
                  src={activeImage.imageUrl}
                  alt={activeImage.title}
                  className="max-h-[68vh] w-auto object-contain rounded-2xl"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="p-6 sm:p-8 bg-slate-900 border-t border-white/10 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-300 bg-teal-950 px-3 py-1 rounded-full border border-teal-500/30">
                    {activeImage.category}
                  </span>
                  <span className="text-xs text-slate-400">• Vihana Dental Care Kalapatti</span>
                </div>
                <h3 className="text-2xl font-extrabold text-white">{activeImage.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed font-normal">{activeImage.caption}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
