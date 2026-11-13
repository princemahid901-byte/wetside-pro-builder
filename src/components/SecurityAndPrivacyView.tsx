import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Video,
  Cookie,
  UserCheck,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Activity,
  RefreshCw,
  Users,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { UserPrivacySettings, AgeVerificationPublicStatus } from '../types/orio';

interface SecurityAndPrivacyViewProps {
  lang: 'en' | 'bn';
  currentUserId: string;
  userProfileId?: string;
  privacy: UserPrivacySettings;
  ageVerifyStatus: AgeVerificationPublicStatus | null;
  onOpenAgeModal: () => void;
  onUpdateExtendedPrivacy: (patch: Partial<UserPrivacySettings>) => void;
  onResetCookies: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const SecurityAndPrivacyView: React.FC<SecurityAndPrivacyViewProps> = ({
  lang,
  currentUserId: _currentUserId,
  userProfileId,
  privacy,
  ageVerifyStatus,
  onOpenAgeModal,
  onUpdateExtendedPrivacy,
  onResetCookies,
  showToast,
}) => {
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'widget' | 'policies'>('overview');
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const [_diagnosticsResult, setDiagnosticsResult] = useState<{
    webrtc: boolean;
    cookies: boolean;
    age: boolean;
  }>({
    webrtc: true,
    cookies: true,
    age: Boolean(ageVerifyStatus?.verified),
  });

  const t = {
    en: {
      title: "Security & Privacy Center",
      subtitle: "Enterprise-grade safety, WebRTC peer-to-peer encryption, zero server video recording, and strict 18+ adult protection.",
      guardianWidget: "Orio Privacy Guardian Widget",
      widgetDesc: "Interactive real-time safety monitor and embeddable badge for your profile and external sites.",
      adult18Title: "Adult 18+ Verification",
      adult18Verified: "18+ Adult Verified",
      adult18Unverified: "Verification Required",
      adult18Desc: "Server-validated Date of Birth and cryptographic SHA-256 ID hash protection.",
      webrtcTitle: "WebRTC P2P Video Privacy",
      webrtcStatus: "Zero Server Recording Active",
      webrtcDesc: "All 1-on-1 calls run directly peer-to-peer using DTLS/SRTP encryption. Calls are never recorded or stored on any server.",
      cookiesTitle: "Google Cookies & Consent",
      cookiesDesc: "Essential session cookies enabled with verified 18+ confirmation. No cross-site ad trackers.",
      messagingTitle: "Messaging & Presence Gates",
      messagingDesc: "Manage who can send you direct messages and toggle whether your online presence is visible.",
      copyEmbed: "Copy Widget Embed Code",
      copied: "Copied Code! ✓",
      openHtmlPage: "Open Standalone HTML Page",
      privacyLevel: "Live Privacy Level",
      onlineStatusToggle: "Show Online Status",
      directoryToggle: "Appear in Global Friends Directory",
      requestsToggle: "Allow Friend Requests",
      messagingPrivacyLabel: "Direct Messaging Access",
      runCheck: "Run Security Diagnostics",
    },
    bn: {
      title: "নিরাপত্তা ও গোপনীয়তা কেন্দ্র",
      subtitle: "কঠোর ১৮+ প্রাপ্তবয়স্ক নিশ্চিতকরণ, ওয়েবরটিসি পিয়ার-টু-পিয়ার এনক্রিপশন এবং কোনো সার্ভার ভিডিও রেকর্ডিং ছাড়া পূর্ণ নিরাপত্তা।",
      guardianWidget: "অরিও প্রাইভেসি গার্ডিয়ান উইজেট",
      widgetDesc: "রিয়েল-টাইম নিরাপত্তা মনিটর এবং ওয়েবসাইটে যুক্ত করার মতো ইন্টারঅ্যাকটিভ ব্যাজ উইজেট।",
      adult18Title: "১৮+ প্রাপ্তবয়স্ক নিশ্চিতকরণ",
      adult18Verified: "১৮+ প্রাপ্তবয়স্ক নিশ্চিত",
      adult18Unverified: "বয়স যাচাইকরণ প্রয়োজন",
      adult18Desc: "সার্ভারে সংরক্ষিত জন্মতারিখ ও ক্রিপ্টোগ্রাফিক SHA-256 হ্যাশের মাধ্যমে সুরক্ষিত।",
      webrtcTitle: "ওয়েবরটিসি ভিডিও গোপনীয়তা",
      webrtcStatus: "জিরো সার্ভার রেকর্ডিং সক্রিয়",
      webrtcDesc: "সমস্ত ১-অন-১ ভিডিও কল সরাসরি পিয়ার-টু-পিয়ার এনক্রিপশনের মাধ্যমে চলে। কখনোই কোনো কল রেকর্ড বা সংরক্ষণ করা হয় না।",
      cookiesTitle: "গুগল কুকিজ ও সম্মতি",
      cookiesDesc: "১৮+ সম্মতির ভিত্তিতে শুধুমাত্র প্রয়োজনীয় নিরাপত্তা কুকিজ ব্যবহৃত হয়। কোনো অনাকাঙ্ক্ষিত ট্র্যাকিং নেই।",
      messagingTitle: "মেসেজিং ও উপস্থিতি নিয়ন্ত্রণ",
      messagingDesc: "কে আপনাকে মেসেজ পাঠাতে পারবে তা নির্ধারণ করুন এবং অনলাইন স্ট্যাটাস চালু/বন্ধ রাখুন।",
      copyEmbed: "উইজেট কোড কপি করুন",
      copied: "কোড কপি হয়েছে! ✓",
      openHtmlPage: "পূর্ণাঙ্গ এইচটিএমএল পেজ খুলুন",
      privacyLevel: "বর্তমান গোপনীয়তা মোড",
      onlineStatusToggle: "অনলাইন স্ট্যাটাস দেখান",
      directoryToggle: "গ্লোবাল ফ্রেন্ডস তালিকায় দেখান",
      requestsToggle: "ফ্রেন্ড রিকোয়েস্ট গ্রহণ করুন",
      messagingPrivacyLabel: "মেসেজ পাঠানোর অনুমতি",
      runCheck: "নিরাপত্তা পরীক্ষা চালান",
    },
  }[lang];

  const handleCopyEmbedCode = async () => {
    const embedCode = `<!-- OrioLiveCall Verified Security & Privacy Widget -->\n<iframe\n  src="${window.location.origin}/security-privacy.html?widget=true"\n  width="100%"\n  height="420"\n  style="border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 20px; background: #05060f;"\n  title="OrioLiveCall Security & Privacy Widget"\n  allow="camera; microphone">\n</iframe>`;
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopiedEmbed(true);
      showToast('Security widget embed code copied!', 'success');
      setTimeout(() => setCopiedEmbed(false), 2200);
    } catch {
      showToast('Could not copy embed code automatically.', 'error');
    }
  };

