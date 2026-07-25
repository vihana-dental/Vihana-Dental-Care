import React, { useState } from 'react';
import { SERVICES, DOCTORS, CLINIC_INFO } from '../data/clinicData';
import { Appointment } from '../types';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  CheckCircle2, 
  Sparkles, 
  MessageCircle, 
  ExternalLink, 
  ShieldCheck, 
  RefreshCw,
  Bell
} from 'lucide-react';

interface AppointmentBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialServiceId?: string;
  onBookingSuccess?: (appointment: Appointment) => void;
}

export const AppointmentBookingModal: React.FC<AppointmentBookingModalProps> = ({
  isOpen,
  onClose,
  initialServiceId,
  onBookingSuccess
}) => {
  const [step, setStep] = useState<number>(1);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialServiceId || SERVICES[0].id);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(DOCTORS[0].id);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('10:30 AM');
  const [patientName, setPatientName] = useState<string>('');
  const [patientPhone, setPatientPhone] = useState<string>('');
  const [patientEmail, setPatientEmail] = useState<string>('');
  const [caregiverPhone, setCaregiverPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [bookingResult, setBookingResult] = useState<any>(null);

  if (!isOpen) return null;

  const timeSlots = [
    '09:30 AM', '10:30 AM', '11:30 AM', '12:30 PM',
    '03:00 PM', '04:00 PM', '05:30 PM', '07:00 PM'
  ];

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName,
          patientPhone,
          patientEmail,
          doctorId: selectedDoctorId,
          serviceId: selectedServiceId,
          date: selectedDate,
          timeSlot: selectedTimeSlot,
          notes,
          caregiverPhone
        })
      });

      const data = await res.json();
      if (data.success) {
        setBookingResult(data);
        if (onBookingSuccess) onBookingSuccess(data.appointment);
        setStep(3); // Success step
      } else {
        alert(data.error || "Booking failed. Please try again.");
      }
    } catch (err) {
      console.error(err);
      alert("Error processing appointment. Please check network connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleTestReschedule = async () => {
    if (!bookingResult?.appointment?.rescheduleToken) return;
    const newDate = new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0];
    const newTime = '04:00 PM';

    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${bookingResult.appointment.rescheduleToken}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newDate,
          newTimeSlot: newTime
        })
      });
      const data = await res.json();
      if (data.success) {
        setBookingResult({
          ...bookingResult,
          appointment: data.appointment,
          whatsappNotification: data.whatsappNotification
        });
        alert(`Appointment rescheduled to ${newDate} at ${newTime}! Google Calendar & WhatsApp confirmation updated.`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 my-8">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-300 hover:text-white p-1 rounded-full bg-slate-800/80"
            id="close-booking-modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-teal-300 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Vihanna Dental Clinic • Coimbatore</span>
          </div>
          <h3 className="text-2xl font-bold">
            {step === 3 ? "Appointment Confirmed! 🎉" : "Schedule Your Dental Appointment"}
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            {step === 3 
              ? "Automated Google Calendar Event Created & WhatsApp Confirmation Sent"
              : "Select your service, doctor, and preferred time slot for instant confirmation"}
          </p>

          {/* Progress Indicator */}
          {step !== 3 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/80 text-xs">
              <span className={`px-2.5 py-1 rounded-full font-bold ${step === 1 ? 'bg-teal-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                1. Service & Doctor
              </span>
              <span className="text-slate-500">•</span>
              <span className={`px-2.5 py-1 rounded-full font-bold ${step === 2 ? 'bg-teal-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                2. Time & Details
              </span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {step === 1 && (
            <div className="space-y-6">
              {/* Select Service */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Select Required Dental Treatment
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                  {SERVICES.map((serv) => (
                    <div
                      key={serv.id}
                      onClick={() => setSelectedServiceId(serv.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        selectedServiceId === serv.id
                          ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-600/20'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <img
                        src={serv.image}
                        alt={serv.title}
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{serv.title}</p>
                        <p className="text-[11px] text-teal-700 font-semibold">{serv.priceRange}</p>
                        <p className="text-[10px] text-slate-500">{serv.durationMinutes} mins</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Select Doctor */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Select Specialist Doctor
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {DOCTORS.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col items-center text-center ${
                        selectedDoctorId === doc.id
                          ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-600/20'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <img
                        src={doc.photo}
                        alt={doc.name}
                        className="w-12 h-12 rounded-full object-cover mb-2 border border-teal-500"
                        referrerPolicy="no-referrer"
                      />
                      <p className="text-xs font-bold text-slate-900 leading-tight">{doc.name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{doc.title.split('&')[0]}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-6 py-3 rounded-xl shadow transition-all flex items-center gap-2"
                  id="booking-next-step"
                >
                  <span>Continue to Time & Details</span>
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmitBooking} className="space-y-5">
              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Preferred Date
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Available Time Slot
                  </label>
                  <select
                    value={selectedTimeSlot}
                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    {timeSlots.map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Patient Contact Info */}
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. Senthil Kumar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      value={patientPhone}
                      onChange={(e) => setPatientPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    <p className="text-[10px] text-emerald-700 mt-1">Automated WhatsApp confirmation will be sent here.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={patientEmail}
                      onChange={(e) => setPatientEmail(e.target.value)}
                      placeholder="senthil@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>
                </div>

                {/* Optional Caregiver Alert Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                    <span>Caregiver Mobile Number (Optional for Post-Op Alerts)</span>
                  </label>
                  <input
                    type="tel"
                    value={caregiverPhone}
                    onChange={(e) => setCaregiverPhone(e.target.value)}
                    placeholder="+91 98421 88321"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dental Concerns / Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Describe any toothache, sensitivity, or medical conditions..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-8 py-3 rounded-xl shadow transition-all flex items-center gap-2"
                  id="submit-booking-button"
                >
                  {loading ? (
                    <span>Syncing Calendar & Booking...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Appointment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 3 && bookingResult && (
            <div className="space-y-6">
              {/* Confirmation Alert Banner */}
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-5 rounded-2xl space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-base text-emerald-900">
                      Appointment #{bookingResult.appointment.id} Reserved!
                    </p>
                    <p className="text-xs text-emerald-800">
                      {bookingResult.appointment.patientName} • {bookingResult.appointment.date} at {bookingResult.appointment.timeSlot}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white/80 p-3 rounded-xl border border-emerald-100">
                  <div>
                    <span className="text-slate-500 font-medium">Assigned Doctor:</span>
                    <p className="font-bold text-slate-800">{bookingResult.appointment.doctorName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Selected Service:</span>
                    <p className="font-bold text-slate-800">{bookingResult.appointment.serviceName}</p>
                  </div>
                </div>
              </div>

              {/* Google Calendar Sync Status */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between text-xs text-blue-900">
                <div className="space-y-0.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span>Google Calendar Event Synced</span>
                  </p>
                  <p className="text-[11px] text-blue-700">
                    Calendar Event ID: <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">{bookingResult.googleCalendarSync.eventId}</code>
                  </p>
                </div>
                <span className="bg-blue-600 text-white font-bold px-2.5 py-1 rounded-md text-[10px]">
                  Doctor Calendar Synced
                </span>
              </div>

              {/* Automated WhatsApp Message Preview */}
              <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl space-y-2 font-mono text-xs border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Message Dispatched
                  </span>
                  <span className="text-slate-400 text-[10px]">Recipient: {bookingResult.appointment.patientPhone}</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-200 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                  {bookingResult.whatsappNotification.messagePreview}
                </pre>
              </div>

              {/* Interactive Rescheduling Option */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs">
                    <p className="font-bold text-slate-900">Automated Rescheduling Link Token</p>
                    <p className="text-slate-500 text-[11px]">Token: <span className="font-mono text-teal-800 font-bold">{bookingResult.appointment.rescheduleToken}</span></p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTestReschedule}
                    disabled={loading}
                    className="bg-slate-800 hover:bg-slate-700 text-teal-300 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                    <span>Test Reschedule API</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onClose}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-8 py-3 rounded-xl shadow"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
