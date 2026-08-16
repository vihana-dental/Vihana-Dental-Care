import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Calendar, Star, ArrowUpRight, MessageCircle, ChevronDown } from 'lucide-react';
import { CLINIC_INFO, whatsAppBotHref } from '../data/clinicData';

// WebP re-encodes of the original PNG exports — same photos, ~98% smaller
// (2.6MB/2.7MB PNGs down to ~60-130KB) since PNG is lossless and wildly
// inefficient for photographic content. This is the largest chunk of the
// homepage's total payload, so it matters most.
const heroPhotoDesktop = '/images/hero-desktop.webp';
const heroPhotoMobile = '/images/hero-mobile.webp';

interface HeroProps {
  onOpenBooking: () => void;
  setActiveTab: (tab: string) => void;
  /** Fires once the welcome copy has been revealed, by button or by scroll. */
  onRevealed?: () => void;
}

const whatsappBookingHref = whatsAppBotHref("Hi, I'd like to book a dental appointment at Vihana Dental Care.");

/**
 * Duration of the click-to-scroll journey. Long enough to read as a
 * deliberate, calming move rather than a jump-cut, short enough that nobody
 * waiting to read the page feels held up.
 */
const SCROLL_DURATION_MS = 1400;

/**
 * easeInOutCubic — gentle on both ends: the page eases away from rest
 * instead of lurching, and settles instead of slamming. Native
 * `scrollTo({ behavior: 'smooth' })` is deliberately not used here; its
 * curve and duration are browser-defined and can't be tuned, and Chrome's in
 * particular decelerates hard at the end, which is exactly the abruptness
 * this interaction is meant to avoid.
 */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Motion for the two copy blocks — a soft settle from each side, no bounce. */
const REVEAL_TRANSITION = { duration: 0.85, ease: [0.22, 1, 0.36, 1] as const };

