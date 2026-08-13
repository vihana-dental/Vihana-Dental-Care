import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Calendar, Star, ArrowUpRight, MessageCircle } from 'lucide-react';
import { CLINIC_INFO } from '../data/clinicData';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Scroll-driven reveal: everything except the background photo (which
// already carries the "Vihana Dental Care" branding baked into the image
// itself) starts fully hidden, off to one side, and slides+fades into place
// as the user scrolls through the pinned section below. The stat readout
// and the CTA buttons share one offset (`rightColumn`) and, on desktop, one
// shared right-10-anchored container — so their right edges align exactly
// instead of relying on a guessed pixel nudge.
const REVEAL_OFFSETS = {
  leftBlock: { desktop: -460, mobile: -200, settleDesktop: 0, settleMobile: 0 },
  rightColumn: { desktop: 400, mobile: 170, settleDesktop: 0, settleMobile: 0 }
};

function revealStyle(
  progress: number,
  isMobile: boolean,
  offsets: { desktop: number; mobile: number; settleDesktop: number; settleMobile: number }
): React.CSSProperties {
  const magnitude = isMobile ? offsets.mobile : offsets.desktop;
  const settle = isMobile ? offsets.settleMobile : offsets.settleDesktop;
  return {
    // translateZ(0) forces GPU compositing for this layer — without it,
    // frequent scroll-driven transform/opacity updates like these can
    // visibly stutter on mobile browsers, especially alongside the fixed
    // background layer above it.
    transform: `translateX(${(1 - progress) * magnitude + settle}px) translateZ(0)`,
    opacity: clamp(progress * 2.2, 0, 1),
    willChange: 'transform, opacity'
  };
}

// WebP re-encodes of the original PNG exports — same photos, ~98% smaller
// (2.6MB/2.7MB PNGs down to ~60-130KB) since PNG is lossless and wildly
// inefficient for photographic content. This is the largest chunk of the
// homepage's total payload, so it matters most.
const heroPhotoDesktop = '/images/hero-desktop.webp';
const heroPhotoMobile = '/images/hero-mobile.webp';

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
// Layout v8 — scroll-gated reveal, fixed background: on load, only the
// full-bleed background photo is visible (it already carries the "Vihana
// Dental Care" wordmark baked into the image, plus the navbar/CTA bar
// above it) — no dark scrim, no headline, no CTAs. The photo itself is a
// `position: fixed` layer, completely decoupled from scroll — it never
// translates. The foreground content sits in a separate sticky-pinned
// block over a long (480vh) scroll spacer; as the user scrolls through
// it, the left copy block and the right stat-card/CTA column slide in
// from their respective sides while a navy gradient fades in over the
// (still motionless) photo for legibility. Only once that reveal fully
// completes does further scrolling release the sticky content block,
// letting Services scroll up and cover the fixed photo from below —
// curtain-style — rather than the photo itself ever moving.
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
  // viewport so extra scroll distance passes underneath while the inner
  // content stays pinned via `sticky top-0 h-screen`. progress goes 0 -> 1
  // across that extra scroll distance and drives every reveal below —
  // until it hits 1, the background can't visibly advance to the next
  // section because the pin is still holding.
  const sectionRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  // Once the pin releases (progress reaches 1), the now-unpinned content
  // block still has to scroll a full extra viewport-height past before
  // Services can occupy the screen — an unavoidable side effect of the
  // sticky-pin technique. bgOpacity fades the fixed background smoothly
  // over exactly that trailing stretch (1 -> 0), so it's gone by the time
  // that scroll finishes instead of hanging on screen with no foreground
  // content over it, obscuring Services underneath. heroStillInView
  // unmounts the fixed layer once the fade (and that trailing scroll)
  // completes.
  const [bgOpacity, setBgOpacity] = useState(1);
  const [heroStillInView, setHeroStillInView] = useState(true);

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

      const overshoot = clamp(-rect.top - scrollableDistance, 0, window.innerHeight);
      const tailProgress = window.innerHeight > 0 ? overshoot / window.innerHeight : 0;
      setBgOpacity(1 - tailProgress);
      setHeroStillInView(tailProgress < 1);
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

  const ctaInteractive = progress > 0.04;

  return (
    <section ref={sectionRef} className="relative w-full" style={{ height: '480vh' }}>
    {/* The full-bleed photo, as its own `fixed` layer — deliberately NOT
        part of the sticky-pinned content block below, so it never
        translates with scroll at all. It already carries the "Vihana
        Dental Care" wordmark baked into the image itself, so on first load
        (progress 0) this is the entire screen: no scrim, no overlaid text,
        nothing else. Stays fully opaque through the whole reveal, then
        fades smoothly to transparent (bgOpacity) over the pin-release
        scroll instead of abruptly vanishing or lingering over Services;
        unmounts once that fade completes. */}
    {heroStillInView && (
      <div
        className="fixed inset-0 z-0 bg-slate-950 transition-opacity duration-100 ease-out"
        style={{ opacity: bgOpacity, willChange: 'opacity', transform: 'translateZ(0)' }}
      >
        {/* Two purpose-composed crops, swapped by viewport via <picture> —
            the wide desktop image's full-width text can't fit a tall phone
            screen without either heavy cropping or empty letterbox space,
            so mobile gets its own portrait crop with the wordmark stacked
            instead of trying to force one image to serve both shapes. */}
        <picture>
          <source media="(max-width: 1023px)" srcSet={heroPhotoMobile} />
          <motion.img
            src={heroPhotoDesktop}
            alt="Vihana Dental Care — a genuine, confident smile"
            loading="eager"
            fetchPriority="high"
            className="w-full h-full object-cover object-[50%_12%] lg:object-[50%_18%]"
            referrerPolicy="no-referrer"
            initial={{ scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </picture>
        {/* Navy gradient scrim — invisible at progress 0, fades in to a 40%
            max as the reveal completes, so the slid-in text stays legible
            without darkening the photo before that. */}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#0a1128] via-[#0f172a] via-45% to-transparent transition-opacity duration-300 ease-out"
          style={{ opacity: progress * 0.4 }}
        />
        <div
          className="absolute inset-0 lg:hidden bg-[#0a1128] transition-opacity duration-300 ease-out"
          style={{ opacity: progress * 0.4 }}
        />
      </div>
    )}

    <div className="sticky top-0 h-screen w-full overflow-hidden text-white flex items-center">
      {/* Top-right column, lg+ only — stat readout and CTA buttons share
          this single right-10-anchored container and one reveal animation,
          so their right edges line up exactly instead of via a guessed
          pixel nudge. Hidden at progress 0, slides in from the right. */}
      <div
        style={revealStyle(progress, isMobile, REVEAL_OFFSETS.rightColumn)}
        className="hidden lg:flex lg:flex-col lg:items-end absolute top-28 right-10 z-20 gap-6 transition-[transform,opacity] duration-300 ease-out"
      >
        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5">
            <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            <span className="text-2xl font-extrabold">{rating.toFixed(1)}</span>
          </div>
          <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mt-0.5">Google Rating</p>
          <div className="mt-3 text-2xl font-extrabold">{totalReviews}+</div>
          <p className="text-xs text-white/50 font-semibold uppercase tracking-wider mt-0.5">Patient Reviews</p>
        </div>

        <div className="flex flex-col items-end gap-3">
          <motion.button
            onClick={onOpenBooking}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={springTransition}
            style={{ pointerEvents: ctaInteractive ? 'auto' : 'none' }}
            className="bg-white hover:bg-slate-100 text-slate-900 font-bold pl-6 pr-2 py-2 rounded-full shadow-xl flex items-center gap-3 text-base transition-colors w-full sm:w-auto justify-center"
            id="hero-book-now-button"
          >
            <Calendar className="w-5 h-5" />
            <span>Book Appointment Online</span>
            <span className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center shrink-0">
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
            style={{ pointerEvents: ctaInteractive ? 'auto' : 'none' }}
            className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/25 text-white font-semibold px-6 py-3.5 rounded-full flex items-center justify-center gap-2 text-sm transition-colors w-full sm:w-auto"
            id="hero-whatsapp-bot-button"
          >
            <MessageCircle className="w-4 h-4 text-brand-500" />
            <span>Book Appointment on WhatsApp</span>
          </motion.a>
        </div>
      </div>

      {/* Main content — copy left, CTAs right. Both blocks start hidden and
          slide in from their own side as the user scrolls. */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-5 sm:px-10 lg:px-16 pt-20 lg:pt-16 pb-16">
        {/* In-flow stat readout for everything below the lg split. */}
        <div
          style={revealStyle(progress, isMobile, REVEAL_OFFSETS.rightColumn)}
          className="lg:hidden flex items-center justify-center gap-6 mb-8 transition-[transform,opacity] duration-300 ease-out"
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
          {/* Left — the hook. Hidden at progress 0, slides in from the left. */}
          <div
            style={revealStyle(progress, isMobile, REVEAL_OFFSETS.leftBlock)}
            className="lg:col-span-6 lg:max-w-lg text-center lg:text-left transition-[transform,opacity] duration-300 ease-out"
          >
            <p className="text-xs sm:text-sm font-bold tracking-[0.25em] uppercase text-brand-500">
              Vihana Dental Care · Kalapatti, Coimbatore
            </p>

            <h1 className="mt-4 text-3xl sm:text-4xl lg:text-4xl font-extrabold tracking-tight leading-[1.15] text-white">
              The first thing anyone<br />notices about you is your
            </h1>

            <div className="relative inline-block mx-auto lg:mx-0 mt-1">
              {/* Depth-layered duplicates behind the real headline — pure
                  brand-color drop-shadow stack, no new colors/content. */}
              <span
                aria-hidden="true"
                className="absolute inset-0 text-6xl sm:text-7xl lg:text-8xl font-extrabold text-brand-900/30 tracking-tight leading-none pointer-events-none select-none"
                style={{ transform: 'translateY(10px)' }}
              >
                smile.
              </span>
              <span
                aria-hidden="true"
                className="absolute inset-0 text-6xl sm:text-7xl lg:text-8xl font-extrabold text-brand-700/40 tracking-tight leading-none pointer-events-none select-none"
                style={{ transform: 'translateY(5px)' }}
              >
                smile.
              </span>
              <span className="relative text-6xl sm:text-7xl lg:text-8xl font-extrabold text-brand-600 tracking-tight leading-none">
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
                  animate={progress > 0.15 ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
                />
                <motion.path
                  d="M 288 8 L 291 12 L 295 14 L 291 16 L 288 20 L 285 16 L 281 14 L 285 12 Z"
                  fill="currentColor"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={progress > 0.15 ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  transition={{ duration: 0.4, delay: 0.7, type: 'spring', stiffness: 260 }}
                  style={{ transformOrigin: '288px 14px' }}
                />
              </svg>
            </div>

            {/* Punchline — the original ad's own line */}
            <p className="mt-5 text-base sm:text-lg text-white/60 font-medium italic">
              Even a missing eyebrow only gets noticed second to that.
            </p>

            <p className="mt-5 text-sm sm:text-base text-white/70 max-w-md mx-auto lg:mx-0 leading-relaxed">
              Get the flawless, confident smile you deserve. Join hundreds of happy patients at Kalapatti's premier clinic for Invisalign, laser root canals, and completely pain-free treatments.
            </p>
          </div>

          {/* Right — CTAs, mobile/tablet only (below lg, where the shared
              right-10 column above doesn't apply). Hidden at progress 0,
              slides in from the right along with the in-flow stat readout
              above. Desktop uses the absolutely-positioned pair instead —
              distinct ids since both exist in the DOM at once. */}
          <div
            style={{
              ...revealStyle(progress, isMobile, REVEAL_OFFSETS.rightColumn),
              pointerEvents: ctaInteractive ? 'auto' : 'none'
            }}
            className="lg:hidden flex flex-col items-center gap-3 transition-[transform,opacity] duration-300 ease-out"
          >
            <motion.button
              onClick={onOpenBooking}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
              className="bg-white hover:bg-slate-100 text-slate-900 font-bold pl-6 pr-2 py-2 rounded-full shadow-xl flex items-center gap-3 text-base transition-colors w-full sm:w-auto justify-center"
              id="hero-book-now-button-mobile"
            >
              <Calendar className="w-5 h-5" />
              <span>Book Appointment Online</span>
              <span className="w-9 h-9 rounded-full bg-brand-700 flex items-center justify-center shrink-0">
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
              id="hero-whatsapp-bot-button-mobile"
            >
              <MessageCircle className="w-4 h-4 text-brand-500" />
              <span>Book Appointment on WhatsApp</span>
            </motion.a>
          </div>
        </div>
      </div>
    </div>
    </section>
  );
};
