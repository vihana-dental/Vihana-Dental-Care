import type { FAQ } from '../types';

// The site's original FAQ copy, used as the initial render before /api/faqs
// (Supabase-backed — see server/services/faqs.ts) loads, and as the fallback
// if that fetch fails. Shared by the home page and the service landing pages.
export const STATIC_FAQS: FAQ[] = [
  {
    id: 'static-1', order: 1,
    question: 'Do you offer painless root canals in Kalapatti?',
    answer: 'Yes, Vihana Dental Care provides 100% painless root canals in Kalapatti using computer-controlled local anesthesia and advanced microscopic laser technology to ensure complete patient comfort.'
  },
  {
    id: 'static-2', order: 2,
    question: 'What is the cost of dental implants in Coimbatore?',
    answer: 'The cost of computer-guided dental implants at Vihana Dental Care ranges from ₹22,000 to ₹45,000 per implant, utilizing premium titanium posts for lifetime durability.'
  },
  {
    id: 'static-3', order: 3,
    question: 'How long does an Invisalign treatment take?',
    answer: 'Invisalign clear aligner treatments typically take between 6 to 18 months depending on case complexity. We use 3D iTero scanners to provide exact timelines during your first consultation.'
  },
  {
    id: 'static-4', order: 4,
    question: 'Is teeth whitening safe for enamel?',
    answer: 'Absolutely. Our advanced laser teeth whitening procedure is completely safe for enamel. It removes deep stains without causing structural damage or long-term sensitivity.'
  },
  {
    id: 'static-5', order: 5,
    question: 'Why do I need X-rays?',
    answer: "Digital X-rays let us see what a visual exam alone can't — cavities forming between teeth, bone loss around the roots, or early-stage infections. Catching these early usually means simpler, less invasive treatment than waiting until they cause pain."
  }
];
