import React, { useEffect, useState, lazy, Suspense } from 'react';
import { InquirySection } from '../components/InquirySection';
import { Breadcrumb } from './Breadcrumb';
import { CONTACT_PAGE } from '../seo/site';

// Google Maps is client-only and heavy, exactly as on the home page.
const LocationMapSection = lazy(() => import('../components/LocationMapSection').then((m) => ({ default: m.LocationMapSection })));

export const ContactPage: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <section className="pt-10 pb-2 bg-white text-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Contact' }]} />
          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{CONTACT_PAGE.h1}</h1>
        </div>
      </section>
      <InquirySection />
      <div style={{ minHeight: 520 }}>
        {mounted && (
          <Suspense fallback={null}>
            <LocationMapSection />
          </Suspense>
        )}
      </div>
    </>
  );
};
