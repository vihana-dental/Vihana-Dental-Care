import React, { useEffect, useRef, useState } from 'react';
import { Newspaper, Loader2, Image as ImageIcon, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { PanelCard, PanelHeader, LoadingRow, ErrorBanner, inputClass, labelClass, primaryButtonClass, ghostButtonClass, dangerButtonClass } from '../shared';

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

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onSessionExpired: () => void;
}

export const BlogPanel: React.FC<Props> = ({ authedFetch, onSessionExpired }) => {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newError, setNewError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ title: string; author: string; content: string; imageUrl: string | null }>({ title: '', author: '', content: '', imageUrl: null });
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await authedFetch('/api/admin/blog');
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load blog posts.');
      setPosts(data.posts);
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load blog posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewError('');
    if (file.size > MAX_BLOG_IMAGE_BYTES) return setNewError('Image is too large — please use one under 3MB.');
    try {
      setNewImage(await readImageAsDataUri(file));
    } catch (err: any) {
      setNewError(err?.message || 'Could not read that image file.');
    }
  };

  const handlePublish = async () => {
    if (!newTitle.trim() || !newAuthor.trim() || !newContent.trim() || !newImage) {
      return setNewError('Image, title, content, and author are all required.');
    }
    setPublishing(true);
    setNewError('');
    try {
      const res = await authedFetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), author: newAuthor.trim(), content: newContent.trim(), imageUrl: newImage })
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not publish this post.');
      setPosts((prev) => [data.post, ...(prev || [])]);
      setNewTitle(''); setNewAuthor(''); setNewContent(''); setNewImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setNewError(err?.message || 'Could not publish this post. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const startEditing = (post: BlogPost) => {
    setEditingId(post.id);
    setEditDraft({ title: post.title, author: post.author, content: post.content, imageUrl: null });
    setActionError('');
  };

  const handleEditImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BLOG_IMAGE_BYTES) return setActionError('Image is too large — please use one under 3MB.');
    try {
      const dataUri = await readImageAsDataUri(file);
      setEditDraft((d) => ({ ...d, imageUrl: dataUri }));
    } catch (err: any) {
      setActionError(err?.message || 'Could not read that image file.');
    }
  };

  const handleSaveEdit = async (id: string) => {
    setSavingEditId(id);
    setActionError('');
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
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save changes.');
      setPosts((prev) => prev && prev.map((p) => p.id === id ? data.post : p));
      setEditingId(null);
    } catch (err: any) {
      setActionError(err?.message || 'Could not save changes. Please try again.');
    } finally {
      setSavingEditId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setActionError('');
    try {
      const res = await authedFetch(`/api/admin/blog/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not delete this post.');
      setPosts((prev) => prev && prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setActionError(err?.message || 'Could not delete this post. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PanelCard>
      <PanelHeader icon={<Newspaper className="w-5 h-5" />} title="Blog Posts" subtitle="Image, title, content, author — published instantly to the public Blog page" />
      <div className="p-6 space-y-5">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">New Post</p>
          <label className="block">
            <span className={labelClass}>Cover Image *</span>
            <input
              ref={fileInputRef} type="file" accept="image/*" onChange={handleNewImageChange}
              className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-800 file:text-white file:text-xs file:font-bold hover:file:bg-brand-900 file:cursor-pointer cursor-pointer"
            />
          </label>
          {newImage && <img src={newImage} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-slate-200" />}
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Post title *" className={inputClass} />
          <input type="text" value={newAuthor} onChange={(e) => setNewAuthor(e.target.value)} placeholder="Author (e.g. Dr. N. Sanchana) *" className={inputClass} />
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Post content *" rows={5} className={inputClass} />
          {newError && <ErrorBanner message={newError} />}
          <button onClick={handlePublish} disabled={publishing} className={primaryButtonClass + ' w-full'}>
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            <span>{publishing ? 'Publishing...' : 'Publish Post'}</span>
          </button>
        </div>

        {actionError && <ErrorBanner message={actionError} />}
        {loading && <LoadingRow label="Loading posts..." />}
        {loadError && <ErrorBanner message={loadError} onRetry={load} />}
        {posts && !loading && posts.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No posts published yet.</p>}

        {posts && posts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {posts.map((post) => (
              <div key={post.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                {editingId === post.id ? (
                  <div className="space-y-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-slate-500 block mb-1">Replace image (optional)</span>
                      <input type="file" accept="image/*" onChange={handleEditImageChange} className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:bg-brand-800 file:text-white file:text-[11px] file:font-bold hover:file:bg-brand-900 file:cursor-pointer cursor-pointer" />
                    </label>
                    {(editDraft.imageUrl || post.imageUrl) && <img src={editDraft.imageUrl || post.imageUrl} alt="" className="w-full h-24 object-cover rounded-lg border border-slate-200" />}
                    <input type="text" value={editDraft.title} onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))} className={inputClass} />
                    <input type="text" value={editDraft.author} onChange={(e) => setEditDraft((d) => ({ ...d, author: e.target.value }))} className={inputClass} />
                    <textarea value={editDraft.content} onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))} rows={4} className={inputClass} />
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleSaveEdit(post.id)} disabled={savingEditId === post.id} className={primaryButtonClass + ' flex-1'}>
                        {savingEditId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>Save</span>
                      </button>
                      <button onClick={() => setEditingId(null)} className={ghostButtonClass + ' flex-1'}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3">
                      <img src={post.imageUrl} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-200 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{post.title}</p>
                        <p className="text-xs text-slate-500">{post.author}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEditing(post)} className={ghostButtonClass + ' flex-1 text-xs py-2'}>
                        <Pencil className="w-3.5 h-3.5" /><span>Edit</span>
                      </button>
                      <button onClick={() => handleDelete(post.id)} disabled={deletingId === post.id} className={dangerButtonClass + ' flex-1 text-xs py-2'}>
                        {deletingId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
    </PanelCard>
  );
};
