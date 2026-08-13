/**
 * Team section — doctor-editable via /doctor-admin. Two entity types,
 * mirroring the existing Doctor / ConsultantDoctor split in src/types.ts:
 * team_doctors (lead doctors) and team_consultants (visiting specialists).
 * Both carry a `bookable` flag toggled per-person from the Team panel —
 * doctors default bookable, consultants default not — that determines
 * whether they appear as a selectable option in the booking flows (see
 * getBookableDoctors() in server.ts, which merges both pools filtered by
 * this flag). Same persistence pattern as blog.ts / services.ts.
 */

import { DOCTORS as STATIC_DOCTORS, CONSULTANT_DOCTORS as STATIC_CONSULTANTS } from '../../src/data/clinicData';
import { Doctor, ConsultantDoctor } from '../../src/types';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'doctor';
}

// ---------------- Lead doctors ----------------

export type DoctorInput = Omit<Doctor, 'id'>;

function rowToDoctor(row: any): Doctor {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    qualification: row.qualification,
    specialization: row.specialization,
    experienceYears: row.experience_years,
    photo: row.photo,
    bio: row.bio,
    availableDays: row.available_days ?? [],
    ugInstitution: row.ug_institution ?? undefined,
    pgInstitution: row.pg_institution ?? undefined,
    externalTraining: row.external_training ?? undefined,
    qualificationYear: row.qualification_year ?? undefined,
    bookable: row.bookable ?? true
  };
}

function doctorToRow(id: string, input: DoctorInput) {
  return {
    id,
    name: input.name,
    title: input.title,
    qualification: input.qualification,
    specialization: input.specialization,
    experience_years: input.experienceYears,
    photo: input.photo,
    bio: input.bio,
    available_days: input.availableDays,
    ug_institution: input.ugInstitution ?? null,
    pg_institution: input.pgInstitution ?? null,
    external_training: input.externalTraining ?? null,
    qualification_year: input.qualificationYear ?? null,
    bookable: input.bookable ?? true,
    updated_at: new Date().toISOString()
  };
}

let mockDoctors: Doctor[] = STATIC_DOCTORS.map((d) => ({ ...d }));
// Only latches permanently true once seeding is CONFIRMED unnecessary or
// complete — see gallery.ts's ensureSeeded for the full rationale (a
// transient failure like the table not existing yet must not permanently
// give up on seeding for the life of the process).
let doctorsSeedAttempted = false;

async function ensureDoctorsSeeded(): Promise<void> {
  if (doctorsSeedAttempted || !isSupabaseConfigured()) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_doctors?select=id&limit=1`, { headers: supabaseHeaders() });
    if (!res.ok) return;
    const rows: any[] = await res.json();
    if (rows.length > 0) { doctorsSeedAttempted = true; return; }
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/team_doctors`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(STATIC_DOCTORS.map((d) => doctorToRow(d.id, d)))
    });
    if (insertRes.ok) doctorsSeedAttempted = true;
  } catch (error: any) {
    console.error('Supabase team_doctors seed failed (will retry on next request):', error?.message || error);
  }
}

