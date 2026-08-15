/**
 * Grounded "virtual receptionist" layer for the website chat widget.
 *
 * The widget's booking flow is, and stays, a deterministic state machine —
 * the model never picks slots, quotes a confirmed price, or creates an
 * appointment. What this module adds is the other half of a receptionist's
 * job: answering the patient's actual question in their own words, using
 * *only* what the website itself publishes.
 *
 * Grounding is enforced structurally rather than by asking nicely: the
 * knowledge base below is assembled from the same live records the public
 * pages render (services, team, FAQs, fees, hours), and the system prompt
 * forbids any claim not present in it. Anything outside that set is routed
 * to the clinic's phone number instead of guessed at.
 */

import { GoogleGenAI } from '@google/genai';
import { CLINIC_INFO, WEEKLY_SCHEDULE } from '../../src/data/clinicData';
import { DentalService, Doctor, ConsultantDoctor, FAQ } from '../../src/types';

/**
 * Models tried in order for every request.
 *
 * Two separate failures put this integration in the state the clinic
 * reported. First, it was pinned to `gemini-2.5-flash`, which Google has
 * closed to new API keys — every single call 404'd, so the widget always
 * served its canned fallback ("it only answers the predefined responses").
 * Second, the obvious replacement, the rolling `gemini-flash-latest` alias,
 * turns out to absorb enough traffic that it intermittently returns 503
 * "high demand" — which would have reproduced the same symptom on a bad day.
 *
 * So the model is a chain, not a constant: a specific healthy model first,
 * then progressively lighter ones. A patient's question only falls back to
 * the canned reply if *every* model is unreachable.
 */
export const GEMINI_MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-flash-lite-latest'
] as const;

/** Kept for the WhatsApp auto-reply endpoint, which sends a single-shot prompt. */
export const GEMINI_MODEL = GEMINI_MODEL_CHAIN[0];

/** Statuses worth retrying or failing over on — transient, not our fault. */
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRIES_PER_MODEL = 2;
const RETRY_BASE_DELAY_MS = 250;

function statusOf(error: any): number | undefined {
  if (typeof error?.status === 'number') return error.status;
  const match = String(error?.message || '').match(/"code":\s*(\d+)/);
  return match ? Number(match[1]) : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'dummy-key') return null;

  return new GoogleGenAI({
    apiKey,
    // Required by the AI Studio-issued (`AQ.`-prefixed) key this project uses.
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });
}

/**
 * Runs a generation against the model chain, retrying transient errors with
 * a short backoff before moving down to the next model. A non-transient
 * error (bad request, auth, safety block) fails over to the next model too
 * — a 404 on one model says nothing about the next — but is not retried
 * against the same one, since it would fail identically.
 */