/**
 * Layout v9 — click-gated reveal.
 *
 * The previous version pinned the hero over a 480vh (desktop) / 190vh
 * (mobile) scroll spacer and drove every element's position and opacity off
 * raw scroll offset. That asked a patient to scroll — accurately, and for a
 * long way — before a single word of the page appeared, which is a poor deal
 * for anyone on a phone, anyone using a keyboard, and anyone whose hands
 * don't do precise repeated gestures.
 *
 * This version replaces the gesture with a target: the hero opens on the
 * photo alone (it carries the "Vihana Dental Care" wordmark baked into the
 * image itself) plus one large, high-contrast "Click Here" button. Pressing
 * it eases the page down one viewport to the welcome panel while the copy
 * settles in behind it, and from there the page is an ordinary document.
 *
 * Nothing is scroll-locked. A patient who ignores the button and simply
 * scrolls gets the same reveal — an IntersectionObserver plays it as the
 * panel arrives — and a keyboard user who tabs into the panel triggers it on
 * focus. Locking the page would have made the "accessible interaction
 * pattern" this replaces the gesture with less accessible than the gesture.
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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [revealed, setRevealed] = useState(false);
  const [scrolling, setScrolling] = useState(false);

  // Read inside scroll callbacks that must not re-subscribe on every state
  // change, and to make the "already revealed, do nothing" check cheap.
  const revealedRef = useRef(false);
  // The parent passes `onRevealed` as an inline arrow, so it is a new
  // function every App render. Held in a ref rather than in markRevealed's
  // dependencies, so markRevealed stays referentially stable and the
  // IntersectionObserver below is created once instead of being torn down
  // and re-observed on every unrelated state change in the page.
  const onRevealedRef = useRef(onRevealed);
  useEffect(() => { onRevealedRef.current = onRevealed; }, [onRevealed]);

  const markRevealed = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
    onRevealedRef.current?.();
  }, []);

  const stopScrollAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setScrolling(false);
  }, []);

  useEffect(() => stopScrollAnimation, [stopScrollAnimation]);

  /**
   * The button's action: reveal the copy, then ease the page down to it.
   *
   * `moveFocus` is true only for keyboard activation — a sighted mouse user
   * watching the page travel doesn't need focus yanked, but a keyboard or
   * screen-reader user needs to land *in* the content they just asked for
   * rather than still sitting on a button that is now off screen.
   */
  const revealWelcome = useCallback((moveFocus: boolean) => {
    const panel = welcomePanelRef.current;
    if (!panel) return;

    markRevealed();

    const targetY = window.scrollY + panel.getBoundingClientRect().top;
    const startY = window.scrollY;
    const distance = targetY - startY;

    const settle = () => {
      stopScrollAnimation();
      if (moveFocus) headingRef.current?.focus({ preventScroll: true });
    };

    // Respect the OS-level motion preference: same destination, no journey.
    if (prefersReducedMotion || Math.abs(distance) < 2) {
      window.scrollTo({ top: targetY });
      settle();
      return;
    }

    stopScrollAnimation();
    setScrolling(true);

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / SCROLL_DURATION_MS, 1);
      window.scrollTo(0, startY + distance * easeInOutCubic(t));

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
        return;
      }
      animationFrameRef.current = null;
      settle();
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, [markRevealed, prefersReducedMotion, stopScrollAnimation]);

  /**
   * Hand control straight back the moment the patient does anything
   * themselves. Without this the animation would fight a wheel spin or a
   * swipe for over a second, which is the single most frustrating thing a
   * scripted scroll can do. Only real input events count — our own
   * window.scrollTo fires 'scroll', so listening for that would cancel the
   * animation on its own first frame.
   */
  useEffect(() => {
    if (!scrolling) return;

    const handOver = () => stopScrollAnimation();
    const onKeyDown = (e: KeyboardEvent) => {
      const keys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape'];
      if (keys.includes(e.key)) stopScrollAnimation();
    };

    window.addEventListener('wheel', handOver, { passive: true });
    window.addEventListener('touchstart', handOver, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', handOver);
      window.removeEventListener('touchstart', handOver);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [scrolling, stopScrollAnimation]);

  /**
   * The no-button paths. Someone who scrolls past the intro on their own —
   * or lands here from a nav link, or restores a scroll position on
   * reload — must never meet a panel of invisible text, so arriving at the
   * panel at all plays the reveal.
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
      {/* The full-bleed photo, pinned behind both panels. `sticky` (not
          `fixed`) with a matching negative margin means it occupies no layout
          height, holds still for the whole hero, and then scrolls away with
          the section's own end — so Services rises over it like a curtain
          without a single scroll listener or opacity fade to schedule. */}
      <div className="sticky top-0 h-screen -mb-[100vh] z-0 overflow-hidden bg-slate-950">
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
            initial={prefersReducedMotion ? false : { scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          />
        </picture>
      </div>

      {/* ---------------- Panel 1 — the invitation ---------------- */}
      {/* Deliberately holds nothing but the photo and one button: the image
          already carries the clinic's wordmark, so there is exactly one
          thing here to decide about. */}
      <div className="relative z-10 h-screen flex flex-col items-center justify-end px-5 pb-28 sm:pb-24 lg:pb-20">
        {/* A short scrim rising from the bottom edge — enough contrast for
            the button and its helper line, without dimming the photograph. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[45vh] bg-gradient-to-t from-[#0a1128] via-[#0a1128]/70 to-transparent pointer-events-none"
        />

        <div className="relative flex flex-col items-center text-center">
          <motion.button
            type="button"
            onClick={(e) => revealWelcome(e.detail === 0)}
            aria-controls="hero-welcome"
            aria-expanded={revealed}
            aria-label="Click here to see our welcome message and appointment options"
            whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={springTransition}
            id="hero-reveal-button"
            /* Sizing is the accessibility point here: min-h-16 (64px) and
               generous padding give a target far above the 44px WCAG 2.5.5
               floor, so it forgives an imprecise tap or an unsteady hand.
               White on #0f2f4d text is ~14:1, and the focus ring is drawn
               offset against the photo so it stays visible on any crop. */
            className="group relative inline-flex min-h-16 items-center gap-3 rounded-full bg-white pl-8 pr-3 py-4 text-lg sm:text-xl font-extrabold text-[#0f2f4d] shadow-2xl shadow-black/40 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a1128]"
          >
            {/* A slow breathing halo — pure decoration, so it is aria-hidden
                and stops entirely under a reduced-motion preference. */}
            {!prefersReducedMotion && !revealed && (
              <motion.span
                aria-hidden="true"
                className="absolute inset-0 rounded-full ring-2 ring-white/70"
                animate={{ scale: [1, 1.14, 1], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            <span className="relative">Click Here</span>
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0f2f4d]">
              <motion.span
                animate={prefersReducedMotion || revealed ? undefined : { y: [0, 3, 0] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                className="flex"
              >
                <ChevronDown className="h-6 w-6 text-white" />
              </motion.span>
            </span>
          </motion.button>

          {/* The plain-language half of the label. The button's own
              aria-label carries the same meaning for screen readers, so this
              line is decorative to them and shown only to sighted users. */}
          <p aria-hidden="true" className="mt-5 max-w-xs text-sm sm:text-base font-medium text-white/85 leading-relaxed">
            Tap the button to see how we can help your smile
          </p>
        </div>
      </div>

      {/* ---------------- Panel 2 — the welcome ---------------- */}
      <div
        id="hero-welcome"
        ref={welcomePanelRef}
        // A keyboard user who tabs forward from the button lands in here
        // before any observer has fired; reveal on the way in so focus never
        // rests on something invisible.
        onFocusCapture={markRevealed}
        className="relative z-10 min-h-screen w-full flex items-center text-white"
      >
        {/* Navy scrim, scoped to this panel so panel 1 stays a clean
            photograph. Two variants rather than one stacked pair: on desktop
            the copy sits left, so a left-anchored gradient darkens only that
            half and leaves the photograph visible on the right. On mobile the
            copy is centred over the whole frame, so it needs an even wash —
            layering both (as a single un-scoped gradient would) drove the
            phone view almost to solid navy and lost the photo entirely. */}
        <div
          aria-hidden="true"
          className="hidden lg:block absolute inset-0 bg-gradient-to-r from-[#0a1128] via-[#0f172a]/95 via-45% to-transparent"
        />
        <div aria-hidden="true" className="lg:hidden absolute inset-0 bg-[#0a1128]/80" />

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

        {/* Main content — copy left, CTAs right. */}
        {/* Top padding clears the sticky navbar (~110px) for the case where
            the copy is taller than the panel and `items-center` stops
            centring it. */}
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

              {/* tabIndex -1 so the button can hand keyboard focus straight
                  here once the page finishes travelling. */}
              <h1
                ref={headingRef}
                tabIndex={-1}
                className="mt-4 text-3xl sm:text-4xl lg:text-4xl font-extrabold tracking-tight leading-[1.15] text-white focus:outline-none"
              >
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
