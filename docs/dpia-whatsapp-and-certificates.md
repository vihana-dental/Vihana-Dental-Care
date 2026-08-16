# Privacy Impact Assessment — WhatsApp number handling & certificate uploads

**Scope:** the two features added on 17 August 2026 — (1) splitting the site's WhatsApp
presence into a published clinic number and a non-published booking-bot number, and
(2) doctor-uploaded clinic certificates surfaced behind the footer's "Certifications" link.

**Framework:** Digital Personal Data Protection Act, 2023 (India). Vihana Dental Care is the
Data Fiduciary; patients and website visitors are Data Principals.

**Status:** technical and organisational assessment by the development team. It records what
the software actually does and where the residual risk sits. It is not legal advice and does
not replace review by the clinic's own counsel before publication.

---

## 1. Feature A — WhatsApp number handling

### What changed

Previously `CLINIC_INFO.whatsapp` held the automated booking assistant's number, and every
WhatsApp surface on the site — header, footer, contact card, hero CTA, sticky bar — rendered
or linked to it, while the Contact & Map section carried a separately hardcoded copy of the
clinic's own number. The two roles have now been separated at the data layer:

| Field | Value | Rendered as text? | Used for |
|---|---|---|---|
| `CLINIC_INFO.whatsapp` | +91 86680 82140 | Yes — everywhere a number is shown | "WhatsApp Us" contact links (header, footer, contact card, map section) |
| `CLINIC_INFO.whatsappBot` | booking assistant line | **Never** | `wa.me` target of "Book on WhatsApp" CTAs, and the confirmation links the booking API returns |

Access to each is funnelled through `clinicWhatsAppHref()` and `whatsAppBotHref()` in
`src/data/clinicData.ts`, so no component hand-builds a `wa.me` URL from whichever number it
happened to import — which is how the bot number reached the header and footer originally.

### Personal data involved

The clinic's and the bot's numbers are **business** contact details, not personal data of a
Data Principal. The personal data arises on the other side of the link: when a patient sends
the pre-filled message, the clinic receives that patient's phone number and message content.

### Lawful basis and consent

Consent under §6, given by affirmative action: the patient taps a labelled button, WhatsApp
opens with a visible pre-filled message, and nothing reaches the clinic until they choose to
send it. Notice under §5 is given at the point of collection — a line beside the WhatsApp CTA
in the Contact & Map section states what is shared, why, and the right to access/correct/delete,
linking to the privacy policy — and the policy now carries a dedicated Consent section.

The website contact form is the other collection point. It now requires an explicit consent
tick; the server rejects any submission arriving without `consentGiven === true`, and stores
the exact consent wording shown plus a timestamp alongside the enquiry, so the record of
consent survives later rewording of the form.

### Risks and mitigations

| Risk | Mitigation | Residual |
|---|---|---|
| Patient messages the bot line believing it is staffed by a person | Bot number is never presented as a contact number; only ever the target of a button labelled "Book on WhatsApp"/"Book Appointments on Whatsapp" | Low |
| A future component re-introduces the bot number into visible copy | Both numbers are documented in `ClinicInfo` with the display rule stated on the field, and links go through the two helpers | Low — convention, not enforced by a test |
| Message content processed by Meta | Disclosed in the privacy policy's WhatsApp Business Platform section; unchanged by this work | Accepted (inherent to the channel) |
| Consent text drifts from what was agreed | Wording is stored per submission | Low |

**Note on the `wa.me` link:** the bot number is not a secret. It appears in the CTA's URL, as
it must for the link to function, and a visitor inspecting the page can read it. The
requirement met here is that it is not *presented* to patients as a contact number anywhere on
the site. Treat it as non-published, not as confidential.

---

## 2. Feature B — Certificate uploads

### What the feature does

An authenticated doctor uploads clinic licences, registrations and qualifications from the
admin console (`/doctor-admin` → Certificates). The public footer's "Certifications" link
lists them; each entry opens the document in a new tab.

### Personal data involved

The documents are **practice credentials intended for publication** — degree certificates,
clinic registration, biomedical waste enrolment, Udyam/MSME registration. They contain no
patient data. Two categories of personal data do arise:

