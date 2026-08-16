import React, { useState, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { InitialLoader } from './components/InitialLoader';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AboutUs } from './components/AboutUs';
import { TeamSection } from './components/TeamSection';
import { ServicesView } from './components/ServicesView';
import { InquirySection } from './components/InquirySection';
import { StickyCtaBar } from './components/StickyCtaBar';
import { ScrollExploreHint } from './components/ScrollExploreHint';
import { Footer } from './components/Footer';
import { DeferredSection } from './components/DeferredSection';

// Split out of the initial bundle. Everything below is either far below the
// fold on the homepage or on a route most visitors never open, so shipping it
// in the first download only delays the hero for patients on mobile data.
//
// The admin console is the biggest single win — it pulls in every admin panel
// and is reachable only from the unlinked /doctor-admin path, so no patient
// should ever download it. LocationMapSection is the next, because it drags
// in the Google Maps JS API.
const BlogView = lazy(() => import('./components/BlogView').then((m) => ({ default: m.BlogView })));
const GalleryView = lazy(() => import('./components/GalleryView').then((m) => ({ default: m.GalleryView })));
const TestimonialsView = lazy(() => import('./components/TestimonialsView').then((m) => ({ default: m.TestimonialsView })));
const LocationMapSection = lazy(() => import('./components/LocationMapSection').then((m) => ({ default: m.LocationMapSection })));
const AppointmentBookingModal = lazy(() => import('./components/AppointmentBookingModal').then((m) => ({ default: m.AppointmentBookingModal })));
const ChatBookingWidget = lazy(() => import('./components/ChatBookingWidget').then((m) => ({ default: m.ChatBookingWidget })));
const DoctorAdminPage = lazy(() => import('./components/DoctorAdminPage').then((m) => ({ default: m.DoctorAdminPage })));
const NotFoundPage = lazy(() => import('./components/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

const KNOWN_PATHS = ['/', '/doctor-admin'];

/** Height-reserving placeholder for a code-split section, so a tab switch
 *  doesn't collapse the page height while its chunk downloads. */
const SectionFallback: React.FC = () => (
  <div className="min-h-[60vh] flex items-center justify-center" aria-hidden="true">
    <div className="w-8 h-8 rounded-full border-2 border-brand-200 border-t-brand-800 animate-spin" />
  </div>
);

/** Full-viewport equivalent, for the two code-split standalone routes. */
const FullPageFallback: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#F5F5F7]" aria-hidden="true">
    <div className="w-10 h-10 rounded-full border-2 border-brand-200 border-t-brand-800 animate-spin" />
  </div>
);

const TAB_TITLES: Record<string, string> = {
  home: 'Vihana Dental Care | Best Dentist in Kalapatti, Coimbatore',
  about: 'About Us | Vihana Dental Care, Kalapatti',
  services: 'Dental Services & Pricing | Vihana Dental Care',
  team: 'Our Team | Vihana Dental Care',
  blog: 'Blog | Vihana Dental Care',
  gallery: 'Photo Gallery | Vihana Dental Care',
  reviews: 'Patient Reviews | Vihana Dental Care',
  location: 'Contact & Location | Vihana Dental Care, Kalapatti'
};

export function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>(undefined);
  // The hero opens on a single "Click Here" button; a floating "Scroll to
  // Explore" hint alongside it would offer a competing instruction at the one
  // moment the page is asking for a specific action. The hint appears once
  // the hero's welcome copy has been revealed, which is when scrolling
  // genuinely becomes the way forward.
  const [heroRevealed, setHeroRevealed] = useState(false);

  const handleOpenBooking = (serviceId?: string) => {
    if (serviceId) setBookingServiceId(serviceId);
    setIsBookingModalOpen(true);
  };

  // Switching sections used to leave the scroll position wherever it was
  // (often mid-page or at the footer), making every navigation feel like it
  // landed on a broken page — jump back to the top on every tab change.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // A distinct browser-tab title per section — helps with bookmarking and
  // multi-tab browsing even though this is a single-page app with no real
  // per-route URLs for search engines to index separately.
  useEffect(() => {
    document.title = TAB_TITLES[activeTab] || TAB_TITLES.home;
  }, [activeTab]);

  // Subtle, unlinked admin entry point — deliberately not referenced anywhere
  // in the public nav/footer. Bypasses the marketing site shell entirely.
  if (typeof window !== 'undefined' && window.location.pathname === '/doctor-admin') {
    return (
      <Suspense fallback={<FullPageFallback />}>
        <DoctorAdminPage />
      </Suspense>
    );
  }

  // This is a single-page app with tab-based in-page navigation, not a
  // router — every real "page" lives at "/". Any other path (a stale
  // bookmark, a typo, a dead link) has nothing to render, so show a proper
  // 404 instead of silently falling back to the homepage.
  if (typeof window !== 'undefined' && !KNOWN_PATHS.includes(window.location.pathname)) {
    return (
      <Suspense fallback={<FullPageFallback />}>
        <NotFoundPage
          onGoHome={() => {
            window.history.pushState({}, '', '/');
            window.location.reload();
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-slate-800 flex flex-col justify-between selection:bg-brand-700 selection:text-white pb-20 lg:pb-0">
      {/* Premium Initial Loader Sequence */}
      <InitialLoader />

      {/* Top Sticky Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBooking={handleOpenBooking}
      />

      {/* Main View Switching */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {activeTab === 'home' && (
              <div className="space-y-0">
                <div id="home">
                  <Hero
                    onOpenBooking={() => handleOpenBooking()}
                    setActiveTab={setActiveTab}
                    onRevealed={() => setHeroRevealed(true)}
                  />
                </div>

                <div id="services"><ServicesView onSelectServiceToBook={handleOpenBooking} /></div>
                <div id="about"><AboutUs /></div>
                <div id="team"><TeamSection /></div>
                {/* Everything from here down is below the fold on every
                    viewport, so it mounts just after first paint (or sooner
                    if scrolled towards) rather than competing with the hero. */}
                <DeferredSection id="gallery" minHeight={620}><GalleryView /></DeferredSection>
                <DeferredSection id="blog" minHeight={560}><BlogView /></DeferredSection>
                <DeferredSection id="reviews" minHeight={560}><TestimonialsView /></DeferredSection>
                <div id="location">
                  <InquirySection />
                  <DeferredSection minHeight={520}><LocationMapSection /></DeferredSection>
                </div>
              </div>
            )}

            {activeTab === 'about' && <AboutUs />}
            {activeTab === 'services' && <ServicesView onSelectServiceToBook={handleOpenBooking} />}
            {activeTab === 'team' && <TeamSection />}
            {/* Code-split tabs — the fallback reserves height so switching
                tabs doesn't collapse the page while the chunk arrives. */}
            {activeTab === 'blog' && (
              <Suspense fallback={<SectionFallback />}><BlogView /></Suspense>
            )}
            {activeTab === 'gallery' && (
              <Suspense fallback={<SectionFallback />}><GalleryView /></Suspense>
            )}
            {activeTab === 'reviews' && (
              <Suspense fallback={<SectionFallback />}><TestimonialsView /></Suspense>
            )}
            {activeTab === 'location' && (
              <div className="space-y-0">
                <InquirySection />
                <Suspense fallback={<SectionFallback />}><LocationMapSection /></Suspense>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer setActiveTab={setActiveTab} />

      {/* Sticky High-Contrast Conversion CTAs */}
      <StickyCtaBar onOpenBooking={() => handleOpenBooking()} />

      {/* Persistent "keep scrolling" hint — Home tab only, and only once the
          hero's own click-to-reveal has played, so it never competes with
          that button for the patient's attention. */}
      {activeTab === 'home' && heroRevealed && <ScrollExploreHint />}

      {/* Full in-chat AI Booking Assistant (Razorpay + Google Calendar, no
          redirects). Split out and mounted after first paint — the launcher
          is a floating button, so nothing above the fold depends on it. */}
      <Suspense fallback={null}>
        <ChatBookingWidget />
      </Suspense>

      {/* Interactive Modals — the chunk is only fetched once a patient
          actually opens the booking flow. */}
      {isBookingModalOpen && (
        <Suspense fallback={null}>
          <AppointmentBookingModal
            isOpen={isBookingModalOpen}
            onClose={() => setIsBookingModalOpen(false)}
            initialServiceId={bookingServiceId}
          />
        </Suspense>
      )}
    </div>
  );
}

export default App;
