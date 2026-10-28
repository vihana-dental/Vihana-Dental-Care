import React from 'react';

export const Breadcrumb: React.FC<{ items: { name: string; href?: string }[] }> = ({ items }) => (
  <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
    <ol className="flex flex-wrap items-center gap-1.5">
      {items.map((it, i) => (
        <li key={it.name} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">/</span>}
          {it.href ? (
            <a href={it.href} className="hover:text-brand-900 underline-offset-2 hover:underline">{it.name}</a>
          ) : (
            <span className="text-slate-700 font-semibold" aria-current="page">{it.name}</span>
          )}
        </li>
      ))}
    </ol>
  </nav>
);
