import { ClinicInfo, DentalService, Doctor, ConsultantDoctor, GalleryItem, Review, PatientRecord, AuditLog, SlotUnavailableReason } from '../types';

const vihanaDoctor = '/images/Dr.Sanchana.jpeg';
const vihanaOperatory = '/images/vihana_operatory_1784918541912.jpg';
const vihanaExteriorSign = '/images/vihana_exterior_sign_1784919394277.jpg';
const drSanchanaConsultation = '/images/dr_sanchana_consultation_1784919412452.jpg';
const vihanaDentalCamp = '/images/vihana_dental_camp_1784919430609.jpg';
const invisalignBoxes = '/images/invisalign_aligners_boxes_1784919447537.jpg';
const rootCanalCapTransformation = '/images/root_canal_cap_transformation_1784919469961.jpg';

// Service custom images
const implantsServiceImg = '/images/dental_implants_img_1784928139754.jpg';
const invisalignServiceImg = '/images/invisalign_aligners_img_1784928150711.jpg';
const rootCanalServiceImg = '/images/laser_root_canal_img_1784928162832.jpg';
const cosmeticSmileServiceImg = '/images/cosmetic_smile_img_1784928176731.jpg';
const teethWhiteningServiceImg = '/images/teeth_whitening_img_1784928192826.jpg';
const pediatricServiceImg = '/images/pediatric_dental_img_1784928204990.jpg';
const wisdomToothServiceImg = '/images/wisdom_tooth_img_1784928216053.jpg';
const zirconiaBridgeServiceImg = '/images/zirconia_bridge_img_1784928230230.jpg';

// Braces service images
const metalBracesServiceImg = '/images/Metal%20Braces.jpeg';
const ceramicBracesServiceImg = '/images/Ceramic%20Braces.jpeg';
// WebP re-encode of the original PNG — 4.3MB down to ~65KB.
const damonBracesServiceImg = '/images/damon-q2-ultima.webp';
const normalBracesServiceImg = '/images/Normal%20Braces.jpeg';

// Gallery poster custom images
const wisdomImpactionPoster = '/images/wisdom_impaction_poster_1784958272384.jpg';
const pediatricOrthoPoster = '/images/pediatric_ortho_poster_1784958287471.jpg';
const completeDenturesPoster = '/images/complete_dentures_poster_1784958302667.jpg';
const jawAlignmentPoster = '/images/jaw_alignment_poster_1784958317051.jpg';
const preventiveHygienePoster = '/images/preventive_hygiene_poster_1784958328845.jpg';

export const CLINIC_INFO: ClinicInfo = {
  name: "Vihana Dental Care",
  tagline: "Advanced Dental Care & Smile Design Studio, Coimbatore",
  address: "No 77, Post Office Street, Kalapatti",
  city: "Coimbatore",
  state: "Tamil Nadu",
  pincode: "641048",
  phone: "+91 98943 17823",
  alternatePhone: "098943 17823",
  whatsapp: "+1 555 427 7090",
  email: "sanchunags@gmail.com",
  googleBusinessUrl: "https://share.google/DM4pZO0cneU667nxJ",
  rating: 4.9,
  totalReviews: 185,
  workingHours: {
    weekdays: "Monday - Saturday: 9:00 AM – 1:30 PM & 5:00 PM – 8:30 PM",
    sundays: "Sunday: 10:30 AM – 1:00 PM",
    emergency: "24/7 Emergency Care on Call"
  },
  location: {
    lat: 11.0772,
    lng: 77.0264
  }
};

// ---------------- Structured Working Hours ----------------
// Single source of truth for bookable windows, consumed by both the server
// (availability computation) and the client (rendering slot chips). Indexed
// by day-of-week: 0 = Sunday ... 6 = Saturday, matching Date#getUTCDay().
export interface TimeWindow {
  start: string; // "HH:mm", 24-hour
  end: string;
}

const WEEKDAY_WINDOWS: TimeWindow[] = [
  { start: '09:00', end: '13:30' },
  { start: '17:00', end: '20:30' }
];
const SUNDAY_WINDOWS: TimeWindow[] = [{ start: '10:30', end: '13:00' }];

export const WEEKLY_SCHEDULE: TimeWindow[][] = [
  SUNDAY_WINDOWS,   // Sun
  WEEKDAY_WINDOWS,  // Mon
  WEEKDAY_WINDOWS,  // Tue
  WEEKDAY_WINDOWS,  // Wed
  WEEKDAY_WINDOWS,  // Thu
  WEEKDAY_WINDOWS,  // Fri
  WEEKDAY_WINDOWS   // Sat
];

