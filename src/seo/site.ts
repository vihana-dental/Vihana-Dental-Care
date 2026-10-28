/**
 * Route table, copy and structured data for the server-rendered pages
 * (service landing pages, blog, contact). Shared by the server (which renders
 * the HTML and head tags) and the client (which hydrates it), so both always
 * agree on what a page says.
 *
 * Nothing here invents clinic facts: every page is assembled from the live
 * service catalog, FAQ list, team data and clinic details the site already
 * shows. The only new copy is page titles, descriptions and H1s.
 */

import { CLINIC_INFO } from '../data/clinicData';
import { STATIC_FAQS } from '../data/staticFaqs';
import type { DentalService, FAQ, Doctor, ConsultantDoctor } from '../types';

export const SITE_URL = 'https://vihanadental.in';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/images/vihana_exterior_sign_1784919394277.jpg`;
/** Stable @id so page-level schema can point back at the clinic entity. */
export const CLINIC_ID = `${SITE_URL}/#clinic`;

export interface BlogPostLite {
  id: string;
  slug: string;
  title: string;
  content: string;
  author: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

/** Everything a page needs to render, serialised into the HTML for hydration. */
export interface PageData {
  path: string;
  services: DentalService[];
  faqs: FAQ[];
  doctors: Doctor[];
  consultants: ConsultantDoctor[];
  posts: BlogPostLite[];
  post?: BlogPostLite;
}

export interface ServicePageDef {
  kind: 'service';
  path: string;
  /** Service ids from the live catalog that this page covers. */
  serviceIds: string[];
  title: string;
  description: string;
  h1: string;
  eyebrow: string;
  /** Short label for nav/footer/"related" links. */
  navLabel: string;
  /** How the treatment is named inside FAQ questions ("Invisalign", "dental implants"). */
  shortName: string;
  /** Existing site FAQs (matched by question text) reused verbatim. */
  faqMatch: RegExp[];
  /** Team members shown on the page, by id (lead doctors or consultants). */
  specialistIds: string[];
  /** Existing gallery photos shown on the page. */
  photos: { src: string; alt: string; caption: string }[];
}

export const SERVICE_PAGES: ServicePageDef[] = [
  {
    kind: 'service',
    path: '/invisalign-coimbatore',
    serviceIds: ['invisalign-aligners'],
    title: 'Invisalign & Clear Aligners in Coimbatore (Kalapatti) | Vihana Dental Care',
    description:
      'Invisalign and clear aligners at Vihana Dental Care, Kalapatti, Coimbatore, with Dr. N. Sanchana, MDS (Orthodontics). See the process, pricing and book an appointment.',
    h1: 'Invisalign & Clear Aligners in Coimbatore (Kalapatti)',
    eyebrow: 'Orthodontics · Clear Aligners',
    navLabel: 'Invisalign & Clear Aligners',
    shortName: 'Invisalign',
    faqMatch: [/invisalign/i],
    specialistIds: ['doc-1'],
    photos: [
      { src: '/images/invisalign_aligners_boxes_1784919447537.jpg', alt: 'Invisalign aligner boxes at the Vihana Dental Care aligner suite in Kalapatti', caption: 'Invisalign & Invisalign First Clear Aligners Suite' },
      { src: '/images/dr_sanchana_consultation_1784919412452.jpg', alt: 'Dr. N. Sanchana at her consultation desk at Vihana Dental Care', caption: 'Dr. N. Sanchana Consultation Desk & Invisalign Suite' }
    ]
  },
  {
    kind: 'service',
    path: '/dental-implants-coimbatore',
    serviceIds: ['dental-implants'],
    title: 'Dental Implants in Coimbatore (Kalapatti) | Vihana Dental Care',
    description:
      'Dental implants and full mouth rehab at Vihana Dental Care, Kalapatti, Coimbatore: computer-guided keyhole placement with 3D CBCT planning. See the steps and book a consultation.',
    h1: 'Dental Implants in Coimbatore (Kalapatti)',
    eyebrow: 'Implants · Full Mouth Rehab',
    navLabel: 'Dental Implants',
    shortName: 'dental implants',
    // The existing implant-cost FAQ quotes a different price from the service
    // card, so it is deliberately not repeated here — see CONTENT_REVIEW.md.
    faqMatch: [],
    specialistIds: ['consultant-saraaj-bhuvan'],
    photos: []
  },
  {
    kind: 'service',
    path: '/root-canal-treatment-coimbatore',
    serviceIds: ['laser-root-canal'],
    title: 'Root Canal Treatment in Coimbatore (Kalapatti) | Vihana Dental Care',
    description:
      'Laser and microscopic root canal treatment at Vihana Dental Care, Kalapatti, Coimbatore. See how the procedure works, the price range and book an appointment.',
    h1: 'Root Canal Treatment in Coimbatore (Kalapatti)',
    eyebrow: 'Endodontics · Root Canal',
    navLabel: 'Root Canal Treatment',
    shortName: 'root canal treatment',
    faqMatch: [/root canal/i],
    specialistIds: ['consultant-kavimalar'],
    photos: [
      { src: '/images/root_canal_cap_transformation_1784919469961.jpg', alt: 'Root canal with cap, before and after, at Vihana Dental Care', caption: 'Root Canal with Cap - Before & After Transformation' }
    ]
  },
  {
    kind: 'service',
    path: '/braces-coimbatore',
    serviceIds: ['metal-braces', 'ceramic-braces', 'damon-braces', 'normal-braces'],
    title: 'Braces in Coimbatore: Metal, Ceramic & Damon | Vihana Dental Care',
    description:
      'Metal, ceramic and Damon braces at Vihana Dental Care, Kalapatti, Coimbatore. Compare the options, see the price ranges and book an orthodontic consultation.',
    h1: 'Braces in Coimbatore: Metal, Ceramic & Damon Braces',
    eyebrow: 'Orthodontics · Braces',
    navLabel: 'Braces (Metal, Ceramic, Damon)',
    shortName: 'braces',
    faqMatch: [],
    specialistIds: ['doc-1'],
    photos: []
  },
  {
    kind: 'service',
    path: '/teeth-whitening-coimbatore',
    serviceIds: ['teeth-whitening'],
    title: 'Teeth Whitening in Coimbatore (Kalapatti) | Vihana Dental Care',
    description:
      'Advanced laser teeth whitening at Vihana Dental Care, Kalapatti, Coimbatore. See the steps, the price range and book an appointment.',
    h1: 'Teeth Whitening in Coimbatore (Kalapatti)',
    eyebrow: 'Cosmetic Dentistry · Whitening',
    navLabel: 'Teeth Whitening',
    shortName: 'teeth whitening',
    faqMatch: [/whitening/i],
    specialistIds: [],
    photos: []
  },
  {
    kind: 'service',
    path: '/kids-dentist-coimbatore',
    serviceIds: ['pediatric-dentistry'],
    title: 'Kids Dentist in Coimbatore (Kalapatti) | Vihana Dental Care',
    description:
      'Pediatric and kids dental care at Vihana Dental Care, Kalapatti, Coimbatore. See what the visit includes, the price range and book an appointment for your child.',
    h1: 'Kids Dentist in Coimbatore (Kalapatti)',
    eyebrow: 'Pediatric Dentistry',
    navLabel: 'Kids Dentist',
    shortName: 'kids dental care',
    faqMatch: [],
    specialistIds: ['consultant-sandhiya'],
    photos: []
  }
];

export const BLOG_INDEX = {
  path: '/blog',
  title: 'Dental Blog | Vihana Dental Care, Kalapatti, Coimbatore',
  description:
    'Tips, treatment explainers and updates written by Dr. N. Sanchana and the Vihana Dental Care team in Kalapatti, Coimbatore.',
  h1: 'Dental Health, Explained.'
};

export const CONTACT_PAGE = {
  path: '/contact',
  title: 'Contact & Location | Vihana Dental Care, Kalapatti, Coimbatore',
  description:
    'Visit Vihana Dental Care at No 77, Post Office Street, Kalapatti, Coimbatore 641048. Call, get directions, send an enquiry or book an appointment.',
  h1: 'Contact Vihana Dental Care in Kalapatti, Coimbatore'
};

export type ResolvedPage =
  | { kind: 'service'; def: ServicePageDef }
  | { kind: 'blog-index' }
  | { kind: 'blog-post'; slug: string }
  | { kind: 'contact' };

/** Maps a URL path to the page it should render, or null if it isn't one of ours. */
export function resolvePage(pathname: string): ResolvedPage | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const service = SERVICE_PAGES.find((p) => p.path === clean);
  if (service) return { kind: 'service', def: service };
  if (clean === BLOG_INDEX.path) return { kind: 'blog-index' };
  if (clean === CONTACT_PAGE.path) return { kind: 'contact' };
  const post = /^\/blog\/([^/]+)$/.exec(clean);
  if (post) return { kind: 'blog-post', slug: decodeURIComponent(post[1]) };
  return null;
}

