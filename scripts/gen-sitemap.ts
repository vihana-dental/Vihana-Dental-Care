/**
 * Writes public/sitemap.xml: every static page plus any blog slugs passed as
 * arguments. The running server serves a live /sitemap.xml that adds blog posts
 * automatically; this file is the static fallback (and what a static host or
 * crawler sees if the dynamic route is ever bypassed).
 *   npx tsx scripts/gen-sitemap.ts why-do-you-need-braces-treatment-a-complete-guide-c2d522
 */
import fs from 'fs';
import path from 'path';
import { buildSitemap } from '../src/seo/site';

const slugs = process.argv.slice(2).map((slug) => ({ slug }));
fs.writeFileSync(path.join(process.cwd(), 'public', 'sitemap.xml'), buildSitemap(slugs));
console.log(`public/sitemap.xml written (${slugs.length} blog post(s))`);
