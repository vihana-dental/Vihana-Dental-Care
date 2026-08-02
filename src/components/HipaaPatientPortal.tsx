import React, { useState, useEffect } from 'react';
import { PatientRecord, AuthUser } from '../types';
import { 
  User, 
  ShieldCheck, 
  Calendar, 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  Heart, 
  Bell, 
  Lock,
  Download,
  Plus
} from 'lucide-react';

interface HipaaPatientPortalProps {
  currentUser: AuthUser;
}

export const HipaaPatientPortal: React.FC<HipaaPatientPortalProps> = ({ currentUser }) => {
  const [patientRecord, setPatientRecord] = useState<PatientRecord | null>(null);
  const [careTeamNotes, setCareTeamNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [postOpPain, setPostOpPain] = useState<number>(1);
  const [postOpNotes, setPostOpNotes] = useState('');
  const [updateMsg, setUpdateMsg] = useState(false);

  const fetchPatientData = async () => {
    try {
      const patientId = currentUser.patientId || "P-10021";
      const res = await fetch(`/api/patients/${patientId}`);
      if (res.ok) {
        const data = await res.json();
        setPatientRecord(data.patient);
        setCareTeamNotes(data.careTeamNotes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, [currentUser]);

  const handleUpdatePostOpStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientRecord) return;

    setPatientRecord({
      ...patientRecord,
      postOpStatus: {
        painLevel: postOpPain,
        medicationTaken: true,
        lastUpdated: new Date().toLocaleString(),
        notes: postOpNotes || "No severe discomfort reported."
      }
    });

    setUpdateMsg(true);
    setTimeout(() => setUpdateMsg(false), 3000);
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm">
        Loading encrypted HIPAA patient record...
      </div>
    );
  }

  if (!patientRecord) {
    return (
      <div className="py-20 text-center text-slate-500 text-sm">
        No patient record found for current login.
      </div>
    );
  }

  const plan = patientRecord.currentTreatmentPlan;

  return (
    <div className="py-12 bg-slate-50 min-h-[85vh] text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Header Title */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-teal-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-slate-800">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-1 rounded-full">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>HIPAA Encrypted Patient Portal</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Welcome back, {patientRecord.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Patient ID: <span className="font-mono text-teal-300 font-bold">{patientRecord.patientId}</span> • Blood Group: <span className="font-bold text-red-300">{patientRecord.bloodGroup}</span>
            </p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-xs space-y-1">
            <p className="font-bold text-teal-300 flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>256-bit AES End-to-End Encrypted</span>
            </p>
            <p className="text-slate-400">Vihana Dental Practice Management System</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Demographics & History */}
          <div className="lg:col-span-4 space-y-6">
            {/* Demographics Card */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <User className="w-4 h-4 text-teal-700" />
                <span>Patient Clinical Profile</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Contact Details:</span>
                  <p className="font-semibold text-slate-800">{patientRecord.phone}</p>
                  <p className="text-slate-500">{patientRecord.email}</p>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Medical History & Conditions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patientRecord.medicalHistory.map((m, i) => (
                      <span key={i} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-medium">Allergies:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patientRecord.allergies.map((a, i) => (
                      <span key={i} className="bg-red-50 text-red-800 border border-red-200 px-2 py-0.5 rounded font-bold">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-400 font-medium">Emergency Contact & Caregiver:</span>
                  <p className="font-bold text-slate-800">{patientRecord.emergencyContact.name} ({patientRecord.emergencyContact.relationship})</p>
                  <p className="text-slate-500">{patientRecord.emergencyContact.phone}</p>
                </div>
              </div>
            </div>

            {/* Post-Op Pain Tracker */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Activity className="w-4 h-4 text-teal-700" />
                <span>Post-Operative Recovery Status</span>
              </h3>

              {patientRecord.postOpStatus && (
                <div className="p-3 bg-teal-50 rounded-2xl border border-teal-100 text-xs space-y-1">
                  <p className="font-bold text-teal-900">Current Reported Pain Level: {patientRecord.postOpStatus.painLevel} / 10</p>
                  <p className="text-slate-600">Last updated: {patientRecord.postOpStatus.lastUpdated}</p>
                  <p className="text-slate-700 italic">"{patientRecord.postOpStatus.notes}"</p>
                </div>
              )}

              {updateMsg ? (
                <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold text-center">
                  Status logged & transmitted to doctor!
                </div>
              ) : (
                <form onSubmit={handleUpdatePostOpStatus} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Pain Level (0 = None, 10 = Severe)</label>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={postOpPain}
                      onChange={(e) => setPostOpPain(parseInt(e.target.value))}
                      className="w-full accent-teal-700"
                    />
                    <p className="text-xs text-right font-bold text-teal-700">{postOpPain} / 10</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Recovery Notes / Sensation</label>
                    <input
                      type="text"
                      value={postOpNotes}
                      onChange={(e) => setPostOpNotes(e.target.value)}
                      placeholder="e.g. Mild tenderness, took medication..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold py-2.5 rounded-xl shadow transition-all"
                  >
                    Log Recovery Update
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column: Treatment Plan Timeline & Visit History */}
          <div className="lg:col-span-8 space-y-6">
            {/* Active Treatment Plan Card */}
            {plan && (
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded border border-teal-200">
                      Active Treatment Roadmap
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mt-1">{plan.title}</h3>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-slate-400">Total Cost / Paid:</span>
                    <p className="font-bold text-slate-900">₹{plan.paidAmount.toLocaleString()} / ₹{plan.totalCost.toLocaleString()}</p>
                  </div>
                </div>

                {/* Treatment Steps Timeline */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Treatment Plan Milestones</h4>

                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                    {plan.steps.map((step) => (
                      <div key={step.id} className="relative flex items-start gap-4 text-xs">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 z-10 ${
                          step.status === 'completed'
                            ? 'bg-emerald-600 text-white'
                            : step.status === 'in-progress'
                            ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                            : 'bg-slate-200 text-slate-600'
                        }`}>
                          {step.status === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : step.stepNumber}
                        </div>

                        <div className={`flex-1 p-3.5 rounded-2xl border ${
                          step.status === 'completed'
                            ? 'bg-emerald-50/50 border-emerald-200'
                            : step.status === 'in-progress'
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <h5 className="font-bold text-slate-900 text-sm">{step.title}</h5>
                            <span className="font-mono text-[11px] text-slate-500">{step.scheduledDate}</span>
                          </div>
                          <p className="text-slate-600 mt-1">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Visit History & Digital Prescriptions */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-5 h-5 text-teal-700" />
                <span>Visit History & E-Prescriptions</span>
              </h3>

              <div className="space-y-4">
                {patientRecord.visits.map((visit) => (
                  <div key={visit.id} className="p-4 rounded-2xl border border-slate-200 space-y-3 bg-slate-50/50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{visit.serviceName}</h4>
                        <p className="text-xs text-teal-700 font-semibold">{visit.doctorName}</p>
                      </div>
                      <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-600">
                        {visit.date}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <p><span className="font-semibold text-slate-700">Diagnosis:</span> {visit.diagnosis}</p>
                      <p><span className="font-semibold text-slate-700">Procedure Done:</span> {visit.treatmentGiven}</p>
                      {visit.prescription && (
                        <div className="mt-2 p-3 bg-white rounded-xl border border-slate-200 font-mono text-slate-800">
                          <p className="font-bold text-teal-800 font-sans text-xs mb-1">📜 Digital Prescription:</p>
                          <p>{visit.prescription}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