1. **The treating doctor's own credentials** — published with the doctor's knowledge and
   participation, as professional information the clinic is expected to display.
2. **The uploader's identity** — the admin email recorded against each upload, retained as a
   security and accountability measure.

The panel carries an explicit on-screen instruction to publish practice credentials only and
never to upload a document containing patient information. That instruction is the control;
the software cannot detect a mis-upload for itself. **This is the principal residual risk of
the feature** — a doctor who uploads the wrong PDF publishes it, and it would need to be
deleted from the console to be withdrawn.

### Security controls implemented

- **Access control** — every write route sits behind `requireAdminAuth`, itself behind Google
  Sign-In restricted to an allowlist of clinic emails.
- **Upload validation** — a file is accepted only if its declared MIME type, its filename
  extension, *and* its actual leading magic bytes all agree on PDF, JPEG or PNG. A `.pdf`-named
  file whose bytes are something else is rejected rather than stored and later re-served under
  a PDF content type.
- **Size limit** — 4 MB per file, below the server's 6 MB JSON body ceiling so an oversized
  upload produces a specific error rather than an opaque 413.
- **Encryption in transit** — HTTPS from browser to server, and TLS from server to Supabase.
- **Encryption at rest** — documents are stored in Supabase Postgres, encrypted at rest
  (AES-256) by the platform. Row Level Security is enabled on the table with no policies, so
  only the server's service-role key can read or write it.
- **No credential leakage in URLs** — public reads are proxied through the site's own origin
  (`/api/certificates/:id/file`); a document URL never carries a Supabase key or signed token.
- **Response hardening** — served with the vetted content type, `X-Content-Type-Options:
  nosniff`, and an inline disposition with the filename stripped of quote/escape characters.
- **Audit logging** — upload, rename, delete, *rejected* upload, and every public file
  retrieval are written to the server log with actor and timestamp, via the same audit writer
  used for patient-data access.

### Risks and mitigations

| Risk | Mitigation | Residual |
|---|---|---|
| Patient-identifying document uploaded by mistake | On-screen instruction in the panel; deletion available from the console | **Medium — procedural only** |
| Malicious file uploaded and served back | Three-way type check + `nosniff` + inline disposition; write access restricted to allowlisted clinic accounts | Low |
| Document tampering | Files immutable after upload — the panel edits title and ordering only; replacing a document means a new upload | Low |
| Storage exhaustion / oversized payloads | 4 MB per-file cap enforced client- and server-side, plus a DB check constraint | Low |
| Audit trail lost on redeploy | Logs are the hosting platform's stdout stream, subject to its retention | **Medium — see below** |

### Recommended follow-ups (not implemented here)

1. **Durable audit storage.** Audit entries currently go to stdout, which inherits the host's
   log retention. If the clinic needs to *demonstrate* a trail months later, these should be
   written to a dedicated Supabase table with their own retention period. This applies equally
   to the pre-existing patient-data audit stream.
2. **Formal retention period** for uploaded certificates and for enquiry records — the policy
   currently states "as long as necessary", which should become a stated number of years agreed
   with the clinic's counsel.
3. **Named Data Protection contact.** §13 grievance redressal works best with a specific person
   or role published as the contact; the policy currently gives the clinic's general phone and
   email.
4. **Automated regression test** asserting that the bot number appears nowhere in the rendered
   HTML as text, so the header/footer regression cannot recur silently.

---

## 3. Data Principal rights coverage

| Right (DPDP §) | Where it is served |
|---|---|
| Access (§11) | On request; patient contact records are viewable by the clinic in the admin console's Patient Database panel |
| Correction (§12) | On request, via the clinic; contact details are editable in the console |
| Erasure (§12) | Self-service request page at `/data-deletion.html`; carried out via the Patient Database panel's delete action, which removes the contact record while retaining clinical/financial records that carry their own legal retention basis |
| Withdrawal of consent (§6(6)) | Stated in the privacy policy; a patient may stop messaging the WhatsApp line or ask to be removed |
| Grievance redressal (§13) | Clinic contact details in the privacy policy — see follow-up 3 above |

Certificate documents are outside this table by design: they hold no Data Principal's personal
data other than the treating doctor's published credentials, which the doctor controls directly
through the console.
