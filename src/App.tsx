import React, { useState } from 'react';
import { InitialLoader } from './components/InitialLoader';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AboutUs } from './components/AboutUs';
import { ServicesView } from './components/ServicesView';
import { GalleryView } from './components/GalleryView';
import { TestimonialsView } from './components/TestimonialsView';
import { InquirySection } from './components/InquirySection';
import { LocationMapSection } from './components/LocationMapSection';
import { AppointmentBookingModal } from './components/AppointmentBookingModal';
import { WhatsAppAutomationWidget } from './components/WhatsAppAutomationWidget';
import { AiDentalAssistantModal } from './components/AiDentalAssistantModal';
import { StickyCtaBar } from './components/StickyCtaBar';
import { Footer } from './components/Footer';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>(undefined);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState<boolean>(false);

  const handleOpenBooking = (serviceId?: string) => {
    if (serviceId) setBookingServiceId(serviceId);
    setIsBookingModalOpen(true);
  };

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
        {activeTab === 'home' && (
          <div className="space-y-0">
            <Hero
              onOpenBooking={() => handleOpenBooking()}
              onOpenWhatsAppBot={() => setActiveTab('whatsapp-simulator')}
              onOpenAiTriage={() => setIsAiTriageOpen(true)}
              setActiveTab={setActiveTab}
            />

            <ServicesView onSelectServiceToBook={handleOpenBooking} />
            <AboutUs />
            <GalleryView />
            <TestimonialsView />
            <InquirySection />
            <LocationMapSection />
          </div>
        )}

        {activeTab === 'about' && <AboutUs />}
        {activeTab === 'services' && <ServicesView onSelectServiceToBook={handleOpenBooking} />}
        {activeTab === 'gallery' && <GalleryView />}
        {activeTab === 'reviews' && <TestimonialsView />}
        {activeTab === 'location' && (
          <div className="space-y-0">
            <InquirySection />
            <LocationMapSection />
          </div>
        )}
        {activeTab === 'whatsapp-simulator' && <WhatsAppAutomationWidget />}
      </main>

      {/* Footer */}
      <Footer
        setActiveTab={setActiveTab}
        onOpenBooking={handleOpenBooking}
      />

      {/* Sticky High-Contrast Conversion CTAs */}
      <StickyCtaBar onOpenBooking={() => handleOpenBooking()} />

      {/* Interactive Modals */}
      <AppointmentBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        initialServiceId={bookingServiceId}
      />

      <AiDentalAssistantModal
        isOpen={isAiTriageOpen}
        onClose={() => setIsAiTriageOpen(false)}
        onOpenBooking={() => handleOpenBooking()}
      />
    </div>
  );
}

export default App;
