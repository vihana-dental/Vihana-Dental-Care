import type { SitePopupConfig } from '../../src/types';
import { DEFAULT_SITE_POPUP } from '../../src/types';
import { resolvePopupMedia } from '../../src/lib/popupMedia';

export const SITE_POPUP_SETTING_KEY = 'site_popup';
const MAX_URL_LENGTH = 4 * 1024 * 1024; // an uploaded poster travels as a base64 data: URI
const DATA_IMAGE_RE = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/;

/** Coerces stored/received JSON into a valid config. Never throws; bad input becomes the "off" default. */
export function normalizeSitePopup(input: any): SitePopupConfig {
  const kind = input?.kind === 'video' ? 'video' : 'image';
  const url = typeof input?.url === 'string' ? input.url.trim() : '';
  const version = Number.isInteger(input?.version) && input.version > 0 ? input.version : 1;
  return { ...DEFAULT_SITE_POPUP, enabled: Boolean(input?.enabled), kind, url, version };
}

/** Returns an error message if the admin's draft can't be shown, otherwise null. */
export function validateSitePopup(cfg: SitePopupConfig): string | null {
  if (!cfg.enabled && !cfg.url) return null;
  if (!cfg.url) return 'Add a poster or a video link first.';
  if (cfg.url.length > MAX_URL_LENGTH) return 'That file is too large. Use an image under about 3MB.';
  if (cfg.kind === 'image') {
    if (DATA_IMAGE_RE.test(cfg.url)) return null;
    return /^https:\/\//i.test(cfg.url) ? null : 'The poster must be an uploaded image or an https:// link to one.';
  }
  return resolvePopupMedia('video', cfg.url)
    ? null
    : 'That video link is not supported. Use a YouTube link, an Instagram reel/post link, or a direct .mp4/.webm link.';
}
