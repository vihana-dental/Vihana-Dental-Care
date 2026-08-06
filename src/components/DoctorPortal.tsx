import React, { useState, useEffect } from 'react';
import { PatientRecord, AuditLog, CareTeamNote, AuthUser, Appointment } from '../types';
import { 
  Stethoscope, 
  Sparkles, 
  Users, 
  ShieldCheck, 
  FileCode, 
  Plus, 
  Search, 
  Lock, 
  Download, 
  Activity,
  CheckCircle2,
  Video,
  Calendar,
  Clock
} from 'lucide-react';

interface DoctorPortalProps {
  currentUser: AuthUser;
}

export const DoctorPortal: React.FC<DoctorPortalProps> = ({ currentUser }) => {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('P-10021');
  const [currentPatient, setCurrentPatient] = useState<PatientRecord | null>(null);
  const [careTeamNotes, setCareTeamNotes] = useState<CareTeamNote[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'clinical' | 'approvals' | 'careteam' | 'fhir' | 'audit'>('clinical');
  const [loading, setLoading] = useState(true);

  // Gemini Clinical Summary
  const [aiSummary, setAiSummary] = useState<string>('');
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);

  // Care Team Note Form
  const [newNote, setNewNote] = useState<string>('');
  const [noteAuthorRole, setNoteAuthorRole] = useState<string>('Chief Surgeon');

  // FHIR Export
  const [fhirData, setFhirData] = useState<any>(null);

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(currentUser.token ? { Authorization: `Bearer ${currentUser.token}` } : {})
  };

  const loadData = async () => {
    try {
      const pRes = await fetch('/api/patients', { headers: authHeaders });
      const pData = await pRes.json();
      if (Array.isArray(pData)) setPatients(pData);

      const apptRes = await fetch('/api/appointments', { headers: authHeaders });
      const apptData = await apptRes.json();
      if (Array.isArray(apptData)) setAppointments(apptData);

      const auditRes = await fetch('/api/audit-logs', { headers: authHeaders });
      const auditData = await auditRes.json();
      if (Array.isArray(auditData)) setAuditLogs(auditData);

      if (Array.isArray(pData) && pData.length > 0) {
        loadSinglePatient(selectedPatientId || pData[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSinglePatient = async (pid: string) => {
    try {
      const res = await fetch(`/api/patients/${pid}`, { headers: authHeaders });
      const data = await res.json();
      setCurrentPatient(data.patient);
      setCareTeamNotes(data.careTeamNotes || []);
      setAiSummary('');
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectPatient = (pid: string) => {
    setSelectedPatientId(pid);
    loadSinglePatient(pid);
  };

  const handleApproveOnlineConsult = async (apptId: string) => {
    try {
      const res = await fetch(`/api/appointments/${apptId}/approve`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({})
      });
      const data = await res.json();
      if (data.success) {
        alert(`Online consultation approved successfully! Google Meet link generated and WhatsApp confirmation sent.`);
        loadData(); // Refresh list
      } else {
        alert(data.error || "Failed to approve appointment.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error while approving appointment.");
    }
  };

  const handleGenerateAiSummary = async () => {
    if (!currentPatient) return;
    setGeneratingAi(true);

    try {
      const res = await fetch('/api/gemini/clinical-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientRecord: currentPatient })
      });
      const data = await res.json();
      setAiSummary(data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleAddCareTeamNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !currentPatient) return;

    try {
      const res = await fetch(`/api/patients/${currentPatient.id}/care-team-notes`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          authorName: currentUser.name || "Dr. N. Sanchana",
          authorRole: noteAuthorRole,
          note: newNote
        })
      });
      const data = await res.json();
      if (data.success) {
        setCareTeamNotes([data.note, ...careTeamNotes]);
        setNewNote('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportFhir = async () => {
    if (!currentPatient) return;
    try {
      const res = await fetch(`/api/patients/${currentPatient.id}/fhir-export`, {
        method: 'POST',
        headers: authHeaders
      });
      const data = await res.json();
      setFhirData(data.fhirBundle);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading Doctor Clinical Portal...</div>;
  }

  const pendingApprovalsCount = appointments.filter(a => a.status === 'pending_approval').length;

  return (
    <div className="py-12 bg-slate-900 text-slate-100 min-h-[85vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-teal-400 text-xs font-semibold mb-1">
              <Stethoscope className="w-4 h-4" />
              <span>Doctor & Multidisciplinary Care Workspace</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Vihana Clinical Management Portal
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              LoggedIn: <span className="font-bold text-white">{currentUser.name}</span> ({currentUser.role.toUpperCase()})
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveSubTab('clinical')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'clinical' ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Patient File & AI
            </button>
            <button
              onClick={() => setActiveSubTab('approvals')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all relative flex items-center gap-1.5 ${
                activeSubTab === 'approvals' ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Online Consult Requests</span>
              {pendingApprovalsCount > 0 && (
                <span className="bg-amber-500 text-slate-950 font-extrabold px-1.5 py-0.2 rounded-full text-[10px]">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveSubTab('careteam')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'careteam' ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Care Team
            </button>
            <button
              onClick={() => {
                setActiveSubTab('fhir');
                handleExportFhir();
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'fhir' ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              FHIR Export
            </button>
            <button
              onClick={() => setActiveSubTab('audit')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'audit' ? 'bg-teal-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              Audit Logs
            </button>
          </div>
        </div>

        {/* Patient Select Bar (Visible on Clinical tab) */}
        {activeSubTab === 'clinical' && (
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Users className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="text-xs font-bold text-slate-300">Active Patient Record:</span>
              <select
                value={selectedPatientId}
                onChange={(e) => handleSelectPatient(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-teal-500"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.patientId}) - {p.gender}, {p.age}y
                  </option>
                ))}
              </select>
            </div>

            {currentPatient && (
              <div className="hidden md:flex items-center gap-4 text-xs">
                <span className="text-slate-400">Allergies: <b className="text-red-400">{currentPatient.allergies.join(', ')}</b></span>
                <span className="text-slate-400">Blood: <b className="text-teal-300">{currentPatient.bloodGroup}</b></span>
              </div>
            )}
          </div>
        )}

        {/* Main Content Area */}
        <div>
          {activeSubTab === 'clinical' && currentPatient && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Patient Overview */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                  <h3 className="font-bold text-lg text-white border-b border-slate-800 pb-3 flex items-center justify-between">
                    <span>Clinical History</span>
                    <span className="text-xs font-mono text-teal-400">{currentPatient.patientId}</span>
                  </h3>

                  <div className="space-y-3 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 font-medium">Medical History:</span>
                      <p className="font-semibold text-white mt-0.5">{currentPatient.medicalHistory.join(', ')}</p>
                    </div>

                    <div>
                      <span className="text-slate-500 font-medium">Active Treatment Plan:</span>
                      <p className="font-bold text-teal-300 text-sm mt-0.5">{currentPatient.currentTreatmentPlan?.title}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <span className="text-slate-500 font-medium">Past Clinical Visits:</span>
                      <div className="space-y-2 mt-2">
                        {currentPatient.visits.map((v) => (
                          <div key={v.id} className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                            <div className="flex items-center justify-between font-semibold text-white">
                              <span>{v.serviceName}</span>
                              <span className="font-mono text-[10px] text-slate-400">{v.date}</span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">Diagnosis: {v.diagnosis}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right AI Assistant & Quick Actions */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-teal-400" />
                      <span>Gemini Clinical AI Assistant</span>
                    </h3>
                    <button
                      onClick={handleGenerateAiSummary}
                      disabled={generatingAi}
                      className="bg-teal-600 hover:bg-teal-500 text-slate-950 text-xs font-bold px-3.5 py-1.5 rounded-xl transition-colors"
                    >
                      {generatingAi ? "Analyzing..." : "Generate AI Summary"}
                    </button>
                  </div>

                  {aiSummary ? (
                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed font-sans">
                      {aiSummary}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Click "Generate AI Summary" to receive a Gemini clinical overview of patient history, risks, and next treatment step recommendations.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'approvals' && (
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-teal-400" />
                  <span>Online Consultation Approval Queue</span>
                </h3>
                <span className="text-xs bg-teal-950 text-teal-300 px-3 py-1 rounded-full font-bold">
                  {appointments.filter(a => a.status === 'pending_approval').length} Pending Requests
                </span>
              </div>

              <div className="space-y-4">
                {appointments.filter(a => a.status === 'pending_approval').length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No pending online consultation approval requests at this moment.
                  </div>
                ) : (
                  appointments.filter(a => a.status === 'pending_approval').map(appt => (
                    <div key={appt.id} className="bg-slate-900 border border-amber-500/30 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border border-amber-500/30">
                            Awaiting Doctor Approval & Meet Link
                          </span>
                          <span className="text-xs text-slate-400 font-mono">ID: {appt.id}</span>
                        </div>
                        <h4 className="font-bold text-white text-base mt-1">{appt.patientName}</h4>
                        <p className="text-xs text-teal-300 font-medium">{appt.serviceName}</p>
                        <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {appt.date}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-slate-400" /> {appt.timeSlot}</span>
                          <span>Phone: <b>{appt.patientPhone}</b></span>
                        </div>
                        {appt.notes && (
                          <p className="text-xs text-slate-400 italic bg-slate-950 p-2.5 rounded-xl border border-slate-800 mt-2">
                            "{appt.notes}"
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 flex flex-col gap-2">
                        <div className="text-[11px] text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-800/50 text-center font-medium">
                          Payment: ₹{appt.feeAmount || 500} ({appt.paymentStatus.toUpperCase()})
                        </div>
                        <button
                          onClick={() => handleApproveOnlineConsult(appt.id)}
                          className="bg-teal-600 hover:bg-teal-500 text-slate-950 text-xs font-bold px-5 py-3 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                        >
                          <Video className="w-4 h-4" />
                          <span>Approve & Generate Meet Link</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'careteam' && (
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-6">
              <h3 className="font-bold text-lg text-white border-b border-slate-800 pb-3 flex items-center justify-between">
                <span>Multidisciplinary Care Team Collaboration Notes</span>
                <span className="text-xs text-teal-400">HIPAA Encrypted Channel</span>
              </h3>

              {/* Add Note Form */}
              <form onSubmit={handleAddCareTeamNote} className="space-y-3 bg-slate-900 p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-3">
                  <select
                    value={noteAuthorRole}
                    onChange={(e) => setNoteAuthorRole(e.target.value)}
                    className="bg-slate-950 text-teal-300 border border-slate-700 text-xs px-3 py-2 rounded-xl focus:outline-none"
                  >
                    <option value="Chief Implant Surgeon">Chief Implant Surgeon</option>
                    <option value="Senior Endodontist">Senior Endodontist</option>
                    <option value="Orthodontist Specialist">Orthodontist Specialist</option>
                    <option value="Oral Surgeon">Oral Surgeon</option>
                  </select>
                  <span className="text-xs text-slate-400">Posting as: {currentUser.name}</span>
                </div>

                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add clinical observation, radiograph note, or surgical recommendation..."
                  className="w-full bg-slate-950 text-white text-xs p-3 rounded-xl border border-slate-800 focus:outline-none focus:border-teal-500"
                />

                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-500 text-slate-950 text-xs font-bold px-5 py-2 rounded-xl transition-colors"
                >
                  Post Encrypted Note
                </button>
              </form>

              {/* Notes Feed */}
              <div className="space-y-3">
                {careTeamNotes.map((note) => (
                  <div key={note.id} className="p-4 bg-slate-900 rounded-2xl border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-teal-300">{note.authorName} ({note.authorRole})</span>
                      <span className="text-[10px] font-mono text-slate-500">{note.timestamp}</span>
                    </div>
                    <p className="text-slate-200 mt-1 leading-relaxed">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'fhir' && (
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-teal-400" />
                  <span>HL7 / FHIR R4 JSON Interoperability Bundle</span>
                </h3>
                <button
                  onClick={handleExportFhir}
                  className="bg-teal-600 text-slate-950 text-xs font-bold px-3.5 py-1.5 rounded-xl"
                >
                  Refresh Export
                </button>
              </div>

              {fhirData ? (
                <pre className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-96">
                  {JSON.stringify(fhirData, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-slate-400">Generating FHIR bundle...</p>
              )}
            </div>
          )}

          {activeSubTab === 'audit' && (
            <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 space-y-4">
              <h3 className="font-bold text-lg text-white border-b border-slate-800 pb-3 flex items-center justify-between">
                <span>Immutable HIPAA Audit Trails</span>
                <span className="text-xs font-mono text-teal-400">Total Entries: {auditLogs.length}</span>
              </h3>

              <div className="space-y-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="p-2">Timestamp</th>
                      <th className="p-2">User</th>
                      <th className="p-2">Action</th>
                      <th className="p-2">Resource</th>
                      <th className="p-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-900/50 text-slate-300">
                        <td className="p-2 font-mono text-[10px] text-slate-400">{log.timestamp}</td>
                        <td className="p-2 font-semibold text-teal-300">{log.userName}</td>
                        <td className="p-2">
                          <span className="bg-slate-800 text-teal-300 px-1.5 py-0.5 rounded font-bold text-[10px]">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-[10px]">{log.resourceType}:{log.resourceId}</td>
                        <td className="p-2">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};