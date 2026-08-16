import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Calendar, Star, ArrowUpRight, MessageCircle } from 'lucide-react';
import { CLINIC_INFO, whatsAppBotHref } from '../data/clinicData';

// WebP re-encodes of the source portrait (public/images/Hero Image.png,
// 2338x1536), with JPEG siblings for browsers that don't decode WebP. Each
// crop is baked to its exact display ratio — desktop 1920x1080 (16:9),
// mobile 864x1536 (9:16) — rather than shipping the full frame and letting
// CSS crop it, so the file that downloads is exactly the pixels shown.
const heroPhotoDesktopWebp = '/images/hero-desktop.webp';
const heroPhotoDesktopJpg = '/images/hero-desktop.jpg';
const heroPhotoMobileWebp = '/images/hero-mobile.webp';
const heroPhotoMobileJpg = '/images/hero-mobile.jpg';

interface HeroProps {
  onOpenBooking: () => void;
  setActiveTab: (tab: string) => void;
  /** Fires once the welcome copy has been revealed by scroll. */
  onRevealed?: () => void;
}

const whatsappBookingHref = whatsAppBotHref("Hi, I'd like to book a dental appointment at Vihana Dental Care.");

/** Motion for the two copy blocks — a soft settle from each side, no bounce. */
const REVEAL_TRANSITION = { duration: 0.85, ease: [0.22, 1, 0.36, 1] as const };

/**
 * Layout v10 — scroll-revealed welcome, self-contained panels.
 *
 * v9 pinned the background photo across both panels with `position: sticky`
 * so it would hold still while the welcome copy slid in over it. That trick
 * depends on the sticky element's nearest transformed ancestor being the
 * viewport itself — but Hero is mounted inside App.tsx's page-transition
 * wrapper (`motion.div` with an `animate={{ y: 0 }}` on every tab switch),
 * and Framer Motion leaves that as a live `transform: translateY(0px)` on
 * the DOM node rather than clearing it back to `none`. A non-`none`
 * transform on any ancestor changes the containing block sticky positioning
 * resolves against, so the pin could release early or late depending on the
 * browser — which is what surfaced as the Hero photo/copy overlapping the
 * Services section below it.
 *
 * This version removes `position: sticky` entirely. Each panel now owns its
 * own background and its own height with nothing pinned across the
 * boundary, so there is no containing-block computation left to get wrong —
 * Services can only ever start exactly where this section's box ends,
 * which is guaranteed by normal block flow rather than by a sticky
 * calculation that happens to agree with it.
 *
 * The button from v9 is gone too. The reveal itself (an IntersectionObserver
 * that plays the welcome panel's entrance as it nears the viewport) is
 * unchanged — scrolling is now the only way to reach it, and it works the
 * same for a mouse, a keyboard, a screen reader, or a swipe.
 */
