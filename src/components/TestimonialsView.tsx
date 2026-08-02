import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { REVIEWS, CLINIC_INFO } from '../data/clinicData';
import { Review } from '../types';
import { Star, CheckCircle, MessageSquarePlus, ExternalLink, X, Sparkles } from 'lucide-react';

export const TestimonialsView: React.FC = () => {
  const [reviewsList, setReviewsList] = useState<Review[]>(REVIEWS);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newAuthor, setNewAuthor] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [newText, setNewText] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleAddReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAuthor || !newText) return;

    const newRev: Review = {
      id: `r-${Date.now()}`,
      authorName: newAuthor,
      rating: newRating,
      relativeTimeDescription: 'Just now',
      text: newText,
      date: new Date().toISOString().split('T')[0],
      verifiedGoogle: true,
      clinicReply: "Thank you for sharing your review! We appreciate your trust in Vihana Dental Clinic."
    };

    setReviewsList([newRev, ...reviewsList]);
    setSubmitSuccess(true);
    setTimeout(() => {
      setSubmitSuccess(false);
      setShowReviewModal(false);
      setNewAuthor('');
      setNewText('');
    }, 1500);
  };

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
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            What Our Patients Say
          </h2>
          <p className="text-slate-600 text-base leading-relaxed">
            Real feedback from verified patients who experienced gentle, world-class dental care at Vihana Dental Clinic in Coimbatore.
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
              <span className="text-4xl font-extrabold text-slate-900">4.9</span>
              <span className="text-slate-400 text-sm font-normal"> / 5.0</span>
              <div className="flex items-center gap-1 justify-center md:justify-start mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
            <div className="border-l border-slate-200 pl-6 space-y-1 text-xs sm:text-sm text-slate-600">
              <p className="font-semibold text-slate-900">Based on 184+ Google Business Reviews</p>
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

            <motion.button
              onClick={() => setShowReviewModal(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-semibold px-4 py-2.5 rounded-xl shadow-xs transition-all"
            >
              <MessageSquarePlus className="w-4 h-4" />
              <span>Write a Review</span>
            </motion.button>
          </div>
        </motion.div>

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
                    <span>Response from Vihana Dental Clinic:</span>
                  </p>
                  <p className="text-slate-700 leading-relaxed">{review.clinicReply}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Write Review Modal */}
      <AnimatePresence>
        {showReviewModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative border border-slate-100"
            >
              <button
                onClick={() => setShowReviewModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <h3 className="text-xl font-extrabold text-slate-900">Write a Google Review</h3>
                <p className="text-xs text-slate-500 font-medium">Share your experience at Vihana Dental Clinic, Coimbatore</p>
              </div>

              {submitSuccess ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-6 rounded-2xl text-center space-y-2">
                  <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="font-bold text-lg">Thank You!</h4>
                  <p className="text-xs">Your review has been posted to our patient feedback stream.</p>
                </div>
              ) : (
                <form onSubmit={handleAddReview} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Your Full Name</label>
                    <input
                      type="text"
                      required
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      placeholder="e.g. Anand Kumar"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Rating</label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => setNewRating(star)}
                          className="p-1 text-amber-400 hover:scale-110 transition-transform"
                        >
                          <Star className={`w-7 h-7 ${star <= newRating ? 'fill-amber-400' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Your Review Feedback</label>
                    <textarea
                      required
                      rows={4}
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder="Describe your treatment experience, doctor care, clinic cleanliness..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setShowReviewModal(false)}
                      className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs"
                    >
                      Post Review
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
