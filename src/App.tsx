import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { InitialLoader } from './components/InitialLoader';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AboutUs } from './components/AboutUs';
import { TeamSection } from './components/TeamSection';
import { BlogView } from './components/BlogView';
import { ServicesView } from './components/ServicesView';
import { GalleryView } from './components/GalleryView';
import { TestimonialsView } from './components/TestimonialsView';
import { InquirySection } from './components/InquirySection';
import { LocationMapSection } from './components/LocationMapSection';
import { AppointmentBookingModal } from './components/AppointmentBookingModal';
import { StickyCtaBar } from './components/StickyCtaBar';
import { Footer } from './components/Footer';
import { ChatBookingWidget } from './components/ChatBookingWidget';
import { DoctorAdminPage } from './components/DoctorAdminPage';
import { NotFoundPage } from './components/NotFoundPage';

const KNOWN_PATHS = ['/', '/doctor-admin'];

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
    return <DoctorAdminPage />;
  }

  // This is a single-page app with tab-based in-page navigation, not a
  // router — every real "page" lives at "/". Any other path (a stale
  // bookmark, a typo, a dead link) has nothing to render, so show a proper
  // 404 instead of silently falling back to the homepage.
  if (typeof window !== 'undefined' && !KNOWN_PATHS.includes(window.location.pathname)) {
    return (
      <NotFoundPage
        onGoHome={() => {
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-slate-800 flex flex-col justify-between selection:bg-teal-500 selection:text-white pb-20 lg:pb-0">
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
                <Hero
                  onOpenBooking={() => handleOpenBooking()}
                  setActiveTab={setActiveTab}
                />

                <ServicesView onSelectServiceToBook={handleOpenBooking} />
                <AboutUs />
                <TeamSection />
                <GalleryView />
                <BlogView />
                <TestimonialsView />
                <InquirySection />
                <LocationMapSection />
              </div>
            )}

            {activeTab === 'about' && <AboutUs />}
            {activeTab === 'services' && <ServicesView onSelectServiceToBook={handleOpenBooking} />}
            {activeTab === 'team' && <TeamSection />}
            {activeTab === 'blog' && <BlogView />}
            {activeTab === 'gallery' && <GalleryView />}
            {activeTab === 'reviews' && <TestimonialsView />}
            {activeTab === 'location' && (
              <div className="space-y-0">
                <InquirySection />
                <LocationMapSection />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <Footer setActiveTab={setActiveTab} />

      {/* Sticky High-Contrast Conversion CTAs */}
      <StickyCtaBar onOpenBooking={() => handleOpenBooking()} />

      {/* Full in-chat AI Booking Assistant (Razorpay + Google Calendar, no redirects) */}
      <ChatBookingWidget />

      {/* Interactive Modals */}
      <AppointmentBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        initialServiceId={bookingServiceId}
      />
    </div>
  );
}

export default App;
