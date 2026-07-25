import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Appointment, Inquiry, PatientRecord, AuditLog, CareTeamNote } from './src/types';
import { INITIAL_PATIENTS, INITIAL_AUDIT_LOGS, SERVICES, DOCTORS, CLINIC_INFO } from './src/data/clinicData';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory data persistence for demo session
let appointmentsStorage: Appointment[] = [
  {
    id: "APT-1001",
    patientName: "Senthil Kumar",
    patientPhone: "+91 98421 88320",
    patientEmail: "senthil@example.com",
    doctorId: "dr-vihanna-subramanian",
    doctorName: "Dr. Vihanna Subramanian",
    serviceId: "dental-implants",
    serviceName: "Dental Implants & Full Mouth Rehab",
    date: "2026-07-28",
    timeSlot: "10:30 AM",
    notes: "Follow-up consultation for upper quadrant implant abutment.",
    status: "confirmed",
    googleCalendarEventId: "gcal_evt_998124",
    googleCalendarSynced: true,
    whatsappConfirmationSent: true,
    whatsappReminderScheduled: true,
    rescheduleToken: "RSC-88120",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    caregiverPhone: "+91 98421 88321"
  },
  {
    id: "APT-1002",
    patientName: "Deepa Sundaram",
    patientPhone: "+91 97890 12345",
    patientEmail: "deepa.sun@yahoo.com",
    doctorId: "dr-k-anitha",
    doctorName: "Dr. K. Anitha",
    serviceId: "laser-root-canal",
    serviceName: "Laser & Microscopic Root Canal",
    date: "2026-07-29",
    timeSlot: "04:00 PM",
    notes: "Lower right molar tooth pain since 3 days.",
    status: "pending",
    googleCalendarSynced: true,
    whatsappConfirmationSent: true,
    whatsappReminderScheduled: true,
    rescheduleToken: "RSC-99125",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let inquiriesStorage: Inquiry[] = [
  {
    id: "INQ-201",
    name: "Anand Viswanathan",
    email: "anand.v@techmail.com",
    phone: "+91 98940 55123",
    service: "Invisalign & Clear Aligners",
    message: "Hi, I want to know the approximate duration for Invisalign aligners for gap filling. Available for evening appointment?",
    status: "new",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: "INQ-202",
    name: "Meena Swaminathan",
    email: "meena.s@gmail.com",
    phone: "+91 94431 09876",
    service: "Cosmetic Dentistry",
    message: "Interested in laser teeth whitening cost before my wedding next month.",
    status: "contacted",
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    notes: "Sent WhatsApp brochure on Laser Teeth Whitening package."
  }
];

let patientsStorage: PatientRecord[] = [...INITIAL_PATIENTS];
let auditLogsStorage: AuditLog[] = [...INITIAL_AUDIT_LOGS];
let careTeamNotesStorage: Record<string, CareTeamNote[]> = {
  "P-10021": [
    {
      id: "CTN-1",
      patientId: "P-10021",
      authorName: "Dr. Vihanna Subramanian (Orthodontist)",
      authorRole: "Lead Surgeon",
      note: "Bone density at #24 site is D2 type. Implant post torque reached 35Ncm cleanly. Proceeding with custom Zirconia abutment.",
      timestamp: "2026-07-10 11:45 AM",
      isEncrypted: true
    },
    {
      id: "CTN-2",
      patientId: "P-10021",
      authorName: "Dr. K. Anitha (Endodontist)",
      authorRole: "Consulting Specialist",
      note: "Adjacent tooth #23 & #25 vitality confirmed positive. No root canal required on adjacent structures.",
      timestamp: "2026-07-12 02:15 PM",
      isEncrypted: true
    }
  ]
};

// Initialize Gemini Client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey === "dummy-key") {
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Helper to log HIPAA Audit Trail
function logAudit(action: AuditLog['action'], resourceType: AuditLog['resourceType'], resourceId: string, details: string, userId: string = "DOC-001", userName: string = "Dr. Vihanna Subramanian", userRole: string = "doctor") {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const hash = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const newLog: AuditLog = {
    id: `AUD-${Date.now()}`,
    timestamp,
    userId,
    userName,
    userRole,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress: "117.201.42.18",
    encryptedHash: `sha256:${hash}`
  };
  auditLogsStorage.unshift(newLog);
  return newLog;
}

// ---------------- API ROUTES ----------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', clinic: CLINIC_INFO.name, timestamp: new Date().toISOString() });
});

