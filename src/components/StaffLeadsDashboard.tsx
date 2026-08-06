import React, { useState, useEffect } from 'react';
import { Inquiry, Appointment } from '../types';
import { 
  Mail, 
  MessageSquare, 
  Calendar, 
  CheckCircle2, 
  Search, 
  Filter, 
  PhoneCall, 
  ExternalLink, 
  LogOut, 
  RefreshCw, 
  ShieldCheck, 
  Plus,
  CreditCard,
  Settings
} from 'lucide-react';

interface StaffLeadsDashboardProps {
  onLogout: () => void;
  onOpenBookingModal: () => void;
  token?: string;
}

interface WhatsAppLead {
  id: string;
  patientName: string;
  phone: string;
  serviceInterest: string;
  lastMessage: string;
  timestamp: string;
  status: 'new' | 'followed_up' | 'converted';
  unreadCount?: number;
}

export const StaffLeadsDashboard: React.FC<StaffLeadsDashboardProps> = ({
  onLogout,
  onOpenBookingModal,
  token
}) => {
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  const [activeSubTab, setActiveSubTab] = useState<'website' | 'whatsapp' | 'appointments' | 'settings'>('website');
  
  // Website Inquiries state
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [noteInput, setNoteInput] = useState('');

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Dual Fee Settings state
  const [feeEnabled, setFeeEnabled] = useState<boolean>(true);
  const [inClinicFee, setInClinicFee] = useState<number>(300);
  const [onlineFee, setOnlineFee] = useState<number>(500);
  const [feeLoading, setFeeLoading] = useState<boolean>(false);
  const [feeSuccessMsg, setFeeSuccessMsg] = useState<string>('');

  // WhatsApp leads state
  const [whatsappLeads, setWhatsappLeads] = useState<WhatsAppLead[]>([
    {
      id: 'wa-1',
      patientName: 'Anand Viswanathan',
      phone: '+91 98940 55123',
      serviceInterest: 'Invisalign Clear Aligners',
      lastMessage: 'Hi, I want to know the approximate duration for Invisalign aligners for gap filling. Available for evening appointment?',
      timestamp: 'Today, 10:15 AM',
      status: 'new',
      unreadCount: 1
    },
    {
      id: 'wa-2',
      patientName: 'Kavitha Ramachandran',
      phone: '+91 97890 88210',
      serviceInterest: 'Swiss Dental Implant',
      lastMessage: 'Interested in computer guided keyhole implant procedure for molar replacement. What is the estimate?',
      timestamp: 'Today, 09:40 AM',
      status: 'followed_up'
    },
    {
      id: 'wa-3',
      patientName: 'Senthil Kumar',
      phone: '+91 98421 88320',
      serviceInterest: 'Laser Root Canal',
      lastMessage: 'Booked appointment for tomorrow 10:30 AM via WhatsApp bot. Confirmed!',
      timestamp: 'Yesterday, 04:20 PM',
      status: 'converted'
    }
  ]);

  const fetchAllData = async () => {
    setInquiriesLoading(true);
    try {
      const [inqRes, apptRes, feeRes] = await Promise.all([
        fetch('/api/inquiries', { headers: authHeaders }),
        fetch('/api/appointments', { headers: authHeaders }),
        fetch('/api/admin/fee-config', { headers: authHeaders })
      ]);
      const inqData = await inqRes.json();
      const apptData = await apptRes.json();
      const feeData = await feeRes.json();
      
      if (Array.isArray(inqData)) setInquiries(inqData);
      if (Array.isArray(apptData)) setAppointments(apptData);
      if (feeData) {
        setFeeEnabled(feeData.confirmationFeeEnabled);
        setInClinicFee(feeData.inClinicFeeINR);
        setOnlineFee(feeData.onlineFeeINR);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setInquiriesLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const handleUpdateInquiryStatus = async (id: string, newStatus: Inquiry['status'], notes?: string) => {
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ status: newStatus, notes })
      });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
        if (selectedInquiry?.id === id) setSelectedInquiry(data.inquiry);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveFeeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeeLoading(true);
    setFeeSuccessMsg('');

    try {
      const res = await fetch('/api/admin/fee-config', {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({
          confirmationFeeEnabled: feeEnabled,
          inClinicFeeINR: Number(inClinicFee),
          onlineFeeINR: Number(onlineFee)
        })
      });
      const data = await res.json();
      if (data.success) {
        setFeeSuccessMsg('Dual fee configurations updated successfully.');
        setTimeout(() => setFeeSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFeeLoading(false);
    }
  };

  const filteredInquiries = inquiries.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          i.phone.includes(searchTerm) ||
                          i.service.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || i.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <section className="py-8 bg-slate-50 min-h-[85vh] text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Minimalist Header */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-700 text-xs font-bold mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Vihana Clinic Management Console</span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Admin & Staff Dashboard
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage patient inquiries, WhatsApp bot leads, appointments, and dual Razorpay advance fees.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchAllData}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-700 ${inquiriesLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={onOpenBookingModal}
              className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Book Appointment</span>
            </button>
            <button
              onClick={onLogout}
              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Clean Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveSubTab('website')}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              activeSubTab === 'website' ? 'bg-teal-700 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Website Inquiries ({inquiries.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('whatsapp')}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              activeSubTab === 'whatsapp' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp Leads ({whatsappLeads.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('appointments')}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              activeSubTab === 'appointments' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Appointments ({appointments.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('settings')}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              activeSubTab === 'settings' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Fee Settings</span>
          </button>
        </div>

        {/* TAB 1: WEBSITE INQUIRIES */}
        {activeSubTab === 'website' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search website leads by name, phone or service..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white w-full sm:w-auto font-medium"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New Leads</option>
                  <option value="contacted">Contacted</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-3">
                {filteredInquiries.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
                    No website inquiries found.
                  </div>
                ) : (
                  filteredInquiries.map((inq) => (
                    <div
                      key={inq.id}
                      onClick={() => setSelectedInquiry(inq)}
                      className={`bg-white p-4 rounded-2xl border cursor-pointer transition-all ${
                        selectedInquiry?.id === inq.id
                          ? 'border-teal-600 ring-2 ring-teal-600/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm">{inq.name}</h4>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              inq.status === 'new' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {inq.status}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-teal-700 mt-0.5">{inq.service}</p>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(inq.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2 mt-2">"{inq.message}"</p>
                    </div>
                  ))
                )}
              </div>

              {/* Inquiry Detail Sidebar */}
              <div className="lg:col-span-5">
                {selectedInquiry ? (
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 sticky top-24">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-base text-slate-900">{selectedInquiry.name}</h3>
                      <p className="text-xs text-slate-500 font-mono">{selectedInquiry.phone}</p>
                    </div>

                    <div className="space-y-2 text-xs">
                      <p><span className="text-slate-400 font-medium">Service:</span> <b className="text-teal-800">{selectedInquiry.service}</b></p>
                      <p className="p-3 bg-slate-50 rounded-xl text-slate-700">"{selectedInquiry.message}"</p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="block text-xs font-bold text-slate-700">Staff Follow-up Notes</label>
                      <textarea
                        rows={2}
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Add notes..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'contacted', noteInput)}
                          className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-900 text-xs font-bold py-2 rounded-xl transition-colors"
                        >
                          Mark Contacted
                        </button>
                        <button
                          onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'resolved', noteInput)}
                          className="flex-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold py-2 rounded-xl transition-colors"
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                    Select an inquiry to view details.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WHATSAPP LEADS */}
        {activeSubTab === 'whatsapp' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {whatsappLeads.map((wLead) => (
              <div key={wLead.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{wLead.patientName}</h4>
                    <p className="text-xs font-mono text-emerald-700">{wLead.phone}</p>
                  </div>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">
                    {wLead.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl italic">"{wLead.lastMessage}"</p>
                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <a
                    href={`https://wa.me/${wLead.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Open WhatsApp</span>
                    <ExternalLink className="w-3 h-3 text-emerald-200" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: APPOINTMENTS */}
        {activeSubTab === 'appointments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Scheduled Clinic Appointments</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase">
                    <th className="p-3">ID</th>
                    <th className="p-3">Patient Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Doctor</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-bold text-teal-800">{apt.id}</td>
                      <td className="p-3 font-bold text-slate-900">{apt.patientName}</td>
                      <td className="p-3 font-mono">{apt.patientPhone}</td>
                      <td className="p-3">{apt.doctorName}</td>
                      <td className="p-3 font-semibold text-teal-700">{apt.serviceName}</td>
                      <td className="p-3 font-medium">{apt.date} • {apt.timeSlot}</td>
                      <td className="p-3">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                          {apt.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DUAL FEE SETTINGS */}
        {activeSubTab === 'settings' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">Dual Razorpay Advance Fees</h3>
                <p className="text-xs text-slate-500">Configure separate confirmation fees for In-Clinic and Online Consultations</p>
              </div>
            </div>

            <form onSubmit={handleSaveFeeConfig} className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div>
                  <p className="text-xs font-bold text-slate-900">Require Confirmation Fee</p>
                  <p className="text-[11px] text-slate-500">Charge advance fee via Razorpay before booking confirmation</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={feeEnabled} 
                    onChange={(e) => setFeeEnabled(e.target.checked)} 
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    In-Clinic Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={inClinicFee}
                      onChange={(e) => setInClinicFee(Number(e.target.value))}
                      disabled={!feeEnabled}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none font-semibold focus:border-teal-600 bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Online Video Fee (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 text-sm font-bold">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={onlineFee}
                      onChange={(e) => setOnlineFee(Number(e.target.value))}
                      disabled={!feeEnabled}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none font-semibold focus:border-teal-600 bg-white"
                    />
                  </div>
                </div>
              </div>

              {feeSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{feeSuccessMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={feeLoading}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs py-3 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>{feeLoading ? "Saving..." : "Save Dual Fee Settings"}</span>
              </button>
            </form>
          </div>
        )}

      </div>
    </section>
  );
};