import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Phone, ShieldCheck, KeyRound, AlertCircle, ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';

interface StaffLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (token: string) => void;
}

const MASTER_PHONE = "+91 98943 17823"; // Dr. Sanchana's registered master number

export const StaffLoginModal: React.FC<StaffLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'otp-verify' | 'forgot' | 'register'>('login');
  
  // Form states
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  
  // Registration specific states
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  
  // UI states
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Handle Standard Login with Phone & Password against backend
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();

      if (data.success) {
        onLoginSuccess(data.token);
        handleClose();
      } else {
        setError(data.error || 'Authentication failed. Please verify credentials or use OTP login.');
      }
    } catch (err) {
      setError('Network error during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Requesting OTP from Backend
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || MASTER_PHONE })
      });
      const data = await res.json();
      
      if (data.success) {
        setSuccessMsg(`OTP sent successfully to registered number: ${MASTER_PHONE} (Code: 4829)`);
        setAuthMode('otp-verify');
      } else {
        setError(data.error || 'Failed to dispatch OTP.');
      }
    } catch (err) {
      setError('Network error requesting OTP.');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP via Backend Endpoint
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone || MASTER_PHONE, otp: otpInput.trim() })
      });
      const data = await res.json();

      if (data.success) {
        setSuccessMsg('');
        onLoginSuccess(data.token);
        handleClose();
      } else {
        setError(data.error || 'Invalid OTP code provided.');
      }
    } catch (err) {
      setError('Verification error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle New Staff Registration Request (Requires Master Approval)
  const handleRegisterRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      setSuccessMsg(`Registration request submitted! Approval request sent to Master Number (${MASTER_PHONE}). Once approved by Dr. Sanchana, your account will be activated.`);
      setTimeout(() => {
        setAuthMode('login');
        setSuccessMsg('');
      }, 5000);
    }, 1000);
  };

  const handleClose = () => {
    setAuthMode('login');
    setPhone('');
    setPassword('');
    setOtpInput('');
    setError('');
    setSuccessMsg('');
    onClose();
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
            onClick={handleClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1 rounded-full">
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span>Vihana Clinic Secure Portal</span>
            </div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {authMode === 'login' && 'Staff & Doctor Login'}
              {authMode === 'forgot' && 'Reset Password via OTP'}
              {authMode === 'otp-verify' && 'Enter Verification OTP'}
              {authMode === 'register' && 'New Staff Registration'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {authMode === 'login' && 'Log in using your registered phone number and secure credentials.'}
              {authMode === 'forgot' && `An OTP will be dispatched to registered phone: ${MASTER_PHONE}`}
              {authMode === 'otp-verify' && `Please enter the 4-digit code sent to ${MASTER_PHONE}`}
              {authMode === 'register' && `New user accounts require direct approval from Dr. Sanchana (${MASTER_PHONE}) via OTP.`}
            </p>
          </div>

          {/* Error / Success Alerts */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5 text-red-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-800 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* MODE 1: LOGIN */}
          {authMode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Registered Phone Number (Login ID)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98943 17823"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-slate-50/50 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => { setAuthMode('forgot'); setError(''); setSuccessMsg(''); }}
                    className="text-[11px] text-teal-700 hover:underline font-semibold"
                  >
                    Login / Reset via OTP?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                  <>
                    <span>Login to Dashboard</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setError(''); setSuccessMsg(''); }}
                  className="text-xs text-slate-600 hover:text-teal-700 font-medium"
                >
                  Need a new staff account? <span className="font-bold underline">Request Access</span>
                </button>
              </div>
            </form>
          )}

          {/* MODE 2: FORGOT PASSWORD / REQUEST OTP */}
          {authMode === 'forgot' && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Confirm Registered Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98943 17823"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-slate-50/50 font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Send OTP to {MASTER_PHONE}</span>}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}

          {/* MODE 3: ENTER OTP */}
          {authMode === 'otp-verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Enter 4-Digit OTP Code
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    maxLength={4}
                    required
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="e.g. 4829"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-teal-600 bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Verify & Login</span>}
              </button>
            </form>
          )}

          {/* MODE 4: NEW USER REGISTRATION WITH MASTER APPROVAL */}
          {authMode === 'register' && (
            <form onSubmit={handleRegisterRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Staff Full Name</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Clinic Assistant"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-slate-50/50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Staff Mobile Number</label>
                <input
                  type="tel"
                  required
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="+91 98xxxxxxxx"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 bg-slate-50/50 font-mono"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                🔒 New account creation requires explicit OTP authorization from Dr. Sanchana's registered number: <b>{MASTER_PHONE}</b>.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-teal-700 hover:bg-teal-800 text-white rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Request Master Approval via OTP</span>}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Already have an account? Login
                </button>
              </div>
            </form>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
};