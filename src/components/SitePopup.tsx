import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { resolvePopupMedia, type PopupMedia } from '../lib/popupMedia';

const SEEN_KEY = 'vihana-popup-seen';
// Long enough for the intro loader (~1.4s) to release its scroll lock first.
const SHOW_DELAY_MS = 2200;

/** The popup itself — also used by the admin console's preview. */
export const SitePopupView: React.FC<{ media: NonNullable<PopupMedia>; onClose: () => void }> = ({ media, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const embedBox =
    media.type === 'embed' && media.portrait
      ? 'w-[min(92vw,380px)] h-[min(82vh,680px)]'
      : 'w-[min(92vw,900px)] aspect-video';

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome message from Vihana Dental Care"
      onClick={onClose}
    >
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-3 -right-3 z-10 bg-white text-slate-800 p-2 rounded-full shadow-lg border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {media.type === 'image' && (
          <img src={media.src} alt="Vihana Dental Care announcement" className="block max-w-[92vw] max-h-[82vh] w-auto h-auto rounded-2xl shadow-2xl bg-white" />
        )}
        {media.type === 'file' && (
          <video
            src={media.src}
            controls
            autoPlay
            muted
            playsInline
            loop
            className="block max-w-[92vw] max-h-[82vh] rounded-2xl shadow-2xl bg-black"
          />
        )}
        {media.type === 'embed' && (
          <iframe
            src={media.src}
            title={`${media.label} video from Vihana Dental Care`}
            className={`block ${embedBox} rounded-2xl shadow-2xl bg-white border-0`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        )}
      </div>
    </div>
  );
};

/**
 * Shows the clinic's welcome popup (set in /doctor-admin) once per visitor.
 * "Seen" is remembered in the browser against the popup's version, so editing
 * the popup or choosing "show again" in the admin shows it to everyone anew.
 * Any failure (offline, storage blocked, nothing configured) shows nothing.
 */
export const SitePopup: React.FC = () => {
  const [media, setMedia] = useState<PopupMedia>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/site-popup');
        const data = await res.json();
        const popup = data?.popup;
        if (cancelled || !popup) return;

        let seen: string | null = null;
        try { seen = localStorage.getItem(SEEN_KEY); } catch { /* storage blocked */ }
        if (seen === String(popup.version)) return;

        const resolved = resolvePopupMedia(popup.kind, popup.url);
        if (!resolved) return;
        // Marked as seen the moment it appears, so a refresh doesn't repeat it.
        try { localStorage.setItem(SEEN_KEY, String(popup.version)); } catch { /* ignore */ }
        setMedia(resolved);
      } catch { /* no popup */ }
    }, SHOW_DELAY_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  if (!media) return null;
  return <SitePopupView media={media} onClose={() => setMedia(null)} />;
};
