import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown } from 'lucide-react';

// A persistent "keep scrolling" hint for the Home tab — visible from the
// very first frame (not tied to Hero's reveal state) and stays up across
// every stacked section (Hero, Services, About, ...), not just Hero, per
// direct request. Its own dark pill background is what makes that
// possible: unlike the old white-text-on-photo version, it needs to read
// clearly over both the dark Hero photo AND the light sections below it,
// so it can't rely on the backdrop's color the way the Hero-only version
// did.
//
// Positioned above the mobile StickyCtaBar (a full-width, z-50, opaque bar
// pinned to the true viewport bottom) instead of sharing its vertical
// space — that bar was silently covering the old Hero-internal version
// for the entire time it was on screen, which is why it only ever seemed
// to "appear" near the WhatsApp CTA that sits above the fold on approach.
export const ScrollExploreHint: React.FC = () => {
  const [nearBottom, setNearBottom] = useState(false);

  useEffect(() => {
    let ticking = false;

    const measure = () => {
      ticking = false;
      const doc = document.documentElement;
      const distanceFromBottom = doc.scrollHeight - (window.scrollY + window.innerHeight);
      setNearBottom(distanceFromBottom < 500);
    };

    const onScrollOrResize = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, []);

  return (
    <div
      className="fixed bottom-24 lg:bottom-6 inset-x-0 flex justify-center z-40 pointer-events-none select-none transition-opacity duration-300 ease-out"
      style={{ opacity: nearBottom ? 0 : 1 }}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-1 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full shadow-lg shadow-black/20">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90">
          Scroll to Explore
        </span>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="w-4 h-4 text-white/90" />
        </motion.div>
      </div>
    </div>
  );
};
