/**
 * Clinic certificates & registrations — doctor-uploaded via /doctor-admin,
 * listed publicly behind the footer's "Certifications" link. Same Supabase-
 * with-static-fallback pattern as gallery.ts / blog.ts / team.ts.
 *
 * WHAT THIS DATA IS: practice credentials (MDS degree, clinic registration,
 * biomedical waste enrolment, Udyam/MSME) — documents the clinic publishes
 * on purpose. They are not patient data, so nothing here is personal data of
 * a Data Principal under the DPDP Act, 2023. The one personal datum that does
 * arise is the *uploader's* identity, which is recorded in the audit trail
 * (see the certificate routes in server.ts) as a legitimate-use processing
 * of an employee/practitioner's work identity.
 *
 * STORAGE: files are held as base64 data: URIs in the row itself, matching
 * the existing blog/gallery image approach — no separate object store to
 * provision for a handful of small documents. That means they inherit
 * Supabase's encryption at rest (AES-256) and travel only over TLS, both
 * from the browser to this server and from this server to Supabase. The
 * public read path re-serves the decoded bytes over the site's own HTTPS
 * origin, so a document URL never leaks a Supabase key or a signed-URL
 * token.
 *
 * VALIDATION: uploads are checked three ways before they are accepted —
 * declared MIME type, file extension, and actual leading magic bytes must
 * all agree on one of PDF / JPEG / PNG, and the decoded size must be within
 * MAX_CERTIFICATE_BYTES. A .pdf-named file whose bytes are something else is
 * rejected rather than stored and later served back with a PDF content type.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ClinicCertificate } from '../../src/types';

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

// 4MB of actual file. Base64 inflates by ~33%, so the largest possible
// request body is ~5.4MB — inside express.json's 6mb ceiling in server.ts.
// Raising this without raising that limit would turn oversized uploads into
// an opaque 413 instead of the specific error message below.
export const MAX_CERTIFICATE_BYTES = 4 * 1024 * 1024;

export const ACCEPTED_CERTIFICATE_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const ACCEPTED_CERTIFICATE_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'] as const;

const EXTENSIONS_BY_TYPE: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png']
};

/** Leading bytes every file of a given type must actually start with. */
const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],                          // %PDF
  'image/jpeg': [[0xff, 0xd8, 0xff]],                                     // SOI + marker
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]         // PNG signature
};

export interface ValidatedCertificateFile {
  mimeType: string;
  bytes: Buffer;
  sizeBytes: number;
}

/**
 * The same `{ ok, ...payload | error }` shape the other services in here
 * return. Deliberately not a discriminated union on a `true`/`false` literal:
 * this project compiles without `strict`, so narrowing on a boolean literal
 * discriminant doesn't work and every call site would need a cast.
 */
export interface CertificateFileValidation {
  ok: boolean;
  file?: ValidatedCertificateFile;
  error?: string;
}

/**
 * Parses and vets an uploaded `data:<mime>;base64,<payload>` string.
 * Returns a typed error string rather than throwing — every caller turns it
 * straight into a 400 the doctor can read and act on.
 */