export async function listDoctors(): Promise<Doctor[]> {
  if (!isSupabaseConfigured()) return mockDoctors;
  await ensureDoctorsSeeded();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_doctors?select=*&order=created_at.asc`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase team_doctors read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows.map(rowToDoctor);
  } catch (error: any) {
    console.error('Supabase listDoctors failed (falling back to static catalog):', error?.message || error);
    return mockDoctors;
  }
}

export interface DoctorWriteResult {
  success: boolean;
  doctor?: Doctor;
  error?: string;
}

export async function createDoctor(input: DoctorInput): Promise<DoctorWriteResult> {
  const existing = await listDoctors();
  let id = slugify(input.name);
  if (existing.some((d) => d.id === id)) {
    let n = 2;
    while (existing.some((d) => d.id === `${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }
  const doctor: Doctor = { id, ...input };

  if (!isSupabaseConfigured()) {
    mockDoctors.push(doctor);
    return { success: true, doctor };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_doctors`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(doctorToRow(id, input))
    });
    if (!res.ok) throw new Error(`Supabase doctor insert failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return { success: true, doctor: rowToDoctor(rows[0]) };
  } catch (error: any) {
    console.error('Supabase createDoctor failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function updateDoctor(id: string, input: DoctorInput): Promise<DoctorWriteResult> {
  if (!isSupabaseConfigured()) {
    const idx = mockDoctors.findIndex((d) => d.id === id);
    if (idx === -1) return { success: false, error: 'Doctor not found.' };
    mockDoctors[idx] = { id, ...input };
    return { success: true, doctor: mockDoctors[idx] };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_doctors?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(doctorToRow(id, input))
    });
    if (!res.ok) throw new Error(`Supabase doctor update failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    if (rows.length === 0) return { success: false, error: 'Doctor not found.' };
    return { success: true, doctor: rowToDoctor(rows[0]) };
  } catch (error: any) {
    console.error('Supabase updateDoctor failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function deleteDoctor(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    const idx = mockDoctors.findIndex((d) => d.id === id);
    if (idx === -1) return { success: false, error: 'Doctor not found.' };
    mockDoctors.splice(idx, 1);
    return { success: true };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_doctors?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' })
    });
    if (!res.ok) throw new Error(`Supabase doctor delete failed: ${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Supabase deleteDoctor failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

// ---------------- Consultant doctors ----------------

export type ConsultantInput = Omit<ConsultantDoctor, 'id'>;

function rowToConsultant(row: any): ConsultantDoctor {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    qualification: row.qualification,
    bio: row.bio,
    photo: row.photo,
    ugInstitution: row.ug_institution ?? undefined,
    pgInstitution: row.pg_institution ?? undefined,
    externalTraining: row.external_training ?? undefined,
    qualificationYear: row.qualification_year ?? undefined,
    experienceYears: row.experience_years ?? undefined,
    bookable: row.bookable ?? false
  };
}

function consultantToRow(id: string, input: ConsultantInput) {
  return {
    id,
    name: input.name,
    specialty: input.specialty,
    qualification: input.qualification,
    bio: input.bio,
    photo: input.photo,
    ug_institution: input.ugInstitution ?? null,
    pg_institution: input.pgInstitution ?? null,
    external_training: input.externalTraining ?? null,
    qualification_year: input.qualificationYear ?? null,
    experience_years: input.experienceYears ?? null,
    bookable: input.bookable ?? false,
    updated_at: new Date().toISOString()
  };
}

let mockConsultants: ConsultantDoctor[] = STATIC_CONSULTANTS.map((c) => ({ ...c }));
// Only latches permanently true once seeding is CONFIRMED unnecessary or
// complete — see gallery.ts's ensureSeeded for the full rationale (a
// transient failure like the table not existing yet must not permanently
// give up on seeding for the life of the process).
let consultantsSeedAttempted = false;

async function ensureConsultantsSeeded(): Promise<void> {
  if (consultantsSeedAttempted || !isSupabaseConfigured()) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_consultants?select=id&limit=1`, { headers: supabaseHeaders() });
    if (!res.ok) return;
    const rows: any[] = await res.json();
    if (rows.length > 0) { consultantsSeedAttempted = true; return; }
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/team_consultants`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(STATIC_CONSULTANTS.map((c) => consultantToRow(c.id, c)))
    });
    if (insertRes.ok) consultantsSeedAttempted = true;
  } catch (error: any) {
    console.error('Supabase team_consultants seed failed (will retry on next request):', error?.message || error);
  }
}

export async function listConsultants(): Promise<ConsultantDoctor[]> {
  if (!isSupabaseConfigured()) return mockConsultants;
  await ensureConsultantsSeeded();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_consultants?select=*&order=created_at.asc`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase team_consultants read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows.map(rowToConsultant);
  } catch (error: any) {
    console.error('Supabase listConsultants failed (falling back to static catalog):', error?.message || error);
    return mockConsultants;
  }
}

export interface ConsultantWriteResult {
  success: boolean;
  consultant?: ConsultantDoctor;
  error?: string;
}

export async function createConsultant(input: ConsultantInput): Promise<ConsultantWriteResult> {
  const existing = await listConsultants();
  let id = slugify(input.name);
  if (existing.some((c) => c.id === id)) {
    let n = 2;
    while (existing.some((c) => c.id === `${id}-${n}`)) n += 1;
    id = `${id}-${n}`;
  }
  const consultant: ConsultantDoctor = { id, ...input };

  if (!isSupabaseConfigured()) {
    mockConsultants.push(consultant);
    return { success: true, consultant };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_consultants`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(consultantToRow(id, input))
    });
    if (!res.ok) throw new Error(`Supabase consultant insert failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return { success: true, consultant: rowToConsultant(rows[0]) };
  } catch (error: any) {
    console.error('Supabase createConsultant failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function updateConsultant(id: string, input: ConsultantInput): Promise<ConsultantWriteResult> {
  if (!isSupabaseConfigured()) {
    const idx = mockConsultants.findIndex((c) => c.id === id);
    if (idx === -1) return { success: false, error: 'Consultant not found.' };
    mockConsultants[idx] = { id, ...input };
    return { success: true, consultant: mockConsultants[idx] };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_consultants?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(consultantToRow(id, input))
    });
    if (!res.ok) throw new Error(`Supabase consultant update failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    if (rows.length === 0) return { success: false, error: 'Consultant not found.' };
    return { success: true, consultant: rowToConsultant(rows[0]) };
  } catch (error: any) {
    console.error('Supabase updateConsultant failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function deleteConsultant(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    const idx = mockConsultants.findIndex((c) => c.id === id);
    if (idx === -1) return { success: false, error: 'Consultant not found.' };
    mockConsultants.splice(idx, 1);
    return { success: true };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/team_consultants?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' })
    });
    if (!res.ok) throw new Error(`Supabase consultant delete failed: ${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Supabase deleteConsultant failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}
