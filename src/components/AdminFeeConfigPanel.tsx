import React, { useState, useEffect } from 'react';
import { Settings, CreditCard, ShieldCheck, CheckCircle2, DollarSign } from 'lucide-react';

export const AdminFeeConfigPanel: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [feeAmount, setFeeAmount] = useState<number>(500);
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    // Fetch current config on load (uses the in-clinic fee as this panel only edits a single amount)
    fetch('/api/admin/fee-config')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setEnabled(data.confirmationFeeEnabled);
          setFeeAmount(data.inClinicFeeINR);
        }
      })
      .catch(err => console.error("Error loading fee config:", err));
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMessage('');

    try {
      const res = await fetch('/api/admin/fee-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationFeeEnabled: enabled,
          inClinicFeeINR: Number(feeAmount)
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Fee configuration updated successfully!');
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        alert("Failed to update fee configuration.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error updating configuration.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 text-slate-100 space-y-6 max-w-xl">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 flex items-center justify-center">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-white">Razorpay Appointment Fee Settings</h3>
          <p className="text-xs text-slate-400">Configure advance confirmation fee for in-clinic and online video consults</p>
        </div>
      </div>

      <form onSubmit={handleSaveConfig} className="space-y-5">
        {/* Toggle Enable/Disable */}
        <div className="flex items-center justify-between p-4 bg-slate-900 rounded-2xl border border-slate-800">
          <div>
            <p className="text-xs font-bold text-white">Require Confirmation Fee</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Patients must pay via Razorpay before booking confirmation</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={enabled} 
              onChange={(e) => setEnabled(e.target.checked)} 
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
          </label>
        </div>

        {/* Fee Amount Input */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
            Advance Fee Amount (INR ₹)
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm font-bold">₹</span>
            <input
              type="number"
              min="0"
              step="50"
              value={feeAmount}
              onChange={(e) => setFeeAmount(Number(e.target.value))}
              disabled={!enabled}
              className={`w-full pl-8 pr-4 py-3 rounded-xl border text-sm outline-none font-semibold ${
                enabled 
                  ? 'bg-slate-900 border-slate-700 text-white focus:border-teal-500' 
                  : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
              }`}
            />
          </div>
          <p className="text-[11px] text-slate-500">This amount will be charged through Razorpay checkout on the patient booking modal.</p>
        </div>

        {successMessage && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold text-xs py-3.5 rounded-xl shadow transition-colors flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          <span>{loading ? "Saving Settings..." : "Save Fee Configuration"}</span>
        </button>
      </form>
    </div>
  );
};