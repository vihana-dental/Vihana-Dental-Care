import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { REVIEWS, CLINIC_INFO } from '../data/clinicData';
import { Review } from '../types';
import { Star, CheckCircle, MessageSquarePlus, ExternalLink, Sparkles, Loader2 } from 'lucide-react';

const GOOGLE_REVIEW_CTA_URL = 'https://share.google/eyQfANWUHPdxfLIqt';

export const TestimonialsView: React.FC = () => {
  const [reviewsList, setReviewsList] = useState<Review[]>(REVIEWS);
  const [rating, setRating] = useState<number>(CLINIC_INFO.rating);
  const [totalReviews, setTotalReviews] = useState<number>(CLINIC_INFO.totalReviews);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchLiveReviews = async () => {
      try {
        const res = await fetch('/api/google-reviews');
        const data = await res.json();
        if (cancelled) return;

        if (typeof data.rating === 'number') setRating(data.rating);
        if (typeof data.totalReviews === 'number') setTotalReviews(data.totalReviews);

        if (data.success && Array.isArray(data.reviews) && data.reviews.length > 0) {
          setReviewsList(data.reviews);
          setIsLive(true);
        }
      } catch (err) {
        console.error('Failed to load live Google reviews, showing curated reviews instead.', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLiveReviews();
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="py-16 bg-slate-50 text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
        {/* Header */}
        <motion.div
          className="text-center max-w-3xl mx-auto space-y-3"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 text-xs font-bold px-3.5 py-1 rounded-full">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span>Google Business Patient Reviews</span>
            {isLive && (
              <span className="ml-1 inline-flex items-center gap-1 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live</span>
              </span>
            )}
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            What Our Patients Say
          </h2>
          <p className="text-slate-600 text-base leading-relaxed">
            Real feedback from verified patients who experienced gentle, world-class dental care at Vihana Dental Care in Coimbatore.
          </p>
        </motion.div>

        {/* Rating Summary Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-6">
            <div className="text-center md:text-left">
              <span className="text-4xl font-extrabold text-slate-900">{rating.toFixed(1)}</span>
              <span className="text-slate-400 text-sm font-normal"> / 5.0</span>
              <div className="flex items-center gap-1 justify-center md:justify-start mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
            <div className="border-l border-slate-200 pl-6 space-y-1 text-xs sm:text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Based on {totalReviews}+ Google Business Reviews</p>
              <p className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Verified Coimbatore Dental Practice
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={CLINIC_INFO.googleBusinessUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-300 transition-colors"
            >
              <span>View Google Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <motion.a
              href={GOOGLE_REVIEW_CTA_URL}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all"
              id="add-google-review-cta"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Add a Review</span>
            </motion.a>
          </div>
        </motion.div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Fetching latest Google reviews...</span>
          </div>
        )}

        {/* Reviews Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviewsList.map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: (index % 2) * 0.1 }}
              whileHover={{ y: -3 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={review.authorPhoto || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100"}
                      alt={review.authorName}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-1">
                        <span>{review.authorName}</span>
                        {review.verifiedGoogle && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-200">
                            Google Verified
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400">{review.relativeTimeDescription}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed italic">
                  "{review.text}"
                </p>
              </div>

              {/* Clinic Response */}
              {review.clinicReply && (
                <div className="bg-teal-50/80 p-3.5 rounded-xl border border-teal-100 text-xs space-y-1 mt-2">
                  <p className="font-bold text-teal-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>Response from Vihana Dental Care:</span>
                  </p>
                  <p className="text-slate-700 leading-relaxed">{review.clinicReply}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
