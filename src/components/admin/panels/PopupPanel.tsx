import React, { useEffect, useMemo, useState } from 'react';
import { PanelTop, Loader2, CheckCircle2, Eye, Image as ImageIcon, Clapperboard } from 'lucide-react';
import { SitePopupConfig, DEFAULT_SITE_POPUP } from '../../../types';
import { resolvePopupMedia } from '../../../lib/popupMedia';
import { SitePopupView } from '../../SitePopup';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, SuccessBanner, ToggleSwitch, inputClass, labelClass, primaryButtonClass, ghostButtonClass } from '../shared';

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_EDGE_PX = 1400;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Reads a poster and shrinks it (long edge 1400px, WebP) so it stays light for visitors. */
function prepareImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.onload = () => {
      const original = reader.result as string;
      if (file.type === 'image/gif') return resolve(original); // keep animation
      const img = new Image();
      img.onerror = () => reject(new Error('That file does not look like an image.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', 0.88));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

export const PopupPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [saved, setSaved] = useState<SitePopupConfig | null>(null);
  const [draft, setDraft] = useState<SitePopupConfig>(DEFAULT_SITE_POPUP);
  const [showAgain, setShowAgain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/site-popup');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load the popup settings.');
      setSaved(data.popup);
      setDraft(data.popup);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load the popup settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = useMemo(
    () => Boolean(saved) && (JSON.stringify({ ...draft, version: 0 }) !== JSON.stringify({ ...saved, version: 0 }) || showAgain),
    [draft, saved, showAgain]
  );
  const media = resolvePopupMedia(draft.kind, draft.url);
  const isUpload = draft.url.startsWith('data:');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    if (file.size > MAX_UPLOAD_BYTES) return setUploadError('That image is too large. Please use one under 8MB.');
    try {
      setDraft((d) => ({ ...d, kind: 'image', url: '' }));
      const uri = await prepareImage(file);
      setDraft((d) => ({ ...d, kind: 'image', url: uri }));
    } catch (err: any) {
      setUploadError(err?.message || 'Could not use that image.');
    }
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    if (!/^video\/(mp4|webm|quicktime)$/.test(file.type)) return setUploadError('Please choose an MP4, WebM or MOV video.');
    if (file.size > MAX_VIDEO_BYTES) return setUploadError('That video is over 50MB. Please compress it, or paste a link instead.');
    setUploadingVideo(true);
    try {
      const res = await authedFetch('/api/admin/site-popup/video', { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed.');
      setDraft((d) => ({ ...d, kind: 'video', url: data.url }));
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError('');
    setNote(null);
    try {
      const res = await authedFetch('/api/admin/site-popup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, showAgain })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save.');
      setSaved(data.popup);
      setDraft(data.popup);
      setShowAgain(false);
      setNote(
        data.persisted === false
          ? { ok: false, text: 'Live now, but it could not be stored, so it may reset if the site restarts. Save again in a moment.' }
          : { ok: true, text: data.popup.enabled ? 'Saved. Visitors who have not seen it yet will get the popup once.' : 'Saved. The popup is off.' }
      );
      setTimeout(() => setNote((n) => (n?.ok ? null : n)), 5000);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const tab = (kind: 'image' | 'video', label: string, icon: React.ReactNode) => (
    <button
      type="button"
      onClick={() => setDraft({ ...draft, kind, url: draft.kind === kind ? draft.url : '' })}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
        draft.kind === kind ? 'bg-brand-800 text-white border-brand-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <PanelCard>
      <PanelHeader icon={<PanelTop className="w-5 h-5" />} title="Welcome Popup" subtitle="A poster, video or Instagram reel shown once to each visitor who opens the website" />
      <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
        {loading && <LoadingRow label="Loading popup settings..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}

        {saved && !loading && (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="flex items-center justify-between gap-4 border border-slate-200 rounded-2xl p-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Show the popup on the website</p>
                <p className="text-xs text-slate-500 mt-0.5">When on, each visitor sees it once, a couple of seconds after opening the site.</p>
              </div>
              <ToggleSwitch checked={draft.enabled} onChange={(on) => setDraft({ ...draft, enabled: on })} />
            </div>

            <div className="flex gap-2">
              {tab('image', 'Poster / image', <ImageIcon className="w-4 h-4" />)}
              {tab('video', 'Video or reel link', <Clapperboard className="w-4 h-4" />)}
            </div>

            {draft.kind === 'image' ? (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Upload a poster</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFile}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-800 file:text-white file:text-xs file:font-bold hover:file:bg-brand-900 file:cursor-pointer cursor-pointer"
                  />
                  {uploadError && <p className="text-xs text-rose-600 mt-1">{uploadError}</p>}
                </div>
                <div>
                  <label className={labelClass}>…or paste a link to an image (https://)</label>
                  <input
                    type="url"
                    value={isUpload ? '' : draft.url}
                    placeholder={isUpload ? 'Uploaded image in use' : 'https://example.com/poster.jpg'}
                    onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Upload a video file (MP4, WebM or MOV, up to 50MB)</label>
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    onChange={handleVideoFile}
                    disabled={uploadingVideo}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-800 file:text-white file:text-xs file:font-bold hover:file:bg-brand-900 file:cursor-pointer cursor-pointer disabled:opacity-50"
                  />
                  {uploadingVideo && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading video, please wait...</p>
                  )}
                  {uploadError && <p className="text-xs text-rose-600 mt-1">{uploadError}</p>}
                </div>
                <label className={labelClass}>…or paste a video link (https://)</label>
                <input
                  type="url"
                  value={draft.url}
                  placeholder="https://www.instagram.com/reel/…  or  https://youtube.com/watch?v=…  or  https://…/video.mp4"
                  onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                  className={inputClass}
                />
                <p className="text-[11px] text-slate-500">
                  Works with an Instagram reel or post, a YouTube video or short, or a direct .mp4 / .webm file. The Instagram or YouTube
                  account must be public. Videos play muted; visitors can turn the sound on.
                </p>
                {draft.url && !media && <p className="text-xs text-rose-600">That link is not recognised as a supported video.</p>}
                {media?.type === 'embed' && <p className="text-xs text-emerald-700">Recognised: {media.label}.</p>}
                {media?.type === 'file' && <p className="text-xs text-emerald-700">Recognised: video file.</p>}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={!media} onClick={() => setPreviewing(true)} className={ghostButtonClass + ' disabled:opacity-50'}>
                <Eye className="w-4 h-4" />
                <span>Preview</span>
              </button>
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input type="checkbox" checked={showAgain} onChange={(e) => setShowAgain(e.target.checked)} className="rounded border-slate-300" />
                Show again to visitors who have already seen it
              </label>
            </div>
            <p className="text-[11px] text-slate-500 -mt-2">
              Choosing a new poster or video always shows it to everyone again once. Turn this on only to re-show the same one.
            </p>

            {saveError && <ErrorBanner message={saveError} />}
            {note && (note.ok ? <SuccessBanner message={note.text} /> : <ErrorBanner message={note.text} />)}

            <div className="flex items-center gap-3">
              <button type="submit" disabled={saving || !dirty} className={primaryButtonClass + ' sm:min-w-[180px]'}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
              {dirty && !saving && <span className="text-xs text-amber-700 font-medium">You have unsaved changes</span>}
            </div>
          </form>
        )}
      </div>
      {previewing && media && <SitePopupView media={media} onClose={() => setPreviewing(false)} />}
    </PanelCard>
  );
};
