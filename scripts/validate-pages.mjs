/**
 * Smoke-tests the server-rendered pages against a running server, with no JavaScript:
 *   node scripts/validate-pages.mjs http://localhost:3100 [extra/path ...]
 * Checks per page: HTTP 200, one <title>, one canonical matching the URL, exactly
 * one <h1>, readable body text in the raw HTML, valid JSON-LD, FAQPage questions
 * that are visible on the page, and no "tel:" link containing spaces.
 * Also checks /sitemap.xml lists every page.
 */
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const extra = process.argv.slice(3);
const paths = [
  '/', '/invisalign-coimbatore', '/dental-implants-coimbatore', '/root-canal-treatment-coimbatore',
  '/braces-coimbatore', '/teeth-whitening-coimbatore', '/kids-dentist-coimbatore', '/blog', '/contact', ...extra
];
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;|&#39;/g, "'");
let failures = 0;
const fail = (p, msg) => { failures++; console.log(`  FAIL ${p}: ${msg}`); };

for (const p of paths) {
  const res = await fetch(base + p);
  const html = await res.text();
  const title = (/<title>([\s\S]*?)<\/title>/.exec(html) || [])[1];
  const canonical = (/<link rel="canonical" href="([^"]+)"/.exec(html) || [])[1];
  const h1s = (html.match(/<h1[\s>]/g) || []).length;
  const noJs = decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  console.log(`${res.status} ${p}  | ${decode(title || '(no title)')}`);
  if (res.status !== 200) fail(p, `status ${res.status}`);
  if (!title) fail(p, 'no <title>');
  if (canonical !== `https://vihanadental.in${p === '/' ? '/' : p}`) fail(p, `canonical is ${canonical}`);
  // Home is rendered client-side; its no-JS H1 lives in <noscript> (also counted here).
  if (h1s !== 1) fail(p, `${h1s} <h1> elements`);
  if (noJs.length < 400) fail(p, `only ${noJs.length} chars of text without JS`);
  if (/href="tel:[^"]*\s[^"]*"/.test(html)) fail(p, 'tel: link contains a space');
  if (/aggregateRating|"review"/.test(ld.join(''))) fail(p, 'rating/review markup present');
  for (const raw of ld) {
    let obj;
    try { obj = JSON.parse(raw); } catch (e) { fail(p, `JSON-LD does not parse: ${e.message}`); continue; }
    const types = [].concat(obj['@type']);
    if (!obj['@context']) fail(p, 'JSON-LD missing @context');
    if (types.includes('FAQPage')) {
      for (const q of obj.mainEntity) if (!noJs.includes(q.name) || !noJs.includes(q.acceptedAnswer.text.slice(0, 40))) fail(p, `FAQ not visible on page: ${q.name}`);
    }
    if (types.includes('Dentist') && p === '/') {
      if (obj.telephone !== '+919894317823') fail(p, 'telephone');
      if (obj.geo.latitude !== 11.0772 || obj.geo.longitude !== 77.0264) fail(p, 'geo');
      if (!obj.sameAs.includes('https://www.instagram.com/vihanadental/')) fail(p, 'instagram');
    }
  }
  console.log(`    JSON-LD: ${ld.map((r) => [].concat(JSON.parse(r)['@type']).join('/')).join(', ') || 'none'}`);
}

const sm = await (await fetch(base + '/sitemap.xml')).text();
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const p of [...paths, '/privacy-policy.html', '/terms-of-service.html', '/refund-cancellation-policy.html', '/data-deletion.html']) {
  const want = `https://vihanadental.in${p}`;
  if (!locs.includes(want)) fail('/sitemap.xml', `missing ${want}`);
}
console.log(`sitemap: ${locs.length} URLs`);
console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL CHECKS PASSED');
process.exit(failures ? 1 : 0);
