import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Bot,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Radio,
  Crown,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Search,
  Users,
  Lock,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { Language, PromotionsConfig, PromotionTargetTab } from '../types/orio';

interface HomepageShowcaseSectionProps {
  lang: Language;
  promotions: PromotionsConfig;
  isAdmin: boolean;
  onNavigateTab: (tab: string) => void;
  onStartAiTalk: () => void;
}

type HomeSubSection = 'overview' | 'creators' | 'streaming' | 'safety';

function isVideoAsset(url: string): boolean {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(url || '');
}

const FALLBACK_STILL = '/assets/aistudio/preview_livecall_16x9.jpg';
const LOGO_ASSET = '/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg';

export const HomepageShowcaseSection: React.FC<HomepageShowcaseSectionProps> = ({
  lang,
  promotions,
  isAdmin,
  onNavigateTab,
  onStartAiTalk,
}) => {
  const [homeSection, setHomeSection] = useState<HomeSubSection>('overview');
  const [previewPlaying, setPreviewPlaying] = useState<boolean>(promotions.preview.autoplay);
  const [previewMuted, setPreviewMuted] = useState<boolean>(true);
  const [previewImgError, setPreviewImgError] = useState<boolean>(false);
  const [bannerImgError, setBannerImgError] = useState<boolean>(false);
  const [carouselImgErrors, setCarouselImgErrors] = useState<Record<string, boolean>>({});
  const [carouselIndex, setCarouselIndex] = useState<number>(0);
  const [carouselPaused, setCarouselPaused] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
    onNavigateTab(tab);
  };

  const sectionTabs: Array<{ id: HomeSubSection; num: string; label: string }> = [
    { id: 'overview', num: '01', label: lang === 'bn' ? 'প্ল্যাটফর্ম ওভারভিউ' : 'Platform Overview' },
    { id: 'creators', num: '02', label: lang === 'bn' ? 'ক্রিয়েটর ও প্রোফাইল আইডি' : 'Creators & Profile IDs' },
    { id: 'streaming', num: '03', label: lang === 'bn' ? 'ভিডিও ও লাইভ স্ট্রিমিং' : 'Free & Premium Live' },
    { id: 'safety', num: '04', label: lang === 'bn' ? '১৮+ নিরাপত্তা ও পেমেন্ট' : '18+ Safety & Payments' },
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-10">
        {/* TOP HERO + PERMANENT 16:9 WEBSITE PREVIEW (Side-by-side desktop, stacked responsive on tablet/mobile) */}
        <section aria-label="OrioLiveCall Homepage Hero and Permanent Website Preview" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* LEFT: Core Brand Identity, Value Proposition & Primary Navigation CTAs */}
          <div className="lg:col-span-6 space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-[#05060f] border border-purple-500/40 shadow-lg shadow-purple-600/25 shrink-0">
                <img
                  src={LOGO_ASSET}
                  alt="OrioLiveCall Logo"
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover translate-x-[70%] scale-[2.65]"
                />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-purple-300">
                  {lang === 'bn' ? 'অরিও লাইভ কল · ১৮+ গ্লোবাল প্ল্যাটফর্ম' : 'OrioLiveCall · 18+ Verified Global Platform'}
                </div>
                <div className="text-xs text-slate-400">
                  {lang === 'bn'
                    ? 'HD/4K ভিডিও কল · প্রোফাইল আইডি · ক্রিয়েটর লাইভ'
                    : 'HD & 4K Live Calling · Unique Profile IDs · Creator Streaming'}
                </div>
              </div>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.08]">
              {lang === 'bn' ? (
                <>
                  বিশ্বের সাথে পরিচিত হোন।{' '}
                  <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    সীমানা ছাড়িয়ে কথা বলুন।
                  </span>
                </>
              ) : (
                <>
                  Meet the World.{' '}
                  <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                    Talk Beyond Borders.
                  </span>
                </>
              )}
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
              {lang === 'bn'
                ? 'বিশ্বব্যাপী ১-টু-১ লাইভ ভিডিও চ্যাট, বাংলা ও ইংরেজি এআই গ্লোবাল টক, ফ্রি ও প্রিমিয়াম লাইভ স্ট্রিম এবং নিরাপদ পেমেন্ট সেন্টার একসাথে উপভোগ করুন।'
                : 'Connect face-to-face in HD & 4K random video calls, talk with AI Global Partner in English & Bengali, discover verified creators by Profile ID, and stream free or premium live broadcasts.'}
            </p>

            {/* All Core Actions Preserved + Prominent FREE VIDEO CALL NOW & Global Friends */}
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => onNavigateTab('chat')}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-extrabold text-sm shadow-xl shadow-purple-600/35 hover:opacity-95 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Video className="w-4 h-4 shrink-0" />
                <span>{lang === 'bn' ? 'ফ্রি ভিডিও কল শুরু করুন' : 'FREE VIDEO CALL NOW'}</span>
              </button>

              <button
                onClick={() => onNavigateTab('friends')}
                className="px-5 py-3.5 rounded-2xl bg-slate-900 border border-purple-500/50 text-purple-200 font-bold text-sm hover:bg-purple-600/20 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Users className="w-4 h-4 text-purple-400 shrink-0" />
                <span>{lang === 'bn' ? 'গ্লোবাল ফ্রেন্ডস' : 'Global Friends'}</span>
              </button>

              <button
                onClick={() => {
                  onNavigateTab('chat');
                  onStartAiTalk();
                }}
                className="px-5 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 hover:opacity-95 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span>{lang === 'bn' ? 'এআই গ্লোবাল টক' : 'AI Global Talk'}</span>
              </button>

              <button
                onClick={() => onNavigateTab('videos')}
                className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold text-xs hover:border-purple-500 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 text-purple-400 shrink-0" />
                <span>{lang === 'bn' ? 'ফ্রি ভিডিও দেখুন' : 'Browse Free Videos'}</span>
              </button>

              <button
                onClick={() => onNavigateTab('live')}
                className="px-4 py-3 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-200 font-semibold text-xs hover:bg-rose-600/30 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Radio className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{lang === 'bn' ? 'ফ্রি ও প্রিমিয়াম লাইভ' : 'Free & Premium Live'}</span>
              </button>

              <button
                onClick={() => onNavigateTab('subscriptions')}
                className="px-4 py-3 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-200 font-semibold text-xs hover:bg-purple-600/30 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <Crown className="w-4 h-4 text-purple-400 shrink-0" />
                <span>{lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription Center'}</span>
              </button>

              <button
                onClick={() => onNavigateTab('payment-methods')}
                className="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-semibold text-xs hover:border-emerald-500 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{lang === 'bn' ? 'পেমেন্ট মেথড' : 'Payment Methods'}</span>
              </button>
            </div>
            <p className="text-[11px] text-emerald-300/90 font-medium">
              {lang === 'bn'
                ? '১০০% ফ্রি র্যান্ডম গ্লোবাল ভিডিও কল — কোনো পেইড সাবস্ক্রিপশন ছাড়াই কল করুন (১৮+ যাচাইকৃত)।'
                : 'Basic 1-to-1 random global video calling is 100% free — no paid subscription required (18+ verification required).'}
            </p>
          </div>

          {/* RIGHT: PERMANENT 16:9 ORIOLIVECALL WEBSITE PREVIEW (Always Visible Across Homepage Sections) */}
          <div className="lg:col-span-6 w-full">
            <div className="rounded-3xl bg-slate-900/95 border border-purple-500/35 shadow-2xl shadow-purple-950/50 overflow-hidden">
              {/* Top bar inside card frame showing permanent status & brand lockup */}
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
                    {promotions.preview.headline}
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
                      Edit Preview
                    </button>
                  )}
                </div>
              </div>

              {/* 16:9 Reference Visual Stage */}
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
                    <div className="text-sm font-bold text-white">OrioLiveCall · 16:9 Platform Preview</div>
                  </div>
                )}

                {/* Scrim + Persistent Corner Brand Signature */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/25" />
                <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950/75 backdrop-blur-sm border border-purple-500/30">
                  <img
                    src={LOGO_ASSET}
                    alt="OrioLiveCall Logo"
                    loading="lazy"
                    decoding="async"
                    className="w-4 h-4 rounded-sm object-cover"
                  />
                  <span className="text-[11px] font-bold text-white tracking-tight">OrioLiveCall</span>
                  <span className="text-[10px] text-purple-300">· 16:9 Live Preview</span>
                </div>
              </div>

              {/* Non-blocking Caption & Quick Action Strip */}
              <div className="px-4 py-3 bg-slate-950/90 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-300 line-clamp-2 flex-1">
                  {promotions.preview.caption}
                </p>
                <button
                  type="button"
                  onClick={() => handleTargetJump(promotions.preview.ctaTab)}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 self-start sm:self-center"
                >
                  <span>{promotions.preview.ctaLabel || 'Launch Live Chat'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
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
              {lang === 'bn'
                ? 'প্রিভিউ ও বিজ্ঞাপন সর্বদা দৃশ্যমান থাকে'
                : 'Preview & promotions stay pinned while exploring sections'}
            </div>
          </div>

          {/* Active Homepage Section Detail Grid */}
          {homeSection === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-purple-400 uppercase tracking-wider">01 · Real-Time Video Engine</div>
                <h2 className="text-xl font-bold text-white">Adaptive WebRTC Calls with Live Stability Signal</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Monitor connection strength bars, RTT latency, packet loss, and adaptive SD/HD/4K resolution dynamically during every random chat or AI Global Talk session.
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
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">02 · Bilingual Voice AI</div>
                <h2 className="text-lg font-bold text-white">Talk in English & বাংলা Anytime</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Practice conversations or explore global cultures with real-time low-latency Gemini Live voice talks and 24/7 Orio AI Help Center guidance.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('chat');
                    onStartAiTalk();
                  }}
                  className="text-xs font-bold text-emerald-300 hover:text-white inline-flex items-center gap-1 pt-1"
                >
                  <span>Start AI Talk</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="md:col-span-3 p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">03 · Instant IDs</div>
                <h2 className="text-lg font-bold text-white">ORI-XXXXXX Identity</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Unique shareable Profile IDs let friends and fans look you up with zero confusion.
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
                <p className="text-xs text-slate-400">Look up verified creators instantly with unique IDs like ORI-100001 and share direct profile links.</p>
                <button type="button" onClick={() => onNavigateTab('creators')} className="text-xs font-bold text-purple-300 hover:text-white pt-1 inline-flex items-center gap-1">
                  <span>Discover Creators</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Free Follow & Optional Memberships</h3>
                <p className="text-xs text-slate-400">Follow favorite creators free or upgrade to monthly/yearly memberships with transparent pricing.</p>
                <button type="button" onClick={() => onNavigateTab('subscriptions')} className="text-xs font-bold text-emerald-300 hover:text-white pt-1 inline-flex items-center gap-1">
                  <span>Manage Memberships</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Creator Studio & Analytics</h3>
                <p className="text-xs text-slate-400">Publish public or private videos, manage livestreams, and track verified creator earnings.</p>
                <button type="button" onClick={() => onNavigateTab('creator-dashboard')} className="text-xs font-bold text-amber-300 hover:text-white pt-1 inline-flex items-center gap-1">
                  <span>Open Creator Dashboard</span>
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
                  <h3 className="text-lg font-bold text-white">Search Videos, Save History & Watch Free</h3>
                  <p className="text-xs text-slate-400">Responsive HTML5 playback, fullscreen & volume controls, hashtags, trending filters, and private creator access locks.</p>
                </div>
                <button type="button" onClick={() => onNavigateTab('videos')} className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-200 text-xs font-bold self-start hover:bg-purple-600/30">
                  Browse Video Library
                </button>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-xs font-bold text-rose-400 uppercase tracking-wider">Free & Premium Live</div>
                  <h3 className="text-lg font-bold text-white">Moderated Live Rooms & Ticketed Access</h3>
                  <p className="text-xs text-slate-400">Join open free public streams or unlock server-verified premium live passes with clear expiry and refund policies.</p>
                </div>
                <button type="button" onClick={() => onNavigateTab('live')} className="px-4 py-2 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-200 text-xs font-bold self-start hover:bg-rose-600/30">
                  Enter Live Rooms
                </button>
              </div>
            </div>
          )}

          {homeSection === 'safety' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-start gap-4">
                <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">18+ Strict Compliance & Moderation</h3>
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
                <Lock className="w-6 h-6 text-purple-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">Payment Methods Center & Receipts</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Configure Bank Transfer, Debit/Credit Cards, or Mobile Banking safely with server-side validation, masked identifiers, and downloadable receipts.
                  </p>
                  <button type="button" onClick={() => onNavigateTab('payment-methods')} className="text-xs font-bold text-purple-300 hover:text-white inline-flex items-center gap-1 pt-1">
                    <span>Open Payment Center</span>
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
                  {lang === 'bn' ? 'স্পন্সরড ও কমিউনিটি শোকেস' : 'Sponsored & Platform Promotions Carousel'}
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
              {/* Slide Lazy Image */}
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

              {/* Slide Editorial Text & CTA */}
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

                  {/* Carousel Dot Indicators */}
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