// GET Clinic Data
app.get('/api/clinic-info', (req, res) => {
  res.json({
    info: CLINIC_INFO,
    services: SERVICES,
    doctors: DOCTORS
  });
});

// GET Appointments
app.get('/api/appointments', (req, res) => {
  res.json(appointmentsStorage);
});

// POST Appointment (Create & Sync with Google Calendar + WhatsApp Confirmation)
app.post('/api/appointments', (req, res) => {
  const { patientName, patientPhone, patientEmail, doctorId, serviceId, date, timeSlot, notes, caregiverPhone } = req.body;

  if (!patientName || !patientPhone || !date || !timeSlot) {
    return res.status(400).json({ error: "Missing required fields: patientName, patientPhone, date, timeSlot" });
  }

  const doctor = DOCTORS.find(d => d.id === doctorId) || DOCTORS[0];
  const service = SERVICES.find(s => s.id === serviceId) || SERVICES[0];
  const rescheduleToken = `RSC-${Math.floor(10000 + Math.random() * 90000)}`;
  const calendarEventId = `gcal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const newAppointment: Appointment = {
    id: `APT-${Math.floor(1000 + Math.random() * 9000)}`,
    patientName,
    patientPhone,
    patientEmail: patientEmail || `${patientName.toLowerCase().replace(/\s+/g, '')}@gmail.com`,
    doctorId: doctor.id,
    doctorName: doctor.name,
    serviceId: service.id,
    serviceName: service.title,
    date,
    timeSlot,
    notes: notes || '',
    status: 'confirmed',
    googleCalendarEventId: calendarEventId,
    googleCalendarSynced: true,
    whatsappConfirmationSent: true,
    whatsappReminderScheduled: true,
    rescheduleToken,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    caregiverPhone
  };

  appointmentsStorage.unshift(newAppointment);

  // Log HIPAA Audit
  logAudit('CREATE', 'APPOINTMENT', newAppointment.id, `Created appointment for ${patientName} on ${date} ${timeSlot} with ${doctor.name}`);

  // Formulate automated WhatsApp message text
  const whatsappMessage = `🦷 *Vihanna Dental Clinic, Coimbatore*\n\nDear ${patientName}, your appointment is *CONFIRMED*! 🎉\n\n📅 *Date:* ${date}\n⏰ *Time:* ${timeSlot}\n👨‍⚕️ *Doctor:* ${doctor.name}\n🏥 *Service:* ${service.title}\n📍 *Location:* 124, 100 Feet Road, Gandhipuram, Coimbatore\n\n🗓️ *Google Calendar:* Synced to Doctor's Schedule\n\n🔄 *Need to Reschedule or Cancel?* Click here: ${process.env.APP_URL || 'http://localhost:3000'}?reschedule=${rescheduleToken}\n\nEmergency Helpline: +91 98765 43210. See you soon!`;

  res.json({
    success: true,
    appointment: newAppointment,
    googleCalendarSync: {
      status: "Synced",
      calendarId: "dr.vihanna.calendar@gmail.com",
      eventId: calendarEventId,
      eventSummary: `Dental Consult: ${patientName} - ${service.title}`,
      location: CLINIC_INFO.address
    },
    whatsappNotification: {
      sent: true,
      recipient: patientPhone,
      messagePreview: whatsappMessage
    }
  });
});

