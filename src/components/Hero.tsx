import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Star, ArrowUpRight, MessageCircle } from 'lucide-react';
import { CLINIC_INFO } from '../data/clinicData';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Scroll-driven reveal amounts for the three elements that get the
// slide/fade treatment — halved below the 768px breakpoint per spec.
// Direction: right-column elements (stat card, CTA group) arrive FROM the
// right; the left-column closing paragraph arrives FROM the left, so both
// sides converge toward their resting position as progress goes 0 -> 1.
const REVEAL_OFFSETS = {
  statCard: { desktop: 120, mobile: 60 },
  ctaGroup: { desktop: 180, mobile: 90 },
  closingParagraph: { desktop: -100, mobile: -50 }
};

function revealStyle(progress: number, isMobile: boolean, offsets: { desktop: number; mobile: number }): React.CSSProperties {
  const magnitude = isMobile ? offsets.mobile : offsets.desktop;
  return {
    transform: `translateX(${(1 - progress) * magnitude}px)`,
    opacity: 0.35 + progress * 0.65
  };
}

const heroPhoto = '/images/Hero%20Image.png';

interface HeroProps {
  onOpenBooking: () => void;
  setActiveTab: (tab: string) => void;
}

const whatsappBookingHref = `https://wa.me/${CLINIC_INFO.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
  "Hi, I'd like to book a dental appointment at Vihana Dental Care."
)}`;

