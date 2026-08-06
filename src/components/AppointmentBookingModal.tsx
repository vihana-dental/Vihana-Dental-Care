import React, { useState, useEffect } from 'react';
import { SERVICES, DOCTORS } from '../data/clinicData';
import { Appointment } from '../types';
import { 
  X, 
  Calendar, 
  Bell, 
  CheckCircle2, 
  Sparkles, 
  UserCheck, 
  Stethoscope, 
  Video,
  MapPin,
  CreditCard
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
  const [consultationType, setConsultationType] = useState<'in-clinic' | 'online-video'>('in-clinic');
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

  // Fee Config state fetched from backend (mirrors server's dual in-clinic/online fee shape)
  const [feeConfig, setFeeConfig] = useState({ confirmationFeeEnabled: true, inClinicFeeINR: 300, onlineFeeINR: 500 });

  useEffect(() => {
    if (isOpen) {
      fetch('/api/clinic-info')
        .then(res => res.json())
        .then(data => {
          if (data.feeConfig) setFeeConfig(data.feeConfig);
        })
        .catch(err => console.error("Error fetching fee config", err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeFeeAmount = consultationType === 'online-video' ? feeConfig.onlineFeeINR : feeConfig.inClinicFeeINR;

  const timeSlots = [
    '09:30 AM', '10:30 AM', '11:30 AM', '12:30 PM',
    '03:00 PM', '04:00 PM', '05:30 PM', '07:00 PM'
  ];

  const handleExecuteBooking = async (razorpayPaymentId?: string, razorpayOrderId?: string) => {
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
          caregiverPhone,
          consultationType,
          razorpayPaymentId,
          razorpayOrderId
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

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();

    // If confirmation fee is enabled, trigger Razorpay checkout first
    if (feeConfig.confirmationFeeEnabled && activeFeeAmount > 0) {
      setLoading(true);
      try {
        const orderRes = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consultationType, receipt: `rcpt_${Date.now()}` })
        });
        const orderData = await orderRes.json();

        if (!orderData.success) {
          alert("Could not initiate payment gateway.");
          setLoading(false);
          return;
        }

        const options = {
          key: orderData.keyId,
          amount: orderData.order.amount,
          currency: "INR",
          name: "Vihana Dental Care",
          description: `Appointment Confirmation Advance (${consultationType.toUpperCase()})`,
          order_id: orderData.order.id,
          handler: function (response: any) {
            handleExecuteBooking(response.razorpay_payment_id, response.razorpay_order_id);
          },
          prefill: {
            name: patientName,
            email: patientEmail,
            contact: patientPhone
          },
          theme: {
            color: "#0f766e"
          }
        };

        if ((window as any).Razorpay) {
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
          setLoading(false);
        } else {
          console.log("Razorpay script not detected, simulating successful payment...");
          setTimeout(() => {
            handleExecuteBooking(`pay_simulated_${Date.now()}`, orderData.order.id);
          }, 1000);
        }
      } catch (err) {
        console.error("Razorpay Error:", err);
        handleExecuteBooking();
      }
    } else {
      handleExecuteBooking();
    }
  };

  return (
    // 1. BACKDROP: Padded to prevent hitting screen edges
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      
      {/* 2. MODAL WRAPPER: Constrained height, flex-col structure */}
      <div className="relative w-full max-w-2xl max-h-full flex flex-col bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        
        {/* 3. HEADER BAR: Shrink-0 ensures it never collapses */}
        <div className="shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-300 hover:text-white p-1.5 rounded-full bg-slate-800/80 transition-colors z-10"
            id="close-booking-modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-teal-300 text-xs font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Vihana Dental Care • Coimbatore</span>
          </div>
          <h3 className="text-2xl font-bold pr-8">
            {step === 3 ? "Appointment Confirmed! 🎉" : "Schedule Your Dental Appointment"}
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            {step === 3 
              ? "Your appointment has been successfully scheduled."
              : "Select consultation mode, service, doctor, and preferred time slot for instant confirmation"}
          </p>

          {/* Progress Indicator */}
          {step !== 3 && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/80 text-xs">
              <span className={`px-2.5 py-1 rounded-full font-bold ${step === 1 ? 'bg-teal-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                1. Mode & Service
              </span>
              <span className="text-slate-500">•</span>
              <span className={`px-2.5 py-1 rounded-full font-bold ${step === 2 ? 'bg-teal-500 text-slate-950' : 'bg-slate-700 text-slate-300'}`}>
                2. Time & Details
              </span>
            </div>
          )}
        </div>

        {/* 4. MODAL BODY: Scrollable container (flex-1 + overflow-y-auto) */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-6">
              
              {/* Consultation Mode Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Select Consultation Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setConsultationType('in-clinic')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                      consultationType === 'in-clinic'
                        ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${consultationType === 'in-clinic' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">In-Clinic Visit</p>
                      <p className="text-[10px] text-slate-500">Kalapatti Clinic</p>
                    </div>
                  </div>

                  <div
                    onClick={() => setConsultationType('online-video')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center gap-3 ${
                      consultationType === 'online-video'
                        ? 'border-teal-600 bg-teal-50/80 ring-2 ring-teal-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${consultationType === 'online-video' ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      <Video className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Online Video Consult</p>
                      <p className="text-[10px] text-teal-700 font-semibold">Instant Google Meet Link</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Select Service */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Select Required Dental Treatment
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <p className="text-[10px] text-slate-500 mt-0.5">{serv.durationMinutes} mins</p>
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

              {/* Razorpay Fee Banner Note */}
              {feeConfig.confirmationFeeEnabled && activeFeeAmount > 0 && (
                <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Razorpay Advance Booking Fee: <strong>₹{activeFeeAmount}</strong></span>
                  </div>
                  <span className="text-[10px] bg-amber-200/60 font-semibold px-2 py-0.5 rounded text-amber-800">Refundable</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
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
                    <span>Processing Payment & Booking...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{feeConfig.confirmationFeeEnabled ? `Pay ₹${activeFeeAmount} & Confirm` : 'Confirm Appointment'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 3 && bookingResult && (
            <div className="space-y-6">
              {/* Clean Confirmation Alert Banner */}
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-5 sm:p-6 rounded-2xl space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="font-bold text-lg text-emerald-900">
                      {bookingResult.appointment.consultationType === 'online-video' ? 'Online Video Consult Reserved!' : 'Appointment Confirmed!'}
                    </p>
                    <p className="text-sm font-medium text-emerald-800 mt-0.5">
                      {bookingResult.appointment.date} at {bookingResult.appointment.timeSlot}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-white/90 p-4 rounded-xl border border-emerald-100/50 shadow-sm">
                  <div>
                    <span className="text-slate-500 font-medium text-xs block mb-1">Patient Name:</span>
                    <p className="font-bold text-slate-800">{bookingResult.appointment.patientName}</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium text-xs block mb-1">Assigned Doctor:</span>
                    <p className="font-bold text-slate-800">{bookingResult.appointment.doctorName}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 font-medium text-xs block mb-1">Selected Service:</span>
                    <p className="font-bold text-slate-800">{bookingResult.appointment.serviceName}</p>
                  </div>

                  {bookingResult.appointment.consultationType === 'online-video' && bookingResult.appointment.videoRoomUrl && (
                    <div className="sm:col-span-2 bg-teal-50 p-3 rounded-xl border border-teal-200 flex items-center justify-between">
                      <div>
                        <span className="text-teal-900 font-bold text-xs block">Google Meet Video Room</span>
                        <a href={bookingResult.appointment.videoRoomUrl} target="_blank" rel="noreferrer" className="text-teal-700 text-xs underline font-mono">
                          {bookingResult.appointment.videoRoomUrl}
                        </a>
                      </div>
                      <a 
                        href={bookingResult.appointment.videoRoomUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg text-xs font-bold"
                      >
                        Join Now
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={onClose}
                  className="bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold px-8 py-3 rounded-xl shadow transition-colors"
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