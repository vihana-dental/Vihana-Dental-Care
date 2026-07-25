import React, { useState, useRef, useEffect } from 'react';
import { WhatsAppMessage } from '../types';
import { CLINIC_INFO } from '../data/clinicData';
import { 
  MessageSquare, 
  Send, 
  Bot, 
  CheckCheck, 
  Sparkles, 
  Calendar, 
  Clock, 
  PhoneCall, 
  RefreshCw,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

export const WhatsAppAutomationWidget: React.FC = () => {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([
    {
      id: 'w1',
      sender: 'system',
      text: "👋 Welcome to *Vihanna Dental Clinic, Coimbatore* WhatsApp AI Assistant!\n\nI can help you with:\n1. 📅 Instant Appointment Booking\n2. 🔄 Rescheduling & Cancellations\n3. 🦷 Treatment Inquiries & Fee Estimates\n4. 📍 Directions to Gandhipuram Clinic",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg: WhatsAppMessage = {
      id: `m-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/whatsapp-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: text,
          conversationHistory: messages.slice(-6)
        })
      });

      const data = await res.json();

      const botMsg: WhatsAppMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: data.replyText || "Thank you! Our WhatsApp bot has logged your request. Call +91 98765 43210 for immediate assistance.",
        timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error("WhatsApp Bot Error:", err);
      const fallbackMsg: WhatsAppMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: "🦷 *Vihanna Dental Clinic Coimbatore*\nThank you for reaching out! To book or reschedule an appointment directly, please call us at *+91 98765 43210*.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const presetQueries = [
    "Book an appointment for Swiss Dental Implant",
    "I want to reschedule my appointment to tomorrow",
    "What is the cost of Invisalign Clear Aligners in Coimbatore?",
    "Is single-sitting laser root canal painful?"
  ];

  return (
    <section className="py-12 bg-slate-900 text-white min-h-[85vh] flex items-center">
      <div className="max-w-4xl mx-auto px-4 w-full space-y-6">
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-1 rounded-full">
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp API & Gemini AI Automation Bench</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Vihanna Clinic WhatsApp Booking Bot
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Automated WhatsApp scheduling, instant appointment confirmations, reminders, and Gemini AI auto-replies.
          </p>
        </div>

        {/* WhatsApp Mobile Frame Container */}
        <div className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden max-w-2xl mx-auto flex flex-col h-[600px]">
          {/* Top WhatsApp Bar */}
          <div className="bg-emerald-900 text-white p-3.5 px-4 flex items-center justify-between border-b border-emerald-800">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-700 flex items-center justify-center text-white font-bold border border-emerald-500">
                  <Bot className="w-6 h-6" />
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-emerald-900" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1">
                  <span>Vihanna Dental WhatsApp AI</span>
                  <CheckCheck className="w-4 h-4 text-emerald-300" />
                </h3>
                <p className="text-[11px] text-emerald-200">Official Business Account • Gemini 3.6 Powered</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="bg-emerald-950 text-emerald-300 px-2 py-1 rounded border border-emerald-700 text-[10px] font-mono">
                Coimbatore +91 98765 43210
              </span>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px] bg-opacity-5">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-md space-y-1 ${
                    msg.sender === 'user'
                      ? 'bg-emerald-700 text-white rounded-br-none'
                      : msg.sender === 'system'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700 rounded-bl-none'
                      : 'bg-slate-850 text-slate-100 border border-slate-700/80 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  <p className="text-[9px] opacity-60 text-right font-mono flex items-center justify-end gap-1">
                    <span>{msg.timestamp}</span>
                    <CheckCheck className="w-3 h-3 text-emerald-300 inline" />
                  </p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-800 text-slate-300 p-3 rounded-2xl text-xs flex items-center gap-2 border border-slate-700">
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span>Gemini AI formulation in progress...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Preset Buttons */}
          <div className="p-2 bg-slate-900 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
            {presetQueries.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                className="shrink-0 bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[11px] px-3 py-1.5 rounded-full border border-slate-700 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type message or booking query..."
              className="flex-1 bg-slate-950 text-white text-xs px-4 py-3 rounded-xl border border-slate-800 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
