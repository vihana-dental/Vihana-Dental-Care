import React from 'react';
import { Calendar, CalendarDays, User } from 'lucide-react';
import { BLOG_INDEX, type BlogPostLite, type PageData } from '../seo/site';
import { useBooking } from './BookingContext';
import { Breadcrumb } from './Breadcrumb';

// Pinned to the clinic's timezone so the server HTML and the browser agree.
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

const postHref = (post: BlogPostLite) => `/blog/${encodeURIComponent(post.slug)}`;

export const BlogIndexPage: React.FC<{ data: PageData }> = ({ data }) => (
  <section className="py-14 bg-white text-slate-800">
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-10">
      <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Blog' }]} />
      <div className="max-w-3xl space-y-4">
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">{BLOG_INDEX.h1}</h1>
        <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
          Tips, treatment explainers, and updates written by Dr. N. Sanchana and the Vihana Dental Care team.
        </p>
      </div>

      {data.posts.length === 0 ? (
        <p className="text-slate-500 text-sm py-10">No posts yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.posts.map((post) => (
            <article key={post.id} className="bg-[#F5F5F7] rounded-[28px] overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-xl transition-all flex flex-col">
              <a href={postHref(post)} className="block h-48 bg-slate-200 overflow-hidden">
                <img src={post.imageUrl} alt={post.title} width={640} height={192} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </a>
              <div className="p-5 space-y-2 flex-1 flex flex-col">
                <h2 className="text-base font-extrabold text-slate-900 leading-snug line-clamp-2">
                  <a href={postHref(post)} className="hover:text-brand-900">{post.title}</a>
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 flex-1">{post.content}</p>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-200/70">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>
                  <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDate(post.createdAt)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  </section>
);

export const BlogPostPage: React.FC<{ data: PageData }> = ({ data }) => {
  const { openBooking } = useBooking();
  const post = data.post;
  if (!post) return null;
  const others = data.posts.filter((p) => p.id !== post.id).slice(0, 3);

  return (
    <article className="py-14 bg-white text-slate-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 space-y-8">
        <Breadcrumb items={[{ name: 'Home', href: '/' }, { name: 'Blog', href: '/blog' }, { name: post.title }]} />
        <header className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">{post.title}</h1>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-brand-900"><User className="w-3.5 h-3.5" />{post.author}</span>
            <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{formatDate(post.createdAt)}</span>
          </div>
        </header>
        <div className="rounded-[28px] overflow-hidden bg-slate-100 border border-slate-200">
          <img src={post.imageUrl} alt={post.title} width={768} height={384} fetchPriority="high" decoding="async" className="w-full h-64 sm:h-96 object-cover" />
        </div>
        <div className="text-sm sm:text-base text-slate-700 leading-relaxed whitespace-pre-wrap">{post.content}</div>

        <div className="bg-[#F5F5F7] border border-slate-200 rounded-[28px] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-800">Questions about your own teeth? Book an appointment at Vihana Dental Care, Kalapatti.</p>
          <button
            type="button"
            onClick={() => openBooking()}
            className="inline-flex items-center justify-center gap-2 bg-brand-900 hover:bg-brand-950 text-white px-6 py-3 rounded-2xl font-bold text-sm shrink-0 transition-colors"
          >
            <Calendar className="w-4 h-4 text-brand-400" />
            <span>Book Appointment</span>
          </button>
        </div>

        {others.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold text-slate-900">More from the blog</h2>
            <ul className="space-y-2">
              {others.map((p) => (
                <li key={p.id}><a href={postHref(p)} className="text-sm font-semibold text-brand-900 hover:underline">{p.title}</a></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
};
