import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, User, ShieldCheck, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';

interface StaffLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const StaffLoginModal: React.FC<StaffLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim().toLowerCase() === 'admin' && password === 'admin') {
      setError('');
      onLoginSuccess();
      onClose();
      // Reset fields
      setUsername('');
      setPassword('');
    } else {
      setError('Invalid Login ID or Password. Please use Username: admin, Password: admin');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative space-y-6 overflow-hidden"
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            id="close-staff-login-modal"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1 rounded-full">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Vihanna Clinic Staff Portal</span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Staff & Admin Login
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Authorized clinic staff portal to view live website inquiries and WhatsApp leads.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Staff Login ID / Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g. admin"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 bg-slate-50/50"
                  id="staff-username-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="e.g. admin"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 bg-slate-50/50"
                  id="staff-password-input"
                />
              </div>
            </div>

            {/* Quick credentials hint box */}
            <div className="p-3 bg-teal-50/80 border border-teal-200/80 rounded-xl text-[11px] text-teal-900 font-mono flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                <span>Default Credentials:</span>
              </div>
              <span className="font-bold bg-white px-2 py-0.5 rounded border border-teal-200">
                admin / admin
              </span>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 group"
              id="staff-login-submit-button"
            >
              <span>Login to Staff Dashboard</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
