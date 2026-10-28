# Content review — to confirm with the clinic

Nothing below was changed. These are statements, prices and hours that the site
shows today and that look inconsistent, unverifiable or risky. The new pages
only reuse existing text; where an item below affected a page, that is noted.

## 1. Sunday hours
- The site shows **Sunday: 10:30 AM – 1:00 PM** in the footer, contact section and booking calendar
  (`WEEKLY_SCHEDULE` in `src/data/clinicData.ts` also offers Sunday slots).
- The header bar shows **Mon-Sat only** (`weekdaysShort`), and other listings (e.g. Google, directories) say Mon to Sat.
- The new LocalBusiness schema on the home page and `/contact` lists Sunday, because that is what the site displays.
  **Confirm whether the clinic is really open on Sundays**, then align the header, schema, Google Business Profile and bookable slots.
- Dr. N. Sanchana is listed as available all seven days (`availableDays`).

## 2. Implant price mismatch
- Service card (live catalog): **₹18,000 – ₹45,000 per implant**.
- FAQ "What is the cost of dental implants in Coimbatore?": **₹22,000 to ₹45,000 per implant** (also the fallback value in `src/data/clinicData.ts`).
- `/dental-implants-coimbatore` shows the card price and deliberately does **not** repeat the FAQ, so the page doesn't contradict itself.
- Same kind of drift: Invisalign is **₹45,000 – ₹3,50,000** in the live catalog but **₹45,000 – ₹1,50,000** in the built-in fallback data.
  The fallback only shows if the database is unreachable, but it should match.

## 3. Claims to substantiate or soften
| Claim | Where | Question |
|---|---|---|
| "Over 5,000 successful computer-guided implants, Invisalign cases, and laser root canals" | About Us | Is there a record behind this number? The hero says "hundreds of happy patients". |
| "5+ Years Experience" | About Us | Dr. N. Sanchana's profile says 8 years; Dr. Sandhiya's says 8+. Which is right, and whose experience is it? |
| "15-year warranty card" / "15-year replacement guarantee" (zirconia crowns) | Services | Is this a written warranty? What are its terms? |
| "Lifetime warranty on implant posts", "lifetime stability", "lifetime durability", "100% biting efficiency" | Services, FAQ | Same: written terms, or remove absolute wording. |
| "Board-certified care" | Our Team | Doctors are listed as MDS. "Board-certified" is a US term, so which certification is meant? |
| "Swiss titanium" implants, "Swiss computer-guided implant dentistry" | Services, About Us | Confirm the implant brand and its country of origin. |
| "German Class-B Suite" | About Us | Confirm the sterilisation equipment and its standard. |
| "100% painless", "zero pain", "guaranteeing completely comfortable" | Services, FAQ, About Us | Absolute outcome promises; consider "gentle" or "designed to be comfortable". |
| "Coimbatore's premier", "Top-rated", "Best Dentist" | Footer, hero, title | Superlatives without a source. |
| "Up to 8 shades lighter in 1 visit" | Teeth whitening | Results claim; confirm it can be supported. |
| "100% Nearly invisible tray design" | Invisalign card | Wording contradicts itself; `/invisalign-coimbatore` leaves this line out, along with "Shorter treatment duration than metal braces". |
| "Official Invisalign and Invisalign First … aligners" | Gallery caption | Implies provider status. The Invisalign page uses neutral wording and says only "Invisalign Qualified", as on the team card. |

## 4. "Walk-ins welcome" and "same-day emergency"
- About Us: "Walk-ins welcome, or book online in advance" and "Emergency treatment with same-day appointments".
- Clinic data: "24/7 Emergency Care on Call"; contact section has an "Emergency Care Helpline" label.
- Confirm these are true during every opening slot, whether "24/7" really means out-of-hours cover, and who answers the line.
  If not, the wording should change before ads send emergency searches to the site.

## 5. Other things found while working
- **"Dentisttry" typo is in the live database**, not in the code: the service "Smile Design and Aesthetic Dentisttry"
  (id `smile-design-and-aesthetic-dentisttry`). The site now corrects it when it displays the heading and image alt text.
  Please also fix the title in the admin console; the id is left unchanged so existing bookings keep working.
- **Rating markup removed.** The home page's old JSON-LD included `aggregateRating` (4.9 from 185 reviews). It was dropped as instructed.
  Google generally does not show self-published ratings for a business's own page.
  Other old fields (email, employee list, founder, areaServed, medicalSpecialty) are also no longer in the home-page block.
- **Normal Braces** exists in the built-in data but not in the live catalog, so `/braces-coimbatore` lists metal, ceramic and Damon braces only.
- **Blog post text** "Why Do You Need Braces Treatment?" has a broken character after "nice smile." (encoding glitch) and hard line breaks in the middle of sentences.
- **Hero H1 / meta keywords**: the `keywords` meta tag lists "Emergency Dentist Coimbatore" and nearby localities; search engines ignore this tag, but it is a claim of its own.
- **Click tracking** goes to the existing Google Ads tag (`AW-11335208700`). It has no GA4 property attached, so `phone_click`, `whatsapp_click` and `form_submit` will not appear in GA4 reports until a GA4 config tag is added, or until they are turned into conversions in Google Ads.