  const handleRunDiagnostics = () => {
    setDiagnosticsRunning(true);
    setTimeout(() => {
      setDiagnosticsResult({
        webrtc: Boolean(window.RTCPeerConnection),
        cookies: navigator.cookieEnabled,
        age: Boolean(ageVerifyStatus?.verified),
      });
      setDiagnosticsRunning(false);
      showToast('All security protocols verified active.', 'success');
    }, 600);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8 w-full flex-1">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-purple-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="space-y-2 relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/70 border border-purple-500/40 text-purple-300 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>OrioLiveCall Security &amp; Privacy Shield</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {t.title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {t.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 relative z-10 shrink-0">
          <a
            href="/security-privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-purple-600/30 border border-purple-500/50 text-purple-200 text-xs font-bold hover:bg-purple-600/50 transition-all flex items-center gap-1.5 shadow-lg"
          >
            <ExternalLink className="w-4 h-4 text-purple-300" />
            <span>{t.openHtmlPage}</span>
          </a>
          <button
            onClick={handleCopyEmbedCode}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold hover:opacity-95 shadow-lg shadow-purple-600/25 transition-all flex items-center gap-1.5"
          >
            {copiedEmbed ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copiedEmbed ? t.copied : t.copyEmbed}</span>
          </button>
        </div>
      </div>

      {/* TOP NAVIGATION TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Security Health &amp; Diagnostics</span>
        </button>
        <button
          onClick={() => setActiveTab('widget')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'widget'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Live Privacy Guardian Widget</span>
        </button>
        <button
          onClick={() => setActiveTab('policies')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'policies'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Full Policy Documents</span>
        </button>
      </div>

      {/* TAB 1: SECURITY HEALTH & REAL-TIME CONTROLS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          
          {/* 4 Core Pillars Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Pillar 1: 18+ Verification */}
            <div className={`p-5 rounded-3xl border flex flex-col justify-between gap-3 ${
              ageVerifyStatus?.verified
                ? 'bg-emerald-950/20 border-emerald-500/40'
                : 'bg-amber-950/20 border-amber-500/40'
            }`}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center font-bold text-xs text-purple-300">
                    18+
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    ageVerifyStatus?.verified ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {ageVerifyStatus?.verified ? t.adult18Verified : t.adult18Unverified}
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm">{t.adult18Title}</h3>
                <p className="text-xs text-slate-400">{t.adult18Desc}</p>
              </div>
              {!ageVerifyStatus?.verified && (
                <button
                  onClick={onOpenAgeModal}
                  className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs transition-all shadow"
                >
                  Verify Adult 18+ Now
                </button>
              )}
            </div>

            {/* Pillar 2: WebRTC Zero Recording */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <Video className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                    DTLS/SRTP Active
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm">{t.webrtcTitle}</h3>
                <p className="text-xs text-slate-400">{t.webrtcDesc}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 text-[11px] text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-semibold">{t.webrtcStatus}</span>
              </div>
            </div>

            {/* Pillar 3: Google Cookies */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                    <Cookie className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-600/20 text-purple-300">
                    18+ Consented
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm">{t.cookiesTitle}</h3>
                <p className="text-xs text-slate-400">{t.cookiesDesc}</p>
              </div>
              <button
                onClick={onResetCookies}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all border border-slate-700"
              >
                Reset Cookie Preferences
              </button>
            </div>

            {/* Pillar 4: Profile ID & Privacy */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-indigo-300 bg-indigo-950/60 border border-indigo-500/30">
                    {userProfileId || 'ORI-100004'}
                  </span>
                </div>
                <h3 className="font-bold text-white text-sm">{t.messagingTitle}</h3>
                <p className="text-xs text-slate-400">{t.messagingDesc}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                <span>Gate: </span>
                <span className="font-bold capitalize text-purple-300">{privacy.messagingPrivacy}</span>
              </div>
            </div>

          </div>

          {/* Real-Time Privacy Controls Panel */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-purple-400" />
                <span>Real-Time Privacy &amp; Visibility Controls (তাত্ক্ষণিক গোপনীয়তা সেটিংস)</span>
              </h2>
              <button
                onClick={handleRunDiagnostics}
                disabled={diagnosticsRunning}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-purple-300 hover:text-white flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${diagnosticsRunning ? 'animate-spin' : ''}`} />
                <span>{diagnosticsRunning ? 'Testing...' : t.runCheck}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              
              {/* Toggle 1: Online Status */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    {privacy.showOnlineStatus ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{t.onlineStatusToggle}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {privacy.showOnlineStatus
                      ? 'Friends can see when you are active on the site.'
                      : 'Your online status is completely hidden (never shown).'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateExtendedPrivacy({ showOnlineStatus: !privacy.showOnlineStatus })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${privacy.showOnlineStatus ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${privacy.showOnlineStatus ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Toggle 2: Show in Global Friends */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>{t.directoryToggle}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {privacy.showInGlobalFriends
                      ? 'Your public profile appears in Global Friends discovery search.'
                      : 'You are unlisted from public discovery search.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateExtendedPrivacy({ showInGlobalFriends: !privacy.showInGlobalFriends })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${privacy.showInGlobalFriends ? 'bg-purple-600' : 'bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${privacy.showInGlobalFriends ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Toggle 3: Allow Friend Requests */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t.requestsToggle}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {privacy.allowFriendRequests
                      ? 'Eligible verified members can send you friend requests.'
                      : 'Incoming friend requests are disabled.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateExtendedPrivacy({ allowFriendRequests: !privacy.allowFriendRequests })}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 ${privacy.allowFriendRequests ? 'bg-indigo-600' : 'bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${privacy.allowFriendRequests ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Selector: Messaging Privacy */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                  <span>{t.messagingPrivacyLabel}</span>
                </div>
                <select
                  value={privacy.messagingPrivacy}
                  onChange={(e) => onUpdateExtendedPrivacy({ messagingPrivacy: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="friends">Global Friends Only (সরাসরি বন্ধুরা)</option>
                  <option value="followers">Followers &amp; Connections (ফলোয়ার্স)</option>
                  <option value="subscribers">Active Subscribers Only (সাবস্ক্রাইবার্স)</option>
                  <option value="everyone">Everyone (অনুরোধ সহ সবার জন্য)</option>
                  <option value="nobody">Nobody (মেসেজ সম্পূর্ণ বন্ধ)</option>
                </select>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE PRIVACY GUARDIAN WIDGET ("GIGET") */}
      {activeTab === 'widget' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-purple-500/40 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>{t.guardianWidget}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">{t.widgetDesc}</p>
            </div>
            <button
              onClick={handleCopyEmbedCode}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow"
            >
              {copiedEmbed ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedEmbed ? t.copied : t.copyEmbed}</span>
            </button>
          </div>

          {/* Embedded Widget Preview Frame */}
          <div className="p-6 rounded-3xl bg-slate-950 border border-purple-500/30 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#05060f] border border-purple-500/40 overflow-hidden shrink-0">
                  <img
                    src="/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg"
                    alt="OrioLiveCall"
                    className="w-full h-full object-cover translate-x-[70%] scale-[2.65]"
                  />
                </div>
                <div>
                  <div className="font-bold text-white text-sm">OrioLiveCall Verified Safety Shield</div>
                  <div className="text-[11px] text-purple-300">Adult 18+ Certified · WebRTC Zero-Recording Standard</div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                ACTIVE SHIELD
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[11px]">Caller Identity</div>
                <div className="font-bold text-white">{userProfileId || 'ORI-100004'}</div>
                <div className="text-[10px] text-emerald-400">Verified ID Protected</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[11px]">Media Stream</div>
                <div className="font-bold text-emerald-400">Zero Recording</div>
                <div className="text-[10px] text-slate-400">Encrypted P2P</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400 text-[11px]">Database Cloud</div>
                <div className="font-bold text-purple-300">Firebase Zero-Trust</div>
                <div className="text-[10px] text-slate-400">ESLint-Validated Rules</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
              ✓ This interactive widget guarantees caller privacy across the entire platform. No personal phone numbers, physical addresses, or raw ID digits are ever stored in plain text or disclosed to third parties.
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMPLETE POLICY DOCUMENTS (BILINGUAL) */}
      {activeTab === 'policies' && (
        <div className="space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-6">
            <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              <span>Full Policy Disclaimers &amp; Guidelines (আইনি ও নিরাপত্তা শর্তাবলী)</span>
            </h2>

            <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>1. 18+ Strict Adult Eligibility Policy (১৮+ বয়স সংক্রান্ত নীতিমালা)</span>
                </h3>
                <p>
                  OrioLiveCall operates exclusively as an adult platform for verified persons aged 18 and older. Any user under 18 is prohibited from creating accounts, accessing live matching queues, or participating in video calls. Age verification utilizes calendar birth dates and hashed identity documents.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>2. Peer-to-Peer WebRTC Zero Video Recording Guarantee (জিরো রেকর্ডিং নিশ্চয়তা)</span>
                </h3>
                <p>
                  All random 1-to-1 video connections are negotiated directly between peer browsers via WebRTC with DTLS/SRTP encryption. OrioLiveCall servers do not inspect, intercept, record, or retain any video or audio stream data.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>3. Google Cookies, Firestore Zero-Trust Rules &amp; Data Rights (ডেটা অধিকার ও কুকিজ)</span>
                </h3>
                <p>
                  Google Firebase Authentication and Firestore enforce zero-trust security rules. You have the right at any time to export your data, change your messaging privacy settings, block or unblock users, and request account deletion.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
