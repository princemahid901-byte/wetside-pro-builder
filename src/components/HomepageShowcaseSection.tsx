import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Bot,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Radio,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Search,
  Users,
  Lock,
  ArrowUpRight,
  Cookie,
  Check,
  ExternalLink,
  Shield,
  MessageSquare,
  Send,
  Mic,
  Camera
} from 'lucide-react';
import { Language, PromotionsConfig, PromotionTargetTab } from '../types/orio';
import { ReferenceLoginScreen, ReferenceLoginStartPayload } from './ReferenceLoginScreen';
import type { FirebaseUser } from '../firebase';

interface HomepageShowcaseSectionProps {
  lang: Language;
  promotions: PromotionsConfig;
  isAdmin: boolean;
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  userName?: string;
  userGender: 'girls' | 'boys' | 'other';
  userAge: number;
  userAvatar?: string;
  currentUserId?: string;
  currentUserProfileId?: string;
  targetGender: 'girls' | 'boys' | 'any';
  cookieConsentStatus: 'accepted' | 'rejected' | null;
  cookie18Checked: boolean;
  guidelinesAgreed: boolean;
  onToggleCookie18: (checked: boolean) => void;
  onToggleGuidelines: (checked: boolean) => void;
  onAcceptGoogleCookies: () => void;
  onEssentialOnlyCookies: () => void;
  onResetCookies: () => void;
  onGoogleSignIn: () => void;
  onStartReferenceChat: (payload: ReferenceLoginStartPayload) => void;
  onOpenPrivateMessageWithPeer?: (peerId: string) => void;
  onStartDirectCall?: (
    peerId: string,
    peerName?: string,
    callType?: 'video' | 'audio',
    peerProfileId?: string,
    peerAvatar?: string
  ) => void;
  onNavigateTab: (tab: string) => void;
  onStartAiTalk: () => void;
  showToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type HomeSubSection = 'overview' | 'creators' | 'streaming' | 'privacy';

function isVideoAsset(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url || '');
}

const FALLBACK_STILL = '/assets/aistudio/preview_livecall_16x9.jpg';
const LOGO_ASSET = '/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg';

