/**
 * Doctor-authored blog posts — Supabase-backed, additive alongside the rest
 * of the app. A post needs exactly four things (image, title, content,
 * author), created/edited/deleted only from /doctor-admin; the public site
 * only ever reads.
 *
 * Falls back to a fully-functional in-memory store when Supabase isn't
 * configured, so the whole feature — including admin create/edit/delete —
 * can be exercised before credentials exist, matching every other
 * integration's mock-first pattern in this project. The in-memory store is
 * obviously not persisted across restarts; that's fine for local dev, and
 * once SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are set, everything moves to
 * real persisted rows automatically with no code changes.
 */

import crypto from 'crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  content: string;
  author: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPostInput {
  title: string;
  content: string;
  author: string;
  imageUrl: string;
}

function slugify(title: string): string {
  const base = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 70);
  return `${base || 'post'}-${crypto.randomBytes(3).toString('hex')}`;
}

function rowToPost(row: any): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    content: row.content,
    author: row.author,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ---------------- In-memory fallback ----------------
const mockPosts: BlogPost[] = [];

// ---------------- Public reads ----------------

export async function listBlogPosts(): Promise<BlogPost[]> {
  if (!isSupabaseConfigured()) {
    return [...mockPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?select=*&order=created_at.desc`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase blog_posts read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows.map(rowToPost);
  } catch (error: any) {
    console.error('Supabase listBlogPosts failed:', error?.message || error);
    return [];
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  if (!isSupabaseConfigured()) {
    return mockPosts.find((p) => p.slug === slug) || null;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase blog_posts read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows[0] ? rowToPost(rows[0]) : null;
  } catch (error: any) {
    console.error('Supabase getBlogPostBySlug failed:', error?.message || error);
    return null;
  }
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  if (!isSupabaseConfigured()) {
    return mockPosts.find((p) => p.id === id) || null;
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}&select=*&limit=1`, { headers: supabaseHeaders() });
    if (!res.ok) throw new Error(`Supabase blog_posts read failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return rows[0] ? rowToPost(rows[0]) : null;
  } catch (error: any) {
    console.error('Supabase getBlogPostById failed:', error?.message || error);
    return null;
  }
}

// ---------------- Admin writes ----------------

export interface BlogWriteResult {
  success: boolean;
  post?: BlogPost;
  error?: string;
}

export async function createBlogPost(input: BlogPostInput): Promise<BlogWriteResult> {
  const now = new Date().toISOString();
  const slug = slugify(input.title);

  if (!isSupabaseConfigured()) {
    const post: BlogPost = { id: crypto.randomUUID(), slug, ...input, createdAt: now, updatedAt: now };
    mockPosts.unshift(post);
    return { success: true, post };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts`, {
      method: 'POST',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        slug,
        title: input.title,
        content: input.content,
        author: input.author,
        image_url: input.imageUrl
      })
    });
    if (!res.ok) throw new Error(`Supabase blog_posts insert failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    return { success: true, post: rowToPost(rows[0]) };
  } catch (error: any) {
    console.error('Supabase createBlogPost failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function updateBlogPost(id: string, input: Partial<BlogPostInput>): Promise<BlogWriteResult> {
  if (!isSupabaseConfigured()) {
    const post = mockPosts.find((p) => p.id === id);
    if (!post) return { success: false, error: 'Post not found.' };
    Object.assign(post, input, { updatedAt: new Date().toISOString() });
    return { success: true, post };
  }

  try {
    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.content !== undefined) patch.content = input.content;
    if (input.author !== undefined) patch.author = input.author;
    if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: supabaseHeaders({ Prefer: 'return=representation' }),
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error(`Supabase blog_posts update failed: ${res.status} ${await res.text()}`);
    const rows: any[] = await res.json();
    if (!rows[0]) return { success: false, error: 'Post not found.' };
    return { success: true, post: rowToPost(rows[0]) };
  } catch (error: any) {
    console.error('Supabase updateBlogPost failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function deleteBlogPost(id: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    const index = mockPosts.findIndex((p) => p.id === id);
    if (index === -1) return { success: false, error: 'Post not found.' };
    mockPosts.splice(index, 1);
    return { success: true };
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: supabaseHeaders({ Prefer: 'return=minimal' })
    });
    if (!res.ok) throw new Error(`Supabase blog_posts delete failed: ${res.status} ${await res.text()}`);
    return { success: true };
  } catch (error: any) {
    console.error('Supabase deleteBlogPost failed:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown Supabase error' };
  }
}

export async function listBlogPostsForAdmin(): Promise<BlogPost[]> {
  return listBlogPosts();
}