export function validateCertificateFile(dataUri: unknown, fileName: unknown): CertificateFileValidation {
  if (typeof dataUri !== 'string' || !dataUri.trim()) {
    return { ok: false, error: 'A certificate file is required.' };
  }
  if (typeof fileName !== 'string' || !fileName.trim()) {
    return { ok: false, error: 'The file name is required.' };
  }

  const match = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUri.trim());
  if (!match) {
    return { ok: false, error: 'That file could not be read. Please upload a PDF, JPG, JPEG or PNG.' };
  }

  const declaredType = match[1].toLowerCase();
  if (!(ACCEPTED_CERTIFICATE_TYPES as readonly string[]).includes(declaredType)) {
    return { ok: false, error: 'Only PDF, JPG, JPEG and PNG files can be uploaded.' };
  }

  const extension = (fileName.match(/\.[a-z0-9]+$/i)?.[0] || '').toLowerCase();
  if (!EXTENSIONS_BY_TYPE[declaredType].includes(extension)) {
    return { ok: false, error: `A ${declaredType} file must have a ${EXTENSIONS_BY_TYPE[declaredType].join(' or ')} extension.` };
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  } catch {
    return { ok: false, error: 'That file could not be decoded. Please try uploading it again.' };
  }

  if (bytes.length === 0) {
    return { ok: false, error: 'That file is empty.' };
  }
  if (bytes.length > MAX_CERTIFICATE_BYTES) {
    // Rounded UP, so a file four bytes over the cap doesn't report itself as
    // "4.0MB — please upload one under 4MB" and read like a contradiction.
    const mb = (Math.ceil((bytes.length / (1024 * 1024)) * 10) / 10).toFixed(1);
    return { ok: false, error: `That file is ${mb}MB — please upload one under ${MAX_CERTIFICATE_BYTES / (1024 * 1024)}MB.` };
  }

  // The declared type is attacker-controlled (it's whatever the browser or a
  // scripted client put in the data URI), so the bytes have to agree with it
  // before we ever store it and later serve it back under that content type.
  const signatures = MAGIC_BYTES[declaredType];
  const matchesSignature = signatures.some((sig) => sig.every((byte, i) => bytes[i] === byte));
  if (!matchesSignature) {
    return { ok: false, error: `That file does not look like a valid ${declaredType.replace('application/', '').replace('image/', '').toUpperCase()} document.` };
  }

  return { ok: true, file: { mimeType: declaredType, bytes, sizeBytes: bytes.length } };
}

// ---------------- Static fallback catalog ----------------
// The four documents already committed under public/certifications/. These
// are what the footer showed before this feature existed, and they remain
// the list when Supabase isn't configured (local dev, or before the schema
// is applied) so the public page never renders empty. Their fileUrl points
// straight at the static asset rather than at the API's file route.
interface StaticCertificate extends ClinicCertificate { staticPath: string; }

const STATIC_CERTIFICATES: StaticCertificate[] = [
  {
    id: 'static-mds-orthodontics',
    title: 'Dr. N. Sanchana — MDS Orthodontics & Dentofacial Orthopaedics',
    fileName: 'MDS Orthodontics and Dentofacial Orthopaedics.pdf',
    staticPath: 'MDS Orthodontics and Dentofacial Orthopaedics.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 0,
    fileUrl: '',
    displayOrder: 1,
    uploadedAt: ''
  },
  {
    id: 'static-clinic-registration',
    title: 'Clinic Registration Certificate',
    // The trailing space before ".pdf" is genuinely part of the filename on
    // disk — encodeURIComponent below preserves it.
    fileName: 'Clinic registration .pdf',
    staticPath: 'Clinic registration .pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 0,
    fileUrl: '',
    displayOrder: 2,
    uploadedAt: ''
  },
  {
    id: 'static-biomedical-waste',
    title: 'Kovai Bio Medical Waste Management Enrollment',
    fileName: 'Kovai Bio waste enrollment form.pdf',
    staticPath: 'Kovai Bio waste enrollment form.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 0,
    fileUrl: '',
    displayOrder: 3,
    uploadedAt: ''
  },
  {
    id: 'static-udyam-registration',
    title: 'Udyam (MSME) Registration',
    fileName: 'Print _ Udyam Registration.pdf',
    staticPath: 'Print _ Udyam Registration.pdf',
    mimeType: 'application/pdf',
    fileSizeBytes: 0,
    fileUrl: '',
    displayOrder: 4,
    uploadedAt: ''
  }
];

function staticCatalog(): ClinicCertificate[] {
  return STATIC_CERTIFICATES.map(({ staticPath, ...cert }) => ({
    ...cert,
    fileUrl: `/certifications/${encodeURIComponent(staticPath)}`
  }));
}

/** Reads one bundled certificate off disk — dist/ in production, public/ in dev. */
function readStaticCertificate(staticPath: string): Buffer | null {
  const candidates = [
    path.join(process.cwd(), 'dist', 'certifications', staticPath),
    path.join(process.cwd(), 'public', 'certifications', staticPath)
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return fs.readFileSync(candidate);
    } catch {
      // Unreadable path — fall through and try the next candidate.
    }
  }
  return null;
}

// Seeds the four bundled documents into Supabase the first time the table is
// found empty, so they become ordinary rows the doctor can rename, reorder
// and delete. Without this, the first real upload would make the table
// non-empty and the bundled four would silently vanish from the public
// footer — the doctor adds one certificate and loses four.
//
// Only latches permanently true once seeding is confirmed unnecessary or
// complete: a transient failure (table not created yet, files not readable)
// leaves it false so the next request retries. Same reasoning as
// gallery.ts's seed, and the same production failure it was written for.
let seedAttempted = false;

