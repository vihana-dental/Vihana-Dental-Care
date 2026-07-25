import React, { useState, useEffect } from 'react';
import { Inquiry, Appointment } from '../types';
import { 
  Mail, 
  MessageSquare, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  PhoneCall, 
  ExternalLink, 
  LogOut, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles, 
  UserCheck, 
  Bot, 
  TrendingUp, 
  User, 
  CheckCheck,
  Send,
  Plus
} from 'lucide-react';

interface StaffLeadsDashboardProps {
  onLogout: () => void;
  onOpenBookingModal: () => void;
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
  onOpenBookingModal
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'website' | 'whatsapp' | 'appointments'>('website');
  
  // Website Inquiries state
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [noteInput, setNoteInput] = useState('');

  // Appointments state
  const [appointments, setAppointments] = useState<Appointment[]>([]);

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
    },
    {
      id: 'wa-4',
      patientName: 'Priya Rajan',
      phone: '+91 94422 11099',
      serviceInterest: 'Teeth Whitening',
      lastMessage: 'Can I come in on Saturday morning for 1-session laser teeth bleaching?',
      timestamp: 'Yesterday, 02:10 PM',
      status: 'new',
      unreadCount: 1
    }
  ]);

  const fetchAllData = async () => {
    setInquiriesLoading(true);
    try {
      const [inqRes, apptRes] = await Promise.all([
        fetch('/api/inquiries'),
        fetch('/api/appointments')
      ]);
      const inqData = await inqRes.json();
      const apptData = await apptRes.json();
      
      if (Array.isArray(inqData)) setInquiries(inqData);
      if (Array.isArray(apptData)) setAppointments(apptData);
    } catch (err) {
      console.error('Failed to load live staff dashboard data:', err);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes })
      });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
        if (selectedInquiry?.id === id) {
          setSelectedInquiry(data.inquiry);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateWhatsAppStatus = (id: string, newStatus: WhatsAppLead['status']) => {
    setWhatsappLeads(prev => prev.map(lead => lead.id === id ? { ...lead, status: newStatus, unreadCount: 0 } : lead));
  };

  const filteredInquiries = inquiries.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          i.phone.includes(searchTerm) ||
                          i.service.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || i.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const newWebsiteLeadsCount = inquiries.filter(i => i.status === 'new').length;
  const newWhatsAppLeadsCount = whatsappLeads.filter(w => w.status === 'new').length;

  return (
    <section className="py-8 bg-slate-100 min-h-[85vh] text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Top Staff Navigation Header */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-400" /> Authorized Staff Portal
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono px-2.5 py-0.5 rounded-full">
                Live Lead Sync Active
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Vihanna Clinic Live Staff Dashboard</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Manage live website lead inquiries, WhatsApp bot interactions, and clinic appointments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAllData}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-2xl text-xs font-bold border border-slate-700 transition-colors flex items-center gap-2"
              title="Refresh live data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${inquiriesLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Leads</span>
            </button>

            <button
              onClick={onLogout}
              className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2"
              id="staff-logout-button"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span>Staff Logout</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            onClick={() => setActiveSubTab('website')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              activeSubTab === 'website'
                ? 'bg-white border-teal-600 ring-2 ring-teal-600/20 shadow-md'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Website Leads</span>
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{inquiries.length}</span>
              {newWebsiteLeadsCount > 0 && (
                <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  {newWebsiteLeadsCount} New
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Incoming Web Contact Forms</p>
          </div>

          <div 
            onClick={() => setActiveSubTab('whatsapp')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              activeSubTab === 'whatsapp'
                ? 'bg-white border-emerald-600 ring-2 ring-emerald-600/20 shadow-md'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">WhatsApp Leads</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{whatsappLeads.length}</span>
              {newWhatsAppLeadsCount > 0 && (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  {newWhatsAppLeadsCount} Live
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Bot Conversations & Enquiries</p>
          </div>

          <div 
            onClick={() => setActiveSubTab('appointments')}
            className={`p-5 rounded-2xl border cursor-pointer transition-all ${
              activeSubTab === 'appointments'
                ? 'bg-white border-blue-600 ring-2 ring-blue-600/20 shadow-md'
                : 'bg-white border-slate-200/80 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Appointments</span>
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">{appointments.length}</span>
              <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                Google Synced
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Scheduled Consultations</p>
          </div>

          <div className="p-5 rounded-2xl border bg-white border-slate-200/80 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quick Action</span>
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
            </div>
            <button
              onClick={onOpenBookingModal}
              className="mt-2 w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Book Appointment For Patient</span>
            </button>
          </div>
        </div>

        {/* Tab Switcher Bar */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveSubTab('website')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              activeSubTab === 'website'
                ? 'bg-teal-700 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
            }`}
            id="tab-website-leads"
          >
            <Mail className="w-4 h-4" />
            <span>Website Inquiries ({inquiries.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('whatsapp')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              activeSubTab === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
            }`}
            id="tab-whatsapp-leads"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Live WhatsApp Leads ({whatsappLeads.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('appointments')}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 ${
              activeSubTab === 'appointments'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
            }`}
            id="tab-appointments-leads"
          >
            <Calendar className="w-4 h-4" />
            <span>Live Appointments ({appointments.length})</span>
          </button>
        </div>

        {/* Sub-Tab Content */}

        {/* TAB 1: WEBSITE INQUIRIES */}
        {activeSubTab === 'website' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search website leads by patient name, phone or service..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white w-full sm:w-auto font-medium"
                >
                  <option value="all">All Lead Statuses</option>
                  <option value="new">New Web Leads</option>
                  <option value="contacted">Contacted / Followed Up</option>
                  <option value="resolved">Resolved / Scheduled</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                {filteredInquiries.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
                    No website inquiries matching search filter.
                  </div>
                ) : (
                  filteredInquiries.map((inq) => (
                    <div
                      key={inq.id}
                      onClick={() => setSelectedInquiry(inq)}
                      className={`bg-white p-5 rounded-2xl border cursor-pointer transition-all ${
                        selectedInquiry?.id === inq.id
                          ? 'border-teal-600 ring-2 ring-teal-600/20 shadow-md'
                          : 'border-slate-200/90 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900 text-sm sm:text-base">{inq.name}</h4>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              inq.status === 'new'
                                ? 'bg-amber-100 text-amber-800'
                                : inq.status === 'contacted'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
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

                      <p className="text-xs text-slate-600 line-clamp-2 mt-2 leading-relaxed">
                        "{inq.message}"
                      </p>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-mono font-bold text-slate-700">
                          <PhoneCall className="w-3.5 h-3.5 text-teal-600" />
                          {inq.phone}
                        </span>

                        <div className="flex items-center gap-2">
                          <a
                            href={`https://wa.me/${inq.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(inq.name)},%20this%20is%20Vihanna%20Dental%20Clinic%20Coimbatore%20regarding%20your%20inquiry%20for%20${encodeURIComponent(inq.service)}.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <MessageSquare className="w-3 h-3 text-emerald-600" />
                            <span>WhatsApp</span>
                          </a>
                          <span className="text-teal-700 font-semibold hidden sm:inline">Manage →</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Selected Web Inquiry Detail */}
              <div className="lg:col-span-5">
                {selectedInquiry ? (
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 sticky top-24">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-900">{selectedInquiry.name}</h3>
                        <p className="text-xs text-slate-500">Inquiry ID: {selectedInquiry.id}</p>
                      </div>
                      <span className="text-xs bg-slate-100 text-slate-700 font-mono font-bold px-2.5 py-1 rounded-md">
                        {selectedInquiry.phone}
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium">Treatment Requested:</span>
                        <p className="font-bold text-teal-800 text-sm">{selectedInquiry.service}</p>
                      </div>

                      <div>
                        <span className="text-slate-400 font-medium">Inquiry Message:</span>
                        <p className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 leading-relaxed mt-1">
                          "{selectedInquiry.message}"
                        </p>
                      </div>

                      {selectedInquiry.notes && (
                        <div>
                          <span className="text-slate-400 font-medium">Staff Internal Notes:</span>
                          <p className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 font-mono mt-1">
                            {selectedInquiry.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Status Update Controls */}
                    <div className="space-y-3 pt-3 border-t border-slate-100">
                      <label className="block text-xs font-bold text-slate-700">Update Lead Status & Follow-up Note</label>
                      <textarea
                        rows={2}
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Add internal staff note or call outcome details..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />

                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'new', noteInput)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold py-2 rounded-xl transition-colors"
                        >
                          Mark New
                        </button>
                        <button
                          onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'contacted', noteInput)}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-900 text-xs font-bold py-2 rounded-xl transition-colors"
                        >
                          Mark Contacted
                        </button>
                        <button
                          onClick={() => handleUpdateInquiryStatus(selectedInquiry.id, 'resolved', noteInput)}
                          className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold py-2 rounded-xl transition-colors"
                        >
                          Mark Resolved
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs space-y-2">
                    <Mail className="w-8 h-8 text-slate-300 mx-auto" />
                    <p>Select any lead from the list to view full details and update status.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WHATSAPP LIVE LEADS */}
        {activeSubTab === 'whatsapp' && (
          <div className="space-y-4">
            <div className="bg-emerald-950 text-white p-5 rounded-2xl border border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-700 flex items-center justify-center text-white">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                    <span>Live WhatsApp Bot & Leads Manager</span>
                    <span className="bg-emerald-500 text-slate-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      Gemini Auto-Reply Active
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-200">
                    Real-time WhatsApp inquiries captured via website bot and phone interactions
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono bg-emerald-900/90 text-emerald-300 px-3 py-1.5 rounded-xl border border-emerald-700">
                Clinic WhatsApp: +91 98765 43210
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {whatsappLeads.map((wLead) => (
                <div
                  key={wLead.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-base">{wLead.patientName}</h4>
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                          wLead.status === 'new'
                            ? 'bg-emerald-100 text-emerald-800'
                            : wLead.status === 'followed_up'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {wLead.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs font-mono font-bold text-emerald-700 mt-0.5">{wLead.phone}</p>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {wLead.timestamp}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 space-y-1">
                    <p className="font-bold text-teal-800 text-[11px]">Interest: {wLead.serviceInterest}</p>
                    <p className="text-slate-600 leading-relaxed italic">"{wLead.lastMessage}"</p>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleUpdateWhatsAppStatus(wLead.id, 'followed_up')}
                        className="text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg"
                      >
                        Followed Up
                      </button>
                      <button
                        onClick={() => handleUpdateWhatsAppStatus(wLead.id, 'converted')}
                        className="text-[11px] font-bold bg-teal-100 hover:bg-teal-200 text-teal-800 px-2.5 py-1 rounded-lg"
                      >
                        Converted
                      </button>
                    </div>

                    <a
                      href={`https://wa.me/${wLead.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(wLead.patientName)},%20this%20is%20Vihanna%20Dental%20Clinic%20Coimbatore%20following%20up%20on%20your%20WhatsApp%20query.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Open WhatsApp Chat</span>
                      <ExternalLink className="w-3 h-3 text-emerald-200" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: LIVE APPOINTMENTS */}
        {activeSubTab === 'appointments' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Live Scheduled Appointments</h3>
                <p className="text-xs text-slate-500">
                  Appointments booked through website and WhatsApp bot with automatic Google Calendar sync
                </p>
              </div>

              <span className="text-xs bg-teal-100 text-teal-800 font-bold px-3 py-1 rounded-full">
                Total: {appointments.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="p-3">Appointment ID</th>
                    <th className="p-3">Patient Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Doctor</th>
                    <th className="p-3">Treatment</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {appointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-mono font-bold text-teal-800">{apt.id}</td>
                      <td className="p-3 font-bold text-slate-900">{apt.patientName}</td>
                      <td className="p-3 font-mono text-slate-600">{apt.patientPhone}</td>
                      <td className="p-3 font-medium text-slate-800">{apt.doctorName}</td>
                      <td className="p-3 font-semibold text-teal-700">{apt.serviceName}</td>
                      <td className="p-3 font-medium">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{apt.date} • {apt.timeSlot}</span>
                        </div>
                      </td>
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

      </div>
    </section>
  );
};