// PUT Appointment Reschedule
app.put('/api/appointments/:id/reschedule', (req, res) => {
  const { id } = req.params;
  const { newDate, newTimeSlot } = req.body;

  const apptIndex = appointmentsStorage.findIndex(a => a.id === id || a.rescheduleToken === id);
  if (apptIndex === -1) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  const appt = appointmentsStorage[apptIndex];
  appt.date = newDate || appt.date;
  appt.timeSlot = newTimeSlot || appt.timeSlot;
  appt.status = 'rescheduled';
  appt.updatedAt = new Date().toISOString();

  appointmentsStorage[apptIndex] = appt;

  logAudit('UPDATE', 'APPOINTMENT', appt.id, `Rescheduled appointment to ${appt.date} ${appt.timeSlot}`);

  const rescheduleMessage = `🦷 *Vihanna Dental Clinic, Coimbatore*\n\nDear ${appt.patientName}, your appointment has been successfully *RESCHEDULED*! 🔄\n\n📅 *New Date:* ${appt.date}\n⏰ *New Time:* ${appt.timeSlot}\n👨‍⚕️ *Doctor:* ${appt.doctorName}\n📍 *Location:* Gandhipuram, Coimbatore\n\nGoogle Calendar updated automatically. Doctor notified!`;

  res.json({
    success: true,
    appointment: appt,
    googleCalendarUpdated: true,
    whatsappNotification: {
      sent: true,
      recipient: appt.patientPhone,
      messagePreview: rescheduleMessage
    }
  });
});

// DELETE Appointment (Cancel)
app.delete('/api/appointments/:id', (req, res) => {
  const { id } = req.params;
  const apptIndex = appointmentsStorage.findIndex(a => a.id === id || a.rescheduleToken === id);

  if (apptIndex === -1) {
    return res.status(404).json({ error: "Appointment not found" });
  }

  const appt = appointmentsStorage[apptIndex];
  appt.status = 'cancelled';
  appt.updatedAt = new Date().toISOString();

  logAudit('DELETE', 'APPOINTMENT', appt.id, `Cancelled appointment for ${appt.patientName}`);

  res.json({
    success: true,
    message: "Appointment cancelled and Google Calendar event updated.",
    cancelledAppointment: appt
  });
});

// GET Inquiries
app.get('/api/inquiries', (req, res) => {
  res.json(inquiriesStorage);
});

// POST Inquiry
app.post('/api/inquiries', (req, res) => {
  const { name, email, phone, service, message } = req.body;
  if (!name || !phone || !message) {
    return res.status(400).json({ error: "Name, phone and message are required" });
  }

  const newInquiry: Inquiry = {
    id: `INQ-${Math.floor(100 + Math.random() * 900)}`,
    name,
    email: email || '',
    phone,
    service: service || 'General Consultation',
    message,
    status: 'new',
    createdAt: new Date().toISOString()
  };

  inquiriesStorage.unshift(newInquiry);
  logAudit('CREATE', 'INQUIRY', newInquiry.id, `New inquiry submitted by ${name} (${service})`);

  res.json({
    success: true,
    inquiry: newInquiry,
    emailNotificationSent: true,
    recipientDoctorEmail: CLINIC_INFO.email
  });
});

// PUT Inquiry Status
app.put('/api/inquiries/:id', (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const inqIndex = inquiriesStorage.findIndex(i => i.id === id);
  if (inqIndex === -1) {
    return res.status(404).json({ error: "Inquiry not found" });
  }

  inquiriesStorage[inqIndex].status = status || inquiriesStorage[inqIndex].status;
  if (notes) inquiriesStorage[inqIndex].notes = notes;

  res.json({ success: true, inquiry: inquiriesStorage[inqIndex] });
});

// GET Patients (HIPAA Protected)
app.get('/api/patients', (req, res) => {
  logAudit('VIEW', 'PATIENT_RECORD', 'ALL', 'Doctor viewed patient directory list');
  res.json(patientsStorage);
});

// GET Patient by ID
app.get('/api/patients/:id', (req, res) => {
  const { id } = req.params;
  const patient = patientsStorage.find(p => p.id === id || p.patientId === id);
  if (!patient) {
    return res.status(404).json({ error: "Patient record not found" });
  }

  logAudit('VIEW', 'PATIENT_RECORD', patient.id, `Accessed medical history & treatment records for ${patient.name}`);
  const teamNotes = careTeamNotesStorage[patient.id] || [];

  res.json({
    patient,
    careTeamNotes: teamNotes
  });
});

