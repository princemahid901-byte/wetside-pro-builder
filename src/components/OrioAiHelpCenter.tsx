import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Minimize2,
  Maximize2,
  Send,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Globe,
} from 'lucide-react';
import { HelpChatMessage, Language } from '../types/orio';

interface OrioAiHelpCenterProps {
  lang: Language;
  onChangeLang: (lang: Language) => void;
  userProfileId?: string;
  userName: string;
  balance: number;
  activeSubsCount: number;
  onNavigateTab: (tab: string) => void;
  bottomOffsetClass?: string;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const QUICK_TOPICS: Record<Language, Array<{ label: string; prompt: string }>> = {
  en: [
    { label: 'Find Profile ID', prompt: 'How do I find, copy, and share my Profile ID?' },
    { label: '18+ Account & Login', prompt: 'How do I confirm 18+ and sign in with Google on OrioLiveCall?' },
    { label: 'Free Video Connect', prompt: 'How do free 1-to-1 random video calls and 5+ multiplayer rooms work?' },
    { label: 'Free Videos & Live', prompt: 'How do I watch free community videos and live rooms?' },
    { label: 'Privacy & Report', prompt: 'How do I change messaging privacy or report an inappropriate user?' },
    { label: 'Google Cookies & Privacy', prompt: 'Tell me about the Privacy Policy, Google Cookies consent, and WebRTC zero recording.' },
  ],
  bn: [
    { label: 'প্রোফাইল আইডি', prompt: 'আমার Profile ID কোথায় পাবো এবং কিভাবে কপি ও শেয়ার করবো?' },
    { label: 'অ্যাকাউন্ট ও লগইন', prompt: 'কিভাবে Google দিয়ে সাইন-ইন ও ১৮+ কনফার্ম করবো?' },
    { label: 'ফ্রি ভিডিও কল', prompt: 'ফ্রি ১-টু-১ ভিডিও কল এবং ৫+ গ্রুপ ভিডিও কল কিভাবে কাজ করে?' },
    { label: 'ফ্রি ভিডিও ও লাইভ', prompt: 'কিভাবে ফ্রি কমিউনিটি ভিডিও এবং লাইভ রুম দেখবো?' },
    { label: 'প্রাইভেসি ও রিপোর্ট', prompt: 'মেসেজ প্রাইভেসি কিভাবে সেট করবো এবং কিভাবে রিপোর্ট করবো?' },
    { label: 'Google কুকিজ ও প্রাইভেসি', prompt: 'গোপনীয়তা নীতি, Google কুকিজ কনসেন্ট এবং জিরো রেকর্ডিং সম্পর্কে বলুন।' },
  ],
};

export const OrioAiHelpCenter: React.FC<OrioAiHelpCenterProps> = ({
  lang,
  onChangeLang,
  userProfileId,
  userName,
  balance,
  activeSubsCount,
  onNavigateTab,
  bottomOffsetClass = 'bottom-5',
  showToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [messages, setMessages] = useState<HelpChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      text:
        lang === 'bn'
          ? `স্বাগতম **Orio AI Help Center**-এ! আমি আপনার অ্যাকাউন্ট, প্রোফাইল আইডি (${userProfileId || 'ORI-100004'}), ফ্রি ভিডিও কল, গ্লোবাল ফ্রেন্ডস, Google কুকিজ এবং প্রাইভেসি বিষয়ে বাংলা ও ইংরেজিতে সাহায্য করতে পারি।`
          : `Hello! I'm **Orio AI Help Center**. Ask me anything about your **Profile ID (${userProfileId || 'ORI-100004'})**, free video calling, Global Friends, Google Sign-In & Cookies, or Privacy & Reports.`,
      timestamp: new Date().toISOString(),
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleCopyId = async () => {
    if (!userProfileId) return;
    try {
      await navigator.clipboard.writeText(userProfileId);
      setCopiedId(true);
      showToast(`Copied Profile ID: ${userProfileId}`, 'success');
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      showToast(`Profile ID: ${userProfileId}`, 'info');
    }
  };

  const askHelpCenter = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: HelpChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/gemini/help-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          language: lang,
          history: nextHistory.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          userContext: {
            profileId: userProfileId || 'ORI-100004',
            name: userName,
            balance,
            activeSubsCount,
          },
        }),
      });
      const data = await res.json();
      const assistantMsg: HelpChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text:
          data.reply ||
          (lang === 'bn'
            ? 'দুঃখিত, এই মুহূর্তে উত্তর দেওয়া সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।'
            : 'Sorry, I could not process that request right now. Please try again.'),
        timestamp: new Date().toISOString(),
        suggestedTab: data.suggestedTab,
        suggestedLabel: data.suggestedLabel,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text:
            lang === 'bn'
              ? 'নেটওয়ার্ক সমস্যার কারণে সংযোগ করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'
              : 'Network connection interrupted. Please try sending your question again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className={`fixed right-5 ${bottomOffsetClass} z-[65]`}>
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open Orio AI Help Center"
          className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-purple-700 via-violet-700 to-black border border-purple-500/60 text-white shadow-2xl shadow-purple-700/40 hover:scale-105 hover:border-purple-400 transition-all"
        >
          <div className="w-8 h-8 rounded-full bg-black/70 border border-purple-400/50 flex items-center justify-center relative">
            <Bot className="w-4 h-4 text-purple-300" />
            <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-pulse" />
          </div>
          <div className="text-left pr-1">
            <div className="text-xs font-extrabold tracking-tight leading-none">
              Orio AI Help Center
            </div>
            <div className="text-[10px] text-purple-200/90 mt-0.5 leading-none">
              {lang === 'bn' ? 'বাংলা ও English সহায়তা' : '24/7 EN & বাংলা Support'}
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed right-4 sm:right-5 ${bottomOffsetClass} z-[65] flex flex-col rounded-3xl bg-[#07050d]/98 backdrop-blur-2xl border border-purple-500/40 shadow-2xl shadow-purple-950/80 overflow-hidden transition-all duration-200 ${
        isExpanded
          ? 'w-[calc(100vw-2rem)] sm:w-[460px] h-[min(78vh,640px)]'
          : 'w-[calc(100vw-2rem)] sm:w-[380px] h-[min(72vh,520px)]'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3.5 bg-gradient-to-r from-purple-950 via-[#160b2e] to-black border-b border-purple-500/30 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-800 border border-purple-400/40 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-white flex items-center gap-1.5 truncate">
              <span>Orio AI Help Center</span>
              <Sparkles className="w-3.5 h-3.5 text-purple-300 shrink-0" />
            </div>
            <div className="text-[10px] text-purple-300 truncate">
              {lang === 'bn' ? 'তাৎক্ষণিক সাহায্য • বাংলা ও English' : 'Instant Support • EN & বাংলা'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onChangeLang(lang === 'en' ? 'bn' : 'en')}
            className="px-2 py-1 rounded-lg bg-black/70 border border-purple-500/40 text-[10px] font-bold text-purple-200 hover:text-white flex items-center gap-1"
            title="Switch Support Language"
          >
            <Globe className="w-3 h-3 text-purple-400" />
            <span>{lang === 'en' ? 'বাংলা' : 'EN'}</span>
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg bg-black/60 text-slate-300 hover:text-white"
            title={isExpanded ? 'Compact view' : 'Expand window'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg bg-black/60 text-slate-300 hover:text-rose-400"
            title="Minimize Help Center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Account Profile ID Strip */}
      {userProfileId && (
        <div className="px-4 py-2 bg-purple-950/35 border-b border-purple-500/20 flex items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex items-center gap-1.5 text-purple-200 truncate">
            <HelpCircle className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>{lang === 'bn' ? 'প্রোফাইল আইডি:' : 'Your Profile ID:'}</span>
            <span className="font-mono font-bold text-white">{userProfileId}</span>
          </div>
          <button
            onClick={handleCopyId}
            className="px-2 py-0.5 rounded-md bg-purple-600/30 border border-purple-500/40 text-purple-100 hover:bg-purple-600 text-[10px] font-bold flex items-center gap-1 shrink-0"
          >
            {copiedId ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
            <span>{copiedId ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      )}

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#05030a]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-br-sm'
                  : 'bg-[#120d1f] border border-purple-500/30 text-slate-100 rounded-bl-sm'
              }`}
            >
              {m.text}
            </div>
            {m.role === 'assistant' && m.suggestedTab && m.suggestedLabel && (
              <button
                onClick={() => {
                  onNavigateTab(m.suggestedTab!);
                }}
                className="mt-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/40 text-[11px] font-bold text-purple-200 hover:bg-purple-600 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <span>{m.suggestedLabel}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-start">
            <div className="px-3.5 py-2.5 rounded-2xl bg-[#120d1f] border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span>{lang === 'bn' ? 'উত্তর তৈরি হচ্ছে...' : 'Thinking...'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Topics */}
      <div className="px-3 py-2 border-t border-purple-500/20 bg-[#0b0714] flex gap-1.5 overflow-x-auto shrink-0">
        {QUICK_TOPICS[lang].map((topic) => (
          <button
            key={topic.label}
            onClick={() => askHelpCenter(topic.prompt)}
            className="px-2.5 py-1 rounded-full bg-purple-950/60 border border-purple-500/30 text-[10px] font-semibold text-purple-200 hover:bg-purple-600 hover:text-white whitespace-nowrap transition-colors shrink-0"
          >
            {topic.label}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          askHelpCenter(input);
        }}
        className="p-3 bg-black border-t border-purple-500/30 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            lang === 'bn'
              ? 'প্রোফাইল আইডি, পেমেন্ট বা প্ল্যান সম্পর্কে লিখুন...'
              : 'Ask about Profile ID, plans, payments, videos...'
          }
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#100b1b] border border-purple-500/30 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="p-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
          title="Send question"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
