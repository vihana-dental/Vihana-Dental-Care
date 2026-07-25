import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Clock, Sparkles } from 'lucide-react';
import { CLINIC_INFO, SERVICES } from '../data/clinicData';

export const InquirySection: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState(SERVICES[0].title);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, service, message })
      });

      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setName('');
        setEmail('');
        setPhone('');
        setMessage('');
      }
    } catch (err) {
      console.error(err);
      alert("Failed to submit inquiry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-16 bg-white text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 text-xs font-semibold px-3 py-1 rounded-full">
            <Mail className="w-3.5 h-3.5 text-teal-600" />
            <span>Get in Touch with Vihanna Specialists</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Have Questions About Dental Treatments?
          </h2>
          <p className="text-slate-600 text-base leading-relaxed">
            Send an inquiry to our clinical team in Gandhipuram, Coimbatore. We usually respond within 30 minutes during working hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Contact Details Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 text-white p-8 rounded-3xl space-y-8 shadow-xl border border-slate-800">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-white">Vihanna Dental Clinic</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                Gandhipuram, Coimbatore • Tamil Nadu, India
              </p>
            </div>

            <div className="space-y-5 text-sm">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-500/30">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Address Location</p>
                  <p className="text-xs text-slate-300 mt-0.5">{CLINIC_INFO.address}, Gandhipuram, Coimbatore - {CLINIC_INFO.pincode}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-500/30">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Phone & WhatsApp</p>
                  <p className="text-xs text-slate-300 mt-0.5">{CLINIC_INFO.phone} / {CLINIC_INFO.alternatePhone}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 bg-teal-500/20 text-teal-300 rounded-xl border border-teal-500/30">
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
              <p className="font-bold text-teal-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Emergency Care Helpline
              </p>
              <p>For urgent dental trauma or toothache emergencies, call +91 98765 43210 immediately.</p>
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
                  Thank you for reaching out to Vihanna Dental Clinic. Our medical receptionist and doctors have received your message and will get back to you shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="bg-teal-700 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
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
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Service Interest</label>
                  <select
                    value={service}
                    onChange={(e) => setService(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
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
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm py-3.5 rounded-xl shadow transition-all flex items-center justify-center gap-2"
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
