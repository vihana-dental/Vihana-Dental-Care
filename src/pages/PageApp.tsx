import React from 'react';
import { PageShell } from './PageShell';
import { ServiceLanding } from './ServiceLanding';
import { BlogIndexPage, BlogPostPage } from './BlogPages';
import { ContactPage } from './ContactPage';
import { resolvePage, type PageData } from '../seo/site';

/** Renders one of the server-rendered pages. Used by the server (renderToString) and the client (hydrateRoot). */
export const PageApp: React.FC<{ data: PageData }> = ({ data }) => {
  const page = resolvePage(data.path);
  if (!page) return null;

  switch (page.kind) {
    case 'service':
      return (
        <PageShell activeNav="services">
          <ServiceLanding def={page.def} data={data} />
        </PageShell>
      );
    case 'blog-index':
      return (
        <PageShell activeNav="blog">
          <BlogIndexPage data={data} />
        </PageShell>
      );
    case 'blog-post':
      return (
        <PageShell activeNav="blog">
          <BlogPostPage data={data} />
        </PageShell>
      );
    case 'contact':
      return (
        <PageShell activeNav="location">
          <ContactPage />
        </PageShell>
      );
  }
};