/** The dedicated landing page for a service, if it has one. */
export function servicePagePath(serviceId: string): string | undefined {
  return SERVICE_PAGES.find((p) => p.serviceIds.includes(serviceId))?.path;
}

/** Every static path that should appear in the sitemap (blog posts are added dynamically). */
export const STATIC_SITEMAP_PATHS: { path: string; changefreq: string; priority: string }[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  ...SERVICE_PAGES.map((p) => ({ path: p.path, changefreq: 'monthly', priority: '0.8' })),
  { path: '/blog', changefreq: 'weekly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/privacy-policy.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms-of-service.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/refund-cancellation-policy.html', changefreq: 'yearly', priority: '0.3' },
  { path: '/data-deletion.html', changefreq: 'yearly', priority: '0.3' }
];

export function buildSitemap(posts: { slug: string; updatedAt?: string }[]): string {
  const entry = (loc: string, changefreq: string, priority: string, lastmod?: string) =>
    `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod.slice(0, 10)}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  const urls = [
    ...STATIC_SITEMAP_PATHS.map((u) => entry(`${SITE_URL}${u.path === '/' ? '/' : u.path}`, u.changefreq, u.priority)),
    ...posts.map((p) => entry(`${SITE_URL}/blog/${encodeURIComponent(p.slug)}`, 'monthly', '0.6', p.updatedAt))
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

// ---------------- Copy helpers ----------------

/** Service titles are doctor-editable; this repairs a known typo ("Dentisttry")
 *  at display time so it never reaches a heading or image alt text. */
export function fixCopy(text: string): string {
  return text.replace(/Dentisttry/g, 'Dentistry');
}

/** "₹45,000 - ₹3,50,000" -> { min: 45000, max: 350000 }, or null if it doesn't parse. */
export function parsePriceRange(range: string): { min: number; max: number } | null {
  const m = /₹\s*([\d,]+)\s*[-–]\s*₹\s*([\d,]+)/.exec(range);
  if (!m) return null;
  const min = Number(m[1].replace(/,/g, ''));
  const max = Number(m[2].replace(/,/g, ''));
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

export function pageServices(def: ServicePageDef, data: PageData): DentalService[] {
  return def.serviceIds
    .map((id) => data.services.find((s) => s.id === id))
    .filter((s): s is DentalService => Boolean(s));
}

export function pageSpecialists(def: ServicePageDef, data: PageData): (Doctor | ConsultantDoctor)[] {
  const all: (Doctor | ConsultantDoctor)[] = [...data.doctors, ...data.consultants];
  return def.specialistIds
    .map((id) => all.find((p) => p.id === id))
    .filter((p): p is Doctor | ConsultantDoctor => Boolean(p));
}

export function hoursText(): string {
  return `${CLINIC_INFO.workingHours.weekdays}; ${CLINIC_INFO.workingHours.sundays}`;
}

export function addressText(): string {
  return `${CLINIC_INFO.address}, ${CLINIC_INFO.city}, ${CLINIC_INFO.state} ${CLINIC_INFO.pincode}`;
}

/**
 * The FAQ shown on a service page. Both the visible list and the FAQPage
 * schema are built from this one function, so the markup can never describe a
 * question the page doesn't show. Answers are the site's existing FAQ answers
 * or restate the service data already on the page.
 */
export function buildServiceFaqs(def: ServicePageDef, data: PageData): { question: string; answer: string }[] {
  const services = pageServices(def, data);
  const primary = services[0];
  const out: { question: string; answer: string }[] = [];

  const known = data.faqs.length > 0 ? data.faqs : STATIC_FAQS;
  for (const re of def.faqMatch) {
    const hit = known.find((f) => re.test(f.question));
    if (hit) out.push({ question: hit.question, answer: hit.answer });
  }

  if (def.path === '/invisalign-coimbatore') {
    const doctor = data.doctors.find((d) => d.id === 'doc-1');
    if (doctor) {
      const invisalign = (doctor.externalTraining || []).find((t) => /invisalign/i.test(t));
      out.push({
        question: 'Who plans Invisalign treatment at Vihana Dental Care?',
        answer: `${doctor.name} (${doctor.qualification}) leads clear aligner treatment at Vihana Dental Care in Kalapatti, Coimbatore${invisalign ? ` and is listed as "${invisalign}"` : ''}.`
      });
    }
  }

  if (primary && services.length === 1) {
    if (primary.procedures.length > 0) {
      out.push({
        question: `What does ${def.shortName} involve at Vihana Dental Care?`,
        answer: `The steps are: ${primary.procedures.map(fixCopy).join('; ')}.`
      });
    }
    out.push({
      question: `How much does ${def.shortName} cost at Vihana Dental Care?`,
      answer: `${def.shortName.charAt(0).toUpperCase()}${def.shortName.slice(1)} at Vihana Dental Care is listed at ${primary.priceRange}. A cost estimate for your recommended treatment is part of your consultation.`
    });
  } else if (services.length > 1) {
    out.push({
      question: 'What types of braces does Vihana Dental Care offer?',
      answer: `${services.map((s) => `${fixCopy(s.title)} (${s.priceRange})`).join('; ')}.`
    });
    out.push({
      question: 'What does braces treatment involve?',
      answer: `The steps are: ${services[0].procedures.map(fixCopy).join('; ')}.`
    });
  }

  out.push({
    question: 'Where is Vihana Dental Care and what are the opening hours?',
    answer: `Vihana Dental Care is at ${addressText()}. ${hoursText()}.`
  });
  return out;
}

// ---------------- Structured data ----------------

function openingHoursSpec() {
  return [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '13:30'
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '17:00',
      closes: '20:30'
    },
    { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Sunday', opens: '10:30', closes: '13:00' }
  ];
}

/** The clinic's LocalBusiness entity. Deliberately has no aggregateRating or review markup. */
export function localBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': ['Dentist', 'LocalBusiness'],
    '@id': CLINIC_ID,
    name: CLINIC_INFO.name,
    description:
      'Dental clinic in Kalapatti, Coimbatore offering implants, Invisalign & clear aligners, root canal treatment, braces, cosmetic dentistry and pediatric dental care.',
    image: DEFAULT_OG_IMAGE,
    logo: `${SITE_URL}/images/vihana_dental_logo_1784918513788.jpg`,
    url: `${SITE_URL}/`,
    telephone: '+919894317823',
    address: {
      '@type': 'PostalAddress',
      streetAddress: CLINIC_INFO.address,
      addressLocality: CLINIC_INFO.city,
      addressRegion: CLINIC_INFO.state,
      postalCode: CLINIC_INFO.pincode,
      addressCountry: 'IN'
    },
    geo: { '@type': 'GeoCoordinates', latitude: CLINIC_INFO.location.lat, longitude: CLINIC_INFO.location.lng },
    openingHoursSpecification: openingHoursSpec(),
    hasMap: CLINIC_INFO.googleMapsUrl,
    sameAs: [CLINIC_INFO.googleBusinessUrl, CLINIC_INFO.instagramUrl]
  };
}

function clinicRef() {
  return { '@type': 'Dentist', '@id': CLINIC_ID, name: CLINIC_INFO.name, url: `${SITE_URL}/` };
}

function absolute(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path === '/' ? '/' : it.path}`
    }))
  };
}

