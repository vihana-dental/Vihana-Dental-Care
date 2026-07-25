import React, { useState } from 'react';
import { InitialLoader } from './components/InitialLoader';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { AboutUs } from './components/AboutUs';
import { ServicesView } from './components/ServicesView';
import { GalleryView } from './components/GalleryView';
import { TestimonialsView } from './components/TestimonialsView';
import { InquirySection } from './components/InquirySection';
import { StaffLeadsDashboard } from './components/StaffLeadsDashboard';
import { LocationMapSection } from './components/LocationMapSection';
import { AppointmentBookingModal } from './components/AppointmentBookingModal';
import { WhatsAppAutomationWidget } from './components/WhatsAppAutomationWidget';
import { AiDentalAssistantModal } from './components/AiDentalAssistantModal';
import { StaffLoginModal } from './components/StaffLoginModal';
import { Footer } from './components/Footer';
import { AuthUser } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>(undefined);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState<boolean>(false);
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState<boolean>(false);
  const [isStaffLoggedIn, setIsStaffLoggedIn] = useState<boolean>(false);

  // Current logged-in user state
  const [currentUser, setCurrentUser] = useState<AuthUser>({
    id: "u-guest",
    name: "Public Visitor",
    role: "guest"
  });

  const handleOpenBooking = (serviceId?: string) => {
    if (serviceId) setBookingServiceId(serviceId);
    setIsBookingModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] font-sans text-slate-800 flex flex-col justify-between selection:bg-teal-500 selection:text-white">
      {/* Premium Initial Loader Sequence */}
      <InitialLoader />

      {/* Top Sticky Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBooking={handleOpenBooking}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsStaffLoginOpen(true)}
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
        
        {(activeTab === 'staff-leads' || activeTab === 'inquiries-dash') && (
          <StaffLeadsDashboard
            onLogout={() => {
              setIsStaffLoggedIn(false);
              setActiveTab('home');
            }}
            onOpenBookingModal={() => handleOpenBooking()}
          />
        )}
      </main>

      {/* Footer */}
      <Footer
        setActiveTab={setActiveTab}
        onOpenBooking={handleOpenBooking}
        onOpenStaffLogin={() => setIsStaffLoginOpen(true)}
      />

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

      <StaffLoginModal
        isOpen={isStaffLoginOpen}
        onClose={() => setIsStaffLoginOpen(false)}
        onLoginSuccess={() => {
          setIsStaffLoggedIn(true);
          setCurrentUser({
            id: 'u-admin',
            name: 'Admin Staff',
            role: 'admin'
          });
          setActiveTab('staff-leads');
        }}
      />
    </div>
  );
}

export default App;