const SLOT_INTERVAL_MINUTES = 30;
const APPOINTMENT_DURATION_MINUTES = 30;

function formatSlotLabel(hours: number, minutes: number): string {
  const meridiem = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

/** Day-of-week (0=Sun) for a "YYYY-MM-DD" string, independent of server timezone. */
export function getWeekdayForDate(dateISO: string): number {
  return new Date(`${dateISO}T00:00:00Z`).getUTCDay();
}

/** Every bookable slot label for a given date, derived from WEEKLY_SCHEDULE. */
export function getTimeSlotsForDate(dateISO: string): string[] {
  const windows = WEEKLY_SCHEDULE[getWeekdayForDate(dateISO)] || [];
  const slots: string[] = [];

  for (const window of windows) {
    const [startH, startM] = window.start.split(':').map(Number);
    const [endH, endM] = window.end.split(':').map(Number);
    const windowStartMin = startH * 60 + startM;
    const windowEndMin = endH * 60 + endM;

    for (let t = windowStartMin; t + APPOINTMENT_DURATION_MINUTES <= windowEndMin; t += SLOT_INTERVAL_MINUTES) {
      slots.push(formatSlotLabel(Math.floor(t / 60), t % 60));
    }
  }

  return slots;
}

/**
 * True once a slot's start time has already passed. Uses the same local
 * Date-construction convention as parseSlotToISO in googleCalendar.ts (no
 * timezone library) so "now" and "slot time" are compared consistently with
 * how the rest of the booking system already reasons about clinic time.
 */
export function isSlotInPast(dateISO: string, timeSlot: string): boolean {
  const [time, meridiem] = timeSlot.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  const slotStart = new Date(`${dateISO}T00:00:00`);
  slotStart.setHours(hours, minutes, 0, 0);

  return slotStart.getTime() <= Date.now();
}

/**
 * Tooltip text for a slot chip that can't be booked. Shared by the website
 * modal and the chat widget so a lapsed slot never gets mislabelled as
 * "Already booked" in one place and "Passed" in the other.
 */
export function slotDisabledLabel(reason?: SlotUnavailableReason): string {
  if (reason === 'passed') return 'This time has passed — booking is closed for this slot';
  if (reason === 'blocked') return 'The doctor is unavailable at this time';
  return 'Already booked';
}

export const SERVICES: DentalService[] = [
  {
    id: "general-consultation",
    title: "General Consultation",
    category: "General",
    shortDescription: "A thorough dental checkup and consultation to diagnose issues and plan the right treatment.",
    fullDescription: "Not sure what you need? Start here. Dr. N. Sanchana examines your teeth and gums, reviews any concerns or symptoms, and recommends the right next steps — whether that's a simple filling, a specialist referral, or a full treatment plan. The starting point for most new patients.",
    image: drSanchanaConsultation,
    durationMinutes: 20,
    priceRange: "₹300 - ₹600",
    benefits: [
      "Full oral examination by Dr. N. Sanchana",
      "Clear, honest treatment recommendations",
      "No pressure to commit to treatment same-day",
      "Ideal first visit for new patients"
    ],
    procedures: [
      "Patient History & Symptom Review",
      "Visual & Instrument-Based Oral Exam",
      "Diagnosis & Treatment Plan Discussion",
      "Cost Estimate for Recommended Treatment"
    ],
    iconName: "Stethoscope"
  },
  {
    id: "dental-implants",
    title: "Dental Implants & Full Mouth Rehab",
    category: "Implants",
    shortDescription: "Permanent Swiss titanium tooth replacement with computer-guided keyhole placement.",
    fullDescription: "Our computer-guided dental implant procedures restore lost teeth with natural aesthetics, 100% biting efficiency, and lifetime stability. Using top Swiss titanium implants and 3D CBCT bone scans.",
    image: implantsServiceImg,
    durationMinutes: 45,
    priceRange: "₹22,000 - ₹45,000 per implant",
    benefits: [
      "Looks and functions like natural teeth",
      "Prevents jawbone loss and sagging",
      "Painless keyhole surgery with rapid recovery",
      "Lifetime warranty on implant posts"
    ],
    procedures: [
      "3D CBCT Bone Density Scan",
      "Virtual Implant Placement Planning",
      "Swiss Titanium Post Fixation",
      "Custom Zirconia Crown Fitting"
    ],
    iconName: "Tooth"
  },
  {
    id: "invisalign-aligners",
    title: "Invisalign & Clear Aligners",
    category: "Orthodontics",
    shortDescription: "Invisible, removable braces for teenagers & adults with 3D digital smile simulation.",
    fullDescription: "Straighten your teeth seamlessly without metallic wires. Custom 3D aligner trays designed with iTero digital scanner allow you to see your transformed smile before starting treatment.",
    image: invisalignServiceImg,
    durationMinutes: 30,
    priceRange: "₹45,000 - ₹1,50,000",
    benefits: [
      "100% Nearly invisible tray design",
      "Removable for effortless eating and brushing",
      "Shorter treatment duration than metal braces",
      "Custom 3D simulation preview"
    ],
    procedures: [
      "3D iTero Digital Intraoral Scan",
      "ClinCheck® AI Treatment Simulation",
      "Custom Aligner Tray Series Delivery",
      "Bi-weekly Progress Monitoring"
    ],
    iconName: "Smile"
  },
  {
    id: "laser-root-canal",
    title: "Laser & Microscopic Root Canal",
    category: "General",
    shortDescription: "Single-sitting painless root canal treatment guided by dental microscope and laser sterilisation.",
    fullDescription: "Save infected or severely painful teeth in a single comfortable 45-minute session. Microscopic endodontics ensures complete removal of bacteria with zero pain.",
    image: rootCanalServiceImg,
    durationMinutes: 45,
    priceRange: "₹4,500 - ₹8,500 per tooth",
    benefits: [
      "100% Painless single-sitting procedure",
      "Dental microscope precision for narrow canals",
      "Diode laser bio-sterilisation prevents re-infection",
      "Preserves original natural tooth structure"
    ],
    procedures: [
      "Digital Apex Locator Measurement",
      "Rotary Endodontic Cleaning",
      "Laser Cavity Sterilisation",
      "Bioceramic Gutta-Percha Sealing"
    ],
    iconName: "ShieldCheck"
  },
  {
    id: "cosmetic-smile-design",
    title: "Cosmetic Dentistry & Smile Makeover",
    category: "Cosmetic",
    shortDescription: "Porcelain veneers, teeth whitening, composite bonding, and digital smile design.",
    fullDescription: "Transform chipped, discolored, or gapped teeth into a confident celebrity smile. Customized facial proportions analysis ensures natural shade and shape.",
    image: cosmeticSmileServiceImg,
    durationMinutes: 60,
    priceRange: "₹8,000 - ₹35,000",
    benefits: [
      "Immediate visual transformation in 2 visits",
      "Stain-resistant ultra-thin porcelain veneers",
      "Harmonizes teeth with facial symmetry",
      "Long-lasting bright aesthetic enhancement"
    ],
    procedures: [
      "Digital Facial Aesthetics Mapping",
      "Diagnostic Wax-Up Mockup",
      "Enamel Prep & Veneer Bonding",
      "Polishing & Bite Verification"
    ],
    iconName: "Sparkles"
  },
  {
    id: "teeth-whitening",
    title: "Advanced Laser Teeth Whitening",
    category: "Cosmetic",
    shortDescription: "Painless 45-minute laser bleaching for 8-shade brighter teeth without tooth sensitivity.",
    fullDescription: "Remove deep tea, coffee, smoking, and age-related stains safely under expert supervision. Includes desensitizing shield for zero post-op sensitivity.",
    image: teethWhiteningServiceImg,
    durationMinutes: 45,
    priceRange: "₹6,000 - ₹12,000",
    benefits: [
      "Up to 8 shades lighter in 1 visit",
      "Safe light-activated formula protects enamel",
      "Ultrasonic scaling & stain polish included",
      "Long lasting results with home maintenance kit"
    ],
    procedures: [
      "Ultrasonic Tartar Scaling",
      "Gingival Barrier Application",
      "Laser Activation Gel Cycles (3x15 min)",
      "Remineralization Fluoride Shield"
    ],
    iconName: "Sun"
  },
  {
    id: "pediatric-dentistry",
    title: "Pediatric & Kids Dental Care",
    category: "Pediatric",
    shortDescription: "Gentle, anxiety-free dental care for infants, children, and teens in a playful environment.",
    fullDescription: "Our specialized child specialists ensure positive dental experiences. From cavity prevention sealants to painless filling and habit correction appliances.",
    image: pediatricServiceImg,
    durationMinutes: 30,
    priceRange: "₹1,200 - ₹4,500",
    benefits: [
      "Kid-friendly painless techniques",
      "Pit & fissure sealants for cavity prevention",
      "Habit breaking appliances (Thumb sucking/Tongue thrusting)",
      "Interactive oral hygiene education"
    ],
    procedures: [
      "Fun Dental Checkup & Tell-Show-Do Method",
      "Fluoride Varnish Shield",
      "Pit & Fissure Sealant",
      "Composite Tooth Fillings"
    ],
    iconName: "Heart"
  },
  {
    id: "wisdom-tooth-surgery",
    title: "Painless Wisdom Tooth Extraction",
    category: "Surgical",
    shortDescription: "Keyhole soft-tissue surgery for impacted wisdom teeth with quick healing PRF therapy.",
    fullDescription: "Expert surgical removal of painful, impacted or misaligned wisdom teeth under local anesthesia with platelet-rich fibrin (PRF) for rapid pain-free healing.",
    image: wisdomToothServiceImg,
    durationMinutes: 45,
    priceRange: "₹3,500 - ₹8,000 per tooth",
    benefits: [
      "Zero discomfort painless anesthesia",
      "Preserves adjacent molar roots",
      "PRF growth factor therapy for 2x faster recovery",
      "Dedicated post-op WhatsApp monitoring"
    ],
    procedures: [
      "Digital OPG Panoramic X-Ray",
      "Targeted Nerve Block Anesthesia",
      "Gentle Tooth Sectioning & Extraction",
      "Bio-suture & PRF Healing Gel"
    ],
    iconName: "Activity"
  },
  {
    id: "zirconia-crowns",
    title: "Zirconia Crowns & CAD/CAM Ceramic Bridges",
    category: "General",
    shortDescription: "Computer-milled metal-free zirconia crowns with 15-year replacement guarantee.",
    fullDescription: "High-strength, bio-compatible Zirconia crowns designed using CAD/CAM digital scanners for perfect margin fit, high translucency, and natural look.",
    image: zirconiaBridgeServiceImg,
    durationMinutes: 30,
    priceRange: "₹7,500 - ₹18,000 per crown",
    benefits: [
      "100% Metal-free, hyper-allergenic design",
      "15-year warranty card with serial tracking",
      "Extreme durability against heavy chewing",
      "Seamless match with adjacent natural shade"
    ],
    procedures: [
      "Digital Intraoral Scanner Prep",
      "3D CAD/CAM Computer Milling",
      "Custom Shade Matching under Clinic Lighting",
      "Bioceramic Resin Cementing"
    ],
    iconName: "Award"
  },
  {
    id: "metal-braces",
    title: "Metal Braces",
    category: "Orthodontics",
    shortDescription: "Traditional stainless-steel fixed braces offering reliable, budget-friendly correction for complex bite issues.",
    fullDescription: "Time-tested stainless-steel brackets and archwires that gradually reposition teeth for a well-aligned bite. A durable, cost-effective choice for children, teens, and adults with moderate to complex misalignment.",
    image: metalBracesServiceImg,
    durationMinutes: 30,
    priceRange: "₹25,000 - ₹50,000",
    benefits: [
      "Most affordable fixed orthodontic option",
      "Effective for complex bite and crowding cases",
      "Durable stainless-steel components",
      "Fun colored band options for kids & teens"
    ],
    procedures: [
      "Digital OPG X-Ray & Bite Assessment",
      "Bracket Bonding & Archwire Placement",
      "Monthly Wire Adjustment Visits",
      "Retainer Fitting Post-Treatment"
    ],
    iconName: "ShieldCheck"
  },
  {
    id: "ceramic-braces",
    title: "Ceramic Braces",
    category: "Orthodontics",
    shortDescription: "Tooth-colored, low-visibility fixed braces that blend with your natural smile while correcting alignment.",
    fullDescription: "Ceramic brackets matched to natural tooth shade deliver the same reliable correction as metal braces with a far more discreet, aesthetic appearance — ideal for image-conscious teens and adults.",
    image: ceramicBracesServiceImg,
    durationMinutes: 30,
    priceRange: "₹35,000 - ₹75,000",
    benefits: [
      "Tooth-colored, far less noticeable than metal",
      "Same predictable results as traditional braces",
      "Stain-resistant ceramic brackets",
      "Comfortable, smooth bracket design"
    ],
    procedures: [
      "Digital OPG X-Ray & Bite Assessment",
      "Ceramic Bracket Bonding & Archwire Placement",
      "Monthly Wire Adjustment Visits",
      "Retainer Fitting Post-Treatment"
    ],
    iconName: "Sparkles"
  },
  {
    id: "damon-braces",
    title: "Damon Braces (Q2 & Ultima)",
    category: "Orthodontics",
    shortDescription: "Advanced self-ligating braces system for faster, more comfortable correction with fewer clinic visits.",
    fullDescription: "Damon Q2 and Ultima self-ligating braces use a sliding mechanism instead of elastic ties, reducing friction and discomfort while enabling shorter treatment timelines and fewer adjustment appointments.",
    image: damonBracesServiceImg,
    durationMinutes: 45,
    priceRange: "₹70,000 - ₹1,20,000",
    benefits: [
      "Self-ligating design needs fewer tightening visits",
      "Lower friction for greater comfort",
      "Often shorter overall treatment duration",
      "Low-profile, sleek bracket design"
    ],
    procedures: [
      "Digital OPG X-Ray & Bite Assessment",
      "Damon Self-Ligating Bracket Bonding",
      "Sliding Archwire Placement",
      "Periodic Progress Review Visits"
    ],
    iconName: "Zap"
  },
  {
    id: "normal-braces",
    title: "Normal Braces",
    category: "Orthodontics",
    shortDescription: "Standard fixed braces treatment for everyday bite and spacing correction at an accessible cost.",
    fullDescription: "Our standard fixed braces protocol corrects common spacing, crowding, and bite issues with regular wire-tie brackets, offering dependable results for patients seeking a straightforward orthodontic solution.",
    image: normalBracesServiceImg,
    durationMinutes: 30,
    priceRange: "₹35,000 - ₹60,000",
    benefits: [
      "Accessible entry-level orthodontic option",
      "Reliable correction for common alignment issues",
      "Well-established, predictable technique",
      "Suitable for teens and adults"
    ],
    procedures: [
      "Digital OPG X-Ray & Bite Assessment",
      "Standard Bracket Bonding & Archwire Placement",
      "Monthly Wire Adjustment Visits",
      "Retainer Fitting Post-Treatment"
    ],
    iconName: "CheckCircle2"
  }
];

export const DOCTORS: Doctor[] = [
  {
    id: "doc-1",
    name: "Dr. N. Sanchana, M.D.S.",
    title: "Chief Consultant Orthodontist & Aligner Specialist",
    qualification: "MDS — Orthodontics & Dentofacial Orthopedics",
    specialization: "Invisalign & Clear Aligners, Jaw Bite Correction, Pediatric Braces & Smile Design",
    experienceYears: 5,
    photo: vihanaDoctor,
    bio: "Dr. N. Sanchana, MDS is the Lead Orthodontist and Founder at Vihana Dental Care, Kalapatti, Coimbatore. Specializing in advanced clear aligners, adult & pediatric braces, microscopic root canals, and gentle jaw alignment treatments. Received Special Training at Coimbatore Medical College, Coimbatore.",
    availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    ugInstitution: "Sri Ramakrishna Dental College and Hospital, Coimbatore",
    pgInstitution: "JKK Nattraja Dental College, Namakkal",
    externalTraining: ["Brava Lingual Braces Certified", "Invisalign Qualified", "RCT Certified"],
    bookable: true
  }
];

// Visiting specialists who consult at the clinic on a case-referral basis.
// Shown on the public Team page always; individually toggleable via
// `bookable` (defaults false here) to optionally also appear in the
// booking flows alongside lead doctors — see the `bookable` field's doc
// comment on ConsultantDoctor in src/types.ts.
export const CONSULTANT_DOCTORS: ConsultantDoctor[] = [
  {
    id: "consultant-saraaj-bhuvan",
    name: "Dr. R. Saraaj Bhuvan, M.D.S.",
    specialty: "Consultant Periodontist & Oral Implantologist",
    qualification: "BDS, MDS — Periodontics & Oral Implantology",
    bio: "An MDS specialist in Periodontics and Oral Implantology, focused on gum health and dental implants. Completed his BDS at Sri Ramakrishna Dental College and Hospital, Coimbatore, and later served there as a Lecturer in the Department of Periodontics.",
    photo: "/images/Dr.Saraaj%20Bhuvan.jpeg",
    ugInstitution: "Sri Ramakrishna Dental College and Hospital, Coimbatore",
    pgInstitution: "Sri Ramachandra Institute of Higher Education & Research",
    qualificationYear: "2012–2017",
    bookable: false
  },
  {
    id: "consultant-santhosh-babu",
    name: "Dr. Santhosh Babu, M.D.S.",
    specialty: "Consultant Oral & Maxillofacial Surgeon",
    qualification: "BDS, MDS — Oral & Maxillofacial Surgery",
    bio: "Consultant surgeon specializing in Oral & Maxillofacial Surgery, providing expert surgical care for complex extractions, impactions, and other oral surgical procedures at Vihana Dental Care.",
    photo: "/images/dr-santhosh-babu.webp", // WebP re-encode — 3.8MB down to ~45KB
    ugInstitution: "Sri Ramakrishna Dental College and Hospital, Coimbatore",
    pgInstitution: "CSI College of Dental Sciences and Research",
    bookable: false
  },
  {
    id: "consultant-kavimalar",
    name: "Dr. Kavimalar, M.D.S.",
    specialty: "Consultant Endodontist & Root Canal Specialist",
    qualification: "BDS, MDS — Endodontics",
    bio: "Consultant Endodontist and root canal specialist. Previously served as Senior Lecturer at Sri Ramakrishna Dental College & Hospital, Coimbatore.",
    photo: "/images/Dr.Kavimalar.jpeg",
    ugInstitution: "Sri Ramakrishna Dental College and Hospital, Coimbatore",
    pgInstitution: "M.S. Ramaiah Dental College and Hospital",
    bookable: false
  },
  {
    id: "consultant-sandhiya",
    name: "Dr. Sandhiya V, M.D.S.",
    specialty: "Consultant Pedodontist & Preventive Dentist",
    qualification: "BDS, MDS — Paedodontics & Preventive Dentistry",
    bio: "A Paediatric and Preventive Dentist with 8+ years of clinical experience in Coimbatore, specializing in children's dentistry — including child dental care, tongue-tie release, pulp treatments, and preventive oral care.",
    photo: "/images/Dr.Sandhiya.jpeg",
    ugInstitution: "Sri Ramakrishna Dental College and Hospital, Coimbatore",
    pgInstitution: "Annamalai Dental College",
    experienceYears: 8,
    bookable: false
  }
];

export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "g-ext",
    title: "Vihana Dental Care Exterior & Illuminated Signboard",
    category: "facilities",
    imageUrl: vihanaExteriorSign,
    caption: "Night view of Vihana Dental Care, Kalapatti, Coimbatore with glowing neon sign detailing Braces, Aligner, Root Canal, Implant & Smile Designing services."
  },
  {
    id: "g-doc-desk",
    title: "Dr. N. Sanchana Consultation Desk & Invisalign Suite",
    category: "facilities",
    imageUrl: drSanchanaConsultation,
    caption: "Dr. N. Sanchana MDS (Orthodontist) at her consultation desk with digital treatment planning tablet and Invisalign aligners."
  },
  {
    id: "g-aligners-stack",
    title: "Invisalign & Invisalign First Clear Aligners Suite",
    category: "facilities",
    imageUrl: invisalignBoxes,
    caption: "Official Invisalign and Invisalign First orthodontic aligners stack at Vihana Dental Care."
  },
  {
    id: "g-operatory-chair",
    title: "Modern Clinical Operatory & Dental Chair",
    category: "facilities",
    imageUrl: vihanaOperatory,
    caption: "Fully equipped ergonomic dental operatory with overhead LED lighting and computer-controlled dental unit."
  },
  {
    id: "g-camp",
    title: "Community Dental Checkup & Wheelchair Care Camp",
    category: "facilities",
    imageUrl: vihanaDentalCamp,
    caption: "Dr. N. Sanchana conducting outdoor community dental screening camps for wheelchair patients and local residents."
  },
  {
    id: "g-rc-cap",
    title: "Root Canal with Cap - Before & After Transformation",
    category: "smiles",
    imageUrl: rootCanalCapTransformation,
    caption: "Full restoration of a fractured front tooth with painless root canal therapy and a high-translucency ceramic crown cap."
  },
  {
    id: "g-p1",
    title: "Safe & Precise Wisdom Tooth Impaction Poster",
    category: "posters",
    imageUrl: wisdomImpactionPoster,
    caption: "Clinical poster explaining gentle wisdom tooth extraction and impaction surgery at Vihana Dental Care."
  },
  {
    id: "g-p2",
    title: "Clear Aligners - Invisible, Comfortable, Effective",
    category: "posters",
    imageUrl: invisalignServiceImg,
    caption: "No metal, no wires, no worries - advanced custom clear aligners for all ages."
  },
  {
    id: "g-p3",
    title: "Signs Your Child Might Need an Orthodontist",
    category: "posters",
    imageUrl: pediatricOrthoPoster,
    caption: "Pediatric orthodontic assessment guide highlighting early signs like thumb sucking, crowded teeth, overbite, and open bite."
  },
  {
    id: "g-p4",
    title: "Whiter Teeth, Brighter You - 1-Session Instant Results",
    category: "posters",
    imageUrl: teethWhiteningServiceImg,
    caption: "In-office teeth whitening transformation in just one 45-minute safe whitening session."
  },
  {
    id: "g-p5",
    title: "Complete Dentures - Comfortable Fit & Natural Look",
    category: "smiles",
    imageUrl: completeDenturesPoster,
    caption: "Full mouth rehabilitate with custom molded complete dentures for easy eating and natural aesthetics."
  },
  {
    id: "g-p6",
    title: "Jaw Alignment & Bite Correction Guide",
    category: "posters",
    imageUrl: jawAlignmentPoster,
    caption: "Advanced orthodontic bite correction for misaligned jaws, jaw pain relief, and facial aesthetics."
  },
  {
    id: "g-p7",
    title: "Preventive Dental Care & Hygiene Awareness",
    category: "posters",
    imageUrl: preventiveHygienePoster,
    caption: "Preventive checkups, painless dental scaling, and fluoride treatments to protect your smile."
  },
  {
    id: "g-p8",
    title: "Dental Implants - Permanent Replacement for Life",
    category: "posters",
    imageUrl: implantsServiceImg,
    caption: "Strong, durable titanium dental implants to restore missing teeth permanently."
  }
];