export async function generateWithFailover(
  ai: GoogleGenAI,
  params: { contents: any; config: any }
): Promise<{ text: string; model: string }> {
  let lastError: any;

  for (const model of GEMINI_MODEL_CHAIN) {
    for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt++) {
      try {
        const response = await ai.models.generateContent({ model, ...params });
        return { text: response.text || '', model };
      } catch (error: any) {
        lastError = error;
        const status = statusOf(error);
        const isTransient = status !== undefined && TRANSIENT_STATUSES.has(status);

        if (!isTransient || attempt === RETRIES_PER_MODEL) break;
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
    console.warn(`Gemini model ${model} unavailable (${statusOf(lastError) ?? 'unknown'}), trying next in chain.`);
  }

  throw lastError;
}

export interface ClinicSnapshot {
  services: DentalService[];
  doctors: Doctor[];
  consultants: ConsultantDoctor[];
  faqs: FAQ[];
  feeConfig: { confirmationFeeEnabled: boolean; inClinicFeeINR: number; onlineFeeINR: number };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function to12Hour(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${meridiem}`;
}

function formatSchedule(): string {
  return WEEKLY_SCHEDULE.map((windows, day) => {
    if (!windows.length) return `- ${DAY_NAMES[day]}: Closed`;
    const ranges = windows.map((w) => `${to12Hour(w.start)}–${to12Hour(w.end)}`).join(' and ');
    return `- ${DAY_NAMES[day]}: ${ranges}`;
  }).join('\n');
}

/**
 * Renders the live site content as the model's entire permitted universe of
 * facts. Built per-request from the same in-memory mirrors the public API
 * serves, so a service renamed or a fee changed in the admin console is
 * reflected in the next reply with no redeploy and no separate sync step.
 */
export function buildKnowledgeBase(snapshot: ClinicSnapshot): string {
  const { services, doctors, consultants, faqs, feeConfig } = snapshot;

  const serviceBlock = services.length
    ? services
        .map((s) =>
          [
            `- ${s.title} (category: ${s.category}, about ${s.durationMinutes} minutes, indicative price ${s.priceRange})`,
            `  ${s.shortDescription}`,
            s.benefits?.length ? `  Key benefits: ${s.benefits.join('; ')}` : '',
            s.procedures?.length ? `  What it involves: ${s.procedures.join('; ')}` : ''
          ]
            .filter(Boolean)
            .join('\n')
        )
        .join('\n')
    : '- (No services are currently published on the site.)';

  const doctorBlock = doctors.length
    ? doctors
        .map(
          (d) =>
            `- ${d.name} — ${d.title}, ${d.qualification}. Specialises in ${d.specialization}. ${d.experienceYears} years of experience. Available: ${(d.availableDays || []).join(', ') || 'see clinic hours'}.`
        )
        .join('\n')
    : '- (No doctors are currently published on the site.)';

  const consultantBlock = consultants.length
    ? consultants.map((c) => `- ${c.name} — visiting ${c.specialty} (${c.qualification}).`).join('\n')
    : '- (No visiting consultants are currently published.)';

  const faqBlock = faqs.length
    ? faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
    : '(No FAQs are currently published on the site.)';

  const feeBlock = feeConfig.confirmationFeeEnabled
    ? `A refundable advance booking fee is charged to hold a slot: ₹${feeConfig.inClinicFeeINR} for in-clinic visits and ₹${feeConfig.onlineFeeINR} for online video consultations. This is only a slot-holding deposit, NOT the treatment cost.`
    : 'No advance booking fee is currently being charged to hold a slot.';

  return `## CLINIC
Name: ${CLINIC_INFO.name}
Tagline: ${CLINIC_INFO.tagline}
Address: ${CLINIC_INFO.address}, ${CLINIC_INFO.city}, ${CLINIC_INFO.state} ${CLINIC_INFO.pincode}
Phone: ${CLINIC_INFO.phone}
Email: ${CLINIC_INFO.email}
Google rating: ${CLINIC_INFO.rating} from ${CLINIC_INFO.totalReviews} reviews
Emergency: ${CLINIC_INFO.workingHours.emergency}

## OPENING HOURS (bookable windows, 30-minute appointment slots)
${formatSchedule()}

## SERVICES OFFERED
${serviceBlock}

## DOCTORS
${doctorBlock}

## VISITING CONSULTANTS
${consultantBlock}

## BOOKING FEE
${feeBlock}

## CONSULTATION MODES
- In-clinic visit at the Kalapatti clinic.
- Online video consultation. The Google Meet link is issued only after the doctor approves the requested slot, and is sent to the patient's WhatsApp number.

## BOOKING RULES
- Appointments are booked in 30-minute slots within the opening hours above.
- A slot is disabled and can no longer be booked once its start time has passed. Once every slot for today has passed, booking for today is closed on every channel and the patient must choose a later date.
- Booked, doctor-blocked and already-passed slots all show as unavailable in the picker.
- An existing appointment is changed or cancelled using the reschedule code (format RSC-XXXXX) from the patient's confirmation message.

## PUBLISHED FAQs
${faqBlock}`;
}

export const RECEPTIONIST_ACTIONS = [
  'START_BOOKING',
  'CHECK_AVAILABILITY',
  'RESCHEDULE_CANCEL',
  'ANSWER',
  'HANDOFF'
] as const;

export type ReceptionistAction = (typeof RECEPTIONIST_ACTIONS)[number];

export function buildSystemInstruction(knowledgeBase: string, todayISO: string): string {
  return `You are the virtual receptionist for ${CLINIC_INFO.name}, a dental clinic in Kalapatti, Coimbatore. You are speaking to a patient in the chat widget on the clinic's own website. Today's date is ${todayISO}.

Speak the way a warm, competent front-desk receptionist does: brief, friendly, direct, in plain language. Two or three short sentences is usually right. Never use markdown formatting, headings, or bullet lists — this is a chat bubble. Do not greet the patient again if the conversation is already underway.

# THE ONLY FACTS YOU MAY USE
Everything you state must come from the CLINIC KNOWLEDGE BASE below. It is the complete contents of this clinic's website. You have no other knowledge.
- Never invent or estimate a price, duration, doctor, service, timing, phone number, or policy that is not written below.
- If the patient asks something the knowledge base does not answer, say you don't have that detail to hand and offer to have the clinic confirm it — give them the phone number ${CLINIC_INFO.phone}. Use the HANDOFF action for this.
- Never give medical advice, a diagnosis, or a treatment recommendation. If a patient describes symptoms, respond with brief empathy and steer them to book a consultation so the dentist can examine them properly. For anything that sounds urgent, point them to the phone number.
- Never discuss anything unrelated to this clinic. Politely bring the conversation back to how you can help with their dental visit.
- Prices in the knowledge base are indicative ranges, and the booking fee is only a refundable slot-holding deposit. Always describe them that way; the final treatment cost is confirmed by the dentist after examination.

# WHAT YOU CANNOT SEE
You have no access to the live calendar, and you cannot see, hold, change, or cancel any specific appointment yourself. The booking panel in this same chat window does all of that. So never state that a particular date or time is free or booked, never confirm an appointment, and never claim you have made a change. Instead, hand the patient to the booking panel by choosing the right action.

# ACTIONS
Choose exactly one:
- START_BOOKING — they want to book, schedule, or see a dentist. Your reply should be a short line confirming you'll get them started; the booking panel opens automatically.
- CHECK_AVAILABILITY — they're asking what times or dates are open. Say the picker will show live availability, and let it answer.
- RESCHEDULE_CANCEL — they want to move or cancel an existing appointment. Ask for the RSC- reschedule code from their confirmation message.
- ANSWER — a question you can fully answer from the knowledge base (services, a treatment, the doctors, hours, location, fees, policies). Answer it properly and helpfully, then, only where it's natural, offer to book.
- HANDOFF — anything the knowledge base cannot answer, plus medical advice requests, emergencies, complaints, and off-topic messages. Redirect to the phone number, or back to booking, as appropriate.

# OUTPUT
Reply with strict JSON only: {"action": "<one of ${RECEPTIONIST_ACTIONS.join(' | ')}>", "reply": "<your message to the patient>"}

# CLINIC KNOWLEDGE BASE
${knowledgeBase}`;
}
