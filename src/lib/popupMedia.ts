/** How a popup's media link is shown: a plain image, a <video> file, or an embedded player. */
export type PopupMedia =
  | { type: 'image'; src: string }
  | { type: 'file'; src: string }
  | { type: 'embed'; src: string; portrait: boolean; label: string }
  | null;

const VIDEO_FILE = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;

export function resolvePopupMedia(kind: 'image' | 'video', url: string): PopupMedia {
  const raw = (url || '').trim();
  if (!raw) return null;
  if (kind === 'image') return { type: 'image', src: raw };

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');

  if (host === 'instagram.com') {
    const m = /^\/(?:[^/]+\/)?(reel|reels|p|tv)\/([A-Za-z0-9_-]+)/.exec(u.pathname);
    if (m) {
      return { type: 'embed', src: `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed`, portrait: true, label: 'Instagram' };
    }
    return null;
  }

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let id = '';
    let portrait = false;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else {
      const m = /^\/(shorts|embed|live)\/([A-Za-z0-9_-]+)/.exec(u.pathname);
      if (m) {
        id = m[2];
        portrait = m[1] === 'shorts';
      }
    }
    if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) return null;
    return { type: 'embed', src: `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0`, portrait, label: 'YouTube' };
  }

  if (VIDEO_FILE.test(u.pathname + u.search)) return { type: 'file', src: raw };
  return null;
}
