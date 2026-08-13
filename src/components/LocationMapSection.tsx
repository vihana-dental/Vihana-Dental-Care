import React from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { CLINIC_INFO } from '../data/clinicData';
import { MapPin, Phone, Clock, ExternalLink, Navigation, Sparkles, MessageCircle, Mail } from 'lucide-react';

export const LocationMapSection: React.FC = () => {
  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY || process.env.GOOGLE_MAPS_PLATFORM_KEY || "";

  return (
    <section className="py-16 bg-slate-900 text-white" id="contact-map">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-brand-700/20 text-brand-500 border border-brand-700/30 text-xs font-semibold px-3 py-1 rounded-full">
            <MapPin className="w-3.5 h-3.5 text-brand-600" />
            <span>Clinic Location & Directions</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Visit Vihana Dental Care in Kalapatti
          </h2>
          <p className="text-slate-300 text-base leading-relaxed">
            Conveniently located on Post Office Street, Kalapatti, Coimbatore with easy access and patient parking.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Details Column */}
          <div className="lg:col-span-5 bg-slate-950 p-8 rounded-3xl border border-slate-800 space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <span>{CLINIC_INFO.name}</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>
                <p className="text-xs text-brand-600 font-medium">Coimbatore Multispecialty Center</p>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Address</p>
                    <p className="mt-0.5">{CLINIC_INFO.address}, Coimbatore, Tamil Nadu - {CLINIC_INFO.pincode}</p>
                  </div>
                </div>

                <a href={`tel:${CLINIC_INFO.phone}`} className="flex items-start gap-3 group">
                  <Phone className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Call Us</p>
                    <p className="mt-0.5 group-hover:text-brand-500 transition-colors">{CLINIC_INFO.phone}</p>
                  </div>
                </a>

                <a
                  href={`https://wa.me/${CLINIC_INFO.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group"
                >
                  <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">WhatsApp Us</p>
                    <p className="mt-0.5 group-hover:text-emerald-300 transition-colors">{CLINIC_INFO.whatsapp}</p>
                  </div>
                </a>

                <a href={`mailto:${CLINIC_INFO.email}`} className="flex items-start gap-3 group">
                  <Mail className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Email Us</p>
                    <p className="mt-0.5 group-hover:text-brand-500 transition-colors">{CLINIC_INFO.email}</p>
                  </div>
                </a>

                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-white">Clinic Timings</p>
                    <p className="mt-0.5">{CLINIC_INFO.workingHours.weekdays}</p>
                    <p className="text-emerald-400 font-medium">{CLINIC_INFO.workingHours.sundays}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <a
                href={CLINIC_INFO.googleBusinessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-brand-800 hover:bg-brand-700 text-slate-950 font-bold text-xs sm:text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow"
              >
                <Navigation className="w-4 h-4" />
                <span>Open in Google Maps App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href={`https://wa.me/${CLINIC_INFO.whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Map Column */}
          <div className="lg:col-span-7 h-96 sm:h-[480px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative bg-slate-950 flex flex-col">
            {apiKey ? (
              <APIProvider apiKey={apiKey}>
                <Map
                  defaultCenter={CLINIC_INFO.location}
                  defaultZoom={15}
                  mapId="VIHANA_DENTAL_MAP"
                  className="w-full h-full"
                  gestureHandling="greedy"
                >
                  <AdvancedMarker position={CLINIC_INFO.location} title={CLINIC_INFO.name}>
                    <Pin background="#003a60" glyphColor="#ffffff" borderColor="#002a45" />
                  </AdvancedMarker>
                </Map>
              </APIProvider>
            ) : (
              <div className="relative w-full h-full min-h-[380px] bg-slate-950">
                <iframe
                  title="Vihana Dental Care Kalapatti Google Map"
                  src="https://maps.google.com/maps?q=32HP%2B7V+Kalapatti,+Tamil+Nadu&t=&z=17&ie=UTF8&iwloc=B&output=embed"
                  width="100%"
                  height="100%"
                  style={{ border: 0, minHeight: '380px' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="w-full h-full grayscale-[15%] contrast-[105%] rounded-3xl"
                />

                {/* Top Badge Overlay */}
                <div className="absolute top-4 left-4 bg-slate-900/90 text-white p-3 rounded-2xl border border-slate-700/80 shadow-xl backdrop-blur-md max-w-xs pointer-events-none hidden sm:block">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-600 animate-ping" />
                    <span className="text-xs font-bold text-brand-500">Vihana Dental Care</span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1 font-medium">
                    No 77, Post Office St, Kalapatti, Coimbatore
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