export const REVIEWS: Review[] = [
  {
    id: "r1",
    authorName: "THALA VISHNU",
    authorPhoto: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    relativeTimeDescription: "1 week ago",
    text: "Super service..drs and staff are too good...!!!",
    date: "2026-07-15",
    verifiedGoogle: true,
    clinicReply: "Thank you Vishnu sir for your kind words! We are glad to serve you."
  },
  {
    id: "r2",
    authorName: "dr silambu",
    authorPhoto: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    relativeTimeDescription: "2 weeks ago",
    text: "Nice experience and good treatment approach and explanation",
    date: "2026-07-10",
    verifiedGoogle: true,
    clinicReply: "Thank you Dr. Silambu! Your recommendation means a lot to our team."
  },
  {
    id: "r3",
    authorName: "Karthika Ramamoorthy",
    authorPhoto: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    relativeTimeDescription: "1 month ago",
    text: "Good service and friendly doctor",
    date: "2026-06-20",
    verifiedGoogle: true,
    clinicReply: "Thank you Karthika ma'am! Wish you a healthy, bright smile!"
  },
  {
    id: "r4",
    authorName: "Senthil Kumar",
    authorPhoto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150",
    rating: 5,
    relativeTimeDescription: "2 months ago",
    text: "Extremely satisfied with my dental treatment at Vihana Dental Care in Kalapatti! Dr. vihana explained the whole process clearly. Painless procedure and super clean clinic.",
    date: "2026-05-18",
    verifiedGoogle: true,
    clinicReply: "Thank you Senthil sir! We are delighted to hear about your positive experience."
  }
];

