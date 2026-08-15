/**
 * On-demand loader for the Razorpay Checkout SDK.
 *
 * The SDK used to be a plain synchronous <script> in index.html, so every
 * visitor downloaded and executed a third-party payment bundle before the
 * page could finish parsing — including the large majority who never open
 * the booking modal at all. That is pure render-blocking cost on the mobile
 * Lighthouse run.
 *
 * Now it is fetched the first time a patient actually reaches the payment
 * step. The promise is cached, so concurrent callers and repeat attempts
 * share a single network request and a single <script> tag.
 */

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loadPromise: Promise<boolean> | null = null;

/** True once window.Razorpay is usable. Resolves false if the script fails to load. */
export function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    // Reuse a tag that's already in flight (e.g. injected by another surface)
    // rather than racing a second copy of the SDK onto the page.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
    const script = existing || document.createElement('script');

    script.addEventListener('load', () => resolve(Boolean((window as any).Razorpay)));
    script.addEventListener('error', () => {
      // Allow a later attempt to retry from scratch — a failed load here is
      // usually a blocked network or an ad blocker, not a permanent state.
      loadPromise = null;
      resolve(false);
    });

    if (!existing) {
      script.src = RAZORPAY_CHECKOUT_SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return loadPromise;
}
