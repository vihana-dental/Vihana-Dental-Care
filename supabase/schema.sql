-- Vihana Dental Care — Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Scope: Supabase is the patient CRM + appointment persistence layer,
-- additive alongside the existing booking system — Google Calendar remains
-- the scheduling source of truth (attendee invites, Meet links, doctor's own
-- view) and Google Sheets remains the human-readable appointment log. The
-- `appointments` table below exists so the app's own in-memory appointment
-- list (used for confirm/cancel logic, the WhatsApp bot, and /doctor-admin)
-- survives a server restart instead of being wiped every time — it is
-- rehydrated from here on boot and every create/update/cancel writes back.

-- ---------------- patients ----------------
-- One row per unique patient, deduplicated by phone (primary identity) or
-- email. Looked up on every booking attempt across all three channels; a new
-- row is only inserted when neither phone nor email matches an existing one.
create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  source_channel text not null check (source_channel in ('whatsapp', 'chatbot', 'website_cta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Phone is the primary dedupe key (every patient gives a phone number;
-- email is optional/often skipped in the chat and WhatsApp flows).
create unique index if not exists patients_phone_unique_idx on patients (phone);

-- Email is unique only when present — a null email must never collide with
-- another null email.
create unique index if not exists patients_email_unique_idx on patients (email) where email is not null;

-- ---------------- service_pricing ----------------
-- DISPLAY ONLY. This is the treatment cost range shown on the public website
-- (service cards + detail modal) and in the WhatsApp bot's "estimated
-- treatment cost" line — editable by the doctor via /doctor-admin, no code
-- changes needed. It is a free-text range ("₹22,000 - ₹45,000 per implant"),
-- not a single number, specifically so it can never be passed to Razorpay as
-- a charge amount by construction — nothing in this codebase is allowed to
-- read this column and hand it to createOrder/createPaymentLink. The only
-- amount ever actually charged, on every channel and every route, is the
-- flat advance booking fee (clinicFeeConfig.inClinicFeeINR/onlineFeeINR in
-- server.ts, edited via the separate "Booking Advance Fees" admin card).
--
-- service_id matches the `id` field of entries in src/data/clinicData.ts's
-- SERVICES array (e.g. "dental-implants") — that's the join key.
create table if not exists service_pricing (
  service_id text primary key,
  service_name text not null,
  price_range_display text not null,
  updated_at timestamptz not null default now()
);

-- Seed with the current service catalog and its existing display text from
-- clinicData.ts, so turning Supabase on doesn't change anything the patient
-- sees until the doctor actually edits a price in /doctor-admin. The backend
-- only falls back to the static clinicData.ts strings when Supabase isn't
-- configured at all (local dev / before credentials exist).
insert into service_pricing (service_id, service_name, price_range_display) values
  ('general-consultation',  'General Consultation',                       '₹300 - ₹600'),
  ('dental-implants',       'Dental Implants & Full Mouth Rehab',        '₹22,000 - ₹45,000 per implant'),
  ('invisalign-aligners',   'Invisalign & Clear Aligners',                '₹45,000 - ₹1,50,000'),
  ('laser-root-canal',      'Laser & Microscopic Root Canal',              '₹4,500 - ₹8,500 per tooth'),
  ('cosmetic-smile-design', 'Cosmetic Dentistry & Smile Makeover',         '₹8,000 - ₹35,000'),
  ('teeth-whitening',       'Advanced Laser Teeth Whitening',              '₹6,000 - ₹12,000'),
  ('pediatric-dentistry',   'Pediatric & Kids Dental Care',                '₹1,200 - ₹4,500'),
  ('wisdom-tooth-surgery',  'Painless Wisdom Tooth Extraction',            '₹3,500 - ₹8,000 per tooth'),
  ('zirconia-crowns',       'Zirconia Crowns & CAD/CAM Ceramic Bridges',   '₹7,500 - ₹18,000 per crown'),
  ('metal-braces',          'Metal Braces',                               '₹25,000 - ₹50,000'),
  ('ceramic-braces',        'Ceramic Braces',                             '₹35,000 - ₹75,000'),
  ('damon-braces',          'Damon Braces (Q2 & Ultima)',                 '₹70,000 - ₹1,20,000'),
  ('normal-braces',         'Normal Braces',                              '₹35,000 - ₹60,000')
on conflict (service_id) do update set
  service_name = excluded.service_name,
  price_range_display = excluded.price_range_display;

-- ---------------- blog_posts ----------------
-- Doctor-authored posts, created/edited/deleted only from /doctor-admin
-- (server/services/blog.ts). image_url can hold either a hosted image URL or
-- a base64 data: URI (the admin upload form encodes the file client-side —
-- no separate file storage/CDN integration needed for a low-volume clinic
-- blog). slug is what the public blog page's URL uses; always
-- machine-generated from the title at creation time, never edited directly.
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  content text not null,
  author text not null,
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists blog_posts_slug_unique_idx on blog_posts (slug);

-- ---------------- appointments ----------------
-- Mirrors the Appointment shape in src/types.ts field-for-field (snake_case).
-- id is OUR OWN daily-renumbered id ("2026-08-08-001"), not a generated uuid
-- — it's the same id used in Calendar, Sheets, Razorpay's receipt/reference_id,
-- and the WhatsApp bot, so it has to stay exactly what the app already
-- generates rather than a fresh database-assigned key.
create table if not exists appointments (
  id text primary key,
  patient_name text not null,
  patient_phone text not null,
  patient_email text not null default '',
  doctor_id text not null,
  doctor_name text not null,
  service_id text not null,
  service_name text not null,
  date text not null,
  time_slot text not null,
  notes text,
  status text not null,
  google_calendar_event_id text,
  google_calendar_synced boolean not null default false,
  whatsapp_confirmation_sent boolean not null default false,
  whatsapp_reminder_scheduled boolean not null default false,
  reschedule_token text not null,
  caregiver_phone text,
  consultation_type text not null,
  video_room_url text,
  online_consult_status text,
  payment_status text not null,
  payment_id text,
  razorpay_order_id text,
  razorpay_payment_link_id text,
  fee_amount numeric,
  channel text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists appointments_created_at_idx on appointments (created_at desc);

-- ---------------- Row Level Security ----------------
-- The backend talks to Supabase using the service_role key (server-side
-- only, bypasses RLS entirely), so RLS isn't required for the app to
-- function — but it's enabled here as defense-in-depth in case the anon/
-- public key is ever used from a browser context by mistake. No policies
-- are defined, so with RLS on and no policies, anon/authenticated access is
-- denied by default; only the service_role key can read/write.
alter table patients enable row level security;
alter table service_pricing enable row level security;
alter table blog_posts enable row level security;
alter table appointments enable row level security;
