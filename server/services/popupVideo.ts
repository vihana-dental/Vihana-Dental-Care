/**
 * Video upload for the welcome popup. Videos are far too big to keep in the
 * settings table the way a poster is, so an uploaded clip goes to a public
 * Supabase Storage bucket and only its URL is saved with the popup settings.
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'popup-media';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // Supabase's default per-file ceiling
const EXT_BY_TYPE: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

let bucketReady = false;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: MAX_VIDEO_BYTES })
  });
  // 400/409 just means the bucket already exists.
  if (!res.ok && res.status !== 400 && res.status !== 409) throw new Error(`Could not prepare storage (${res.status}).`);
  bucketReady = true;
}

export async function uploadPopupVideo(
  data: Buffer,
  contentType: string
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { success: false, error: 'Video upload needs the storage connection, which is not set up here. Paste a video link instead.' };
  }
  const type = contentType.split(';')[0].trim().toLowerCase();
  const ext = EXT_BY_TYPE[type];
  if (!ext) return { success: false, error: 'Please upload an MP4, WebM or MOV video.' };
  if (data.length === 0) return { success: false, error: 'That file is empty.' };
  if (data.length > MAX_VIDEO_BYTES) return { success: false, error: 'That video is over 50MB. Please compress it or paste a link instead.' };

  try {
    await ensureBucket();
    const name = `popup-${Date.now()}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': type,
        'cache-control': 'max-age=31536000'
      },
      body: data
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    return { success: true, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}` };
  } catch (err: any) {
    console.error('Popup video upload failed:', err?.message || err);
    return { success: false, error: 'The upload failed. Please try again, or paste a video link instead.' };
  }
}