async function ensureSeeded(): Promise<void> {
  if (seedAttempted || !isSupabaseConfigured()) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clinic_certificates?select=id&limit=1`, { headers: supabaseHeaders() });
    if (!res.ok) return;
    const rows: any[] = await res.json();
    if (rows.length > 0) { seedAttempted = true; return; }

    const now = new Date().toISOString();
    const payload = STATIC_CERTIFICATES.flatMap((cert) => {
      const bytes = readStaticCertificate(cert.staticPath);
      if (!bytes) return [];
      return [{
        id: crypto.randomUUID(),
        title: cert.title,
        file_name: cert.fileName,
        mime_type: cert.mimeType,
        file_size_bytes: bytes.length,
        file_data: `data:${cert.mimeType};base64,${bytes.toString('base64')}`,
        display_order: cert.displayOrder,
        uploaded_by: 'system-seed',
        created_at: now,
        updated_at: now
      }];
    });
    // Nothing readable on disk — leave the latch open and retry, rather than
    // recording an empty seed as done.
    if (payload.length === 0) return;

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/clinic_certificates`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=minimal' }),
      body: JSON.stringify(payload)
    });
    if (insertRes.ok) seedAttempted = true;
  } catch (error: any) {
    console.error('Supabase clinic_certificates seed failed (will retry on next request):', error?.message || error);
  }
}

// ---------------- Row mapping ----------------
function rowToCertificate(row: any): ClinicCertificate {
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes) || 0,
    fileUrl: `/api/certificates/${encodeURIComponent(row.id)}/file`,
    displayOrder: Number(row.display_order) || 0,
    uploadedAt: row.created_at
  };
}

/** Uploads held in memory when Supabase isn't configured, alongside the static catalog. */
interface MockCertificate { certificate: ClinicCertificate; bytes: Buffer; }
const mockUploads: MockCertificate[] = [];

const METADATA_COLUMNS = 'id,title,file_name,mime_type,file_size_bytes,display_order,created_at';

/**
 * Public + admin listing, metadata only — the base64 payload is deliberately
 * never selected here, so listing a dozen certificates doesn't move a dozen
 * megabytes. Never throws; falls back to the static catalog on any failure so
 * the footer link always has something to show.
 */
export async function listCertificates(): Promise<ClinicCertificate[]> {
  const sortByOrder = (a: ClinicCertificate, b: ClinicCertificate) =>
    a.displayOrder - b.displayOrder || a.title.localeCompare(b.title);

  if (!isSupabaseConfigured()) {
    return [...staticCatalog(), ...mockUploads.map((m) => m.certificate)].sort(sortByOrder);
  }

  await ensureSeeded();

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/clinic_certificates?select=${METADATA_COLUMNS}&order=display_order.asc,created_at.asc`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) throw new Error(`Supabase clinic_certificates read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();

    // Empty AND unseeded means seeding hasn't succeeded yet (table just
    // created, or the bundled files weren't readable) — show the bundled
    // four rather than an empty page, and the next request retries the seed.
    // Empty AFTER a successful seed is a real, deliberate empty list: the
    // doctor deleted every row, and re-showing the bundled documents there
    // would resurrect exactly what they just removed.
    if (rows.length === 0 && !seedAttempted) return staticCatalog();
    return rows.map(rowToCertificate).sort(sortByOrder);
  } catch (error: any) {
    console.error('Supabase listCertificates failed (falling back to static catalog):', error?.message || error);
    return staticCatalog();
  }
}

export interface CertificateFile {
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}

/** Fetches one certificate's actual bytes for the public file route. */
export async function getCertificateFile(id: string): Promise<CertificateFile | null> {
  const mock = mockUploads.find((m) => m.certificate.id === id);
  if (mock) {
    return { fileName: mock.certificate.fileName, mimeType: mock.certificate.mimeType, bytes: mock.bytes };
  }

  if (!isSupabaseConfigured()) return null;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/clinic_certificates?id=eq.${encodeURIComponent(id)}&select=file_name,mime_type,file_data&limit=1`,
      { headers: supabaseHeaders() }
    );
    if (!res.ok) throw new Error(`Supabase certificate file read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    if (rows.length === 0) return null;

    const base64 = String(rows[0].file_data || '').replace(/^data:[^;]+;base64,/, '');
    if (!base64) return null;
    return { fileName: rows[0].file_name, mimeType: rows[0].mime_type, bytes: Buffer.from(base64, 'base64') };
  } catch (error: any) {
    console.error('Supabase getCertificateFile failed:', error?.message || error);
    return null;
  }
}