// The hook: a real, well-known dental marketing device — a postcard ad
// where a family portrait has the father missing a front tooth, captioned
// "The FIRST thing people notice about you is your SMILE — then maybe
// that you're missing an eyebrow." The punchline is the original ad's own
// line (eyebrow, not tooth) — kept as written even though the photo shows
// a gap tooth, per direct request.
//
// Layout v6: the photo stays as the actual full-bleed section background
// (confirmed: keep it that way), fixed by alignment instead of by
// containing it — a strong scrim covers roughly the left half where the
// text sits, easing to fully clear by the right half, and the photo's
// crop is pushed further right (object-[82%_20%]) so his face lands
// entirely in that clear right zone. The text column is capped narrower
// than before so it can't stretch into the fade zone at in-between
// viewport widths.
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

  // Sticky-pin scroll mechanics: the outer <section> is taller than the
  // viewport (120vh) so extra scroll distance passes underneath while the
  // inner content stays pinned via `sticky top-0 h-screen`. progress goes
  // 0 -> 1 across that extra scroll distance and drives the stat
  // card / CTA group / closing paragraph slide+fade below — everything
  // else in the Hero keeps its original mount-time entrance, untouched.
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    let ticking = false;

    const measure = () => {
      ticking = false;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollableDistance = rect.height - window.innerHeight;
      const nextProgress = scrollableDistance > 0 ? clamp(-rect.top / scrollableDistance, 0, 1) : 0;
      setProgress(nextProgress);
      setIsMobile(window.innerWidth < 768);
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

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.25 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: springTransition },
  };

  return (
    <section ref={sectionRef} className="relative w-full" style={{ height: '120vh' }}>
    <div className="sticky top-0 h-screen w-full overflow-hidden text-white flex items-center bg-slate-950">
      {/* The full-bleed photo, as background. Face pushed well right via
          object-position; a strong left-to-right scrim covers the text
          column's side and clears by roughly mid-frame, so the text zone
          never has his face underneath it regardless of viewport width. */}
      <div className="absolute inset-0">
        <motion.img
          src={heroPhoto}
          alt="A genuine, confident smile — it's the first thing you notice"
          loading="eager"
          fetchPriority="high"
          className="w-full h-full object-cover object-[82%_20%]"
          referrerPolicy="no-referrer"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/65 via-45% to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />
        {/* Below lg, text is centered full-width (not confined to a left
            column), so the left-right gradient alone isn't enough — add a
            flat scrim across the whole frame at those breakpoints only. */}
        <div className="absolute inset-0 lg:hidden bg-black/40" />
      </div>

      {/* Top-right corner stat readout, lg+ only — that's where the layout
          actually becomes a real left/right split. Below lg (tablet
          included), everything is one centered, stacked column, and
          centered headline text at those widths can still span far enough
          right to reach an absolute corner block (confirmed at 900px
          tablet width) — so anything short of the true split gets the
          in-flow mobile copy instead (below). */}
      <div
        style={revealStyle(progress, isMobile, REVEAL_OFFSETS.statCard)}
        className="hidden lg:block absolute top-28 right-10 z-10 text-right transition-[transform,opacity] duration-100 ease-out"
      >
        <div className="flex items-center justify-end gap-1.5">
          <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
          <span className="text-2xl font-extrabold">{rating.toFixed(1)}</span>
        </div>
        <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mt-0.5">Google Rating</p>
        <div className="mt-3 text-2xl font-extrabold">{totalReviews}+</div>
        <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mt-0.5">Patient Reviews</p>
      </div>

      {/* Main content — copy left (on the plain canvas), photo + CTAs
          right. */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 sm:px-10 lg:px-16 pt-20 lg:pt-16 pb-16">
        {/* In-flow stat readout for everything below the lg split — in
            normal document flow, above everything else, so it can never
            overlap the headline the way an absolutely-positioned corner
            block did at narrow/stacked widths. */}
        <div
          style={revealStyle(progress, isMobile, REVEAL_OFFSETS.statCard)}
          className="lg:hidden flex items-center justify-center gap-6 mb-8 transition-[transform,opacity] duration-100 ease-out"
        >
          <div className="text-center">
            <div className="flex items-center justify-center gap-1.5">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="text-xl font-extrabold">{rating.toFixed(1)}</span>
            </div>
            <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider mt-0.5">Google Rating</p>
          </div>
          <div className="w-px h-8 bg-white/15" />
          <div className="text-center">
            <div className="text-xl font-extrabold">{totalReviews}+</div>
            <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider mt-0.5">Patient Reviews</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
          {/* Left — the hook. Capped to lg:col-span-6 (not 7) and given an
              explicit max-width so it can't stretch into the gradient's
              fade zone toward mid-frame at lg, which is exactly where his
              face starts becoming visible again. */}
          <motion.div
            className="lg:col-span-6 lg:max-w-lg text-center lg:text-left"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.p variants={itemVariants} className="text-xs sm:text-sm font-bold tracking-[0.25em] uppercase text-teal-300">
              Vihana Dental Care · Kalapatti, Coimbatore
            </motion.p>

            <motion.h1
              variants={itemVariants}
              className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.15] text-white"
            >
              The first thing anyone notices about you is your
            </motion.h1>

            <motion.div variants={itemVariants} className="relative inline-block mx-auto lg:mx-0 mt-1">
              {/* Depth-layered duplicates behind the real headline — pure
                  brand-color drop-shadow stack, no new colors/content. The
                  visible span below is untouched. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 text-6xl sm:text-7xl lg:text-8xl font-extrabold text-teal-700/30 tracking-tight leading-none pointer-events-none select-none"
                style={{ transform: 'translateY(10px)' }}
              >
                smile.
              </span>
              <span
                aria-hidden="true"
                className="absolute inset-0 text-6xl sm:text-7xl lg:text-8xl font-extrabold text-teal-500/40 tracking-tight leading-none pointer-events-none select-none"
                style={{ transform: 'translateY(5px)' }}
              >
                smile.
              </span>
              <span className="relative text-6xl sm:text-7xl lg:text-8xl font-extrabold text-teal-400 tracking-tight leading-none">
                smile.
              </span>
              <svg
                viewBox="0 0 300 40"
                preserveAspectRatio="none"
                className="absolute left-1 right-1 -bottom-2 sm:-bottom-3 h-4 sm:h-5 text-white"
                aria-hidden="true"
              >
                <motion.path
                  d="M 5 22 Q 90 4, 150 18 T 295 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.9, delay: 1.1, ease: [0.4, 0, 0.2, 1] }}
                />
                <motion.path
                  d="M 288 8 L 291 12 L 295 14 L 291 16 L 288 20 L 285 16 L 281 14 L 285 12 Z"
                  fill="currentColor"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 2, type: 'spring', stiffness: 260 }}
                  style={{ transformOrigin: '288px 14px' }}
                />
              </svg>
            </motion.div>

            {/* Punchline — the original ad's own line */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 2.3, duration: 0.5, ease: 'easeOut' }}
              className="mt-5 text-base sm:text-lg text-white/60 font-medium italic"
            >
              Even a missing eyebrow only gets noticed second to that.
            </motion.p>

            <p
              style={revealStyle(progress, isMobile, REVEAL_OFFSETS.closingParagraph)}
              className="mt-5 text-sm sm:text-base text-white/70 max-w-md mx-auto lg:mx-0 leading-relaxed transition-[transform,opacity] duration-100 ease-out"
            >
              Get the flawless, confident smile you deserve. Join hundreds of happy patients at Kalapatti's premier clinic for Invisalign, laser root canals, and completely pain-free treatments.
            </p>
          </motion.div>

          {/* Right — CTAs, sitting directly on the visible photo. Both
              buttons carry their own solid/glass backing (not relying on
              the scrim), so they stay legible regardless of what's behind
              them at this point in the frame. */}
          <div
            style={revealStyle(progress, isMobile, REVEAL_OFFSETS.ctaGroup)}
            className="lg:col-span-5 flex flex-col items-center lg:items-end gap-3 transition-[transform,opacity] duration-100 ease-out"
          >
            <motion.button
              onClick={onOpenBooking}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
              className="bg-white hover:bg-slate-100 text-slate-900 font-bold pl-6 pr-2 py-2 rounded-full shadow-xl flex items-center gap-3 text-base transition-colors w-full sm:w-auto justify-center"
              id="hero-book-now-button"
            >
              <Calendar className="w-5 h-5" />
              <span>Book Appointment Online</span>
              <span className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center shrink-0">
                <ArrowUpRight className="w-[18px] h-[18px] text-slate-950" />
              </span>
            </motion.button>

            <motion.a
              href={whatsappBookingHref}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/25 text-white font-semibold px-6 py-3.5 rounded-full flex items-center justify-center gap-2 text-sm transition-colors w-full sm:w-auto"
              id="hero-whatsapp-bot-button"
            >
              <MessageCircle className="w-4 h-4 text-teal-300" />
              <span>Book Appointment on WhatsApp</span>
            </motion.a>
          </div>
        </div>
      </div>
    </div>
    </section>
  );
};
