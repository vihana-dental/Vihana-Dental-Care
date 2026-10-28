/**
 * Rewrites the LocalBusiness JSON-LD block in index.html from
 * src/seo/site.ts (localBusinessJsonLd), so the home page and /contact can
 * never describe the clinic differently. Run: npx tsx scripts/sync-home-jsonld.ts
 */
import fs from 'fs';
import path from 'path';
import { localBusinessJsonLd } from '../src/seo/site';

const file = path.join(process.cwd(), 'index.html');
const html = fs.readFileSync(file, 'utf-8');
const json = JSON.stringify(localBusinessJsonLd(), null, 2).split('\n').map((l) => `    ${l}`).join('\n');
const block = `<script type="application/ld+json">\n${json}\n    </script>`;
const re = /<script type="application\/ld\+json">[\s\S]*?<\/script>/;
if (!re.test(html)) throw new Error('No JSON-LD block found in index.html');
fs.writeFileSync(file, html.replace(re, () => block));
console.log('index.html JSON-LD updated');
