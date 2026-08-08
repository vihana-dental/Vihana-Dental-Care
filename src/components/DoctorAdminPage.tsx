import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock, Loader2, AlertTriangle, CheckCircle2, LogOut, IndianRupee, CalendarCheck2, Link2, Tag, Video, XCircle, Newspaper, Image as ImageIcon, Trash2, Pencil, Star } from 'lucide-react';
import { Appointment, FeeConfig } from '../types';

interface ServicePriceRow {
  serviceId: string;
  serviceName: string;
  priceRangeDisplay: string;
}

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  author: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

const MAX_BLOG_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB — comfortably under the 6mb JSON body limit once base64-encoded

function readImageAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that image file.'));
    reader.readAsDataURL(file);
  });
}

const SESSION_STORAGE_KEY = 'vihana_doctor_admin_token';

export const DoctorAdminPage: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(SESSION_STORAGE_KEY));
  const [pin, setPin] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [feeConfig, setFeeConfig] = useState<FeeConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; clientConfigured: boolean } | null>(null);
  const [googleStatusLoading, setGoogleStatusLoading] = useState(false);
  const [googleConnectLoading, setGoogleConnectLoading] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState('');

  // Per-service DISPLAY price ranges shown on the public website + WhatsApp
  // bot — never charged through any route (that's the separate flat fee
  // above). editedPrices holds in-progress edits keyed by serviceId; saving
  // is per-row so one slow/failed save doesn't block the others.
  const [servicePrices, setServicePrices] = useState<ServicePriceRow[] | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesLoadError, setPricesLoadError] = useState('');
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [savedServiceId, setSavedServiceId] = useState<string | null>(null);
  const [priceSaveError, setPriceSaveError] = useState('');

  // Online consults awaiting the doctor's actual availability confirmation
  // before a Google Meet link is generated and pushed to the patient.
  const [pendingConsults, setPendingConsults] = useState<Appointment[] | null>(null);
  const [pendingConsultsLoading, setPendingConsultsLoading] = useState(false);
  const [pendingConsultsError, setPendingConsultsError] = useState('');
  const [actioningConsultId, setActioningConsultId] = useState<string | null>(null);
  const [consultActionError, setConsultActionError] = useState('');

  // Blog — doctor-authored posts (image, title, content, author). Public
  // page only ever reads; every create/edit/delete happens here.
  const [blogPosts, setBlogPosts] = useState<BlogPost[] | null>(null);
  const [blogLoading, setBlogLoading] = useState(false);
  const [blogLoadError, setBlogLoadError] = useState('');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostAuthor, setNewPostAuthor] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [newPostError, setNewPostError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; author: string; content: string; imageUrl: string | null }>({ title: '', author: '', content: '', imageUrl: null });
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [blogActionError, setBlogActionError] = useState('');
  const newPostFileInputRef = useRef<HTMLInputElement>(null);

  // Google review count/rating shown in the Hero badge & Testimonials header
  // — live from Google Places by default, or a manual override set here.
  const [reviewOverride, setReviewOverride] = useState<{ enabled: boolean; rating: number; totalReviews: number } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewLoadError, setReviewLoadError] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewSaveError, setReviewSaveError] = useState('');
  const [reviewSaveSuccess, setReviewSaveSuccess] = useState(false);

  const authedFetch = (url: string, options: RequestInit = {}) =>
    fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });

  const loadGoogleStatus = async () => {
    setGoogleStatusLoading(true);
    try {
      const res = await authedFetch('/api/admin/google-status');
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (data.success) setGoogleStatus({ connected: data.connected, clientConfigured: data.clientConfigured });
    } catch {
      // Non-critical — the connect button will surface its own error if clicked.
    } finally {
      setGoogleStatusLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    setGoogleConnectLoading(true);
    setGoogleConnectError('');
    try {
      const res = await authedFetch('/api/admin/google-connect');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not start the Google connection.');
      window.location.href = data.url;
    } catch (err: any) {
      setGoogleConnectError(err?.message || 'Could not start the Google connection.');
      setGoogleConnectLoading(false);
    }
  };

  const loadFeeConfig = async () => {
    setLoadingConfig(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/fee-config');
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load fee settings.');
      setFeeConfig(data.feeConfig);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load current fee settings.');
    } finally {
      setLoadingConfig(false);
    }
  };

  const loadServicePrices = async () => {
    setPricesLoading(true);
    setPricesLoadError('');
    try {
      const res = await authedFetch('/api/admin/service-pricing');
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load service prices.');
      setServicePrices(data.prices);
      setEditedPrices(Object.fromEntries(data.prices.map((p: ServicePriceRow) => [p.serviceId, p.priceRangeDisplay])));
    } catch (err: any) {
      setPricesLoadError(err?.message || 'Could not load service prices.');
    } finally {
      setPricesLoading(false);
    }
  };

  const handleSaveServicePrice = async (serviceId: string) => {
    setSavingServiceId(serviceId);
    setSavedServiceId(null);
    setPriceSaveError('');
    try {
      const res = await authedFetch('/api/admin/service-pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, priceRangeDisplay: editedPrices[serviceId] })
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save price.');
      setServicePrices((prev) => prev && prev.map((p) => p.serviceId === serviceId ? { ...p, priceRangeDisplay: data.priceRangeDisplay } : p));
      setSavedServiceId(serviceId);
      setTimeout(() => setSavedServiceId((current) => current === serviceId ? null : current), 2500);
    } catch (err: any) {
      setPriceSaveError(err?.message || 'Could not save this price. Please try again.');
    } finally {
      setSavingServiceId(null);
    }
  };

  const loadPendingConsults = async () => {
    setPendingConsultsLoading(true);
    setPendingConsultsError('');
    try {
      const res = await authedFetch('/api/admin/pending-online-consults');
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load pending consults.');
      setPendingConsults(data.appointments);
    } catch (err: any) {
      setPendingConsultsError(err?.message || 'Could not load pending online consults.');
    } finally {
      setPendingConsultsLoading(false);
    }
  };

  const handleApproveConsult = async (id: string) => {
    setActioningConsultId(id);
    setConsultActionError('');
    try {
      const res = await authedFetch(`/api/admin/online-consults/${encodeURIComponent(id)}/approve`, { method: 'POST' });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not approve this consult.');
      setPendingConsults((prev) => prev && prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setConsultActionError(err?.message || 'Could not approve this consult. Please try again.');
    } finally {
      setActioningConsultId(null);
    }
  };

  const handleRescheduleConsult = async (id: string) => {
    setActioningConsultId(id);
    setConsultActionError('');
    try {
      const res = await authedFetch(`/api/admin/online-consults/${encodeURIComponent(id)}/reschedule`, { method: 'POST' });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not release this slot.');
      setPendingConsults((prev) => prev && prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setConsultActionError(err?.message || 'Could not release this slot. Please try again.');
    } finally {
      setActioningConsultId(null);
    }
  };

  const loadBlogPosts = async () => {
    setBlogLoading(true);
    setBlogLoadError('');
    try {
      const res = await authedFetch('/api/admin/blog');
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load blog posts.');
      setBlogPosts(data.posts);
    } catch (err: any) {
      setBlogLoadError(err?.message || 'Could not load blog posts.');
    } finally {
      setBlogLoading(false);
    }
  };

  const handleNewPostImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewPostError('');
    if (file.size > MAX_BLOG_IMAGE_BYTES) {
      setNewPostError('Image is too large — please use one under 3MB.');
      return;
    }
    try {
      setNewPostImage(await readImageAsDataUri(file));
    } catch (err: any) {
      setNewPostError(err?.message || 'Could not read that image file.');
    }
  };

  const handlePublishPost = async () => {
    if (!newPostTitle.trim() || !newPostAuthor.trim() || !newPostContent.trim() || !newPostImage) {
      setNewPostError('Image, title, content, and author are all required.');
      return;
    }
    setPublishing(true);
    setNewPostError('');
    try {
      const res = await authedFetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newPostTitle.trim(), author: newPostAuthor.trim(), content: newPostContent.trim(), imageUrl: newPostImage })
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not publish this post.');
      setBlogPosts((prev) => [data.post, ...(prev || [])]);
      setNewPostTitle('');
      setNewPostAuthor('');
      setNewPostContent('');
      setNewPostImage(null);
      if (newPostFileInputRef.current) newPostFileInputRef.current.value = '';
    } catch (err: any) {
      setNewPostError(err?.message || 'Could not publish this post. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const startEditingPost = (post: BlogPost) => {
    setEditingPostId(post.id);
    setEditDraft({ title: post.title, author: post.author, content: post.content, imageUrl: null });
    setBlogActionError('');
  };

  const handleEditImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BLOG_IMAGE_BYTES) {
      setBlogActionError('Image is too large — please use one under 3MB.');
      return;
    }
    try {
      setEditDraft((d) => ({ ...d, imageUrl: null }));
      const dataUri = await readImageAsDataUri(file);
      setEditDraft((d) => ({ ...d, imageUrl: dataUri }));
    } catch (err: any) {
      setBlogActionError(err?.message || 'Could not read that image file.');
    }
  };

  const handleSaveEdit = async (id: string) => {
    setSavingEditId(id);
    setBlogActionError('');
    try {
      const res = await authedFetch(`/api/admin/blog/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editDraft.title.trim(),
          author: editDraft.author.trim(),
          content: editDraft.content.trim(),
          ...(editDraft.imageUrl ? { imageUrl: editDraft.imageUrl } : {})
        })
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save changes.');
      setBlogPosts((prev) => prev && prev.map((p) => p.id === id ? data.post : p));
      setEditingPostId(null);
    } catch (err: any) {
      setBlogActionError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSavingEditId(null);
    }
  };

  const handleDeletePost = async (id: string) => {
    setDeletingPostId(id);
    setBlogActionError('');
    try {
      const res = await authedFetch(`/api/admin/blog/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not delete this post.');
      setBlogPosts((prev) => prev && prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setBlogActionError(err?.message || 'Could not delete this post. Please try again.');
    } finally {
      setDeletingPostId(null);
    }
  };

  const loadReviewOverride = async () => {
    setReviewLoading(true);
    setReviewLoadError('');
    try {
      const res = await authedFetch('/api/admin/review-override');
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load review settings.');
      setReviewOverride(data.override);
    } catch (err: any) {
      setReviewLoadError(err?.message || 'Could not load review settings.');
    } finally {
      setReviewLoading(false);
    }
  };

  const handleSaveReviewOverride = async () => {
    if (!reviewOverride) return;
    setReviewSaving(true);
    setReviewSaveError('');
    setReviewSaveSuccess(false);
    try {
      const res = await authedFetch('/api/admin/review-override', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewOverride)
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save.');
      setReviewOverride(data.override);
      setReviewSaveSuccess(true);
      setTimeout(() => setReviewSaveSuccess(false), 3000);
    } catch (err: any) {
      setReviewSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setReviewSaving(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadFeeConfig();
      loadGoogleStatus();
      loadServicePrices();
      loadPendingConsults();
      loadBlogPosts();
      loadReviewOverride();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Login failed.');
      sessionStorage.setItem(SESSION_STORAGE_KEY, data.token);
      setToken(data.token);
      setPin('');
    } catch (err: any) {
      setLoginError(err?.message || 'Could not log in. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setToken(null);
    setFeeConfig(null);
    setServicePrices(null);
    setPendingConsults(null);
    setBlogPosts(null);
    setReviewOverride(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feeConfig) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const res = await authedFetch('/api/admin/fee-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feeConfig)
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save.');
      setFeeConfig(data.feeConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6 text-teal-300">
          <ShieldCheck className="w-5 h-5" />
          <span className="text-xs font-bold tracking-widest uppercase">Vihana Dental Care — Doctor Admin</span>
        </div>

        {!token ? (
          <form onSubmit={handleLogin} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 pb-2">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Lock className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Doctor Login</p>
                <p className="text-[10px] text-slate-400">Enter your PIN to manage booking fees</p>
              </div>
            </div>

            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              className="w-full bg-slate-950 text-white text-center tracking-[0.4em] text-lg px-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:border-teal-500"
            />

            {loginError && (
              <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading || !pin.trim()}
              className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors"
            >
              {loginLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>{loginLoading ? 'Verifying...' : 'Unlock'}</span>
            </button>
          </form>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                  <IndianRupee className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <p className="text-sm font-bold">Booking Advance Fees</p>
                  <p className="text-[10px] text-slate-400">Changes apply to new bookings immediately</p>
                </div>
              </div>
              <button onClick={handleLogout} className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Log out" title="Log out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {loadingConfig && (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-6">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>Loading current fees...</span>
              </div>
            )}

            {loadError && (
              <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>{loadError}</p>
                  <button onClick={loadFeeConfig} className="underline font-semibold mt-1">Retry</button>
                </div>
              </div>
            )}

            {feeConfig && !loadingConfig && (
              <form onSubmit={handleSave} className="space-y-4">
                <label className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200">Require advance fee to confirm booking</span>
                  <input
                    type="checkbox"
                    checked={feeConfig.confirmationFeeEnabled}
                    onChange={(e) => setFeeConfig({ ...feeConfig, confirmationFeeEnabled: e.target.checked })}
                    className="w-4 h-4 accent-teal-500"
                  />
                </label>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">In-Clinic Visit Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={feeConfig.inClinicFeeINR}
                    onChange={(e) => setFeeConfig({ ...feeConfig, inClinicFeeINR: Number(e.target.value) })}
                    className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Online Video Consult Fee (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={feeConfig.onlineFeeINR}
                    onChange={(e) => setFeeConfig({ ...feeConfig, onlineFeeINR: Number(e.target.value) })}
                    className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>

                {saveError && (
                  <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                )}
                {saveSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-900 text-emerald-300 text-xs p-2.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Saved. New fees are live.</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </form>
            )}
          </div>
        )}

        {token && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl mt-5">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Video className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Pending Online Consults</p>
                <p className="text-[10px] text-slate-400">Approve to generate the Meet link (sent to the patient on WhatsApp) or release the slot</p>
              </div>
            </div>

            {pendingConsultsLoading && (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-6">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>Loading pending consults...</span>
              </div>
            )}

            {pendingConsultsError && (
              <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>{pendingConsultsError}</p>
                  <button onClick={loadPendingConsults} className="underline font-semibold mt-1">Retry</button>
                </div>
              </div>
            )}

            {consultActionError && (
              <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{consultActionError}</span>
              </div>
            )}

            {pendingConsults && !pendingConsultsLoading && pendingConsults.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">Nothing waiting — all online consults are confirmed.</p>
            )}

            {pendingConsults && pendingConsults.length > 0 && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto scroll-thin pr-1">
                {pendingConsults.map((appt) => (
                  <div key={appt.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <div>
                      <p className="text-xs font-bold text-white">{appt.patientName}</p>
                      <p className="text-[11px] text-slate-400">{appt.serviceName}</p>
                      <p className="text-[11px] text-teal-300 font-semibold mt-0.5">{appt.date} at {appt.timeSlot}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">#{appt.id} • {appt.patientPhone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveConsult(appt.id)}
                        disabled={actioningConsultId === appt.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-[11px] font-bold py-2.5 rounded-lg transition-colors"
                      >
                        {actioningConsultId === appt.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRescheduleConsult(appt.id)}
                        disabled={actioningConsultId === appt.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-[11px] font-bold py-2.5 rounded-lg transition-colors border border-slate-700"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Release Slot</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {token && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl mt-5">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Tag className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Treatment Price Ranges</p>
                <p className="text-[10px] text-slate-400">Shown on the website & WhatsApp bot only — never charged directly</p>
              </div>
            </div>

            {pricesLoading && (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-6">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>Loading treatment prices...</span>
              </div>
            )}

            {pricesLoadError && (
              <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>{pricesLoadError}</p>
                  <button onClick={loadServicePrices} className="underline font-semibold mt-1">Retry</button>
                </div>
              </div>
            )}

            {priceSaveError && (
              <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{priceSaveError}</span>
              </div>
            )}

            {servicePrices && !pricesLoading && (
              <div className="space-y-2.5 max-h-80 overflow-y-auto scroll-thin pr-1">
                {servicePrices.map((row) => (
                  <div key={row.serviceId} className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400">{row.serviceName}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedPrices[row.serviceId] ?? ''}
                        onChange={(e) => setEditedPrices({ ...editedPrices, [row.serviceId]: e.target.value })}
                        placeholder="e.g. ₹22,000 - ₹45,000 per implant"
                        className="flex-1 min-w-0 bg-slate-950 text-white px-3 py-2.5 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-teal-500"
                      />
                      <button
                        onClick={() => handleSaveServicePrice(row.serviceId)}
                        disabled={savingServiceId === row.serviceId || editedPrices[row.serviceId] === row.priceRangeDisplay}
                        className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white transition-colors"
                        aria-label={`Save price for ${row.serviceName}`}
                        title="Save"
                      >
                        {savingServiceId === row.serviceId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : savedServiceId === row.serviceId ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Tag className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {token && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl mt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <CalendarCheck2 className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Google Calendar & Sheets</p>
                <p className="text-[10px] text-slate-400">Powers availability sync, event creation, Meet links & the appointment log sheet</p>
              </div>
            </div>

            {googleStatusLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>Checking connection...</span>
              </div>
            )}

            {!googleStatusLoading && googleStatus && (
              <>
                <div className={`flex items-center gap-2 text-xs rounded-xl p-3 border ${
                  googleStatus.connected
                    ? 'bg-emerald-950/40 border-emerald-900 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-900 text-amber-300'
                }`}>
                  {googleStatus.connected ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                  <span>{googleStatus.connected ? 'Connected — bookings sync live.' : 'Not connected — bookings use placeholder data until connected.'}</span>
                </div>

                {!googleStatus.clientConfigured && (
                  <p className="text-[10px] text-slate-500">
                    GOOGLE_OAUTH_CLIENT_ID / SECRET / REDIRECT_URI aren't set in .env yet — add those first.
                  </p>
                )}

                {googleConnectError && (
                  <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{googleConnectError}</span>
                  </div>
                )}

                <button
                  onClick={handleConnectGoogle}
                  disabled={googleConnectLoading || !googleStatus.clientConfigured}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl transition-colors border border-slate-700"
                >
                  {googleConnectLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  <span>{googleConnectLoading ? 'Redirecting to Google...' : googleStatus.connected ? 'Reconnect / Switch Google Account' : 'Connect Google Calendar'}</span>
                </button>
              </>
            )}
          </div>
        )}

        {token && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl mt-5">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Newspaper className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Blog Posts</p>
                <p className="text-[10px] text-slate-400">Image, title, content, author — published instantly to the public Blog page</p>
              </div>
            </div>

            {/* New post form */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-slate-300">New Post</p>

              <label className="block">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">Cover Image *</span>
                <input
                  ref={newPostFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleNewPostImageChange}
                  className="w-full text-[11px] text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:text-[11px] file:font-bold hover:file:bg-teal-500 file:cursor-pointer cursor-pointer"
                />
              </label>

              {newPostImage && (
                <img src={newPostImage} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-slate-800" />
              )}

              <input
                type="text"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="Post title *"
                className="w-full bg-slate-900 text-white px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-teal-500"
              />
              <input
                type="text"
                value={newPostAuthor}
                onChange={(e) => setNewPostAuthor(e.target.value)}
                placeholder="Author (e.g. Dr. N. Sanchana) *"
                className="w-full bg-slate-900 text-white px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-teal-500"
              />
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Post content *"
                rows={5}
                className="w-full bg-slate-900 text-white px-3.5 py-2.5 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-teal-500"
              />

              {newPostError && (
                <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{newPostError}</span>
                </div>
              )}

              <button
                onClick={handlePublishPost}
                disabled={publishing}
                className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold py-3 rounded-xl transition-colors"
              >
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                <span>{publishing ? 'Publishing...' : 'Publish Post'}</span>
              </button>
            </div>

            {blogActionError && (
              <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{blogActionError}</span>
              </div>
            )}

            {blogLoading && (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-6">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>Loading posts...</span>
              </div>
            )}

            {blogLoadError && (
              <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>{blogLoadError}</p>
                  <button onClick={loadBlogPosts} className="underline font-semibold mt-1">Retry</button>
                </div>
              </div>
            )}

            {blogPosts && !blogLoading && blogPosts.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4">No posts published yet.</p>
            )}

            {blogPosts && blogPosts.length > 0 && (
              <div className="space-y-2.5 max-h-96 overflow-y-auto scroll-thin pr-1">
                {blogPosts.map((post) => (
                  <div key={post.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    {editingPostId === post.id ? (
                      <div className="space-y-2">
                        <label className="block">
                          <span className="text-[10px] font-semibold text-slate-400 block mb-1">Replace image (optional)</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleEditImageChange}
                            className="w-full text-[10px] text-slate-400 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-teal-600 file:text-white file:text-[10px] file:font-bold hover:file:bg-teal-500 file:cursor-pointer cursor-pointer"
                          />
                        </label>
                        {(editDraft.imageUrl || post.imageUrl) && (
                          <img src={editDraft.imageUrl || post.imageUrl} alt="" className="w-full h-24 object-cover rounded-lg border border-slate-800" />
                        )}
                        <input
                          type="text"
                          value={editDraft.title}
                          onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                          className="w-full bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-800 text-xs focus:outline-none focus:border-teal-500"
                        />
                        <input
                          type="text"
                          value={editDraft.author}
                          onChange={(e) => setEditDraft((d) => ({ ...d, author: e.target.value }))}
                          className="w-full bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-800 text-xs focus:outline-none focus:border-teal-500"
                        />
                        <textarea
                          value={editDraft.content}
                          onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                          rows={4}
                          className="w-full bg-slate-900 text-white px-3 py-2 rounded-lg border border-slate-800 text-xs focus:outline-none focus:border-teal-500"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSaveEdit(post.id)}
                            disabled={savingEditId === post.id}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-[11px] font-bold py-2 rounded-lg"
                          >
                            {savingEditId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>Save</span>
                          </button>
                          <button
                            onClick={() => setEditingPostId(null)}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold py-2 rounded-lg border border-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <img src={post.imageUrl} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-800 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">{post.title}</p>
                            <p className="text-[10px] text-slate-400">{post.author}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditingPost(post)}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold py-2 rounded-lg border border-slate-700"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            disabled={deletingPostId === post.id}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-rose-950/60 hover:bg-rose-950 disabled:opacity-50 text-rose-300 text-[11px] font-bold py-2 rounded-lg border border-rose-900"
                          >
                            {deletingPostId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            <span>Delete</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {token && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl mt-5">
            <div className="flex items-center gap-3 pb-2 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                <Star className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Google Reviews</p>
                <p className="text-[10px] text-slate-400">Shown in the Hero badge & Testimonials header</p>
              </div>
            </div>

            {reviewLoading && (
              <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-6">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span>Loading review settings...</span>
              </div>
            )}

            {reviewLoadError && (
              <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p>{reviewLoadError}</p>
                  <button onClick={loadReviewOverride} className="underline font-semibold mt-1">Retry</button>
                </div>
              </div>
            )}

            {reviewOverride && !reviewLoading && (
              <div className="space-y-4">
                <label className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200">Use manual override (instead of live Google rating)</span>
                  <input
                    type="checkbox"
                    checked={reviewOverride.enabled}
                    onChange={(e) => setReviewOverride({ ...reviewOverride, enabled: e.target.checked })}
                    className="w-4 h-4 accent-teal-500"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Rating (0–5)</label>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={reviewOverride.rating}
                      onChange={(e) => setReviewOverride({ ...reviewOverride, rating: Number(e.target.value) })}
                      className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Total Reviews</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={reviewOverride.totalReviews}
                      onChange={(e) => setReviewOverride({ ...reviewOverride, totalReviews: Number(e.target.value) })}
                      className="w-full bg-slate-950 text-white px-4 py-3 rounded-xl border border-slate-800 text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {!reviewOverride.enabled && (
                  <p className="text-[10px] text-slate-500">
                    Currently pulling live from Google Places (or the static fallback if that isn't configured). Turn the toggle on to set these numbers manually instead.
                  </p>
                )}

                {reviewSaveError && (
                  <div className="flex items-center gap-2 bg-rose-950/50 border border-rose-900 text-rose-300 text-xs p-2.5 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{reviewSaveError}</span>
                  </div>
                )}
                {reviewSaveSuccess && (
                  <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-900 text-emerald-300 text-xs p-2.5 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Saved. Live on the site now.</span>
                  </div>
                )}

                <button
                  onClick={handleSaveReviewOverride}
                  disabled={reviewSaving}
                  className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm font-bold py-3 rounded-xl transition-colors"
                >
                  {reviewSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{reviewSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[10px] text-slate-600 mt-6">Vihana Dental Care internal tool. Not linked from the public site.</p>
      </div>
    </div>
  );
};
