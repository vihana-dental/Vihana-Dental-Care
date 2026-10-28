import {StrictMode} from 'react';
import {createRoot, hydrateRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {initClickTracking} from './lib/tracking';

initClickTracking();

const root = document.getElementById('root')!;
const pageDataEl = document.getElementById('__PAGE_DATA__');

if (pageDataEl) {
  // A server-rendered page (service landing page, blog, contact): the HTML is
  // already in #root, so hydrate it instead of rebuilding it. Loaded on demand
  // so the home page's bundle doesn't carry these pages.
  const data = JSON.parse(pageDataEl.textContent || '{}');
  import('./pages/PageApp').then(({PageApp}) => {
    hydrateRoot(root, <StrictMode><PageApp data={data} /></StrictMode>);
  });
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