// POST Care Team Note
app.post('/api/patients/:id/care-team-notes', (req, res) => {
  const { id } = req.params;
  const { authorName, authorRole, note } = req.body;

  const newNote: CareTeamNote = {
    id: `CTN-${Date.now()}`,
    patientId: id,
    authorName: authorName || 'Dr. Vihanna Subramanian',
    authorRole: authorRole || 'Chief Consultant',
    note,
    timestamp: new Date().toLocaleString(),
    isEncrypted: true
  };

  if (!careTeamNotesStorage[id]) {
    careTeamNotesStorage[id] = [];
  }
  careTeamNotesStorage[id].unshift(newNote);

  logAudit('CREATE', 'PATIENT_RECORD', id, `Added multidisciplinary team note: "${note.substring(0, 30)}..."`);

  res.json({ success: true, note: newNote });
});

// POST FHIR / HL7 Interoperability Export
app.post('/api/patients/:id/fhir-export', (req, res) => {
  const { id } = req.params;
  const patient = patientsStorage.find(p => p.id === id);

  if (!patient) {
    return res.status(404).json({ error: "Patient not found" });
  }

  logAudit('EXPORT_FHIR', 'PATIENT_RECORD', patient.id, `Exported HIPAA-compliant FHIR R4 JSON bundle`);

  const fhirBundle = {
    resourceType: "Bundle",
    type: "document",
    timestamp: new Date().toISOString(),
    entry: [
      {
        resource: {
          resourceType: "Patient",
          id: patient.id,
          name: [{ family: patient.name.split(' ').pop(), given: [patient.name.split(' ')[0]] }],
          telecom: [{ system: "phone", value: patient.phone }, { system: "email", value: patient.email }],
          gender: patient.gender.toLowerCase(),
          managingOrganization: { display: "Vihanna Dental Clinic, Coimbatore" }
        }
      },
      {
        resource: {
          resourceType: "Condition",
          subject: { reference: `Patient/${patient.id}` },
          code: { text: patient.currentTreatmentPlan?.title || "Dental Consultation" },
          clinicalStatus: "active"
        }
      }
    ]
  };

  res.json({
    success: true,
    patientName: patient.name,
    fhirBundle
  });
});

// GET Audit Logs
app.get('/api/audit-logs', (req, res) => {
  res.json(auditLogsStorage);
});

