import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SERVICES, CLINIC_INFO, slotDisabledLabel } from '../data/clinicData';
import { AvailabilitySlot, BookingDraft, ChatBubble, ChatFlowStep, FeeConfig } from '../types';
import {
  Bot,
  X,
  Send,
  MessageCircleHeart,
  Loader2,
  CheckCircle2,
  QrCode,
  CalendarCheck2,
  AlertTriangle,
  ChevronRight,
  MapPin,
  Video,
  RotateCcw
} from 'lucide-react';

const nowStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const IS_URL = /^https?:\/\//;

/** Renders a chat bubble's text with any bare URLs turned into clickable links, instead of dead-looking plain text. */
const LinkifiedText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(URL_PATTERN);
  return (
    <>
      {parts.map((part, i) =>
        IS_URL.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noreferrer"
            className="underline break-all font-semibold"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

const MENU_CHIPS = ['📅 Book an Appointment', '🕒 Check Availability', '🔄 Reschedule / Cancel', '❓ Ask a Question'];

// Two-level category -> service drill-down (mirrors the WhatsApp bot's flow)
// so every one of the 13 services stays reachable — a flat chip list used to
// hard-cut off at 9, silently hiding all 4 braces options from this widget.
const SERVICE_CATEGORIES = Array.from(new Set(SERVICES.map((s) => s.category)));

// Steps that are part of the guided booking sequence, used both for the
// progress indicator and to decide whether free text typed mid-flow is
// allowed to redirect the step (see handleFreeTextSend) — a stray question
// typed while picking a service used to silently reset the whole flow.
const BOOKING_STEPS: ChatFlowStep[] = ['consultation_type', 'category', 'service', 'doctor', 'datetime', 'patient_details', 'payment'];

export const ChatBookingWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatBubble[]>([
    {
      id: uid('bot'),
      sender: 'bot',
      kind: 'text',
      text: "Hi, I'm the Vihana Dental Care booking assistant. How may I help you? 👋",
      timestamp: nowStamp()
    }
  ]);
  const [step, setStep] = useState<ChatFlowStep>('menu');
  const [draft, setDraft] = useState<BookingDraft>({});
  const [category, setCategory] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [nlLoading, setNlLoading] = useState(false);
  const [feeConfig, setFeeConfig] = useState<FeeConfig>({ confirmationFeeEnabled: true, inClinicFeeINR: 300, onlineFeeINR: 500 });
  const [paymentLink, setPaymentLink] = useState<{ shortUrl: string; qrImageUrl: string; amount: number } | null>(null);
  const [paymentAppointmentId, setPaymentAppointmentId] = useState<string | null>(null);
  const [paymentGenLoading, setPaymentGenLoading] = useState(false);
  const [paymentGenError, setPaymentGenError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [cancelToken, setCancelToken] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [cancelDone, setCancelDone] = useState(false);
  const [checkingSlot, setCheckingSlot] = useState(false);
  const [bookableDoctors, setBookableDoctors] = useState<{ id: string; name: string; displayTitle: string; photo: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/clinic-info')
        .then((res) => res.json())
        .then((data) => data.feeConfig && setFeeConfig(data.feeConfig))
        .catch(() => {});
      // Live, bookable-filtered roster — shared with the website modal and
      // WhatsApp bot via the same endpoint, so a doctor toggled off in the
      // Team panel disappears from this picker immediately.
      fetch('/api/bookable-doctors')
        .then((res) => res.json())
        .then((data) => data.success && setBookableDoctors(data.doctors))
        .catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, step, paymentLink, confirming]);

  const pushBot = (text: string) => setMessages((prev) => [...prev, { id: uid('bot'), sender: 'bot', kind: 'text', text, timestamp: nowStamp() }]);
  const pushUser = (text: string) => setMessages((prev) => [...prev, { id: uid('user'), sender: 'user', kind: 'text', text, timestamp: nowStamp() }]);

  const resetFlow = () => {
    setDraft({});
    setCategory(null);
    setPaymentLink(null);
    setPaymentAppointmentId(null);
    setPaymentGenError('');
    setPaymentFailed(false);
    setBookingResult(null);
    setConfirmError('');
    setCancelToken('');
    setCancelError('');
    setCancelDone(false);
    setStep('menu');
  };

  const handleMenuChip = (chip: string) => {
    pushUser(chip);
    if (chip.includes('Book an Appointment') || chip.includes('Check Availability')) {
      pushBot('Great! Is this an in-clinic visit or an online video consultation?');
      setStep('consultation_type');
    } else if (chip.includes('Reschedule')) {
      pushBot('No problem. Enter the reschedule code from your confirmation (e.g. RSC-88120) and I’ll cancel that slot so you can rebook a new time.');
      setStep('reschedule');
    } else {
      pushBot('Go ahead and type your question below — I can help with services, hours, fees, or booking.');
      setStep('free_chat');
    }
  };

  const handleConsultationType = (type: 'in-clinic' | 'online-video') => {
    pushUser(type === 'in-clinic' ? '🏥 In-Clinic Visit' : '💻 Online Video Consult');
    setDraft((d) => ({ ...d, consultationType: type }));
    pushBot('Which type of treatment are you looking for?');
    setStep('category');
  };

  const handleCategorySelect = (cat: string) => {
    pushUser(cat);
    setCategory(cat);
    pushBot(`${cat} treatments — which one?`);
    setStep('service');
  };

  const handleServiceSelect = (serviceId: string) => {
    const service = SERVICES.find((s) => s.id === serviceId);
    pushUser(service?.title || 'Selected service');
    setDraft((d) => ({ ...d, serviceId }));
    pushBot('Which doctor would you like to see?');
    setStep('doctor');
  };

  const handleDoctorSelect = (doctorId: string) => {
    const doctor = bookableDoctors.find((d) => d.id === doctorId);
    pushUser(doctor?.name || 'Selected doctor');
    setDraft((d) => ({ ...d, doctorId }));
    pushBot('Pick a date and time that works for you.');
    setStep('datetime');
  };

  const handleDateTimeSubmit = (date: string, timeSlot: string) => {
    pushUser(`📅 ${date} at ${timeSlot}`);
    setDraft((d) => ({ ...d, date, timeSlot }));
    pushBot('Almost done — could I get your name and contact details?');
    setStep('patient_details');
  };

  const handlePatientDetailsSubmit = async (name: string, phone: string, email: string, notes: string) => {
    pushUser(`${name} • ${phone}`);
    setDraft((d) => ({ ...d, patientName: name, patientPhone: phone, patientEmail: email, notes }));

    // Re-verify the chosen slot is still free right before payment/Meet
    // generation — someone else may have booked it (or the doctor blocked
    // the time on their own calendar) while this patient was typing.
    setCheckingSlot(true);
    try {
      const res = await fetch('/api/availability/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: draft.date, timeSlot: draft.timeSlot, doctorId: draft.doctorId })
      });
      const data = await res.json();
      if (!data.valid) {
        pushBot(data.message || `Sorry — that ${draft.date} ${draft.timeSlot} slot was just taken. Please pick another time.`);
        setStep('datetime');
        return;
      }
    } catch {
      // Fail open — the server does a hard re-check again on final booking anyway.
    } finally {
      setCheckingSlot(false);
    }

    const fee = draft.consultationType === 'online-video' ? feeConfig.onlineFeeINR : feeConfig.inClinicFeeINR;
    if (feeConfig.confirmationFeeEnabled && fee > 0) {
      pushBot(`Thanks! There's a refundable advance booking fee of ₹${fee}. Generate a secure payment link below to pay without leaving this chat.`);
      setStep('payment');
    } else {
      pushBot('Thanks! Confirming your appointment now...');
      finalizeBooking();
    }
  };

  // Creates the appointment as PENDING server-side and returns a real
  // Razorpay Payment Link — the appointmentId is what the webhook matches
  // against to confirm payment (see /api/payments/webhook). Once set, the
  // polling effect below takes over and confirms automatically — there is
  // no manual "I've paid" button; the patient just completes the payment in
  // the tab that opens and this screen updates on its own.
  const generatePaymentLink = async () => {
    setPaymentGenLoading(true);
    setPaymentGenError('');
    setPaymentFailed(false);
    try {
      const res = await fetch('/api/razorpay/create-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: draft.patientName,
          patientPhone: draft.patientPhone,
          patientEmail: draft.patientEmail,
          doctorId: draft.doctorId || bookableDoctors[0]?.id,
          serviceId: draft.serviceId,
          date: draft.date,
          timeSlot: draft.timeSlot,
          notes: draft.notes,
          consultationType: draft.consultationType
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not generate payment link.');
      setPaymentLink({ shortUrl: data.shortUrl, qrImageUrl: data.qrImageUrl, amount: data.amount / 100 });
      setPaymentAppointmentId(data.appointmentId);
    } catch (err: any) {
      setPaymentGenError(err?.message || 'Payment link generation failed. Please try again.');
    } finally {
      setPaymentGenLoading(false);
    }
  };

  // Free/waived-fee bookings only — no payment involved, so the appointment
  // is created and confirmed in one step. Paid bookings never call this;
  // they're confirmed by the Razorpay webhook (or its mock-mode stand-in,
  // confirmPaymentLink below) once payment actually completes.
  const finalizeBooking = async () => {
    setConfirming(true);
    setConfirmError('');
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: draft.patientName,
          patientPhone: draft.patientPhone,
          patientEmail: draft.patientEmail,
          doctorId: draft.doctorId || bookableDoctors[0]?.id,
          serviceId: draft.serviceId,
          date: draft.date,
          timeSlot: draft.timeSlot,
          notes: draft.notes,
          consultationType: draft.consultationType,
          channel: 'chatbot'
        })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Booking failed.');
      setBookingResult(data);
      setStep('confirmed');
    } catch (err: any) {
      setConfirmError(err?.message || 'Something went wrong confirming your appointment. Please try again or call ' + CLINIC_INFO.phone + '.');
    } finally {
      setConfirming(false);
    }
  };

  // Silent background check — called on an interval by the polling effect
  // below, not by a manual button. In mock mode (no live Razorpay keys) this
  // actually confirms the booking, simulating what the webhook would do;
  // with live keys, real confirmation only ever comes from the webhook, so
  // this just reports current status (pending / failed / confirmed).
  const checkPaymentStatus = async () => {
    if (!paymentAppointmentId) return;
    try {
      const res = await fetch('/api/payments/confirm-payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId: paymentAppointmentId })
      });
      const data = await res.json();
      if (!data.success) return;

      if (data.failed) {
        setPaymentFailed(true);
        return;
      }
      if (data.pending) return;

      setBookingResult(data);
      setStep('confirmed');
    } catch {
      // Transient network hiccup — the next poll tick will just try again.
    }
  };

  // Polls for payment confirmation automatically once a link exists, so the
  // patient never has to click an "I've paid" button — this screen just
  // updates itself the moment Razorpay's webhook (or, in mock mode, the
  // simulated instant-confirm) lands.
  useEffect(() => {
    if (step !== 'payment' || !paymentAppointmentId || paymentFailed) return;
    checkPaymentStatus();
    const interval = setInterval(checkPaymentStatus, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, paymentAppointmentId, paymentFailed]);

  const handleCancelSubmit = async () => {
    if (!cancelToken.trim()) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      const res = await fetch(`/api/appointments/${encodeURIComponent(cancelToken.trim())}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Could not find that appointment code.');
      setCancelDone(true);
      pushBot(`Done — your ${cancelToken.trim()} appointment has been cancelled. Tap "Book an Appointment" whenever you're ready to pick a new slot.`);
    } catch (err: any) {
      setCancelError(err?.message || 'Could not cancel that appointment. Double-check the code and try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleFreeTextSend = async () => {
    const text = inputText.trim();
    if (!text) return;
    pushUser(text);
    setInputText('');
    setNlLoading(true);
    try {
      const res = await fetch('/api/gemini/booking-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Prior turns go along so the receptionist can resolve follow-ups
        // ("how much is that one?") against what was already discussed.
        // Only the plain text bubbles are sent — never patient contact
        // details, which live in `draft` and stay on this side.
        body: JSON.stringify({
          userMessage: text,
          conversationHistory: messages
            .filter((m) => m.kind === 'text' && m.text)
            .slice(-10)
            .map((m) => ({ sender: m.sender, text: m.text }))
        })
      });
      const data = await res.json();
      pushBot(data.reply || "I can help with booking, availability, or rescheduling — what would you like to do?");

      // Only let the assistant jump the step when we're not already mid-way
      // through the guided booking sequence — otherwise a curious "do you
      // take insurance?" typed while picking a date used to silently wipe
      // out everything already selected.
      const canRedirectFlow = step === 'menu' || step === 'free_chat';
      if (canRedirectFlow) {
        if (data.action === 'START_BOOKING' || data.action === 'CHECK_AVAILABILITY') setStep('consultation_type');
        else if (data.action === 'RESCHEDULE_CANCEL') setStep('reschedule');
      }
      // ANSWER / HANDOFF: stay put, the reply above is the whole response.
    } catch (err) {
      pushBot(`I'm having trouble reaching our assistant right now. Please call ${CLINIC_INFO.phone} or tap a quick option below.`);
    } finally {
      setNlLoading(false);
    }
  };

  const chipButtonClass = 'shrink-0 bg-white hover:bg-brand-200 border border-brand-400 text-brand-950 text-xs font-semibold px-3.5 py-2 rounded-full transition-colors shadow-xs';

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed z-50 bottom-24 right-4 lg:bottom-6 lg:right-6 flex items-center gap-2 bg-brand-900 hover:bg-brand-950 text-white pl-4 pr-5 py-3.5 rounded-full shadow-2xl shadow-brand-950/30"
            id="chat-booking-launcher"
            aria-label="Open booking assistant"
          >
            <MessageCircleHeart className="w-5 h-5" />
            <span className="text-sm font-bold hidden sm:inline">Book via Chat</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="fixed z-50 inset-x-3 bottom-3 top-16 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[400px] sm:h-[640px] sm:max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            id="chat-booking-panel"
          >
            {/* Header */}
            <div className="shrink-0 bg-gradient-to-r from-slate-900 via-brand-900 to-brand-accent-dark text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-700/20 border border-brand-700/30 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-brand-500" />
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight">Vihana Booking Assistant</p>
                  <p className="text-[10px] text-brand-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                    Online • Books in this chat
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {step !== 'menu' && (
                  <button
                    onClick={resetFlow}
                    className="p-2 rounded-full hover:bg-white/10 text-slate-300"
                    aria-label="Start over"
                    title="Start over"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => setIsOpen(false)} className="p-2 rounded-full hover:bg-white/10" aria-label="Close chat">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Booking progress indicator — only shown during the guided steps */}
            {BOOKING_STEPS.includes(step) && (
              <div className="shrink-0 px-4 pt-3 pb-2 bg-white border-b border-slate-100">
                <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 mb-1.5">
                  <span>Step {BOOKING_STEPS.indexOf(step) + 1} of {BOOKING_STEPS.length}</span>
                  <span>{Math.round(((BOOKING_STEPS.indexOf(step) + 1) / BOOKING_STEPS.length) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-800 rounded-full transition-all duration-300"
                    style={{ width: `${((BOOKING_STEPS.indexOf(step) + 1) / BOOKING_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scroll-thin p-4 space-y-3 bg-slate-50">
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                      m.sender === 'user' ? 'bg-brand-900 text-white rounded-br-sm' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed"><LinkifiedText text={m.text || ''} /></p>
                    <p className={`text-[9px] mt-1 ${m.sender === 'user' ? 'text-brand-400' : 'text-slate-400'}`}>{m.timestamp}</p>
                  </div>
                </div>
              ))}

              {nlLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 text-slate-500 px-3.5 py-2.5 rounded-2xl text-xs flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-800" />
                    <span>Thinking...</span>
                  </div>
                </div>
              )}

              {/* ---- Interactive step panels ---- */}
              {step === 'menu' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {MENU_CHIPS.map((chip) => (
                    <button key={chip} onClick={() => handleMenuChip(chip)} className={chipButtonClass}>
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {step === 'consultation_type' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-3 space-y-2">
                  <button
                    onClick={() => handleConsultationType('in-clinic')}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-brand-600 hover:bg-brand-200/60 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-brand-800 text-white flex items-center justify-center shrink-0">
                      <MapPin className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">In-Clinic Visit</p>
                      <p className="text-[10px] text-slate-500">Kalapatti Clinic, Coimbatore</p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleConsultationType('online-video')}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 hover:border-brand-600 hover:bg-brand-200/60 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-brand-800 text-white flex items-center justify-center shrink-0">
                      <Video className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Online Video Consult</p>
                      <p className="text-[10px] text-slate-500">Instant Google Meet link</p>
                    </div>
                  </button>
                </div>
              )}

              {step === 'category' && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {SERVICE_CATEGORIES.map((cat) => (
                    <button key={cat} onClick={() => handleCategorySelect(cat)} className={chipButtonClass}>
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {step === 'service' && (
                <div className="space-y-2">
                  <button
                    onClick={() => setStep('category')}
                    className="text-[10px] text-brand-900 font-semibold hover:underline"
                  >
                    ← Back to categories
                  </button>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {SERVICES.filter((s) => s.category === category).map((s) => (
                      <button key={s.id} onClick={() => handleServiceSelect(s.id)} className={chipButtonClass}>
                        {s.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'doctor' && (
                <div className="space-y-2">
                  <button
                    onClick={() => setStep('service')}
                    className="text-[10px] text-brand-900 font-semibold hover:underline"
                  >
                    ← Back to treatments
                  </button>
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {bookableDoctors.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => handleDoctorSelect(doc.id)}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-brand-600 hover:bg-brand-200/60 transition-colors text-left"
                      >
                        <img loading="lazy" decoding="async" src={doc.photo} alt={doc.name} className="w-9 h-9 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{doc.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{doc.displayTitle}</p>
                        </div>
                      </button>
                    ))}
                    {bookableDoctors.length === 0 && (
                      <p className="text-[11px] text-slate-400 py-2">Loading available doctors...</p>
                    )}
                  </div>
                </div>
              )}

              {step === 'datetime' && <DateTimePanel onSubmit={handleDateTimeSubmit} doctorId={draft.doctorId} />}

              {step === 'patient_details' && <PatientDetailsPanel onSubmit={handlePatientDetailsSubmit} loading={checkingSlot} />}

              {step === 'payment' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                  {!paymentLink && !paymentGenLoading && (
                    <button
                      onClick={generatePaymentLink}
                      className="w-full flex items-center justify-center gap-2 bg-brand-900 hover:bg-brand-950 text-white text-xs font-bold py-3 rounded-xl shadow"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Generate Secure Payment Link</span>
                    </button>
                  )}
                  {paymentGenLoading && (
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-3">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-800" />
                      <span>Generating secure payment link...</span>
                    </div>
                  )}
                  {paymentGenError && (
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] p-2.5 rounded-xl">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p>{paymentGenError}</p>
                        <button onClick={generatePaymentLink} className="underline font-semibold mt-1">Retry</button>
                      </div>
                    </div>
                  )}
                  {paymentLink && !paymentFailed && (
                    <div className="space-y-3">
                      <div className="text-center space-y-1">
                        <p className="text-xs font-bold text-slate-900">₹{paymentLink.amount} Advance Booking Fee</p>
                      </div>
                      <a
                        href={paymentLink.shortUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-brand-900 hover:bg-brand-950 text-white text-xs font-bold py-3 rounded-xl shadow"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>Pay ₹{paymentLink.amount} Now</span>
                      </a>
                      <p className="text-[10px] text-slate-400 text-center break-all">{paymentLink.shortUrl}</p>
                      {/* No manual "I've paid" button — this polls automatically in the background and moves to the confirmation screen the instant Razorpay confirms it. */}
                      <div className="flex items-center justify-center gap-2 text-xs text-slate-500 py-2 border-t border-slate-100">
                        <Loader2 className="w-4 h-4 animate-spin text-brand-800" />
                        <span>Waiting for payment confirmation...</span>
                      </div>
                    </div>
                  )}
                  {paymentFailed && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] p-2.5 rounded-xl">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Your payment didn't go through. No amount was booked — please try again.</span>
                      </div>
                      <button
                        onClick={generatePaymentLink}
                        className="w-full flex items-center justify-center gap-2 bg-brand-900 hover:bg-brand-950 text-white text-xs font-bold py-3 rounded-xl shadow"
                      >
                        <span>Try Payment Again</span>
                      </button>
                    </div>
                  )}
                  {confirmError && (
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] p-2.5 rounded-xl">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{confirmError}</span>
                    </div>
                  )}
                </div>
              )}

              {step === 'reschedule' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                  <label className="text-[11px] font-semibold text-slate-600">Reschedule / Cancellation Code</label>
                  <input
                    value={cancelToken}
                    onChange={(e) => setCancelToken(e.target.value)}
                    placeholder="e.g. RSC-88120"
                    disabled={cancelDone}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-700 outline-none disabled:bg-slate-50"
                  />
                  {cancelError && <p className="text-[11px] text-rose-600">{cancelError}</p>}
                  {!cancelDone ? (
                    <button
                      onClick={handleCancelSubmit}
                      disabled={cancelLoading || !cancelToken.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-brand-900 hover:bg-brand-950 disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-xl"
                    >
                      {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      <span>{cancelLoading ? 'Cancelling...' : 'Cancel This Appointment'}</span>
                    </button>
                  ) : (
                    <button onClick={resetFlow} className="w-full bg-brand-200 text-brand-950 text-xs font-bold py-2.5 rounded-xl">
                      Book a New Appointment
                    </button>
                  )}
                </div>
              )}

              {step === 'confirmed' && bookingResult && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <p className="text-xs font-bold">Appointment Confirmed!</p>
                  </div>
                  <div className="bg-white rounded-xl border border-emerald-100 p-3 text-[11px] space-y-1">
                    <p><span className="text-slate-500">ID:</span> <span className="font-semibold">{bookingResult.appointment.id}</span></p>
                    <p><span className="text-slate-500">When:</span> <span className="font-semibold">{bookingResult.appointment.date} at {bookingResult.appointment.timeSlot}</span></p>
                    <p><span className="text-slate-500">Doctor:</span> <span className="font-semibold">{bookingResult.appointment.doctorName}</span></p>
                    <p><span className="text-slate-500">Reschedule code:</span> <span className="font-mono font-semibold">{bookingResult.appointment.rescheduleToken}</span></p>
                  </div>

                  {bookingResult.appointment.videoRoomUrl && (
                    <a
                      href={bookingResult.appointment.videoRoomUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-2 bg-white border border-brand-400 rounded-xl p-3 text-[11px] hover:border-brand-600 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-brand-950 font-semibold">
                        <Video className="w-4 h-4 shrink-0" />
                        Google Meet Link
                      </span>
                      <span className="text-brand-900 underline truncate max-w-[140px]">{bookingResult.appointment.videoRoomUrl}</span>
                    </a>
                  )}

                  {bookingResult.appointment.consultationType === 'online-video' && !bookingResult.appointment.videoRoomUrl && (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900">
                      <Video className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>Dr. N. Sanchana is confirming availability for this slot — your Google Meet link will be sent to your WhatsApp number once confirmed.</span>
                    </div>
                  )}

                  <div className={`flex items-center gap-2 text-[11px] rounded-xl p-2.5 border ${bookingResult.calendarSync?.synced ? 'bg-brand-200 border-brand-400 text-brand-950' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    <CalendarCheck2 className="w-4 h-4 shrink-0" />
                    <span>
                      {bookingResult.calendarSync?.synced
                        ? `Synced to Google Calendar${bookingResult.calendarSync?.mock ? ' (demo mode)' : ''}.`
                        : bookingResult.calendarSync?.error || "We'll confirm the calendar entry manually — your appointment is booked."}
                    </span>
                  </div>

                  {bookingResult.whatsappLink && (
                    <a
                      href={bookingResult.whatsappLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebd5a] text-white text-xs font-bold py-3 rounded-xl shadow"
                    >
                      <MessageCircleHeart className="w-4 h-4" />
                      <span>Get Confirmation on WhatsApp</span>
                    </a>
                  )}

                  <button onClick={resetFlow} className="w-full bg-brand-900 hover:bg-brand-950 text-white text-xs font-bold py-2.5 rounded-xl">
                    Done
                  </button>
                </div>
              )}

              <div ref={endRef} />
            </div>

            {/* Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleFreeTextSend();
              }}
              className="shrink-0 p-3 border-t border-slate-200 bg-white flex items-center gap-2"
            >
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a question, e.g. 'do you do Invisalign?'"
                // Sentence-casing and a "send" return key make this behave like
                // a real messaging field on mobile rather than a bare text box.
                // Font size is lifted to 16px on touch pointers in index.css to
                // stop iOS auto-zooming the page on focus.
                enterKeyHint="send"
                autoCapitalize="sentences"
                autoComplete="off"
                className="flex-1 min-w-0 bg-slate-100 text-slate-800 text-xs px-3.5 py-2.5 rounded-xl border border-transparent focus:outline-none focus:border-brand-600 focus:bg-white"
              />
              <button
                type="submit"
                disabled={nlLoading || !inputText.trim()}
                className="bg-brand-900 hover:bg-brand-950 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const DateTimePanel: React.FC<{ onSubmit: (date: string, timeSlot: string) => void; doctorId?: string }> = ({ onSubmit, doctorId }) => {
  const [date, setDate] = useState(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('');
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [dayFullyBooked, setDayFullyBooked] = useState(false);
  const [dayLapsed, setDayLapsed] = useState(false);
  const [degradedMessage, setDegradedMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadAvailability = async (targetDate: string) => {
    setLoading(true);
    setError('');
    setDegradedMessage('');
    try {
      const res = await fetch(`/api/availability?date=${targetDate}${doctorId ? `&doctorId=${encodeURIComponent(doctorId)}` : ''}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not load availability for this date.');

      setSlots(data.slots || []);
      setDayFullyBooked(Boolean(data.dayFullyBooked));
      setDayLapsed(Boolean(data.dayLapsed));
      if (data.degraded) setDegradedMessage(data.message || 'Live availability temporarily unavailable — showing standard hours.');

      const firstAvailable = (data.slots || []).find((s: AvailabilitySlot) => s.available);
      setTimeSlot(firstAvailable ? firstAvailable.time : '');
    } catch (err: any) {
      setError(err?.message || 'Could not load availability for this date. Please try another date.');
      setSlots([]);
      setDayLapsed(false);
      setTimeSlot('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAvailability(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
      <div>
        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Preferred Date</label>
        <input
          type="date"
          min={new Date().toISOString().split('T')[0]}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-700 outline-none"
        />
      </div>

      {degradedMessage && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] p-2 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{degradedMessage}</span>
        </div>
      )}

      <div>
        <label className="text-[11px] font-semibold text-slate-600 block mb-1">Time Slot</label>

        {loading && (
          <div className="flex flex-wrap gap-1.5">
            {[...Array(6)].map((_, i) => (
              <span key={i} className="w-16 h-7 rounded-lg bg-slate-100 animate-pulse inline-block" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] p-2.5 rounded-xl">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p>{error}</p>
              <button onClick={() => loadAvailability(date)} className="underline font-semibold mt-1">Retry</button>
            </div>
          </div>
        )}

        {!loading && !error && dayLapsed && (
          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            Today's booking window has closed — slots are disabled once their start time has passed. Please pick another date above.
          </p>
        )}

        {!loading && !error && !dayLapsed && dayFullyBooked && (
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            Fully booked on this date — please pick another date above.
          </p>
        )}

        {!loading && !error && !dayLapsed && !dayFullyBooked && (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((s) => (
              <button
                key={s.time}
                onClick={() => s.available && setTimeSlot(s.time)}
                disabled={!s.available}
                title={!s.available ? slotDisabledLabel(s.reason) : undefined}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                  !s.available
                    ? 'bg-slate-50 border-slate-100 text-slate-300 line-through cursor-not-allowed'
                    : timeSlot === s.time
                    ? 'bg-brand-900 border-brand-900 text-white'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-brand-500'
                }`}
              >
                {s.time}
              </button>
            ))}
          </div>
        )}

        {/* Only while part of today is still bookable — a fully lapsed day is
            already explained by the amber notice above. */}
        {!loading && !error && !dayLapsed && slots.some((s) => s.reason === 'passed') && (
          <p className="text-[10px] text-slate-400 mt-1.5">
            Struck-through times have already passed today and can no longer be booked.
          </p>
        )}
      </div>

      <button
        onClick={() => timeSlot && onSubmit(date, timeSlot)}
        disabled={!timeSlot || loading || dayFullyBooked || dayLapsed}
        className="w-full bg-brand-900 hover:bg-brand-950 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1"
      >
        Continue <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const PatientDetailsPanel: React.FC<{ onSubmit: (name: string, phone: string, email: string, notes: string) => void; loading?: boolean }> = ({ onSubmit, loading }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const canSubmit = name.trim() && phone.trim() && !loading;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name *"
        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-700 outline-none"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="WhatsApp mobile number *"
        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-700 outline-none"
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (optional)"
        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-700 outline-none"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Any concerns or notes (optional)"
        rows={2}
        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-brand-700 outline-none"
      />
      <button
        onClick={() => canSubmit && onSubmit(name.trim(), phone.trim(), email.trim(), notes.trim())}
        disabled={!canSubmit}
        className="w-full bg-brand-900 hover:bg-brand-950 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>{loading ? 'Checking availability...' : 'Continue'}</span>
      </button>
    </div>
  );
};