export const HomepageShowcaseSection: React.FC<HomepageShowcaseSectionProps> = ({
  lang,
  promotions,
  isAdmin,
  firebaseUser,
  authLoading,
  userName,
  userGender,
  userAge,
  userAvatar,
  currentUserId,
  currentUserProfileId,
  targetGender,
  cookieConsentStatus,
  cookie18Checked,
  guidelinesAgreed,
  onToggleCookie18,
  onToggleGuidelines,
  onAcceptGoogleCookies,
  onEssentialOnlyCookies,
  onResetCookies,
  onGoogleSignIn,
  onStartReferenceChat,
  onOpenPrivateMessageWithPeer,
  onStartDirectCall,
  onNavigateTab,
  onStartAiTalk,
  showToast,
}) => {
  const [homeSection, setHomeSection] = useState<HomeSubSection>('overview');
  const [previewPlaying, setPreviewPlaying] = useState<boolean>(promotions.preview.autoplay);
  const [previewMuted, setPreviewMuted] = useState<boolean>(true);
  const [previewImgError, setPreviewImgError] = useState<boolean>(false);
  const [bannerImgError, setBannerImgError] = useState<boolean>(false);
  const [carouselImgErrors, setCarouselImgErrors] = useState<Record<string, boolean>>({});
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [carouselPaused, setCarouselPaused] = useState<boolean>(false);
  const [previewChatInput, setPreviewChatInput] = useState<string>('');
  const [previewMessages, setPreviewMessages] = useState<Array<{ id: string; sender: string; text: string; time: string; mine?: boolean }>>([
    { id: 'pm-1', sender: 'Sophia (Tokyo)', text: 'Hey! Join live HD call or say hi here.', time: 'Now' },
    { id: 'pm-2', sender: 'Liam (London)', text: '5+ global video room is open & free!', time: '1m' },
  ]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handleSendPreviewMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = previewChatInput.trim();
    if (!trimmed) return;
    setPreviewMessages((prev) => [
      ...prev.slice(-3),
      {
        id: `pm-${Date.now()}`,
        sender: userName && userName !== 'Global Verified User' ? userName : 'You',
        text: trimmed,
        time: 'Just now',
        mine: true,
      },
    ]);
    setPreviewChatInput('');
  };

  const activeSlides = (promotions.carousel || []).filter((s) => s.active);
  const currentSlide = activeSlides.length > 0 ? activeSlides[carouselIndex % activeSlides.length] : null;

  useEffect(() => {
    setPreviewImgError(false);
  }, [promotions.preview.mediaUrl, promotions.preview.posterUrl]);

  useEffect(() => {
    setBannerImgError(false);
  }, [promotions.banner.imageUrl]);

  useEffect(() => {
    setCarouselIndex(0);
  }, [activeSlides.length]);

  // Auto-rotate carousel every 5 seconds unless paused or reduced-motion preferred
  useEffect(() => {
    if (activeSlides.length <= 1 || carouselPaused) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % activeSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeSlides.length, carouselPaused]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (previewPlaying) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  }, [previewPlaying, promotions.preview.mediaUrl]);

  const handleTogglePreviewPlay = () => {
    const vid = videoRef.current;
    if (vid) {
      if (vid.paused) {
        vid.play().catch(() => {});
        setPreviewPlaying(true);
      } else {
        vid.pause();
        setPreviewPlaying(false);
      }
    } else {
      setPreviewPlaying((p) => !p);
    }
  };

  const handleTogglePreviewMute = () => {
    const vid = videoRef.current;
    const nextMuted = !previewMuted;
    if (vid) {
      vid.muted = nextMuted;
    }
    setPreviewMuted(nextMuted);
  };

  const bannerAccentClasses = {
    purple: 'from-purple-950/80 via-slate-900 to-indigo-950/70 border-purple-500/40',
    emerald: 'from-emerald-950/75 via-slate-900 to-teal-950/60 border-emerald-500/40',
    amber: 'from-amber-950/60 via-slate-900 to-orange-950/60 border-amber-500/40',
    rose: 'from-rose-950/70 via-slate-900 to-purple-950/60 border-rose-500/40',
  }[promotions.banner.accentTheme || 'purple'];

  const handleTargetJump = (tab: PromotionTargetTab) => {
    if (tab === 'subscriptions' || tab === 'payment-methods' || tab === 'gifts') {
      onNavigateTab('chat');
      return;
    }
    onNavigateTab(tab);
  };

  const sectionTabs: Array<{ id: HomeSubSection; num: string; label: string }> = [
    { id: 'overview', num: '01', label: 'Platform Overview' },
    { id: 'creators', num: '02', label: 'Global Friends & Profile IDs' },
    { id: 'streaming', num: '03', label: 'Free Videos & Live Rooms' },
    { id: 'privacy', num: '04', label: 'Privacy & Google Cookies' },
  ];

  const previewIsVideo = isVideoAsset(promotions.preview.mediaUrl);

  return (
    <div className="relative overflow-hidden w-full flex-1">
      {/* Subtle atmospheric glow placed strictly behind content (pointer-events-none) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 right-0 w-[520px] h-[520px] rounded-full bg-purple-600/10 blur-3xl -z-10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-40 -left-24 w-[420px] h-[420px] rounded-full bg-blue-600/10 blur-3xl -z-10"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8">
        {/* TOP BRAND STRIP & QUICK PLATFORM NAVIGATION */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl overflow-hidden bg-[#05060f] border border-purple-500/40 shadow-lg shadow-purple-600/25 shrink-0">
              <img
                src={LOGO_ASSET}
                alt="OrioLiveCall Logo"
                loading="eager"
                decoding="async"
                className="w-full h-full object-cover translate-x-[70%] scale-[2.65]"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                OrioLiveCall ·{' '}
                <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                  Meet the World. Talk Beyond Borders.
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                100% Free Global Video Calling &amp; Live Messaging — No signup, no subscriptions, and no payment system.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('chat')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xs shadow-lg shadow-purple-600/25 hover:opacity-95 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Video className="w-3.5 h-3.5 shrink-0" />
              <span>Free Video Call</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('messages')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-pink-500/40 text-pink-200 font-semibold text-xs hover:bg-pink-600/20 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span>Messaging</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('friends')}
              className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-purple-500/40 text-purple-200 font-semibold text-xs hover:bg-purple-600/20 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Global Friends</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateTab('chat');
                onStartAiTalk();
              }}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 font-semibold text-xs hover:bg-emerald-600/30 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>AI Partner</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('videos')}
              className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-semibold text-xs hover:border-purple-500 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Videos</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('live')}
              className="px-3 py-2.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-200 font-semibold text-xs hover:bg-rose-600/30 transition-all flex items-center gap-1.5 whitespace-nowrap"
            >
              <Radio className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>Live Rooms</span>
            </button>
          </div>
        </div>

        {/* FIRST PAGE SPLIT SHOWCASE: UPGRADED LOGIN/CALL CARD (LEFT) + SIDE-BY-SIDE CALL VIDEO & MESSAGING PREVIEW (RIGHT) */}
        <section
          aria-label="First Page Instant Call Setup with Side-by-Side Messaging and Video Call Preview"
          className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start"
        >
          {/* LEFT: UPGRADED READY TO CHAT / TALK FIRST-PAGE ENTRY CARD */}
          <div className="xl:col-span-7 w-full">
            <ReferenceLoginScreen
              initialName={userName}
              initialGender={userGender}
              initialTargetGender={targetGender}
              initialAge={userAge}
              avatarUrl={userAvatar}
              currentUserId={currentUserId}
              currentUserProfileId={currentUserProfileId}
              firebaseUser={firebaseUser}
              authLoading={authLoading}
              compactFirstPage={true}
              onStartChat={onStartReferenceChat}
              onOpenPrivateMessageWithPeer={onOpenPrivateMessageWithPeer}
              onStartDirectCall={onStartDirectCall}
              onGoogleSignIn={onGoogleSignIn}
              onOpenPrivacyPage={() => onNavigateTab('privacy-policy')}
              showToast={showToast}
            />
          </div>

          {/* RIGHT (SIDE-BY-SIDE): LIVE CALL VIDEO PREVIEW + LIVE MESSAGING PREVIEW + COOKIE CONSENT */}
          <div className="xl:col-span-5 w-full space-y-4">
            <div className="rounded-3xl bg-slate-900/95 border border-purple-500/40 shadow-2xl shadow-purple-950/50 overflow-hidden">
              {/* Preview Header */}
              <div className="px-4 py-2.5 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={LOGO_ASSET}
                    alt="OrioLiveCall Brand Mark"
                    loading="lazy"
                    decoding="async"
                    className="w-6 h-6 rounded-md object-cover border border-purple-500/40 shrink-0"
                  />
                  <span className="text-xs font-bold text-white truncate">
                    Live Call Video &amp; Messaging Preview
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {previewIsVideo && (
                    <>
                      <button
                        type="button"
                        onClick={handleTogglePreviewPlay}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                        aria-label={previewPlaying ? 'Pause website preview' : 'Play website preview'}
                        title={previewPlaying ? 'Pause preview' : 'Play preview'}
                      >
                        {previewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={handleTogglePreviewMute}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                        aria-label={previewMuted ? 'Unmute preview audio' : 'Mute preview audio'}
                        title={previewMuted ? 'Unmute preview audio' : 'Mute preview audio'}
                      >
                        {previewMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </button>
                    </>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('admin')}
                      className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-[11px] font-semibold text-purple-200 whitespace-nowrap"
                    >
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* 16:9 Live Video Call Preview Stage */}
              <div className="relative aspect-video w-full bg-[#070914] overflow-hidden">
                {previewIsVideo && !previewImgError ? (
                  <video
                    ref={videoRef}
                    src={promotions.preview.mediaUrl}
                    poster={promotions.preview.posterUrl || FALLBACK_STILL}
                    autoPlay={promotions.preview.autoplay}
                    muted={previewMuted}
                    loop
                    playsInline
                    preload="metadata"
                    onError={() => setPreviewImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : !previewImgError ? (
                  <img
                    src={previewIsVideo ? (promotions.preview.posterUrl || FALLBACK_STILL) : promotions.preview.mediaUrl}
                    alt={promotions.preview.headline}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={() => setPreviewImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0c0f24] via-purple-950/60 to-slate-950 flex flex-col items-center justify-center p-6 text-center gap-3">
                    <img
                      src={LOGO_ASSET}
                      alt="OrioLiveCall"
                      loading="lazy"
                      decoding="async"
                      className="w-16 h-16 rounded-2xl object-cover border border-purple-500/50"
                    />
                    <div className="text-sm font-bold text-white">OrioLiveCall · 16:9 Call Video Preview</div>
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/35" />

                {/* Top Call Preview HUD */}
                <div className="pointer-events-none absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-purple-500/35">
                    <Video className="w-3.5 h-3.5 text-pink-400" />
                    <span className="text-[11px] font-bold text-white">HD Video Call Preview</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-emerald-500/35 text-[10px] font-semibold text-emerald-300">
                    <Camera className="w-3 h-3" />
                    <Mic className="w-3 h-3" />
                    <span>Ready</span>
                  </div>
                </div>

                {/* Bottom Quick Video Launch Bar */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-200 font-medium line-clamp-1 flex-1 drop-shadow">
                    {promotions.preview.headline}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleTargetJump(promotions.preview.ctaTab)}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#f43f8e] to-purple-600 hover:brightness-110 text-white text-[11px] font-bold transition-all flex items-center gap-1 whitespace-nowrap shrink-0 shadow-lg"
                  >
                    <Video className="w-3 h-3" />
                    <span>{promotions.preview.ctaLabel || 'Join Call'}</span>
                  </button>
                </div>
              </div>

              {/* LIVE MESSAGING PREVIEW PANEL (RIGHT UNDER CALL VIDEO PREVIEW) */}
              <div className="p-3.5 bg-slate-950/95 border-t border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
                    <span>Live Messaging Preview</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('messages')}
                    className="text-[11px] font-semibold text-purple-300 hover:text-white inline-flex items-center gap-1"
                  >
                    <span>Open Messages</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {previewMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] leading-snug flex items-start justify-between gap-2 ${
                        msg.mine
                          ? 'bg-purple-600/25 border border-purple-500/40 text-purple-100'
                          : 'bg-slate-900 border border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className={`font-bold mr-1.5 ${msg.mine ? 'text-pink-300' : 'text-emerald-300'}`}>
                          {msg.sender}:
                        </span>
                        <span className="break-words">{msg.text}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 shrink-0 mt-0.5">{msg.time}</span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendPreviewMessage} className="flex items-center gap-2 pt-0.5">
                  <input
                    type="text"
                    value={previewChatInput}
                    onChange={(e) => setPreviewChatInput(e.target.value)}
                    placeholder="Type a quick message..."
                    maxLength={120}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-pink-500 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>

            {/* FIRST-VISIT USER GOOGLE COOKIES & AUTH CONSENT BOX DIRECTLY UNDER PREVIEW */}
            <div
              aria-label="Google Cookies Consent and Privacy Under Preview"
              className={`rounded-2xl border p-4 transition-all ${
                cookieConsentStatus === 'accepted'
                  ? 'bg-emerald-950/30 border-emerald-500/40'
                  : 'bg-slate-900/95 border-purple-500/50 shadow-lg shadow-purple-950/40'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center shrink-0 mt-0.5">
                    <Cookie className="w-4 h-4 text-purple-300" />
                  </div>
                  <div className="space-y-0.5 text-xs">
                    <div className="font-bold text-white flex flex-wrap items-center gap-2">
                      <span>Google Cookies &amp; Auth Consent</span>
                      {cookieConsentStatus === 'accepted' && (
                        <span className="text-emerald-300 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Accepted
                        </span>
                      )}
                      {cookieConsentStatus === 'rejected' && (
                        <span className="text-rose-300 font-semibold">Declined</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      Confirm 18+ age &amp; agree to Website Guidelines.
                    </p>
                  </div>
                </div>

                {cookieConsentStatus && (
                  <button
                    type="button"
                    onClick={onResetCookies}
                    className="text-[11px] font-semibold text-purple-300 hover:text-white underline self-start sm:self-center shrink-0"
                  >
                    Open Notification
                  </button>
                )}
              </div>

              {!cookieConsentStatus && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white">
                      <input
                        type="checkbox"
                        checked={cookie18Checked}
                        onChange={(e) => onToggleCookie18(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-purple-500"
                      />
                      <span>Confirm 18+ years old</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200 hover:text-white">
                      <input
                        type="checkbox"
                        checked={guidelinesAgreed}
                        onChange={(e) => onToggleGuidelines(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-purple-500"
                      />
                      <span>Agree to Guidelines</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onAcceptGoogleCookies}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold flex items-center gap-1 shadow-md whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      onClick={onEssentialOnlyCookies}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold whitespace-nowrap"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('guidelines')}
                      className="text-[11px] font-semibold text-purple-300 hover:text-white ml-auto"
                    >
                      Guidelines
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* HOMEPAGE PRIVACY POLICY, GOOGLE COOKIES & CONSENT SECTION (ALWAYS VISIBLE ON HOME PAGE) */}
        <section
          aria-label="Homepage Privacy Policy and Google Cookies Consent"
          className="rounded-3xl bg-slate-900/95 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Privacy Policy, Google Cookies &amp; Consent</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Transparent Privacy, Google Sign-In &amp; 100% Free Access
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href="/privacy-policy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <span>Standalone Privacy Policy</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onNavigateTab('privacy-policy')}
                className="px-4 py-2 rounded-xl bg-purple-600/25 border border-purple-500/40 text-purple-200 hover:bg-purple-600/40 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Privacy Guardian Center</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <Cookie className="w-4 h-4 text-purple-400" />
                  <span>Google Cookies &amp; Auth</span>
                </div>
                {cookieConsentStatus && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      cookieConsentStatus === 'accepted'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-rose-500/15 text-rose-300'
                    }`}
                  >
                    {cookieConsentStatus === 'accepted' ? 'Accepted' : 'Declined'}
                  </span>
                )}
              </div>
              <p className="text-slate-400 leading-relaxed">
                Confirm you are <strong className="text-slate-200">18+ years old</strong> and agree to our{' '}
                <button
                  type="button"
                  onClick={() => onNavigateTab('guidelines')}
                  className="text-purple-300 hover:text-white underline font-semibold"
                >
                  Website Guidelines
                </button>{' '}
                &amp; Google Auth session cookies.
              </p>
              <div className="space-y-1.5 text-[11px] text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cookie18Checked}
                    onChange={(e) => onToggleCookie18(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-emerald-500"
                  />
                  <span>18+ Years Confirmed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={guidelinesAgreed}
                    onChange={(e) => onToggleGuidelines(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-emerald-500"
                  />
                  <span>Agree with Website Guidelines</span>
                </label>
              </div>
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onAcceptGoogleCookies}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold whitespace-nowrap"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={onEssentialOnlyCookies}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold whitespace-nowrap"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={onResetCookies}
                  className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/40 text-purple-200 hover:bg-purple-600/35 font-semibold whitespace-nowrap"
                >
                  Notify Popup
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Zero-Recording P2P Calls</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Real-time 1-on-1 and group video calls run peer-to-peer with mutual acceptance before connecting. Camera, mic, and profile privacy visibility stay strictly under your control.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('guidelines')}
                className="text-xs font-bold text-emerald-300 hover:text-white inline-flex items-center gap-1 pt-1"
              >
                <span>Read Safety Guidelines</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>100% Free — No Payment System</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                No subscriptions, no virtual gifts, no wallets, no earnings, and no paid upgrades are requested on this website. All communication features are completely free for 18+ users.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('terms')}
                className="text-xs font-bold text-blue-300 hover:text-white inline-flex items-center gap-1 pt-1"
              >
                <span>Read Terms &amp; 18+ Policy</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* HOMEPAGE SECTION SWITCHER — Navigating Sections Keeps 16:9 Preview + Ads Continuously Visible */}
        <section aria-label="Homepage Section Navigation and Feature Explorer" className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {sectionTabs.map((tab) => {
                const active = homeSection === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHomeSection(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-purple-500/50 hover:text-white'
                    }`}
                  >
                    <span className={`font-mono text-[10px] ${active ? 'text-purple-200' : 'text-purple-400'}`}>
                      {tab.num}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-slate-400">
              Preview, privacy &amp; promotions remain visible while exploring
            </div>
          </div>

          {homeSection === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">01 · Real-Time Video Engine</div>
                <h2 className="text-xl font-bold text-white">Adaptive WebRTC Calls with Live Stability Signal</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Monitor connection strength bars, RTT latency, packet loss, and adaptive video resolution dynamically during every random video chat or multiplayer session.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('chat')}
                  className="text-xs font-bold text-purple-300 hover:text-white inline-flex items-center gap-1 pt-1"
                >
                  <span>Open Call Stage</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="md:col-span-4 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">02 · 5+ Multiplayer Video</div>
                <h2 className="text-lg font-bold text-white">Free Group Video Lounge</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Host or join multi-participant live video rooms with smooth grid/spotlight layouts, mic &amp; camera controls, and live room chat.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('multiplayer')}
                  className="text-xs font-bold text-emerald-300 hover:text-white inline-flex items-center gap-1 pt-1"
                >
                  <span>Enter 5+ Lounge</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="md:col-span-3 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">03 · Instant IDs</div>
                <h2 className="text-lg font-bold text-white">ORI-XXXXXX Identity</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Unique shareable Profile IDs let global friends look you up safely without sharing private details.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('profile')}
                  className="text-xs font-bold text-blue-300 hover:text-white inline-flex items-center gap-1 pt-1"
                >
                  <span>View My Profile ID</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {homeSection === 'creators' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <Search className="w-5 h-5 text-purple-400" />
                <h3 className="text-base font-bold text-white">Search by Profile ID or Name</h3>
                <p className="text-xs text-slate-400">Look up profiles instantly with unique IDs like ORI-100001 and share direct profile links.</p>
                <button type="button" onClick={() => onNavigateTab('creators')} className="text-xs font-bold text-purple-300 hover:text-white pt-1 inline-flex items-center gap-1">
                  <span>Discover Profiles</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Free Global Friends</h3>
                <p className="text-xs text-slate-400">Send friend requests, filter by country, and control who can see your online status.</p>
                <button type="button" onClick={() => onNavigateTab('friends')} className="text-xs font-bold text-emerald-300 hover:text-white pt-1 inline-flex items-center gap-1">
                  <span>Open Global Friends</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Private Live Messaging</h3>
                <p className="text-xs text-slate-400">Message friends directly or keep unknown senders routed to your Message Requests inbox.</p>
                <button type="button" onClick={() => onNavigateTab('messages')} className="text-xs font-bold text-blue-300 hover:text-white pt-1 inline-flex items-center gap-1">
                  <span>Open Messages</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {homeSection === 'streaming' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">Free Public Discovery</div>
                  <h3 className="text-lg font-bold text-white">Search Videos, Save History &amp; Watch Free</h3>
                  <p className="text-xs text-slate-400">Responsive HTML5 playback, fullscreen &amp; volume controls, hashtags, trending filters, and safe content screening.</p>
                </div>
                <button type="button" onClick={() => onNavigateTab('videos')} className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-200 text-xs font-bold self-start hover:bg-purple-600/30">
                  Browse Video Library
                </button>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wider">Free Community Live</div>
                  <h3 className="text-lg font-bold text-white">Moderated Free Live Rooms</h3>
                  <p className="text-xs text-slate-400">Join open free public live rooms and interactive moderated chat with zero charges or ticket fees.</p>
                </div>
                <button type="button" onClick={() => onNavigateTab('live')} className="px-4 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-200 text-xs font-bold self-start hover:bg-rose-600/30">
                  Enter Live Rooms
                </button>
              </div>
            </div>
          )}

          {homeSection === 'privacy' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start gap-4">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">18+ Strict Compliance &amp; Moderation</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Non-explicit platform rules, privacy-first message requests, instant user blocking, and human + automated content moderation queues keep every room safe.
                  </p>
                  <button type="button" onClick={() => onNavigateTab('guidelines')} className="text-xs font-bold text-emerald-300 hover:text-white inline-flex items-center gap-1 pt-1">
                    <span>Read Community Rules</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start gap-4">
                <Cookie className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">Google Cookies &amp; Privacy Center</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Inspect Firebase storage policies, manage Google Sign-In cookie preferences, or open our standalone white Privacy Policy page.
                  </p>
                  <button type="button" onClick={() => onNavigateTab('privacy-policy')} className="text-xs font-bold text-purple-300 hover:text-white inline-flex items-center gap-1 pt-1">
                    <span>Open Privacy Center</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* SEPARATE ADVERTISEMENT BANNER AREA */}
        {promotions.banner.enabled && (
          <section
            aria-label="Featured Advertisement Banner"
            className={`rounded-3xl bg-gradient-to-r ${bannerAccentClasses} border p-5 sm:p-6 shadow-xl`}
          >
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              <div className="md:col-span-8 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-purple-300">
                  <span>{promotions.banner.sponsorLabel}</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-slate-400">Advertisement</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                  {promotions.banner.title}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                  {promotions.banner.subtitle}
                </p>
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleTargetJump(promotions.banner.ctaTab)}
                    className="px-5 py-2.5 rounded-xl bg-white text-slate-950 font-bold text-xs hover:bg-purple-100 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <span>{promotions.banner.ctaLabel}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('admin')}
                      className="px-3.5 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-xs font-semibold text-slate-200 hover:border-purple-400 whitespace-nowrap"
                    >
                      Manage Banner in Admin
                    </button>
                  )}
                </div>
              </div>

              <div className="md:col-span-4">
                <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-slate-950 relative">
                  {!bannerImgError && promotions.banner.imageUrl ? (
                    <img
                      src={promotions.banner.imageUrl}
                      alt={promotions.banner.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() => setBannerImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-900/80 via-slate-900 to-blue-900/70 flex items-center justify-center p-4">
                      <img
                        src={LOGO_ASSET}
                        alt="OrioLiveCall Partner Banner"
                        loading="lazy"
                        decoding="async"
                        className="w-14 h-14 rounded-xl object-cover border border-purple-400/50"
                      />
                    </div>
                  )}
                  <div className="pointer-events-none absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/80 border border-white/10">
                    <img
                      src={LOGO_ASSET}
                      alt="OrioLiveCall"
                      loading="lazy"
                      decoding="async"
                      className="w-3.5 h-3.5 rounded-sm object-cover"
                    />
                    <span className="text-[10px] font-bold text-slate-200">OrioLiveCall</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* AUTOMATIC ROTATING ADVERTISEMENT CAROUSEL */}
        {currentSlide && (
          <section
            aria-label="Automatic Rotating Advertisement Carousel"
            onMouseEnter={() => setCarouselPaused(true)}
            onMouseLeave={() => setCarouselPaused(false)}
            className="rounded-3xl bg-slate-900/95 border border-slate-800 p-5 sm:p-6 shadow-xl space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={LOGO_ASSET}
                  alt="OrioLiveCall Logo"
                  loading="lazy"
                  decoding="async"
                  className="w-6 h-6 rounded-lg object-cover border border-purple-500/40"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Sponsored &amp; Platform Promotions Carousel
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCarouselPaused((p) => !p)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 flex items-center gap-1"
                  aria-label={carouselPaused ? 'Resume auto-rotation' : 'Pause auto-rotation'}
                >
                  {carouselPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                  <span>{carouselPaused ? 'Paused' : 'Auto'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCarouselIndex((prev) => (prev - 1 + activeSlides.length) % activeSlides.length)
                  }
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  aria-label="Previous promotion slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCarouselIndex((prev) => (prev + 1) % activeSlides.length)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  aria-label="Next promotion slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-5">
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 relative">
                  {!carouselImgErrors[currentSlide.id] && currentSlide.imageUrl ? (
                    <img
                      src={currentSlide.imageUrl}
                      alt={currentSlide.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setCarouselImgErrors((prev) => ({ ...prev, [currentSlide.id]: true }))
                      }
                      className="w-full h-full object-cover transition-opacity duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-slate-950 via-purple-950/60 to-blue-950/60 flex items-center justify-center">
                      <img
                        src={LOGO_ASSET}
                        alt="OrioLiveCall"
                        loading="lazy"
                        decoding="async"
                        className="w-12 h-12 rounded-xl object-cover border border-purple-500/40"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="md:col-span-7 space-y-3">
                <div className="text-xs font-semibold text-purple-300 flex items-center gap-2">
                  <span>{currentSlide.sponsor}</span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-400">{currentSlide.category}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {currentSlide.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {currentSlide.subtitle}
                </p>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => handleTargetJump(currentSlide.ctaTab)}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold hover:opacity-95 transition-opacity inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <span>{currentSlide.ctaLabel}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-2" role="tablist" aria-label="Carousel slide indicators">
                    {activeSlides.map((slide, idx) => {
                      const isActive = idx === carouselIndex % activeSlides.length;
                      return (
                        <button
                          key={slide.id}
                          type="button"
                          role="tab"
                          aria-selected={isActive}
                          aria-label={`View slide ${idx + 1}: ${slide.title}`}
                          onClick={() => setCarouselIndex(idx)}
                          className={`h-2 rounded-full transition-all ${
                            isActive ? 'w-7 bg-purple-400' : 'w-2 bg-slate-700 hover:bg-slate-500'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