export interface CertificateWriteResult {
  success: boolean;
  certificate?: ClinicCertificate;
  error?: string;
}

export interface CreateCertificateInput {
  title: string;
  fileName: string;
  file: ValidatedCertificateFile;
  displayOrder?: number;
  /** Admin email from the authenticated session — part of the audit trail. */
  uploadedBy: string;
}

export async function createCertificate(input: CreateCertificateInput): Promise<CertificateWriteResult> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const displayOrder = Number.isFinite(input.displayOrder) ? Number(input.displayOrder) : 100;

  const certificate: ClinicCertificate = {
    id,
    title: input.title,
    fileName: input.fileName,
    mimeType: input.file.mimeType,
    fileSizeBytes: input.file.sizeBytes,
    fileUrl: `/api/certificates/${encodeURIComponent(id)}/file`,
    displayOrder,
    uploadedAt: now
  };

  if (!isSupabaseConfigured()) {
    mockUploads.push({ certificate, bytes: input.file.bytes });
    return { success: true, certificate };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clinic_certificates?select=${METADATA_COLUMNS}`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        id,
        title: input.title,
        file_name: input.fileName,
        mime_type: input.file.mimeType,
        file_size_bytes: input.file.sizeBytes,
        file_data: `data:${input.file.mimeType};base64,${input.file.bytes.toString('base64')}`,
        display_order: displayOrder,
        uploaded_by: input.uploadedBy,
        created_at: now,
        updated_at: now
      })
    });
    if (!res.ok) throw new Error(`Supabase certificate insert failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return { success: true, certificate: rowToCertificate(rows[0]) };
  } catch (error: any) {
    console.error('Supabase createCertificate failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export interface UpdateCertificateInput {
  title: string;
  displayOrder: number;
}

/** Metadata-only edit — the stored file itself is immutable once uploaded. */
export async function updateCertificate(id: string, input: UpdateCertificateInput): Promise<CertificateWriteResult> {
  const mock = mockUploads.find((m) => m.certificate.id === id);
  if (mock) {
    mock.certificate = { ...mock.certificate, title: input.title, displayOrder: input.displayOrder };
    return { success: true, certificate: mock.certificate };
  }

  if (!isSupabaseConfigured()) return { success: false, error: 'Certificate not found.' };

  try {
    // The explicit select= keeps the base64 payload out of the row PostgREST
    // echoes back — without it every rename would haul the whole file over
    // the wire twice for no reason.
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/clinic_certificates?id=eq.${encodeURIComponent(id)}&select=${METADATA_COLUMNS}`,
      {
        method: 'PATCH',
        headers: supabaseHeaders({ Prefer: 'return=representation' }),
        body: JSON.stringify({ title: input.title, display_order: input.displayOrder, updated_at: new Date().toISOString() })
      }
    );
    if (!res.ok) throw new Error(`Supabase certificate update failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    if (rows.length === 0) return { success: false, error: 'Certificate not found.' };
    return { success: true, certificate: rowToCertificate(rows[0]) };
  } catch (error: any) {
    console.error('Supabase updateCertificate failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function deleteCertificate(id: string): Promise<{ success: boolean; error?: string }> {
  if (STATIC_CERTIFICATES.some((c) => c.id === id)) {
    return { success: false, error: 'This is a built-in document and cannot be deleted from the console.' };
  }

  const mockIdx = mockUploads.findIndex((m) => m.certificate.id === id);
  if (mockIdx !== -1) {
    mockUploads.splice(mockIdx, 1);
    return { success: true };
  }

  if (!isSupabaseConfigured()) return { success: false, error: 'Certificate not found.' };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/clinic_certificates?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' })
    });
    if (!res.ok) throw new Error(`Supabase certificate delete failed: ${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Supabase deleteCertificate failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}
