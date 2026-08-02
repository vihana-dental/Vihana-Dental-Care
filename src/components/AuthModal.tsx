import React from 'react';
import { AuthUser } from '../types';
import { X, ShieldCheck, UserCheck, Stethoscope, User } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onSelectUser: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectUser
}) => {
  if (!isOpen) return null;

  const users: AuthUser[] = [
    {
      id: "u-guest",
      name: "Public Visitor",
      role: "guest"
    },
    {
      id: "u-patient-1",
      name: "Ramesh Chandran",
      role: "patient",
      patientId: "P-10021"
    },
    {
      id: "u-patient-2",
      name: "Deepa Sundaram",
      role: "patient",
      patientId: "P-10022"
    },
    {
      id: "u-doc-1",
      name: "Dr. Sanchana",
      role: "doctor"
    },
    {
      id: "u-admin-1",
      name: "Clinic Administrator",
      role: "admin"
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 relative space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 bg-teal-100 text-teal-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>HIPAA Role Portal Switcher</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900">Select Access Account</h3>
          <p className="text-xs text-slate-500">Switch role to test Patient Portal or Doctor Clinical Portal</p>
        </div>

        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              onClick={() => {
                onSelectUser(u);
                onClose();
              }}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                currentUser.id === u.id
                  ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-600/20'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white ${
                  u.role === 'doctor' || u.role === 'admin'
                    ? 'bg-teal-700'
                    : u.role === 'patient'
                    ? 'bg-emerald-600'
                    : 'bg-slate-700'
                }`}>
                  {u.role === 'doctor' ? <Stethoscope className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{u.name}</p>
                  <p className="text-[11px] text-slate-500 uppercase font-mono">{u.role} {u.patientId ? `• ${u.patientId}` : ''}</p>
                </div>
              </div>

              {currentUser.id === u.id && (
                <span className="text-xs bg-teal-600 text-white font-bold px-2.5 py-1 rounded-md">
                  Active
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
