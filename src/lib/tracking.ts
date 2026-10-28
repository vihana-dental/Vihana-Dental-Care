/**
 * Click tracking on the site's existing Google tag (gtag.js, see index.html).
 * One delegated listener reads links as they are clicked — it never edits
 * them — and queues an event for each of:
 *
 *   phone_click     any tel: link
 *   whatsapp_click  any wa.me link (the number is read from the link, never set here)
 *   form_submit     the contact form (fired from InquirySection)
 *
 * gtag is a queueing stub until the library loads, so calling it early is safe.
 * If the tag is missing or blocked, tracking quietly does nothing.
 */

type Gtag = (command: 'event', name: string, params?: Record<string, unknown>) => void;

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  try {
    const gtag = (window as unknown as { gtag?: Gtag }).gtag;
    if (typeof gtag === 'function') gtag('event', name, params);
  } catch {
    /* never let analytics break a click */
  }
}

export function initClickTracking(): void {
  document.addEventListener(
    'click',
    (e) => {
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (/^tel:/i.test(href)) {
        trackEvent('phone_click', { link_url: href, link_text: (link.textContent || '').trim().slice(0, 80), page_path: location.pathname });
      } else if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(href)) {
        trackEvent('whatsapp_click', { link_url: href, link_text: (link.textContent || '').trim().slice(0, 80), page_path: location.pathname });
        // Google Ads conversion for "Book appointment" WhatsApp links only,
        // queued on click before the browser follows the link.
        const label = `${link.textContent || ''} ${link.getAttribute('aria-label') || ''}`;
        if (/book|appointment/i.test(label) && typeof (window as any).gtag === 'function') {
          (window as any).gtag('event', 'conversion', { send_to: 'AW-11335208700/lx5jCP7A4-IcEPydhp0q' });
        }
      }
    },
    true
  );
}
