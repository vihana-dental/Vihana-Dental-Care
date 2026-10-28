import React, { useEffect, useState, lazy, Suspense } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { StickyCtaBar } from '../components/StickyCtaBar';
import { BookingContext } from './BookingContext';

// Same lazy chunks the home page uses, so booking behaves identically.
const AppointmentBookingModal = lazy(() => import('../components/AppointmentBookingModal').then((m) => ({ default: m.AppointmentBookingModal })));
const ChatBookingWidget = lazy(() => import('../components/ChatBookingWidget').then((m) => ({ default: m.ChatBookingWidget })));

/**
 * Chrome for the server-rendered pages (service landing pages, blog, contact):
 * the same navbar, footer, sticky call/WhatsApp/book bar, booking modal and
 * chat assistant as the home page. The modal and chat widget mount only on the
 * client, after hydration, so the server HTML and first client render match.
 */
export const PageShell: React.FC<{ activeNav: string; children: React.ReactNode }> = ({ activeNav, children }) => {
  const [isBookingOpen, setBookingOpen] = useState(false);
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const openBooking = (serviceId?: string) => {
    if (serviceId) setBookingServiceId(serviceId);
    setBookingOpen(true);
  };

  return (
    <BookingContext.Provider value={{ openBooking }}>
      <div className="min-h-screen bg-[#F5F5F7] font-sans text-slate-800 flex flex-col justify-between selection:bg-brand-700 selection:text-white pb-20 lg:pb-0">
        <Navbar activeTab={activeNav} onOpenBooking={openBooking} />
        <main className="flex-1">{children}</main>
        <Footer />
        <StickyCtaBar onOpenBooking={() => openBooking()} />
        {mounted && (
          <Suspense fallback={null}>
            <ChatBookingWidget />
          </Suspense>
        )}
        {mounted && isBookingOpen && (
          <Suspense fallback={null}>
            <AppointmentBookingModal
              isOpen={isBookingOpen}
              onClose={() => setBookingOpen(false)}
              initialServiceId={bookingServiceId}
            />
          </Suspense>
        )}
      </div>
    </BookingContext.Provider>
  );
};
