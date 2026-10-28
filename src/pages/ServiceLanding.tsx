import React from 'react';
import { Calendar, CheckCircle2, Clock, MapPin, Phone, MessageCircleQuestion, Award } from 'lucide-react';
import { CLINIC_INFO, clinicTelHref } from '../data/clinicData';
import { imgDims } from '../seo/imageSizes';
import {
  SERVICE_PAGES,
  buildServiceFaqs,
  fixCopy,
  hoursText,
  pageServices,
  pageSpecialists,
  addressText,
  type PageData,
  type ServicePageDef
} from '../seo/site';
import { useBooking } from './BookingContext';
import { Breadcrumb } from './Breadcrumb';

/**
 * One landing page per treatment. Everything shown comes from the live
 * service catalog, FAQ list and team data the rest of the site already uses;
 * the page adds structure and links, not new claims.
 */
export const ServiceLanding: React.FC<{ def: ServicePageDef; data: PageData }> = ({ def, data }) => {
  const { openBooking } = useBooking();
  const services = pageServices(def, data);
  const primary = services[0];
  const faqs = buildServiceFaqs(def, data);
  const specialists = pageSpecialists(def, data);
  const related = SERVICE_PAGES.filter((p) => p.path !== def.path);
  const multi = services.length > 1;
  const heroImage = primary && !primary.image.startsWith('data:') ? primary.image : '';

  const bookButton = (label = 'Book Appointment') => (
    <button
      type="button"
      onClick={() => openBooking(primary?.id)}
      className="inline-flex items-center justify-center gap-2 bg-brand-900 hover:bg-brand-950 text-white px-6 py-3.5 rounded-2xl font-bold text-sm shadow-md transition-colors"
    >
      <Calendar className="w-4 h-4 text-brand-400" />
      <span>{label}</span>
    </button>
  );

  return (
    <article>
      {/* Intro */}
      <section className="pt-10 pb-12 bg-[#F5F5F7]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-8">
          <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: def.navLabel }]} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-1.5 bg-brand-700/10 text-brand-950 text-xs font-bold px-4 py-1.5 rounded-full border border-brand-700/20">
                <span>{def.eyebrow}</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">{def.h1}</h1>
              {primary && (
                <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
                  {multi
                    ? 'Fixed braces to correct crowding, spacing and bite issues, offered at Vihana Dental Care in Kalapatti, Coimbatore. Compare the options below.'
                    : fixCopy(primary.shortDescription)}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                {bookButton()}
                <a
                  href={clinicTelHref()}
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 px-6 py-3.5 rounded-2xl font-bold text-sm transition-colors"
                >
                  <Phone className="w-4 h-4 text-brand-900" />
                  <span>Call {CLINIC_INFO.phone}</span>
                </a>
              </div>
            </div>
            {heroImage && (
              <div className="rounded-[28px] overflow-hidden border border-slate-200/80 shadow-sm bg-slate-100">
                <img
                  src={heroImage}
                  alt={`${fixCopy(primary.title)} at Vihana Dental Care, Kalapatti`}
                  {...imgDims(heroImage)}
                  fetchPriority="high"
                  decoding="async"
                  className="w-full h-72 sm:h-96 object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Treatment detail — one block per service (braces has several) */}
      {services.map((service) => (
        <section key={service.id} className="py-12 bg-white border-t border-slate-200/70">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-3 gap-10">
            <div className="lg:col-span-2 space-y-6">
              {multi ? (
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{fixCopy(service.title)}</h2>
              ) : (
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">About this treatment</h2>
              )}
              <div className="space-y-3 text-slate-600 leading-relaxed">
                {fixCopy(service.fullDescription)
                  .split(/\n{2,}/)
                  .map((para, i) => (
                    <p key={i} className="whitespace-pre-line">{para}</p>
                  ))}
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Key features</h3>
                <ul className="space-y-2">
                  {service.benefits
                    // The Invisalign page makes no outcome claims, so it leaves out
                    // the results comparison ("Shorter treatment duration than
                    // metal braces") and the absolute "100%" wording.
                    .filter((b) => !(def.path === '/invisalign-coimbatore' && /shorter treatment|^100%/i.test(b)))
                    .map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{fixCopy(b)}</span>
                      </li>
                    ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Procedure steps</h3>
                <ol className="space-y-2">
                  {service.procedures.map((p, i) => (
                    <li key={i} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm text-slate-700">
                      <span className="w-6 h-6 rounded-full bg-brand-300 text-brand-950 font-bold flex items-center justify-center shrink-0 text-xs">{i + 1}</span>
                      <span>{fixCopy(p)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div>
                  <p className="text-xs text-slate-500 font-medium">Estimated cost range</p>
                  <p className="text-lg font-extrabold text-brand-900">{service.priceRange}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{service.durationMinutes} mins per session</span>
                </div>
                <button
                  type="button"
                  onClick={() => openBooking(service.id)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-brand-900 hover:bg-brand-950 text-white px-5 py-3 rounded-xl font-bold text-sm transition-colors"
                >
                  <Calendar className="w-4 h-4 text-brand-400" />
                  <span>{multi ? `Book ${fixCopy(service.title)}` : 'Book Appointment'}</span>
                </button>
              </div>
              {multi && service.image && !service.image.startsWith('data:') && (
                <img
                  src={service.image}
                  alt={`${fixCopy(service.title)} at Vihana Dental Care`}
                  {...imgDims(service.image)}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-48 object-cover rounded-2xl border border-slate-200"
                />
              )}
            </aside>
          </div>
        </section>
      ))}

      {/* Photos from the clinic */}
      {def.photos.length > 0 && (
        <section className="py-12 bg-[#F5F5F7] border-t border-slate-200/70">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Inside the clinic</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {def.photos.map((photo) => (
                <figure key={photo.src} className="bg-white rounded-[28px] overflow-hidden border border-slate-200/80 shadow-sm">
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    {...imgDims(photo.src)}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-64 object-cover"
                  />
                  <figcaption className="p-4 text-sm font-semibold text-slate-700">{photo.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Specialists */}
      {specialists.length > 0 && (
        <section className="py-12 bg-white border-t border-slate-200/70">
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {specialists.length > 1 ? 'Your specialists' : 'Your specialist'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {specialists.map((doc) => {
                const role = 'title' in doc ? doc.title : doc.specialty;
                const training = 'externalTraining' in doc ? doc.externalTraining || [] : [];
                const photo = doc.photo && !doc.photo.startsWith('data:') ? doc.photo : '';
                return (
                  <div key={doc.id} className="flex gap-5 bg-[#F5F5F7] rounded-[28px] border border-slate-200/80 p-5">
                    {photo && (
                      <img
                        src={photo}
                        alt={doc.name}
                        {...imgDims(photo, [480, 480])}
                        loading="lazy"
                        decoding="async"
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover shrink-0"
                      />
                    )}
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-extrabold text-slate-900">{doc.name}</h3>
                      <p className="text-sm font-semibold text-brand-900">{role}</p>
                      <p className="text-sm text-slate-600">{doc.qualification}</p>
                      {training.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {training.map((t) => (
                            <span key={t} className="inline-flex items-center gap-1 bg-white text-slate-700 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-slate-200">
                              <Award className="w-3 h-3 text-brand-800" />
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-12 bg-[#F5F5F7] border-t border-slate-200/70">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-brand-300 flex items-center justify-center">
              <MessageCircleQuestion className="w-6 h-6 text-brand-900" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Frequently asked questions</h2>
          </div>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="text-base font-bold text-slate-900 mb-1.5">{faq.question}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Visit + CTA */}
      <section className="py-12 bg-white border-t border-slate-200/70">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Visit Vihana Dental Care</h2>
            <p className="flex items-start gap-3 text-sm text-slate-700">
              <MapPin className="w-4 h-4 text-brand-800 mt-0.5 shrink-0" />
              <a href={CLINIC_INFO.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {addressText()}
              </a>
            </p>
            <p className="flex items-start gap-3 text-sm text-slate-700">
              <Clock className="w-4 h-4 text-brand-800 mt-0.5 shrink-0" />
              <span>{hoursText()}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {bookButton()}
              <a href="/contact" className="inline-flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 px-6 py-3.5 rounded-2xl font-bold text-sm transition-colors">
                Contact &amp; directions
              </a>
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-900">Other treatments</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {related.map((p) => (
                <li key={p.path}>
                  <a href={p.path} className="block bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors">
                    {p.navLabel}
                  </a>
                </li>
              ))}
              <li>
                <a href="/blog" className="block bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors">
                  Dental blog
                </a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </article>
  );
};
