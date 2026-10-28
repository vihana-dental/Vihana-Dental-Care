import React from 'react';
import { renderToString } from 'react-dom/server';
import { PageApp } from '../../src/pages/PageApp';
import { buildPageMeta, resolvePage, type PageData } from '../../src/seo/site';

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** JSON for embedding in a <script> tag: "<" is escaped so content can't close the tag. */
const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .split(String.fromCharCode(0x2028)).join('\\u2028')
    .split(String.fromCharCode(0x2029)).join('\\u2029');

function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const re = new RegExp(`<meta ${attr}="${key}"[^>]*>`);
  const tag = `<meta ${attr}="${key}" content="${escAttr(value)}" />`;
  return re.test(html) ? html.replace(re, () => tag) : html.replace('</head>', () => `    ${tag}\n  </head>`);
}

/**
 * Turns the SPA shell (dist/index.html) into a fully server-rendered page:
 * the page's own title, description, canonical, social tags and JSON-LD in the
 * head, and the page content already inside #root so crawlers and no-JS
 * visitors get real text. The client then hydrates it (see src/main.tsx).
 * Returns null if `data.path` isn't one of the server-rendered pages.
 */
export function renderPage(template: string, data: PageData): string | null {
  const page = resolvePage(data.path);
  if (!page) return null;
  const meta = buildPageMeta(page, data);
  const body = renderToString(<PageApp data={data} />);

  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escText(meta.title)}</title>`);
  html = setMeta(html, 'name', 'title', meta.title);
  html = setMeta(html, 'name', 'description', meta.description);
  html = html.replace(/<link rel="canonical"[^>]*>/, () => `<link rel="canonical" href="${escAttr(meta.canonical)}" />`);
  html = setMeta(html, 'property', 'og:type', page.kind === 'blog-post' ? 'article' : 'website');
  html = setMeta(html, 'property', 'og:url', meta.canonical);
  html = setMeta(html, 'property', 'og:title', meta.title);
  html = setMeta(html, 'property', 'og:description', meta.description);
  html = setMeta(html, 'property', 'og:image', meta.ogImage);
  html = setMeta(html, 'property', 'og:image:alt', meta.title);
  html = setMeta(html, 'name', 'twitter:title', meta.title);
  html = setMeta(html, 'name', 'twitter:description', meta.description);
  html = setMeta(html, 'name', 'twitter:image', meta.ogImage);

  // The home page's LocalBusiness block and its hero preloads/placeholder
  // belong to "/" only.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '');
  html = html.replace(/<link rel="preload" as="image" href="\/images\/hero-[^>]*>\s*/g, '');
  html = html.replace(/<div id="boot-hero"[\s\S]*?<\/picture><\/div>\s*/, '');
  // The home page's no-JS fallback (its own H1 and contact block); these pages
  // are already fully rendered in the HTML.
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>\s*/, '');

  const ld = meta.jsonLd.map((obj) => `    <script type="application/ld+json">${safeJson(obj)}</script>`).join('\n');
  html = html.replace('</head>', () => `${ld}\n  </head>`);

  html = html.replace('<div id="root"></div>', () => `<div id="root">${body}</div>`);
  html = html.replace('<script type="module"', () => `<script id="__PAGE_DATA__" type="application/json">${safeJson(data)}</script>\n    <script type="module"`);

  return html;
}