export const INITIAL_PATIENTS: PatientRecord[] = [
  {
    id: "P-10021",
    patientId: "P-10021",
    name: "Ramesh Chandran",
    age: 42,
    gender: "Male",
    phone: "+91 98421 88320",
    email: "ramesh.c@gmail.com",
    bloodGroup: "O+",
    medicalHistory: ["Hypertension (Controlled)", "No Known Diabetes"],
    allergies: ["Penicillin Allergy"],
    emergencyContact: {
      name: "Lakshmi Chandran",
      relationship: "Spouse",
      phone: "+91 98421 88321"
    },
    currentTreatmentPlan: {
      id: "TP-801",
      title: "Upper Left Quadrant Dental Implant & Zirconia Crown",
      startDate: "2026-07-01",
      estimatedCompletion: "2026-08-15",
      totalCost: 32000,
      paidAmount: 18000,
      steps: [
        {
          id: "s1",
          stepNumber: 1,
          title: "3D CBCT Scan & Bone Density Mapping",
          description: "Scan completed. Bone height verified at 12.4mm.",
          status: "completed",
          scheduledDate: "2026-07-01"
        },
        {
          id: "s2",
          stepNumber: 2,
          title: "Keyhole Swiss Implant Post Fixation",
          description: "4.1mm x 10mm implant post placed under local anesthesia.",
          status: "completed",
          scheduledDate: "2026-07-10"
        },
        {
          id: "s3",
          stepNumber: 3,
          title: "Osseointegration Check & Abutment Measurement",
          description: "Digital intraoral scan for custom zirconia crown.",
          status: "in-progress",
          scheduledDate: "2026-07-28"
        },
        {
          id: "s4",
          stepNumber: 4,
          title: "Final Zirconia Crown Cementation",
          description: "Occlusion verification & aesthetic shade matching.",
          status: "scheduled",
          scheduledDate: "2026-08-10"
        }
      ]
    },
    visits: [
      {
        id: "V-501",
        date: "2026-07-10",
        doctorName: "Dr. Sanchana",
        serviceName: "Dental Implant Surgery",
        diagnosis: "Edentulous space #24 due to trauma",
        treatmentGiven: "Surgical placement of Straumann Implant post. Cold compress advised.",
        prescription: "Tab. Augmentin 625mg BD x 5 days, Tab. Paracetamol 650mg TDS, Chlorhexidine mouthwash",
        cost: 18000,
        status: "Follow-up Needed",
        nextFollowUpDate: "2026-07-28"
      },
      {
        id: "V-480",
        date: "2026-07-01",
        doctorName: "Dr. Sanchana",
        serviceName: "Consultation & CBCT",
        diagnosis: "Missing Tooth #24",
        treatmentGiven: "Diagnostic CBCT 3D Scan & Implant Workup Plan",
        cost: 2000,
        status: "Completed"
      }
    ],
    caregiver: {
      name: "Lakshmi Chandran",
      phone: "+91 98421 88321",
      receiveAlerts: true
    },
    postOpStatus: {
      painLevel: 1,
      medicationTaken: true,
      lastUpdated: "2026-07-24 09:30 AM",
      notes: "Slight tightness around implant site, no bleeding. Pain level 1/10."
    }
  },
  {
    id: "P-10022",
    patientId: "P-10022",
    name: "Deepa Sundaram",
    age: 28,
    gender: "Female",
    phone: "+91 97890 12345",
    email: "deepa.sun@yahoo.com",
    bloodGroup: "B+",
    medicalHistory: ["None"],
    allergies: ["Nil"],
    emergencyContact: {
      name: "Sundaram V",
      relationship: "Father",
      phone: "+91 97890 12300"
    },
    currentTreatmentPlan: {
      id: "TP-802",
      title: "Invisalign Clear Aligners (18 Trays Series)",
      startDate: "2026-06-15",
      estimatedCompletion: "2026-12-20",
      totalCost: 85000,
      paidAmount: 45000,
      steps: [
        {
          id: "s21",
          stepNumber: 1,
          title: "iTero 3D Digital Scan & ClinCheck Approval",
          description: "Digital alignment plan generated.",
          status: "completed",
          scheduledDate: "2026-06-15"
        },
        {
          id: "s22",
          stepNumber: 2,
          title: "Tray Set 1-6 Handover & Attachments Bonding",
          description: "Attachments placed on teeth #12, #22, #33.",
          status: "completed",
          scheduledDate: "2026-06-25"
        },
        {
          id: "s23",
          stepNumber: 3,
          title: "Mid-Course Progress Review & Tray Set 7-12 Handover",
          description: "Checking tooth tracking & IPD spaces.",
          status: "scheduled",
          scheduledDate: "2026-08-05"
        }
      ]
    },
    visits: [
      {
        id: "V-492",
        date: "2026-06-25",
        doctorName: "Dr. Sanchana",
        serviceName: "Invisalign Tray Fitting",
        diagnosis: "Class I Malocclusion with mild anterior crowding",
        treatmentGiven: "Bonded composite attachments, handed Tray #1 to #6.",
        cost: 45000,
        status: "Completed",
        nextFollowUpDate: "2026-08-05"
      }
    ]
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: "AUD-9901",
    timestamp: "2026-07-24 10:15:22",
    userId: "DOC-001",
    userName: "Dr. Sanchana",
    userRole: "doctor",
    action: "VIEW",
    resourceType: "PATIENT_RECORD",
    resourceId: "P-10021",
    details: "Accessed patient Ramesh Chandran clinical history and CBCT radiograph",
    ipAddress: "117.201.42.18",
    encryptedHash: "a9f8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6"
  },
  {
    id: "AUD-9902",
    timestamp: "2026-07-24 10:30:05",
    userId: "DOC-001",
    userName: "Dr. Sanchana",
    userRole: "doctor",
    action: "UPDATE",
    resourceType: "TREATMENT_PLAN",
    resourceId: "TP-801",
    details: "Updated treatment step #2 status to completed for patient P-10021",
    ipAddress: "117.201.42.18",
    encryptedHash: "f1e2d3c4b5a69887766554433221100ffbbaaddeeff"
  },
  {
    id: "AUD-9903",
    timestamp: "2026-07-24 11:00:14",
    userId: "ADMIN-01",
    userName: "System Compliance Engine",
    userRole: "admin",
    action: "EXPORT_FHIR",
    resourceType: "PATIENT_RECORD",
    resourceId: "P-10022",
    details: "Generated encrypted FHIR R4 JSON bundle for interoperability export",
    ipAddress: "10.0.0.1",
    encryptedHash: "887766554433221100aabbccddeeff00112233445566"
  }
];