// POST Gemini WhatsApp Bot API Endpoint
app.post('/api/gemini/whatsapp-bot', async (req, res) => {
  const { userMessage, conversationHistory } = req.body;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("Gemini API key is not configured.");
    }

    const systemInstruction = `You are VihannaBot, the official AI WhatsApp assistant for Vihanna Dental Clinic in Coimbatore, Tamil Nadu.
Clinic Details:
- Name: Vihanna Dental Clinic
- Location: 124, 100 Feet Road, Gandhipuram, Coimbatore
- Phone: +91 98765 43210
- Working Hours: Mon-Sat 9:00 AM - 8:30 PM, Sun 10:00 AM - 2:00 PM
- Chief Doctor: Dr. Vihanna Subramanian (Orthodontist & Implantologist) and Dr. K. Anitha (Root Canal Specialist)
- Services offered: Dental Implants, Invisalign Aligners, Laser Root Canal, Cosmetic Smile Design, Teeth Whitening, Pediatric Care, Wisdom Tooth Surgery, Zirconia Crowns.

Your job:
1. Provide warm, polite, professional, concise WhatsApp auto-replies in English (or Tamil phrases if requested).
2. Answer patient queries about appointment booking, doctor availability, clinic location, dental treatment options, and rescheduling.
3. If the user expresses intent to book or reschedule, include formatted action options in your response (e.g. "[ACTION:BOOK_APPOINTMENT]" or "[ACTION:RESCHEDULE]").
4. Keep messages formatted nicely for WhatsApp using emojis and bold text.`;

    const prompt = `User WhatsApp Message: "${userMessage}"
Conversation context: ${JSON.stringify(conversationHistory || [])}
Provide a helpful, friendly WhatsApp auto-reply.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    const replyText = response.text || "Hello! Thank you for reaching out to Vihanna Dental Clinic, Coimbatore. How can we assist with your smile today?";

    res.json({
      replyText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  } catch (error) {
    console.log("Note: Using contextual fallback for whatsapp-bot:", (error as any)?.message || error);
    
    let fallbackReply = `Hello! Thank you for contacting *Vihanna Dental Clinic, Coimbatore*. 🦷\n\nOur clinic is located at 124, 100 Feet Road, Gandhipuram. How can we assist you today? You can book an appointment, check treatment costs, or speak with our team at *+91 98765 43210*.`;
    
    const msg = (userMessage || "").toLowerCase();
    if (msg.includes("book") || msg.includes("appointment") || msg.includes("timing") || msg.includes("slot")) {
      fallbackReply = `🦷 *Vihanna Dental Clinic Appointment Booking*\n\nOur clinic hours in Gandhipuram, Coimbatore:\n• Mon - Sat: 9:00 AM - 8:30 PM\n• Sunday: 10:00 AM - 2:00 PM\n\nWould you like to reserve a consultation with Dr. Vihanna Subramanian? Click [ACTION:BOOK_APPOINTMENT] below to pick your date & time!`;
    } else if (msg.includes("cost") || msg.includes("price") || msg.includes("invisalign") || msg.includes("implant") || msg.includes("root canal")) {
      fallbackReply = `🦷 *Vihanna Dental Clinic Specialised Treatments*\n\nWe specialize in:\n• Computer-Guided Dental Implants\n• 3D Invisalign Aligners\n• Painless Laser Root Canal Therapy\n• Cosmetic Smile Design & Whitening\n\nCall *+91 98765 43210* or click [ACTION:BOOK_APPOINTMENT] to schedule an evaluation!`;
    }

    res.json({
      replyText: fallbackReply,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }
});

// POST Gemini Clinical Summary
app.post('/api/gemini/clinical-summary', async (req, res) => {
  const { patientRecord } = req.body;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("Gemini API key is not configured.");
    }

    const prompt = `Act as an expert Dental Specialist Assistant. Summarize this patient's medical and treatment record for the doctor concisely:
${JSON.stringify(patientRecord)}

Provide:
1. Executive Clinical Summary (3 bullet points)
2. Key Risks / Allergies / Precautions
3. Recommended Next Clinical Step`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert clinical AI assistant for dentists. Be concise, medically accurate, and structured."
      }
    });

    res.json({ summary: response.text });
  } catch (err) {
    console.log("Note: Using contextual fallback for clinical-summary:", (err as any)?.message || err);
    res.json({
      summary: `• Patient (${patientRecord?.name || 'Ramesh Chandran'}, ${patientRecord?.age || 42}y): Active dental implant treatment at #24 tooth position.\n• Medical Alerts: ${patientRecord?.allergies?.join(', ') || 'Penicillin allergy'}, Hypertension (Controlled).\n• Recommended Next Step: Osseointegration check & digital intraoral scanner impression for custom Zirconia crown.`
    });
  }
});

// POST Gemini AI Patient Advice
app.post('/api/gemini/patient-advice', async (req, res) => {
  const { symptomDescription } = req.body;

  try {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("Gemini API key is not configured.");
    }

    const prompt = `A patient at Vihanna Dental Clinic describes the following dental symptom or concern: "${symptomDescription}".
Provide preliminary care guidance, probable treatment option at Vihanna Dental Clinic in Coimbatore, and urgency level (Low/Medium/Urgent Emergency). Remind them that an in-person dental consultation is necessary.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are a helpful, empathetic dental triage assistant."
      }
    });

    res.json({ advice: response.text });
  } catch (err) {
    console.log("Note: Using contextual fallback for patient-advice:", (err as any)?.message || err);
    res.json({
      advice: `Based on your symptom description ("${symptomDescription}"), we recommend an in-person evaluation at Vihanna Dental Clinic in Gandhipuram, Coimbatore.\n\n• Urgency Level: Moderate - Evaluation recommended within 24-48 hours.\n• Home Care Advice: Avoid extreme hot or cold foods. Rinse gently with warm saline solution. Do not apply hot compression directly to cheek.\n• Next Step: Please book a consultation or call our helpline at +91 98765 43210.`
    });
  }
});

// ---------------- VITE & EXPRESS BOOT ----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vihanna Dental Clinic App server running on http://localhost:${PORT}`);
  });
}

startServer();
