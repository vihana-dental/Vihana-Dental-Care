import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Clock, Sparkles, MessageCircle, AlertTriangle } from 'lucide-react';
import { CLINIC_INFO, SERVICES, clinicWhatsAppHref } from '../data/clinicData';

// DPDP Act, 2023 §5-6 — the notice a patient agrees to before we take their
// contact details, kept as a constant so the exact wording shown can be
// stored alongside the consent record on the server. Change the text here and
// the stored record for future submissions changes with it; records already
// written keep the wording that was actually displayed at the time.
export const INQUIRY_CONSENT_TEXT =
  'I consent to Vihana Dental Care storing my name, phone number and email to respond to this enquiry about dental treatment. ' +
  'I understand I can ask for my details to be accessed, corrected or deleted at any time.';

export const InquirySection: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState(SERVICES[0].title);
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError('Please tick the consent box so we may store your details to reply to you.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, service, message, consentGiven: consent, consentText: INQUIRY_CONSENT_TEXT })
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setName('');
        setEmail('');
        setPhone('');
        setMessage('');
        setService(SERVICES[0].title);
        setConsent(false);
      } else {
        // The server rejects with { error } and no success flag — without this
        // branch the form silently did nothing at all on a validation failure,
        // leaving the patient staring at an unchanged form with no feedback.
        setError(data.error || 'Could not send your enquiry. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Could not reach the clinic right now. Please check your connection, or call us directly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-16 bg-white text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-brand-300 text-brand-950 text-xs font-semibold px-3 py-1 rounded-full">
            <Mail className="w-3.5 h-3.5 text-brand-800" />
            <span>Get in Touch with Vihana Specialists</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Have Questions About Dental Treatments?
          </h2>
          <p className="text-slate-600 text-base leading-relaxed">
            Send an inquiry to our clinical team in Kalapatti, Coimbatore. We usually respond within 30 minutes during working hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Contact Details Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-900 to-brand-950 text-white p-8 rounded-3xl space-y-8 shadow-xl border border-slate-800">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Vihana Dental Care</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                Kalapatti, Coimbatore • Tamil Nadu, India
              </p>
            </div>

            <div className="space-y-5 text-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-brand-700/20 text-brand-500 rounded-xl border border-brand-700/30">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Address Location</p>
                  <a
                    href={CLINIC_INFO.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open ${CLINIC_INFO.name}'s location in Google Maps (opens in a new tab)`}
                    className="text-xs text-slate-300 mt-0.5 block hover:text-brand-500 transition-colors"
                  >
                    {CLINIC_INFO.address}, {CLINIC_INFO.city} - {CLINIC_INFO.pincode}
                  </a>
                </div>
              </div>

              <a href={`tel:${CLINIC_INFO.phone}`} className="flex items-start gap-4 group">
                <div className="p-3 bg-brand-700/20 text-brand-500 rounded-xl border border-brand-700/30">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Call Us</p>
                  <p className="text-xs text-slate-300 mt-0.5 group-hover:text-brand-500 transition-colors">{CLINIC_INFO.phone}</p>
                </div>
              </a>

              <a
                href={clinicWhatsAppHref()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-4 group"
              >
                <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">WhatsApp Us</p>
                  <p className="text-xs text-slate-300 mt-0.5 group-hover:text-emerald-300 transition-colors">{CLINIC_INFO.whatsapp}</p>
                </div>
              </a>

              <a href={`mailto:${CLINIC_INFO.email}`} className="flex items-start gap-4 group">
                <div className="p-3 bg-brand-700/20 text-brand-500 rounded-xl border border-brand-700/30">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Email Us</p>
                  <p className="text-xs text-slate-300 mt-0.5 group-hover:text-brand-500 transition-colors">{CLINIC_INFO.email}</p>
                </div>
              </a>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-brand-700/20 text-brand-500 rounded-xl border border-brand-700/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Working Hours</p>
                  <p className="text-xs text-slate-300 mt-0.5">{CLINIC_INFO.workingHours.weekdays}</p>
                  <p className="text-xs text-emerald-400 font-medium mt-0.5">{CLINIC_INFO.workingHours.sundays}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 text-xs text-slate-300 space-y-1">
              <p className="font-bold text-brand-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Emergency Care Helpline
              </p>
              <p>
                For urgent dental trauma or toothache emergencies, call{' '}
                <a href={`tel:${CLINIC_INFO.phone}`} className="underline hover:text-brand-500 transition-colors">{CLINIC_INFO.phone}</a> immediately.
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-7 bg-slate-50 p-8 rounded-3xl border border-slate-200 shadow-sm">
            {submitted ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Inquiry Submitted!</h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Thank you for reaching out to Vihana Dental Care. Our medical receptionist and doctors have received your message and will get back to you shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="bg-brand-900 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Viswanathan M."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-700 outline-none bg-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Phone / WhatsApp *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-700 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-700 outline-none bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Interest</label>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-700 outline-none bg-white"
                  >
                    {SERVICES.map((s) => (
                      <option key={s.id} value={s.title}>{s.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Your Message or Questions *</label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us about your dental concern, preferred consultation timing..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-700 outline-none bg-white"
                  />
                </div>

                <div className="flex items-start gap-2.5 bg-white border border-slate-200 rounded-xl p-3">
                  <input
                    id="inquiry-consent"
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 w-4 h-4 shrink-0 accent-brand-800 cursor-pointer"
                  />
                  <label htmlFor="inquiry-consent" className="text-[11px] leading-relaxed text-slate-600 cursor-pointer">
                    {INQUIRY_CONSENT_TEXT}{' '}
                    <a href="/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-brand-800">
                      Read our privacy policy
                    </a>.
                  </label>
                </div>

                {error && (
                  <p role="alert" className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-900 hover:bg-brand-950 disabled:opacity-60 text-white font-bold text-sm py-3.5 rounded-xl shadow transition-all flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{loading ? "Submitting Inquiry..." : "Submit Inquiry to Clinic"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
