import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Newspaper, X, User, CalendarDays } from 'lucide-react';

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

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

export const BlogView: React.FC = () => {
  const [posts, setPosts] = useState<BlogPost[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePost, setActivePost] = useState<BlogPost | null>(null);

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 };

  const loadPosts = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/blog');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not load blog posts.');
      setPosts(data.posts);
    } catch (err: any) {
      setError(err?.message || 'Could not load blog posts. Please try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  return (
    <section className="py-20 bg-white text-slate-800">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 space-y-12">
        <motion.div
          className="text-center max-w-3xl mx-auto space-y-4"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={springTransition}
        >
          <div className="inline-flex items-center gap-1.5 bg-brand-700/10 text-brand-950 text-xs font-bold px-4 py-1.5 rounded-full border border-brand-700/20">
            <Newspaper className="w-3.5 h-3.5 text-brand-800" />
            <span>From the Clinic</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-sans">
            Dental Health, Explained.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed font-normal">
            Tips, treatment explainers, and updates written by Dr. N. Sanchana and the Vihana Dental Care team.
          </p>
        </motion.div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-16">
            <Loader2 className="w-5 h-5 animate-spin text-brand-800" />
            <span>Loading posts...</span>
          </div>
        )}

        {!loading && error && (
          <div className="max-w-md mx-auto text-center bg-rose-50 border border-rose-200 text-rose-700 text-sm p-4 rounded-2xl">
            <p>{error}</p>
            <button onClick={loadPosts} className="underline font-semibold mt-1">Retry</button>
          </div>
        )}

        {!loading && !error && posts && posts.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-16">No posts yet — check back soon.</p>
        )}

        {!loading && !error && posts && posts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ ...springTransition, delay: (i % 3) * 0.08 }}
                whileHover={{ y: -6 }}
                onClick={() => setActivePost(post)}
                className="bg-[#F5F5F7] rounded-[28px] overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col"
              >
                <div className="h-48 bg-slate-200 overflow-hidden">
                  <img loading="lazy" decoding="async" src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="p-5 space-y-2 flex-1 flex flex-col">
                  <h3 className="text-base font-extrabold text-slate-900 leading-snug line-clamp-2">{post.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 flex-1">{post.content}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-200/70">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{post.author}</span>
                    <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{formatDate(post.createdAt)}</span>
                  </div>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {activePost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActivePost(null)}
            className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={springTransition}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-2xl w-full max-h-[85vh] overflow-y-auto scroll-thin bg-white border border-slate-200 rounded-[32px] shadow-2xl"
            >
              <button
                onClick={() => setActivePost(null)}
                className="absolute top-5 right-5 z-10 bg-white/90 text-slate-700 p-2.5 rounded-full hover:bg-white transition-colors border border-slate-200 shadow-md"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="h-64 bg-slate-100 overflow-hidden">
                <img loading="lazy" decoding="async" src={activePost.imageUrl} alt={activePost.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="p-6 sm:p-8 space-y-4">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-semibold text-brand-900"><User className="w-3.5 h-3.5" />{activePost.author}</span>
                  <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{formatDate(activePost.createdAt)}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{activePost.title}</h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{activePost.content}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
