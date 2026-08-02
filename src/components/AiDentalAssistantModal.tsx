import React, { useState } from 'react';
import { X, Sparkles, Bot, AlertCircle, Phone, Send } from 'lucide-react';

interface AiDentalAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBooking: () => void;
}

export const AiDentalAssistantModal: React.FC<AiDentalAssistantModalProps> = ({
  isOpen,
  onClose,
  onOpenBooking
}) => {
  const [symptom, setSymptom] = useState('');
  const [loading, setLoading] = useState(false);
  const [adviceResult, setAdviceResult] = useState('');

  if (!isOpen) return null;

  const handleAskAdvice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symptom.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/gemini/patient-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptomDescription: symptom })
      });
      const data = await res.json();
      setAdviceResult(data.advice);
    } catch (err) {
      console.error(err);
      setAdviceResult("We recommend an in-person dental consultation at Vihana Dental Clinic. Call +91 98765 43210 for immediate care.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 text-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-800 relative space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Gemini Dental Symptom Checker</h3>
            <p className="text-xs text-slate-400">Preliminary care guidance & triage assistant</p>
          </div>
        </div>

        <form onSubmit={handleAskAdvice} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Describe your toothache, sensitivity, or dental concern:
            </label>
            <textarea
              required
              rows={3}
              value={symptom}
              onChange={(e) => setSymptom(e.target.value)}
              placeholder="e.g. Sharp pain when drinking cold water in upper molar, or swelling around wisdom tooth..."
              className="w-full bg-slate-950 text-white px-4 py-3 rounded-2xl border border-slate-800 text-xs focus:outline-none focus:border-teal-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !symptom.trim()}
            className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs py-3 rounded-xl shadow flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-teal-200" />
            <span>{loading ? "Analyzing Symptoms with Gemini AI..." : "Get AI Dental Guidance"}</span>
          </button>
        </form>

        {adviceResult && (
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-xs space-y-3">
            <div className="flex items-center gap-2 text-teal-400 font-bold">
              <Sparkles className="w-4 h-4" />
              <span>Preliminary Advice:</span>
            </div>
            <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{adviceResult}</p>

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Emergency Call: +91 98765 43210</span>
              <button
                onClick={() => {
                  onClose();
                  onOpenBooking();
                }}
                className="bg-teal-500 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl"
              >
                Book Consultation Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
