import React, { useState, useEffect } from 'react';
import { Inquiry } from '../types';
import { Mail, CheckCircle, Clock, Search, Filter, MessageSquare, PhoneCall } from 'lucide-react';

export const InquiryDashboard: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [noteInput, setNoteInput] = useState('');

  const fetchInquiries = async () => {
    try {
      const res = await fetch('/api/inquiries');
      const data = await res.json();
      setInquiries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: Inquiry['status'], notes?: string) => {
    try {
      const res = await fetch(`/api/inquiries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes })
      });
      const data = await res.json();
      if (data.success) {
        fetchInquiries();
        if (selectedInquiry?.id === id) {
          setSelectedInquiry(data.inquiry);
        }
      }
    } catch (err) {
      console.error(err);
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
    <section className="py-12 bg-slate-50 min-h-[85vh] text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
              <Mail className="w-7 h-7 text-teal-700" />
              <span>Doctor & Reception Inquiry Portal</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Track, filter, and respond to incoming web inquiries for Vihana Dental Clinic
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-teal-100 text-teal-800 text-xs font-bold px-3 py-1.5 rounded-full">
              Total Inquiries: {inquiries.length}
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by patient name, phone or service..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white w-full sm:w-auto"
            >
              <option value="all">All Statuses</option>
              <option value="new">New Inquiries</option>
              <option value="contacted">Contacted / In Progress</option>
              <option value="resolved">Resolved / Scheduled</option>
            </select>
          </div>
        </div>

        {/* Main List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            {filteredInquiries.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
                No inquiries matching search filter.
              </div>
            ) : (
              filteredInquiries.map((inq) => (
                <div
                  key={inq.id}
                  onClick={() => setSelectedInquiry(inq)}
                  className={`bg-white p-5 rounded-2xl border cursor-pointer transition-all ${
                    selectedInquiry?.id === inq.id
                      ? 'border-teal-600 ring-2 ring-teal-600/20 shadow-md'
                      : 'border-slate-200 hover:border-slate-300'
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
                    <span className="flex items-center gap-1">
                      <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
                      {inq.phone}
                    </span>
                    <span className="text-teal-700 font-medium">Click to manage & respond →</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected Inquiry Action Panel */}
          <div className="lg:col-span-5">
            {selectedInquiry ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 sticky top-24">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{selectedInquiry.name}</h3>
                    <p className="text-xs text-slate-500">Inquiry ID: {selectedInquiry.id}</p>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2.5 py-1 rounded-md">
                    {selectedInquiry.phone}
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Requested Service:</span>
                    <p className="font-bold text-teal-800 text-sm">{selectedInquiry.service}</p>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium">Patient Message:</span>
                    <p className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 leading-relaxed mt-1">
                      "{selectedInquiry.message}"
                    </p>
                  </div>

                  {selectedInquiry.notes && (
                    <div>
                      <span className="text-slate-400 font-medium">Internal Notes:</span>
                      <p className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 font-mono mt-1">
                        {selectedInquiry.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Status Update Controls */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700">Update Status & Reply Notes</label>
                  <textarea
                    rows={2}
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add internal note or WhatsApp follow-up details..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'new', noteInput)}
                      className="bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold py-2 rounded-xl"
                    >
                      Mark New
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'contacted', noteInput)}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-900 text-xs font-bold py-2 rounded-xl"
                    >
                      Mark Contacted
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(selectedInquiry.id, 'resolved', noteInput)}
                      className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold py-2 rounded-xl"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs space-y-2">
                <Mail className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Select any inquiry from the list to manage and update status.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
