import React, { useState, useEffect, useRef, Suspense } from 'react';

/**
 * Defers mounting a below-the-fold homepage section so it stays out of the
 * critical rendering path, without ever hiding it from a crawler.
 *
 * Two independent triggers, whichever fires first:
 *
 *  1. Proximity — an IntersectionObserver with a generous rootMargin, so the
 *     section is already mounted by the time the patient scrolls to it and
 *     they never see the placeholder.
 *  2. Idle — a timer/idle callback after first paint that mounts the section
 *     regardless of scroll position.
 *
 * The idle trigger is the important one, and the reason this isn't plain
 * lazy-on-scroll. This site leans hard on local SEO, and content that only
 * exists after a scroll event is content a crawler may never record. Mounting
 * unconditionally shortly after load means the full page is in the DOM for
 * anything that looks at it, while the initial paint still only pays for the
 * hero. It also means no-JS-scroll contexts (in-page anchors, Ctrl+F, a
 * deep-linked #gallery) find real content rather than an empty box.
 *
 * `minHeight` reserves space so the placeholder swapping for real content
 * doesn't shift the page underneath someone mid-scroll (CLS).
 */

const IDLE_MOUNT_DELAY_MS = 1500;
const PROXIMITY_ROOT_MARGIN = '600px';

interface DeferredSectionProps {
  children: React.ReactNode;
  /** Reserved space before the section mounts, matching its rough real height. */
  minHeight?: number;
  id?: string;
}

export const DeferredSection: React.FC<DeferredSectionProps> = ({ children, minHeight = 480, id }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldRender) return;

    // Trigger 1: the patient is scrolling towards it.
    let observer: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) setShouldRender(true);
        },
        { rootMargin: PROXIMITY_ROOT_MARGIN }
      );
      observer.observe(containerRef.current);
    }

    // Trigger 2: the browser is idle after first paint — mount regardless, so
    // the section always ends up in the DOM even with no scroll at all.
    const idle = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: any) => number);
    const cancelIdle = (window as any).cancelIdleCallback as undefined | ((handle: number) => void);

    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    if (idle) {
      idleHandle = idle(() => setShouldRender(true), { timeout: IDLE_MOUNT_DELAY_MS });
    } else {
      timeoutHandle = window.setTimeout(() => setShouldRender(true), IDLE_MOUNT_DELAY_MS);
    }

    return () => {
      observer?.disconnect();
      if (idleHandle !== undefined && cancelIdle) cancelIdle(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, [shouldRender]);

  return (
    <div ref={containerRef} id={id} style={shouldRender ? undefined : { minHeight }}>
      {shouldRender && <Suspense fallback={<div style={{ minHeight }} />}>{children}</Suspense>}
    </div>
  );
};