function offerFor(service: DentalService) {
  const range = parsePriceRange(service.priceRange);
  if (!range) return undefined;
  return {
    '@type': 'Offer',
    priceCurrency: 'INR',
    priceSpecification: { '@type': 'PriceSpecification', priceCurrency: 'INR', minPrice: range.min, maxPrice: range.max }
  };
}

function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer }
    }))
  };
}

export interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  jsonLd: object[];
}

export function buildPageMeta(page: ResolvedPage, data: PageData): PageMeta {
  if (page.kind === 'service') {
    const { def } = page;
    const services = pageServices(def, data);
    const faqs = buildServiceFaqs(def, data);
    const pageUrl = `${SITE_URL}${def.path}`;
    const first = services[0];
    const img = first && first.image && !first.image.startsWith('data:') ? absolute(first.image) : DEFAULT_OG_IMAGE;

    const service =
      services.length === 1
        ? {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: fixCopy(first.title),
            serviceType: fixCopy(first.title),
            description: fixCopy(first.shortDescription),
            url: pageUrl,
            provider: clinicRef(),
            areaServed: { '@type': 'City', name: 'Coimbatore' },
            ...(offerFor(first) ? { offers: offerFor(first) } : {})
          }
        : {
            '@context': 'https://schema.org',
            '@type': 'Service',
            name: 'Braces (Metal, Ceramic & Damon)',
            serviceType: 'Orthodontic braces',
            url: pageUrl,
            provider: clinicRef(),
            areaServed: { '@type': 'City', name: 'Coimbatore' },
            hasOfferCatalog: {
              '@type': 'OfferCatalog',
              name: 'Braces at Vihana Dental Care',
              itemListElement: services.map((s) => ({
                '@type': 'Offer',
                itemOffered: { '@type': 'Service', name: fixCopy(s.title), description: fixCopy(s.shortDescription) },
                ...(offerFor(s) ? { priceCurrency: 'INR', priceSpecification: offerFor(s)!.priceSpecification } : {})
              }))
            }
          };

    return {
      title: def.title,
      description: def.description,
      canonical: pageUrl,
      ogImage: img,
      jsonLd: [
        service,
        faqJsonLd(faqs),
        breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: def.navLabel, path: def.path }
        ])
      ]
    };
  }

  if (page.kind === 'blog-index') {
    return {
      title: BLOG_INDEX.title,
      description: BLOG_INDEX.description,
      canonical: `${SITE_URL}${BLOG_INDEX.path}`,
      ogImage: DEFAULT_OG_IMAGE,
      jsonLd: [breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Blog', path: BLOG_INDEX.path }])]
    };
  }

  if (page.kind === 'blog-post' && data.post) {
    const post = data.post;
    const url = `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`;
    const text = post.content.replace(/\s+/g, ' ').trim();
    const description = text.length > 155 ? `${text.slice(0, 152).trimEnd()}...` : text;
    const image = post.imageUrl && !post.imageUrl.startsWith('data:') ? absolute(post.imageUrl) : DEFAULT_OG_IMAGE;
    return {
      title: `${post.title} | Vihana Dental Care`,
      description,
      canonical: url,
      ogImage: image,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          image,
          datePublished: post.createdAt,
          dateModified: post.updatedAt || post.createdAt,
          author: { '@type': 'Person', name: post.author },
          publisher: clinicRef(),
          mainEntityOfPage: { '@type': 'WebPage', '@id': url }
        },
        breadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: BLOG_INDEX.path },
          { name: post.title, path: `/blog/${encodeURIComponent(post.slug)}` }
        ])
      ]
    };
  }

  // contact
  return {
    title: CONTACT_PAGE.title,
    description: CONTACT_PAGE.description,
    canonical: `${SITE_URL}${CONTACT_PAGE.path}`,
    ogImage: DEFAULT_OG_IMAGE,
    jsonLd: [
      localBusinessJsonLd(),
      breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Contact', path: CONTACT_PAGE.path }])
    ]
  };
}
