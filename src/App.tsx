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
import { AuthModal } from './components/AuthModal';
import { DoctorPortal } from './components/DoctorPortal';
import { HipaaPatientPortal } from './components/HipaaPatientPortal';
import { StickyCtaBar } from './components/StickyCtaBar';
import { Footer } from './components/Footer';
import { AuthUser } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [bookingServiceId, setBookingServiceId] = useState<string | undefined>(undefined);
  const [isAiTriageOpen, setIsAiTriageOpen] = useState<boolean>(false);
  const [isStaffLoginOpen, setIsStaffLoginOpen] = useState<boolean>(false);
  const [isStaffLoggedIn, setIsStaffLoggedIn] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

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

  // Demo role switcher (AuthModal): requests a session token for the chosen
  // role so DoctorPortal / HipaaPatientPortal can call protected API routes.
  const handleSelectDemoUser = async (user: AuthUser) => {
    try {
      const res = await fetch('/api/auth/dev-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: user.role, name: user.name, patientId: user.patientId })
      });
      const data = await res.json();
      setCurrentUser({ ...user, token: data.token });
    } catch (err) {
      console.error('Failed to start demo session:', err);
      setCurrentUser(user);
    }

    if (user.role === 'doctor') setActiveTab('doctor-portal');
    else if (user.role === 'patient') setActiveTab('patient-portal');
    else if (user.role === 'admin') setActiveTab('staff-leads');
    else setActiveTab('home');
  };

  const handleLogout = async () => {
    try {
      if (currentUser.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentUser.token}` }
        });
      }
    } catch (err) {
      console.error('Logout request failed:', err);
    }
    setIsStaffLoggedIn(false);
    setCurrentUser({ id: 'u-guest', name: 'Public Visitor', role: 'guest' });
    setActiveTab('home');
  };

  const isStaffArea =
    activeTab === 'staff-leads' ||
    activeTab === 'inquiries-dash' ||
    activeTab === 'doctor-portal' ||
    activeTab === 'patient-portal';

  return (
    <div className={`min-h-screen bg-[#F5F5F7] font-sans text-slate-800 flex flex-col justify-between selection:bg-teal-500 selection:text-white ${isStaffArea ? '' : 'pb-20 lg:pb-0'}`}>
      {/* Premium Initial Loader Sequence */}
      <InitialLoader />

      {/* Top Sticky Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBooking={handleOpenBooking}
        currentUser={currentUser}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
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
            onLogout={handleLogout}
            onOpenBookingModal={() => handleOpenBooking()}
            token={currentUser.token}
          />
        )}

        {activeTab === 'doctor-portal' && <DoctorPortal currentUser={currentUser} />}
        {activeTab === 'patient-portal' && <HipaaPatientPortal currentUser={currentUser} />}
      </main>

      {/* Footer */}
      <Footer
        setActiveTab={setActiveTab}
        onOpenBooking={handleOpenBooking}
        onOpenStaffLogin={() => setIsStaffLoginOpen(true)}
      />

      {/* Sticky High-Contrast Conversion CTAs (patient-facing only) */}
      {!isStaffArea && <StickyCtaBar onOpenBooking={() => handleOpenBooking()} />}

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
        onLoginSuccess={(token) => {
          setIsStaffLoggedIn(true);
          setCurrentUser({
            id: 'u-admin',
            name: 'Admin Staff',
            role: 'admin',
            token
          });
          setActiveTab('staff-leads');
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onSelectUser={handleSelectDemoUser}
      />
    </div>
  );
}

export default App;