export const Hero: React.FC<HeroProps> = ({ onOpenBooking, onRevealed }) => {
  const springTransition = { type: 'spring', stiffness: 100, damping: 20 };
  const prefersReducedMotion = useReducedMotion();

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

  const welcomePanelRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const revealedRef = useRef(false);

  // The parent passes `onRevealed` as an inline arrow, so it is a new
  // function every App render. Held in a ref rather than as a dependency, so
  // the IntersectionObserver below is created once instead of being torn
  // down and re-observed on every unrelated state change in the page.
  const onRevealedRef = useRef(onRevealed);
  useEffect(() => { onRevealedRef.current = onRevealed; }, [onRevealed]);

  const markRevealed = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
    onRevealedRef.current?.();
  }, []);

  /**
   * The welcome copy plays its entrance once the panel nears the viewport —
   * on an ordinary scroll, a nav-link jump, or a restored scroll position on
   * reload. `onFocusCapture` below covers a keyboard user tabbing forward
   * into the panel's first focusable control before the observer fires, so
   * focus never lands on something still invisible.
   */
  useEffect(() => {
    const panel = welcomePanelRef.current;
    if (!panel || typeof IntersectionObserver === 'undefined') {
      markRevealed();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          markRevealed();
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, [markRevealed]);

  // Direction each block settles in from. Flattened to a pure fade when the
  // patient has asked for reduced motion.
  const slide = (from: number) => (prefersReducedMotion ? 0 : from);

  return (
    <section className="relative w-full">
      {/* ---------------- Panel 1 — the photograph ---------------- */}
      {/* Self-contained: exactly one viewport tall, its own image, nothing
          reaching into Panel 2. */}
      <div className="relative h-screen w-full overflow-hidden bg-slate-950">
        {/* Two purpose-cropped images, swapped by viewport via <picture> —
            the desktop 16:9 frame and the mobile 9:16 portrait crop are
            baked as separate files (see the const block above), each with a
            WebP source and a JPEG fallback for browsers that can't decode
            WebP. Order matters: the browser picks the first <source> whose
            `media` matches and whose `type` it supports, so WebP is listed
            before JPEG within each breakpoint, and the plain <img> at the
            end (JPEG) is what renders if the browser ignores every
            <source>. */}
        <picture>
          <source media="(max-width: 1023px)" srcSet={heroPhotoMobileWebp} type="image/webp" />
          <source media="(max-width: 1023px)" srcSet={heroPhotoMobileJpg} type="image/jpeg" />
          <source media="(min-width: 1024px)" srcSet={heroPhotoDesktopWebp} type="image/webp" />
          <source media="(min-width: 1024px)" srcSet={heroPhotoDesktopJpg} type="image/jpeg" />
          <motion.img
            src={heroPhotoDesktopJpg}
            alt="Vihana Dental Care — a genuine, confident smile"
            loading="eager"
            fetchPriority="high"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            initial={prefersReducedMotion ? false : { scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </picture>
        {/* A short fade at the very bottom into Panel 2's navy, so the seam
            between the bright photo and the solid welcome background reads
            as a deliberate transition rather than a hard cut. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0a1128] to-transparent pointer-events-none"
        />
      </div>

      {/* ---------------- Panel 2 — the welcome ---------------- */}
      <div
        id="hero-welcome"
        ref={welcomePanelRef}
        onFocusCapture={markRevealed}
        className="relative min-h-screen w-full flex items-center text-white overflow-hidden bg-gradient-to-br from-[#0a1128] via-[#0f172a] to-[#0a1128]"
      >
        {/* Subtle brand-blue glow for depth — echoes the loader's own
            radial glow so the two feel like one visual system. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(44,76,156,0.18)_0%,transparent_60%)] pointer-events-none"
        />

        {/* Top-right column, lg+ only — stat readout and CTA buttons share
            this single right-10-anchored container and one animation, so
            their right edges line up exactly instead of via a guessed pixel
            nudge. */}
        <motion.div
          initial={{ opacity: 0, x: slide(400) }}
          animate={revealed ? { opacity: 1, x: 0 } : { opacity: 0, x: slide(400) }}
          transition={REVEAL_TRANSITION}
          className="hidden lg:flex lg:flex-col lg:items-end absolute top-28 right-10 z-20 gap-6"
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
              whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
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
              whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={springTransition}
              className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/25 text-white font-semibold px-6 py-3.5 rounded-full flex items-center justify-center gap-2 text-sm transition-colors w-full sm:w-auto"
              id="hero-whatsapp-bot-button"
            >
              <MessageCircle className="w-4 h-4 text-brand-500" />
              <span>Book Appointment on WhatsApp</span>
            </motion.a>
          </div>
        </motion.div>

        {/* Main content — copy left, CTAs right. Top padding clears the
            sticky navbar (~110px) since `items-center` stops centring once
            the copy is taller than the panel. */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 sm:px-10 lg:px-16 pt-32 lg:pt-28 pb-24">
          {/* In-flow stat readout for everything below the lg split. */}
          <motion.div
            initial={{ opacity: 0, x: slide(170) }}
            animate={revealed ? { opacity: 1, x: 0 } : { opacity: 0, x: slide(170) }}
            transition={REVEAL_TRANSITION}
            className="lg:hidden flex items-center justify-center gap-6 mb-8"
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
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-center">
            {/* Left — the hook. */}
            <motion.div
              initial={{ opacity: 0, x: slide(-460) }}
              animate={revealed ? { opacity: 1, x: 0 } : { opacity: 0, x: slide(-460) }}
              transition={REVEAL_TRANSITION}
              className="lg:col-span-6 lg:max-w-lg text-center lg:text-left"
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
                  {/* Drawn on arrival, timed to land just after the copy
                      settles — the last beat of the reveal. */}
                  <motion.path
                    d="M 5 22 Q 90 4, 150 18 T 295 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="7"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={revealed ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                    transition={{ duration: 0.9, delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  />
                  <motion.path
                    d="M 288 8 L 291 12 L 295 14 L 291 16 L 288 20 L 285 16 L 281 14 L 285 12 Z"
                    fill="currentColor"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={revealed ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                    transition={{ duration: 0.4, delay: 1.05, type: 'spring', stiffness: 260 }}
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
            </motion.div>

            {/* Right — CTAs, mobile/tablet only (below lg, where the shared
                right-10 column above doesn't apply). Desktop uses the
                absolutely-positioned pair instead — distinct ids since both
                exist in the DOM at once. */}
            <motion.div
              initial={{ opacity: 0, x: slide(170) }}
              animate={revealed ? { opacity: 1, x: 0 } : { opacity: 0, x: slide(170) }}
              transition={REVEAL_TRANSITION}
              className="lg:hidden flex flex-col items-center gap-3"
            >
              <motion.button
                onClick={onOpenBooking}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -2 }}
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
                whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={springTransition}
                className="bg-white/10 hover:bg-white/15 backdrop-blur-md border border-white/25 text-white font-semibold px-6 py-3.5 rounded-full flex items-center justify-center gap-2 text-sm transition-colors w-full sm:w-auto"
                id="hero-whatsapp-bot-button-mobile"
              >
                <MessageCircle className="w-4 h-4 text-brand-500" />
                <span>Book Appointment on WhatsApp</span>
              </motion.a>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
