/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video, VideoOff, Mic, MicOff, PhoneOff, SkipForward, Globe, Shield,
  User, LogOut, Settings as SettingsIcon, AlertTriangle, CheckCircle2, Lock, Sparkles,
  Heart, Users, HelpCircle, FileText, ChevronDown, RefreshCw,
  Maximize, Minimize, MessageSquare, Volume2, VolumeX, Wallet, Send,
  ArrowDownLeft, RefreshCcw, X, Calendar,
  Wand2, Flame, Share2, MessageCircle, Plus, Camera, Radio,
  Gift, Crown, ShieldCheck, RefreshCcw as RefreshIcon, Sliders, Bell,
  Home, Compass, ShieldAlert, BarChart3, HelpCircle as HelpIcon, Cookie, Bot, PhoneCall,
  WifiOff, Activity, Play, Flag, Search, Copy, Check, CreditCard, ExternalLink, Ban, UserPlus
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import {
  auth,
  signInWithGoogleFirebase,
  signOutFirebase,
  syncUserToFirestore,
  loadUserFromFirestore,
  testFirestoreConnection,
  updateMessagingPrivacyInFirestore,
  saveVideoToFirestore,
  toggleVideoLikeInFirestore,
  syncSubscriptionToFirestore,
  saveLiveStreamToFirestore,
  submitReportToFirestore,
  saveCallRatingToFirestore,
  syncUserPreferencesToFirestore,
  syncAgeVerificationToFirestore,
  syncPrivacySettingsToFirestore,
  onAuthStateChanged,
  FirebaseUser
} from './firebase';
import { VideoDiscoveryWatch } from './components/VideoDiscoveryWatch';
import { LiveStreamsHub } from './components/LiveStreamsHub';
import { CreatorDashboardView } from './components/CreatorDashboardView';
import { MessagingAndPrivacyView } from './components/MessagingAndPrivacyView';
import { GlobalFriendsView } from './components/GlobalFriendsView';
import { OrioAiHelpCenter } from './components/OrioAiHelpCenter';
import { SubscriptionCenterView } from './components/SubscriptionCenterView';
import { PaymentMethodsCenterView } from './components/PaymentMethodsCenterView';
import { HomepageShowcaseSection } from './components/HomepageShowcaseSection';
import { AdminPromoManager } from './components/AdminPromoManager';
import { PostCallRatingModal } from './components/PostCallRatingModal';
import {
  SubscriptionItem,
  VideoFeedItem,
  ModerationReportItem,
  UserPrivacySettings,
  PromotionsConfig,
  CallFeedbackSession,
  CallRatingSummary,
  AgeVerificationPublicStatus,
  GlobalFriendProfile,
  ProposedMatchInfo
} from './types/orio';

type Language = 'en' | 'bn';

interface UserProfile {
  userId: string;
  profileId?: string;
  uid?: string;
  name: string;
  email: string;
  gender: 'girls' | 'boys' | 'other';
  country: string;
  birthDate: string;
  age: number;
  verified: boolean;
  avatar?: string;
  bio?: string;
  creatorBadge?: boolean;
  subscribersCount?: number;
  earnings?: number;
}

interface CreatorProfile {
  id: string;
  profileId?: string;
  name: string;
  username: string;
  country: string;
  gender: string;
  avatar: string;
  bio: string;
  creatorBadge: boolean;
  online: boolean;
  subscribersCount: number;
  monthlyPrice: number;
  yearlyPrice: number;
  livestreamUrl?: string;
  isSubscribed?: boolean;
}

interface MatchPreferences {
  targetGender: 'girls' | 'boys' | 'any';
  targetCountry: string;
}

interface Transaction {
  txId: string;
  type: 'deposit' | 'send' | 'receive' | 'withdraw' | 'refund' | 'gift' | 'subscription';
  amount: number;
  currency: string;
  counterparty?: string;
  status: 'completed' | 'pending' | 'disputed' | 'refunded';
  timestamp: string;
  description: string;
}

interface WalletData {
  userId: string;
  balance: number;
  currency: string;
  transactions: Transaction[];
}

interface MessageItem {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  image?: string;
  timestamp: string;
  read: boolean;
}

interface ShortVideoItem {
  id: string;
  creatorName: string;
  creatorAvatar: string;
  videoUrl: string;
  thumbnailUrl: string;
  description: string;
  hashtags: string[];
  likes: number;
  commentsCount: number;
  shares: number;
  isFollowing?: boolean;
  comments: Array<{ user: string; text: string; time: string }>;
}

interface AiTalkMessage {
  role: 'user' | 'ai';
  text: string;
  timestamp: string;
}

type ArFilter = 'none' | 'neon' | 'vintage' | 'cosmic' | 'rainbow' | 'matrix' | 'sunset';
type VideoQuality = 'HD' | '4K' | 'SD';
type SignalLevel = 0 | 1 | 2 | 3 | 4;
type StabilityStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'reconnecting' | 'offline';

interface CallNetworkStats {
  signalBars: SignalLevel;
  status: StabilityStatus;
  rttMs: number | null;
  packetLossPct: number | null;
  bitrateKbps: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  qualityTier: VideoQuality | 'Pending' | 'OFF';
  iceState: string;
  networkType: string;
  downlinkMbps: number | null;
}

function float32ToBase64Pcm16(float32Array: Float32Array): string {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const [isInitializing, setIsInitializing] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Firebase Auth & Firestore Status
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseOnline, setFirebaseOnline] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Google Cookie Consent & 18+ Tick Mark State
  const [cookieConsentOpen, setCookieConsentOpen] = useState(() => {
    return !localStorage.getItem('oriolivecall_cookie_consent');
  });
  const [cookie18Checked, setCookie18Checked] = useState(() => {
    return localStorage.getItem('oriolivecall_age18_confirmed') === 'true';
  });
  const [google18Checked, setGoogle18Checked] = useState(true);

  // Browser Notifications State
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [appNotifications] = useState<Array<{ id: string; title: string; time: string; read: boolean }>>([
    { id: 'notif-1', title: 'Welcome to OrioLiveCall! Complete your profile to get started.', time: 'Just now', read: false },
    { id: 'notif-2', title: 'Sophia Vance started a live stream in Tokyo.', time: '5m ago', read: false }
  ]);

  // Initialize user & auth state from localStorage for persistence
  const [authStep, setAuthStep] = useState<'welcome' | 'signin' | 'signup' | 'age-verify' | 'profile-setup' | 'authenticated'>(() => {
    const savedAuth = localStorage.getItem('oriolivecall_auth');
    return (savedAuth as any) || 'welcome';
  });

  const [user, setUser] = useState<UserProfile>(() => {
    const savedUser = localStorage.getItem('oriolivecall_user');
    if (savedUser) {
      try { return JSON.parse(savedUser); } catch { /* fallback */ }
    }
    return {
      userId: `ORIO-ID-${Math.floor(100000 + Math.random() * 900000)}`,
      name: 'Global Verified User',
      email: 'user@oriolivecall.com',
      gender: 'girls',
      country: 'Bangladesh',
      birthDate: '2000-01-15',
      age: 26,
      verified: true,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'Exploring the world through OrioLiveCall live video chat! 🌍✨',
      creatorBadge: true,
      subscribersCount: 1420,
      earnings: 1850.00
    };
  });

  const [birthDateInput, setBirthDateInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passInput, setPassInput] = useState('');

  // Splash loading timeout + Firestore connection check
  useEffect(() => {
    testFirestoreConnection().then(setFirebaseOnline);
    const timer = setTimeout(() => {
      setIsInitializing(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const loaded = await loadUserFromFirestore(fbUser.uid).catch(() => null);
        const generatedId = loaded?.user?.userId || (user.userId.startsWith('ORIO-ID-') ? user.userId : `ORIO-ID-${fbUser.uid.slice(0, 8).toUpperCase()}`);
        const mergedProfile: UserProfile = {
          userId: generatedId,
          profileId: loaded?.user?.profileId || loaded?.profile?.profileId || user.profileId,
          uid: fbUser.uid,
          name: loaded?.profile?.name || fbUser.displayName || user.name || 'Google Verified User',
          email: fbUser.email || user.email,
          gender: loaded?.profile?.gender || user.gender || 'girls',
          country: loaded?.profile?.country || user.country || 'Bangladesh',
          birthDate: loaded?.user?.birthDate || user.birthDate || '2000-01-15',
          age: loaded?.user?.age || user.age || 26,
          verified: loaded?.user?.verified ?? false,
          avatar: loaded?.profile?.avatar || fbUser.photoURL || user.avatar,
          bio: loaded?.profile?.bio || user.bio || 'OrioLiveCall Global Member 🌟',
          creatorBadge: loaded?.profile?.creatorBadge ?? user.creatorBadge ?? true,
          subscribersCount: loaded?.profile?.subscribersCount ?? user.subscribersCount ?? 340,
          earnings: user.earnings ?? 1850.00,
        };
        setUser(mergedProfile);
        setAuthStep('authenticated');
        syncUserToFirestore(fbUser, mergedProfile).catch((err) => {
          console.warn('Firestore background sync:', err);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Preferences
  const [preferences, setPreferences] = useState<MatchPreferences>({
    targetGender: 'any',
    targetCountry: 'all'
  });

  // Navigation tab state supporting all menu items including Global Friends, Home Preview & Payment Methods Center
  const [activeTab, setActiveTab] = useState<
    'home' | 'chat' | 'friends' | 'videos' | 'community' | 'messages' | 'shorts' | 'live' | 'creators' | 'profile' | 'creator-dashboard' | 'wallet' | 'send-money' | 'receive-money' | 'history' | 'gifts' | 'subscriptions' | 'payment-methods' | 'notifications' | 'settings' | 'help' | 'privacy-policy' | 'terms' | 'guidelines' | 'admin'
  >('home');
  const [navOpen, setNavOpen] = useState(false);

  // Easy Profile ID & Directory Search State
  const [profileSearchQuery, setProfileSearchQuery] = useState('');
  const [profileDirectoryResults, setProfileDirectoryResults] = useState<CreatorProfile[]>([]);
  const [copiedProfileId, setCopiedProfileId] = useState(false);

  // Wallet State
  const [wallet, setWallet] = useState<WalletData | null>({
    userId: user.userId,
    balance: 1850.00,
    currency: 'USD',
    transactions: [
      { txId: 'ORIO-TX-100492', type: 'deposit', amount: 250.00, currency: 'USD', status: 'completed', timestamp: new Date().toISOString(), description: 'Welcome Global Wallet Credit' },
      { txId: 'ORIO-TX-100581', type: 'gift', amount: 150.00, currency: 'USD', counterparty: 'Sophia Vance', status: 'completed', timestamp: new Date().toISOString(), description: 'Received Diamond Crown Gift 👑' }
    ]
  });
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendDesc, setSendDesc] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('bKash / Mobile Banking');
  const [disputeReason, setDisputeReason] = useState('');
  const [selectedTxForDispute, setSelectedTxForDispute] = useState<string | null>(null);

  // Give Gift Modal State
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [giftTargetName, setGiftTargetName] = useState('');
  const [selectedGiftType, setSelectedGiftType] = useState<{ name: string; price: number; icon: string }>({ name: 'Diamond Crown 👑', price: 50, icon: '👑' });
  const [giftAnimationActive, setGiftAnimationActive] = useState(false);

  // Paid Private Messaging & Subscriptions State
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subTargetCreator, setSubTargetCreator] = useState<CreatorProfile | null>(null);
  const [subPlanType, setSubPlanType] = useState<'monthly' | 'yearly'>('monthly');

  // Creators Directory State
  const [creators, setCreators] = useState<CreatorProfile[]>([
    {
      id: 'creator-1',
      profileId: 'ORI-100001',
      name: 'Sophia Vance',
      username: '@sophia_tokyo',
      country: 'Japan',
      gender: 'Female',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      bio: 'Tokyo nightlife vlogger, live music streaming & 1-on-1 chats! 🌃✨',
      creatorBadge: true,
      online: false,
      subscribersCount: 8400,
      monthlyPrice: 19.99,
      yearlyPrice: 149.99,
      livestreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lights-playing-with-her-hair-41584-large.mp4',
      isSubscribed: false
    },
    {
      id: 'creator-2',
      profileId: 'ORI-100002',
      name: 'Anika Rahman',
      username: '@anika_dhaka',
      country: 'Bangladesh',
      gender: 'Female',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      bio: 'Bhangra dance, cultural Q&A and daily live shows from Dhaka! 🇧🇩❤️',
      creatorBadge: true,
      online: false,
      subscribersCount: 12500,
      monthlyPrice: 14.99,
      yearlyPrice: 119.99,
      livestreamUrl: 'https://assets.mixkit.co/videos/preview/mixkit-musician-playing-on-stage-with-colorful-lights-41982-large.mp4',
      isSubscribed: true
    },
    {
      id: 'creator-3',
      profileId: 'ORI-100003',
      name: 'Jessica Miller',
      username: '@jessica_nyc',
      country: 'United States',
      gender: 'Female',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
      bio: 'New York fashion & live lifestyle streams. Join my private chat! 🗽',
      creatorBadge: true,
      online: false,
      subscribersCount: 6200,
      monthlyPrice: 24.99,
      yearlyPrice: 199.99,
      livestreamUrl: '',
      isSubscribed: false
    }
  ]);
  const [selectedProfileForModal, setSelectedProfileForModal] = useState<CreatorProfile | null>(null);

  // Subscriptions, Follows, Privacy, Presence, Adult Verification & Global Friends State
  const [follows, setFollows] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});
  const [recentCreatorUploads, setRecentCreatorUploads] = useState<VideoFeedItem[]>([]);
  const [messageRequests, setMessageRequests] = useState<MessageItem[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [msgPrivacy, setMsgPrivacy] = useState<UserPrivacySettings>({
    messagingPrivacy: 'followers',
    allowUnsolicitedRequests: true,
    blockedUsers: [],
    showOnlineStatus: true,
    showInGlobalFriends: true,
    allowFriendRequests: true,
  });
  const [myFriendsList, setMyFriendsList] = useState<GlobalFriendProfile[]>([]);
  const [selectedDmPeer, setSelectedDmPeer] = useState<string | null>(null);
  const [ageVerifyStatus, setAgeVerifyStatus] = useState<AgeVerificationPublicStatus | null>(null);
  const [ageModalOpen, setAgeModalOpen] = useState(false);
  const [verifyDobInput, setVerifyDobInput] = useState('');
  const [verifyDocType, setVerifyDocType] = useState<'passport' | 'national_id' | 'driver_license'>('national_id');
  const [verifyIdLast4, setVerifyIdLast4] = useState('');
  const [verifyCountry, setVerifyCountry] = useState('Bangladesh');
  const [verifyAttestation, setVerifyAttestation] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [adminUsers, setAdminUsers] = useState<Array<{
    id: string;
    profileId: string;
    name: string;
    username: string;
    country: string;
    ageStatus: string;
    verified: boolean;
    suspended: boolean;
    suspendedReason: string | null;
  }>>([]);
  const [moderationReports, setModerationReports] = useState<ModerationReportItem[]>([]);
  const [reportModalTarget, setReportModalTarget] = useState<{
    targetType: 'video' | 'short' | 'livestream' | 'user' | 'message';
    targetId: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState('Inappropriate or unsafe content');
  const [ageLicenseAgreed, setAgeLicenseAgreed] = useState(false);
  const [shortsSearch, setShortsSearch] = useState('');
  const [shortCommentInput, setShortCommentInput] = useState('');
  const [promotions, setPromotions] = useState<PromotionsConfig>({
    preview: {
      enabled: true,
      headline: 'OrioLiveCall Platform Preview · HD & 4K Live Calling',
      caption: 'Watch how creators connect globally with verified Profile IDs, AI Global Talk, and multi-stream HD calling.',
      mediaUrl: '/assets/aistudio/Global_video_call_platform_features_4219cb14_b0135f23.mp4',
      posterUrl: '/assets/aistudio/preview_livecall_16x9.jpg',
      autoplay: true,
      ctaLabel: 'Launch Live Chat',
      ctaTab: 'chat',
      updatedAt: new Date().toISOString(),
    },
    banner: {
      enabled: true,
      sponsorLabel: 'Featured Platform Offer · 18+ Verified',
      title: 'Unlock Unlimited Creator Access & Ad-Free Global HD Calls',
      subtitle: 'Join OrioLiveCall All-Access Monthly or Yearly plans with instant Bank, Card & bKash/Nagad checkout.',
      imageUrl: '/assets/aistudio/preview_brand_16x9.jpg',
      ctaLabel: 'Explore Plans',
      ctaTab: 'subscriptions',
      accentTheme: 'purple',
      updatedAt: new Date().toISOString(),
    },
    carousel: [
      {
        id: 'ad-slide-1',
        title: 'Connect with Top Global Creators in HD & 4K',
        subtitle: 'Search creators instantly by @username or unique Profile ID like ORI-100001.',
        sponsor: 'Creator Spotlight',
        category: 'Discovery',
        imageUrl: '/assets/aistudio/preview_creators_16x9.jpg',
        ctaLabel: 'Discover Creators',
        ctaTab: 'creators',
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ad-slide-2',
        title: 'Real-Time Multilingual 1-on-1 & Group Calling',
        subtitle: 'Switch seamlessly between peer-to-peer random chat and AI Global Talk in English & Bengali.',
        sponsor: 'OrioLiveCall Live Engine',
        category: 'Video Calls',
        imageUrl: '/assets/aistudio/preview_livecall_16x9.jpg',
        ctaLabel: 'Start Video Chat',
        ctaTab: 'chat',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ],
  });

  // Messaging State
  const [messages, setMessages] = useState<MessageItem[]>([
    { id: 'msg-1', senderId: 'support@oriolivecall.com', recipientId: 'guest-user', text: 'Welcome to OrioLiveCall! Private messaging respects your privacy settings.', timestamp: new Date().toISOString(), read: false }
  ]);

  // Hot Shorts State
  const [shorts, setShorts] = useState<ShortVideoItem[]>([]);
  const [currentShortIdx, setCurrentShortIdx] = useState(0);

  // Video chat & WebRTC advanced state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chatState, setChatState] = useState<
    'idle' | 'searching' | 'confirming' | 'connected' | 'reconnecting' | 'disconnected' | 'ai-talking'
  >('idle');
  const [proposedMatch, setProposedMatch] = useState<ProposedMatchInfo | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [partnerInfo, setPartnerInfo] = useState<{
    socketId: string;
    userId?: string;
    profileId?: string;
    name: string;
    country: string;
    gender: string;
  } | null>(null);
  const [webrtcConfig, setWebrtcConfig] = useState<{
    iceServers: RTCIceServer[];
    stunConfigured: boolean;
    turnConfigured: boolean;
  }>({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    stunConfigured: true,
    turnConfigured: false,
  });
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [videoQuality, setVideoQuality] = useState<VideoQuality>('HD');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [icebreakers, setIcebreakers] = useState<Array<{ english: string; bengali: string }>>([]);
  const [loadingIcebreakers, setLoadingIcebreakers] = useState(false);

  // Hardware devices & Call Settings & Fullscreen
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [availableMics, setAvailableMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [showCallSettings, setShowCallSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [postCallFeedbackSession, setPostCallFeedbackSession] = useState<CallFeedbackSession | null>(null);
  const [submittingCallRating, setSubmittingCallRating] = useState(false);
  const [callRatingSummary, setCallRatingSummary] = useState<CallRatingSummary | null>(null);

  // Advanced Video Effects
  const [activeFilter, setActiveFilter] = useState<ArFilter>('none');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [lightingEffect, setLightingEffect] = useState<'normal' | 'studio' | 'contour' | 'warm'>('normal');
  const [bgBlur, setBgBlur] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // AI Global Talking State
  const [aiLiveActive, setAiLiveActive] = useState(false);
  const [aiLiveConnecting, setAiLiveConnecting] = useState(false);
  const [aiTalkMessages, setAiTalkMessages] = useState<AiTalkMessage[]>([]);
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [aiSendingText, setAiSendingText] = useState(false);
  const [aiVoiceName, setAiVoiceName] = useState<'Zephyr' | 'Kore' | 'Puck' | 'Fenrir' | 'Charon'>('Zephyr');

  // Call Connection Stability & WebRTC Resolution Telemetry
  const [showNetworkDetails, setShowNetworkDetails] = useState(false);
  const [autoAdaptiveQuality, setAutoAdaptiveQuality] = useState(true);
  const [networkStats, setNetworkStats] = useState<CallNetworkStats>({
    signalBars: 4,
    status: 'excellent',
    rttMs: null,
    packetLossPct: null,
    bitrateKbps: null,
    width: null,
    height: null,
    fps: null,
    qualityTier: 'Pending',
    iceState: 'ready',
    networkType: 'online',
    downlinkMbps: null,
  });

  const videoStageRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMicOnRef = useRef(isMicOn);
  const isSpeakerOnRef = useRef(isSpeakerOn);
  const prevBytesRef = useRef<{ bytes: number; timestamp: number } | null>(null);
  const prevPacketsRef = useRef<{ lost: number; received: number } | null>(null);

  // Live API Audio Refs
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => { isMicOnRef.current = isMicOn; }, [isMicOn]);
  useEffect(() => { isSpeakerOnRef.current = isSpeakerOn; }, [isSpeakerOn]);

  // Real-time WebRTC connection stability, stats & adaptive resolution monitor (never claims 4K/HD unless measured)
  const evaluateNetworkAndWebRTC = useCallback(async () => {
    const resolveTier = (w: number | null, h: number | null): VideoQuality | 'Pending' | 'OFF' => {
      if (!isCameraOn && chatState !== 'connected' && chatState !== 'reconnecting') return 'OFF';
      if (!w || !h) return 'Pending';
      if (h >= 1800 || w >= 3000) return '4K';
      if (h >= 700 || w >= 1200) return 'HD';
      return 'SD';
    };

    const navConn = (navigator as unknown as {
      connection?: {
        effectiveType?: string;
        rtt?: number;
        downlink?: number;
        addEventListener?: (t: string, cb: () => void) => void;
        removeEventListener?: (t: string, cb: () => void) => void;
      };
    }).connection;

    const isOnline = navigator.onLine;
    const netType = !isOnline ? 'offline' : (navConn?.effectiveType || 'online').toUpperCase();
    const downlink = typeof navConn?.downlink === 'number' ? Number(navConn.downlink.toFixed(1)) : null;
    const navRtt = typeof navConn?.rtt === 'number' && navConn.rtt > 0 ? navConn.rtt : null;

    // Local camera track settings fallback
    const localTrack = streamRef.current?.getVideoTracks()[0];
    const localSettings = localTrack?.readyState === 'live' ? localTrack.getSettings() : null;
    let activeWidth: number | null = isCameraOn && localSettings?.width ? localSettings.width : null;
    let activeHeight: number | null = isCameraOn && localSettings?.height ? localSettings.height : null;
    let activeFps: number | null = isCameraOn && localSettings?.frameRate ? Math.round(localSettings.frameRate) : null;

    // If remote video element already has dimensions during connected call, read them
    if ((chatState === 'connected' || chatState === 'reconnecting') && remoteVideoRef.current?.videoWidth && remoteVideoRef.current?.videoHeight) {
      activeWidth = remoteVideoRef.current.videoWidth;
      activeHeight = remoteVideoRef.current.videoHeight;
    }

    const pc = pcRef.current;
    if (pc && (chatState === 'connected' || chatState === 'reconnecting')) {
      const iceState = pc.iceConnectionState || pc.connectionState || 'new';
      let rttMs: number | null = navRtt;
      let packetLossPct: number | null = null;
      let bitrateKbps: number | null = null;

      try {
        const stats = await pc.getStats();
        let bestPair: any = null;
        let videoInbound: any = null;
        let videoOutbound: any = null;

        stats.forEach((report: any) => {
          if (report.type === 'candidate-pair' && (report.nominated || report.state === 'succeeded')) {
            if (!bestPair || report.nominated) bestPair = report;
          }
          if (report.type === 'inbound-rtp' && (report.kind === 'video' || report.mediaType === 'video')) {
            videoInbound = report;
          }
          if (report.type === 'outbound-rtp' && (report.kind === 'video' || report.mediaType === 'video')) {
            videoOutbound = report;
          }
        });

        if (bestPair && typeof bestPair.currentRoundTripTime === 'number') {
          rttMs = Math.round(bestPair.currentRoundTripTime * 1000);
        }

        const rtp = videoInbound || videoOutbound;
        if (rtp) {
          if (typeof rtp.frameWidth === 'number' && rtp.frameWidth > 0) activeWidth = rtp.frameWidth;
          if (typeof rtp.frameHeight === 'number' && rtp.frameHeight > 0) activeHeight = rtp.frameHeight;
          if (typeof rtp.framesPerSecond === 'number' && rtp.framesPerSecond > 0) {
            activeFps = Math.round(rtp.framesPerSecond);
          }

          const totalBytes = typeof rtp.bytesReceived === 'number' ? rtp.bytesReceived : rtp.bytesSent;
          if (typeof totalBytes === 'number' && typeof rtp.timestamp === 'number') {
            if (prevBytesRef.current && rtp.timestamp > prevBytesRef.current.timestamp) {
              const dtSec = (rtp.timestamp - prevBytesRef.current.timestamp) / 1000;
              const dBytes = Math.max(0, totalBytes - prevBytesRef.current.bytes);
              if (dtSec > 0) bitrateKbps = Math.round((dBytes * 8) / dtSec / 1000);
            }
            prevBytesRef.current = { bytes: totalBytes, timestamp: rtp.timestamp };
          }

          if (videoInbound && typeof videoInbound.packetsLost === 'number' && typeof videoInbound.packetsReceived === 'number') {
            const lost = videoInbound.packetsLost;
            const recv = videoInbound.packetsReceived;
            if (prevPacketsRef.current) {
              const dLost = Math.max(0, lost - prevPacketsRef.current.lost);
              const dRecv = Math.max(0, recv - prevPacketsRef.current.received);
              const total = dLost + dRecv;
              if (total > 0) packetLossPct = Number(((dLost / total) * 100).toFixed(1));
            }
            prevPacketsRef.current = { lost, received: recv };
          }
        }
      } catch (err) {
        console.warn('WebRTC getStats read error:', err);
      }

      let signalBars: SignalLevel = 4;
      let status: StabilityStatus = 'excellent';

      if (!isOnline) {
        signalBars = 0;
        status = 'offline';
      } else if (iceState === 'disconnected' || iceState === 'failed') {
        signalBars = 1;
        status = 'reconnecting';
      } else if (iceState === 'checking' || iceState === 'new') {
        signalBars = 2;
        status = 'reconnecting';
      } else {
        const loss = packetLossPct ?? 0;
        const latency = rttMs ?? 60;
        if (latency <= 90 && loss <= 1 && (downlink === null || downlink >= 3)) {
          signalBars = 4;
          status = 'excellent';
        } else if (latency <= 180 && loss <= 3 && (downlink === null || downlink >= 1.5)) {
          signalBars = 3;
          status = 'good';
        } else if (latency <= 350 && loss <= 7) {
          signalBars = 2;
          status = 'fair';
        } else {
          signalBars = 1;
          status = 'poor';
        }
      }

      // Adaptive WebRTC bitrate & resolution scaling based on live conditions
      if (autoAdaptiveQuality && pc.connectionState === 'connected') {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (videoSender) {
          try {
            const params = videoSender.getParameters();
            if (params.encodings && params.encodings.length > 0) {
              const targetScale = signalBars <= 1 ? 2 : signalBars === 2 ? 1.5 : 1;
              const targetBitrate = signalBars <= 1 ? 450_000 : signalBars === 2 ? 1_200_000 : (videoQuality === '4K' ? 8_000_000 : 2_500_000);
              if (params.encodings[0].scaleResolutionDownBy !== targetScale || params.encodings[0].maxBitrate !== targetBitrate) {
                params.encodings[0].scaleResolutionDownBy = targetScale;
                params.encodings[0].maxBitrate = targetBitrate;
                await videoSender.setParameters(params).catch(() => {});
              }
            }
          } catch {
            // Browser may not support all encoding parameters on current codec
          }
        }
      }

      setNetworkStats({
        signalBars,
        status,
        rttMs,
        packetLossPct,
        bitrateKbps,
        width: activeWidth,
        height: activeHeight,
        fps: activeFps,
        qualityTier: resolveTier(activeWidth, activeHeight),
        iceState,
        networkType: netType,
        downlinkMbps: downlink,
      });
      return;
    }

    // Non-peer state (AI Global Talk, Searching, or Pre-Call Camera Preview)
    prevBytesRef.current = null;
    prevPacketsRef.current = null;

    let signalBars: SignalLevel = 4;
    let status: StabilityStatus = 'excellent';

    if (!isOnline) {
      signalBars = 0;
      status = 'offline';
    } else if (socket && !socket.connected) {
      signalBars = 1;
      status = 'reconnecting';
    } else if (navConn?.effectiveType === 'slow-2g' || navConn?.effectiveType === '2g') {
      signalBars = 1;
      status = 'poor';
    } else if (navConn?.effectiveType === '3g' || (navRtt !== null && navRtt > 220)) {
      signalBars = 2;
      status = 'fair';
    } else if ((navRtt !== null && navRtt > 110) || (downlink !== null && downlink < 3)) {
      signalBars = 3;
      status = 'good';
    } else {
      signalBars = 4;
      status = 'excellent';
    }

    setNetworkStats({
      signalBars,
      status,
      rttMs: navRtt,
      packetLossPct: null,
      bitrateKbps: null,
      width: activeWidth,
      height: activeHeight,
      fps: activeFps,
      qualityTier: resolveTier(activeWidth, activeHeight),
      iceState: chatState === 'ai-talking' ? (aiLiveActive ? 'live-ai' : aiLiveConnecting ? 'connecting' : 'ready') : (socket?.connected ? 'signaling-ok' : 'connecting'),
      networkType: netType,
      downlinkMbps: downlink,
    });
  }, [chatState, isCameraOn, videoQuality, autoAdaptiveQuality, socket, aiLiveActive, aiLiveConnecting, stream]);

  const evaluateNetworkRef = useRef(evaluateNetworkAndWebRTC);
  useEffect(() => {
    evaluateNetworkRef.current = evaluateNetworkAndWebRTC;
  }, [evaluateNetworkAndWebRTC]);

  useEffect(() => {
    evaluateNetworkAndWebRTC();
    const intervalMs = chatState === 'connected' || chatState === 'ai-talking' ? 1500 : 3000;
    const timer = setInterval(() => evaluateNetworkRef.current(), intervalMs);

    const handleNetChange = () => evaluateNetworkRef.current();
    window.addEventListener('online', handleNetChange);
    window.addEventListener('offline', handleNetChange);
    const navConn = (navigator as unknown as {
      connection?: {
        addEventListener?: (t: string, cb: () => void) => void;
        removeEventListener?: (t: string, cb: () => void) => void;
      };
    }).connection;
    navConn?.addEventListener?.('change', handleNetChange);

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleNetChange);
      window.removeEventListener('offline', handleNetChange);
      navConn?.removeEventListener?.('change', handleNetChange);
    };
  }, [evaluateNetworkAndWebRTC, chatState]);

  // Call duration timer
  useEffect(() => {
    if (chatState !== 'connected' && chatState !== 'ai-talking') {
      setCallDurationSec(0);
      return;
    }
    const interval = setInterval(() => {
      setCallDurationSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [chatState]);

  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60).toString().padStart(2, '0');
    const secs = (totalSec % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Fullscreen listener & toggle
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (videoStageRef.current?.requestFullscreen) {
          await videoStageRef.current.requestFullscreen();
        }
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
      showToast('Fullscreen mode is blocked by browser settings.', 'error');
    }
  };

  // Save user and auth state to localStorage
  useEffect(() => {
    localStorage.setItem('oriolivecall_user', JSON.stringify(user));
    localStorage.setItem('oriolivecall_auth', authStep);
  }, [user, authStep]);

  // Enumerate hardware cameras & mics
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === 'videoinput');
      const mics = devices.filter((d) => d.kind === 'audioinput');
      setAvailableCameras(cams);
      setAvailableMics(mics);
      if (cams.length > 0 && !selectedCameraId) setSelectedCameraId(cams[0].deviceId);
      if (mics.length > 0 && !selectedMicId) setSelectedMicId(mics[0].deviceId);
    } catch (err) {
      console.warn('Could not enumerate devices:', err);
    }
  }, [selectedCameraId, selectedMicId]);

  // Translations
  const t = {
    en: {
      brand: "OrioLiveCall",
      tagline: "Meet the World. Talk Beyond Borders.",
      navHome: "Home",
      navChat: "Free Video Connect",
      navFriends: "Global Friends",
      navVideos: "Videos & Search",
      navCommunity: "Global Community",
      navMessages: "Live Messaging",
      navShorts: "Hot Shorts",
      navLive: "Global Live",
      navCreators: "Discover Creators",
      navProfile: "My Profile",
      navCreatorDash: "Creator Dashboard",
      navWallet: "Wallet",
      navSend: "Send Money",
      navReceive: "Receive Money",
      navHistory: "Transaction History",
      navGifts: "Gift Shop",
      navSubs: "Subscription Center",
      navPayMethods: "Payment Methods",
      navNotifs: "Notifications",
      navSettings: "Privacy & Settings",
      navHelp: "Help & Support",
      navPrivacy: "Privacy Policy",
      navTerms: "Terms & Conditions",
      navGuidelines: "Community Guidelines",
      navAdmin: "Admin Dashboard",
      navLogout: "Logout",
      startChat: "FREE VIDEO CALL NOW",
      startAiTalk: "Start AI Global Talk",
      selectGender: "Voluntary gender preference:",
      girls: "Girls / নারীরা",
      boys: "Boys / পুরুষরা",
      anyGender: "Any Gender / যেকোনো লিঙ্গ",
      selectCountry: "Country Preference:",
      allCountries: "All Countries (Worldwide)",
      ageCheckTitle: "Adult Verification (18+ Required)",
      ageCheckDesc: "OrioLiveCall is a strict adults-only global platform. Please select your exact Date of Birth from the calendar below.",
      birthDateLabel: "Date of Birth (Calendar Style)",
      verifyBtn: "Verify & Enter",
      underageError: "Access Denied: You must be at least 18 years old to use OrioLiveCall.",
      googleSignIn: "Continue with Google (Firebase Auth)",
      emailLabel: "Email Address",
      passwordLabel: "Password",
      nameLabel: "Full Name",
      genderLabel: "Your Gender",
      countryLabel: "Your Country",
      saveProfile: "Save Profile & Continue",
      searching: "Searching for available verified 18+ adult partner worldwide...",
      cancelSearch: "Cancel Search",
      nextPerson: "Next Person",
      endCall: "End Call",
      aiIcebreaker: "AI Icebreaker",
      generateIcebreaker: "Get AI Question",
      rightsReserved: "© 2026 OrioLiveCall. Meet the World. Talk Beyond Borders."
    },
    bn: {
      brand: "অরিও লাইভ কল",
      tagline: "বিশ্বের সাথে পরিচিত হোন। সীমানা ছাড়িয়ে কথা বলুন।",
      navHome: "হোম",
      navChat: "ফ্রি ভিডিও কল",
      navFriends: "গ্লোবাল ফ্রেন্ডস",
      navVideos: "ভিডিও ও সার্চ",
      navCommunity: "গ্লোবাল কমিউনিটি",
      navMessages: "লাইভ মেসেজ",
      navShorts: "হট শর্টস",
      navLive: "গ্লোবাল লাইভ",
      navCreators: "ক্রিয়েটর খুঁজুন",
      navProfile: "আমার প্রোফাইল",
      navCreatorDash: "ক্রিয়েটর ড্যাশবোর্ড",
      navWallet: "ওয়ালেট",
      navSend: "টাকা পাঠান",
      navReceive: "টাকা গ্রহণ করুন",
      navHistory: "লেনদেনের ইতিহাস",
      navGifts: "গিফট শপ",
      navSubs: "সাবস্ক্রিপশন সেন্টার",
      navPayMethods: "পেমেন্ট মেথড",
      navNotifs: "নোটিফিকেশন",
      navSettings: "প্রাইভেসি ও সেটিংস",
      navHelp: "সাহায্য ও সহায়তা",
      navPrivacy: "প্রাইভেসি নীতি",
      navTerms: "শর্তাবলী",
      navGuidelines: "কমিউনিটি নির্দেশিকা",
      navAdmin: "অ্যাডমিন ড্যাশবোর্ড",
      navLogout: "লগআউট",
      startChat: "ফ্রি ভিডিও কল শুরু করুন",
      startAiTalk: "এআই গ্লোবাল টক কল",
      selectGender: "আমি যাদের সাথে ম্যাচ করতে চাই:",
      girls: "মেয়েরা / Girls",
      boys: "ছেলেরা / Boys",
      anyGender: "যেকোনো লিঙ্গ / Any Gender",
      selectCountry: "দেশের পছন্দ:",
      allCountries: "সকল দেশ (বিশ্বব্যাপী)",
      ageCheckTitle: "বয়স যাচাই (১৮+ বাধ্যতামূলক)",
      ageCheckDesc: "অরিও লাইভ কল একটি প্রাপ্তবয়স্কদের গ্লোবাল প্ল্যাটফর্ম। নিচের ক্যালেন্ডার থেকে আপনার সঠিক জন্মতারিখ নির্বাচন করুন।",
      birthDateLabel: "জন্মতারিখ (ক্যালেন্ডার)",
      verifyBtn: "যাচাই করুন ও প্রবেশ করুন",
      underageError: "প্রবেশাধিকার নিষিদ্ধ: এই প্ল্যাটফর্ম ব্যবহারের জন্য আপনার বয়স কমপক্ষে ১৮ বছর হতে হবে।",
      googleSignIn: "গুগল ফায়ারবেস দিয়ে চালিয়ে যান",
      emailLabel: "ইমেইল ঠিকানা",
      passwordLabel: "পাসওয়ার্ড",
      nameLabel: "পূর্ণ নাম",
      genderLabel: "আপনার লিঙ্গ",
      countryLabel: "আপনার দেশ",
      saveProfile: "প্রোফাইল সংরক্ষণ করুন",
      searching: "বিশ্বব্যাপী উপলব্ধ প্রাপ্তবয়স্ক সঙ্গীর সন্ধান করা হচ্ছে...",
      cancelSearch: "অনুসন্ধান বাতিল করুন",
      nextPerson: "পরবর্তী ব্যক্তি",
      endCall: "কল শেষ করুন",
      aiIcebreaker: "এআই আইসব্রেকার",
      generateIcebreaker: "এআই প্রশ্ন নিন",
      rightsReserved: "© ২০২৬ অরিও লাইভ কল। বিশ্বের সাথে পরিচিত হোন। সীমানা ছাড়িয়ে কথা বলুন।"
    }
  }[lang];

  const getVideoEffectsStyle = () => {
    let filterStr = '';
    switch (activeFilter) {
      case 'neon': filterStr += 'brightness(125%) contrast(130%) hue-rotate(270deg) saturate(180%) '; break;
      case 'vintage': filterStr += 'sepia(65%) contrast(110%) brightness(90%) '; break;
      case 'cosmic': filterStr += 'hue-rotate(180deg) saturate(160%) contrast(120%) '; break;
      case 'rainbow': filterStr += 'hue-rotate(90deg) saturate(200%) contrast(120%) '; break;
      case 'matrix': filterStr += 'hue-rotate(120deg) invert(15%) contrast(150%) sepia(30%) '; break;
      case 'sunset': filterStr += 'sepia(35%) saturate(150%) hue-rotate(-15deg) brightness(105%) '; break;
      default: break;
    }
    switch (lightingEffect) {
      case 'studio': filterStr += 'brightness(115%) contrast(110%) '; break;
      case 'contour': filterStr += 'contrast(130%) brightness(95%) '; break;
      case 'warm': filterStr += 'sepia(25%) saturate(120%) brightness(105%) '; break;
      default: break;
    }
    if (bgBlur) filterStr += 'blur(4px) ';
    return { filter: filterStr.trim() };
  };

  // Real Firebase Google Sign-In (never treated alone as proof of 18+ age)
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const fbUser = await signInWithGoogleFirebase();
      const assignedId = user.userId.startsWith('ORIO-ID-') ? user.userId : `ORIO-ID-${fbUser.uid.slice(0, 8).toUpperCase()}`;
      const googleUser: UserProfile = {
        ...user,
        userId: assignedId,
        uid: fbUser.uid,
        name: fbUser.displayName || 'OrioLiveCall User',
        email: fbUser.email || '',
        avatar: fbUser.photoURL || user.avatar,
      };
      setUser(googleUser);
      setAuthStep('authenticated');
      await syncUserToFirestore(fbUser, googleUser);
      showToast(`Signed in with Google Firebase! Complete 18+ Adult Verification before live calls.`, 'success');
    } catch (err: any) {
      console.error('Google Firebase Sign-In error:', err);
      showToast(err?.message || 'Google sign-in popup was cancelled or blocked. Please allow popups or register with Calendar DOB.', 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  // Camera & Microphone Permission Handler with Device & Resolution support
  const requestCameraPermission = async (
    quality: VideoQuality = videoQuality,
    camId: string = selectedCameraId,
    micId: string = selectedMicId,
    wantVideo: boolean = isCameraOn,
    wantAudio: boolean = isMicOn
  ) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((tr) => tr.stop());
      }

      const videoConstraints: MediaTrackConstraints | boolean = wantVideo
        ? {
            ...(camId ? { deviceId: { exact: camId } } : { facingMode }),
            width: { ideal: quality === '4K' ? 3840 : quality === 'HD' ? 1920 : 640 },
            height: { ideal: quality === '4K' ? 2160 : quality === 'HD' ? 1080 : 480 },
          }
        : false;

      const audioConstraints: MediaTrackConstraints | boolean = wantAudio
        ? {
            ...(micId ? { deviceId: { exact: micId } } : {}),
            echoCancellation: true,
            noiseSuppression: true,
          }
        : false;

      if (!videoConstraints && !audioConstraints) {
        setStream(null);
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        return null;
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: audioConstraints,
      });

      setStream(mediaStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      // Update active WebRTC peer tracks if in a call
      if (pcRef.current) {
        const videoTrack = mediaStream.getVideoTracks()[0];
        const audioTrack = mediaStream.getAudioTracks()[0];
        const senders = pcRef.current.getSenders();
        if (videoTrack) {
          const videoSender = senders.find((s) => s.track?.kind === 'video');
          if (videoSender) await videoSender.replaceTrack(videoTrack);
          else pcRef.current.addTrack(videoTrack, mediaStream);
        }
        if (audioTrack) {
          const audioSender = senders.find((s) => s.track?.kind === 'audio');
          if (audioSender) await audioSender.replaceTrack(audioTrack);
          else pcRef.current.addTrack(audioTrack, mediaStream);
        }
      }

      await refreshDevices();
      return mediaStream;
    } catch (err) {
      console.error('Media permission error:', err);
      showToast('Camera/Microphone access denied or unavailable. Check browser permissions.', 'error');
      return null;
    }
  };

  // Ensure local video preview stays bound when stream or view updates
  useEffect(() => {
    if (localVideoRef.current && stream) {
      localVideoRef.current.srcObject = stream;
    }
  }, [stream, activeTab, chatState, isCameraOn]);

  // Camera ON/OFF toggle (hardware track stop/re-acquire so camera light turns off cleanly)
  const toggleCamera = async () => {
    if (isCameraOn) {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = false;
          track.stop();
        });
      }
      setIsCameraOn(false);
      showToast('Camera turned OFF', 'info');
    } else {
      setIsCameraOn(true);
      await requestCameraPermission(videoQuality, selectedCameraId, selectedMicId, true, isMicOn);
      showToast('Camera turned ON', 'success');
    }
  };

  // Microphone ON/OFF toggle
  const toggleMic = async () => {
    if (isMicOn) {
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setIsMicOn(false);
      showToast('Microphone muted', 'info');
    } else {
      setIsMicOn(true);
      if (streamRef.current && streamRef.current.getAudioTracks().length > 0) {
        streamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
      } else {
        await requestCameraPermission(videoQuality, selectedCameraId, selectedMicId, isCameraOn, true);
      }
      showToast('Microphone unmuted', 'success');
    }
  };

  const toggleSpeaker = () => {
    const nextState = !isSpeakerOn;
    setIsSpeakerOn(nextState);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !nextState;
    }
    showToast(nextState ? 'Speaker ON' : 'Speaker muted', 'info');
  };

  const switchCamera = async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    setSelectedCameraId('');
    if (isCameraOn) {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: newFacing },
          audio: isMicOn,
        });
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        setStream(mediaStream);
        if (localVideoRef.current) localVideoRef.current.srcObject = mediaStream;
        showToast(`Switched to ${newFacing === 'user' ? 'Front' : 'Back'} camera`, 'info');
      } catch (err) {
        console.error('Switch camera error:', err);
        showToast('Unable to switch camera on this device.', 'error');
      }
    }
  };

  // Fetch Helpers
  const fetchWallet = async () => {
    const userId = user.email || user.userId || 'guest';
    try {
      const res = await fetch(`/api/wallet/${encodeURIComponent(userId)}`);
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        setWallet(data);
      }
    } catch (err) {
      console.error("Wallet fetch error:", err);
    }
  };

  const fetchMessages = async () => {
    const myId = user.email || user.userId || 'guest-user';
    try {
      const res = await fetch(`/api/messages/${encodeURIComponent(myId)}`);
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setMessages(data);
        } else if (data && typeof data === 'object') {
          if (Array.isArray(data.messages)) setMessages(data.messages);
          if (Array.isArray(data.requests)) setMessageRequests(data.requests);
          if (Array.isArray(data.onlineUserIds)) setOnlineUserIds(data.onlineUserIds);
          if (data.privacy) setMsgPrivacy(data.privacy);
        }
      }
    } catch (err) {
      console.error("Messages fetch error:", err);
    }
  };

  const fetchShorts = async (q = shortsSearch) => {
    try {
      const url = q ? `/api/shorts?q=${encodeURIComponent(q)}` : '/api/shorts';
      const res = await fetch(url);
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (Array.isArray(data)) setShorts(data);
      }
    } catch (err) {
      console.error("Shorts fetch error:", err);
    }
  };

  const fetchSubscriptions = async () => {
    const myId = user.email || user.userId || 'guest-user';
    try {
      const res = await fetch(`/api/subscriptions/${encodeURIComponent(myId)}`);
      if (res.ok) {
        const data = await res.json();
        setFollows(data.follows || []);
        setSubscriptions(data.subscriptions || []);
        setFollowerCounts(data.followerCounts || {});
        setSubscriberCounts(data.subscriberCounts || {});
        setRecentCreatorUploads(data.recentCreatorUploads || []);
      }
    } catch (err) {
      console.error('Subscriptions fetch error:', err);
    }
  };

  const fetchModerationReports = async () => {
    try {
      const res = await fetch('/api/moderation/reports');
      if (res.ok) {
        setModerationReports(await res.json());
      }
    } catch {}
  };

  const fetchPromotions = useCallback(async () => {
    try {
      const res = await fetch('/api/promotions');
      if (res.ok) {
        const data = await res.json();
        if (data?.preview && data?.banner) {
          setPromotions(data);
        }
      }
    } catch {}
  }, []);

  const fetchCallRatings = useCallback(async () => {
    try {
      const res = await fetch('/api/call-ratings');
      if (res.ok) {
        setCallRatingSummary(await res.json());
      }
    } catch {}
  }, []);

  const fetchAgeVerificationStatus = useCallback(async (overrideId?: string) => {
    const myId = overrideId || user.email || user.userId || 'guest-user';
    try {
      const res = await fetch(`/api/age-verification/${encodeURIComponent(myId)}`);
      if (res.ok) {
        const data: AgeVerificationPublicStatus = await res.json();
        setAgeVerifyStatus(data);
        setUser((prev) => ({ ...prev, verified: Boolean(data.verified) }));
      }
    } catch {}
  }, [user.email, user.userId]);

  const fetchWebrtcConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/webrtc/config');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.iceServers)) {
          setWebrtcConfig(data);
        }
      }
    } catch {}
  }, []);

  const fetchMyFriends = useCallback(async () => {
    const myId = user.email || user.userId || 'guest-user';
    try {
      const res = await fetch(`/api/friends/${encodeURIComponent(myId)}`);
      if (res.ok) {
        const data = await res.json();
        setMyFriendsList(data.friends || []);
      }
    } catch {}
  }, [user.email, user.userId]);

  const fetchAdminUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        setAdminUsers(await res.json());
      }
    } catch {}
  }, []);

  const handleToggleFollow = async (creatorId: string) => {
    const myId = user.email || user.userId || 'guest-user';
    try {
      const res = await fetch('/api/subscriptions/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, creatorId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFollows(data.follows || []);
        if (firebaseUser) {
          const targetCreator = creators.find((c) => c.id === creatorId);
          syncSubscriptionToFirestore(firebaseUser, {
            creatorId,
            creatorName: targetCreator?.name || creatorId,
            plan: 'free_follow',
            price: 0,
            status: data.following ? 'active' : 'cancelled',
          }).catch(() => {});
        }
        fetchSubscriptions();
        showToast(data.following ? 'Following creator for free!' : 'Unfollowed creator', 'info');
      }
    } catch {}
  };

  const handleUpdateMsgPrivacy = async (nextPrivacy: UserPrivacySettings['messagingPrivacy']) => {
    const myId = user.email || user.userId || 'guest-user';
    const nextState: UserPrivacySettings = { ...msgPrivacy, messagingPrivacy: nextPrivacy };
    setMsgPrivacy(nextState);
    await fetch(`/api/privacy/${encodeURIComponent(myId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messagingPrivacy: nextPrivacy }),
    });
    if (firebaseUser) {
      updateMessagingPrivacyInFirestore(firebaseUser, nextPrivacy).catch(() => {});
      syncPrivacySettingsToFirestore(firebaseUser, {
        messagingPrivacy: nextState.messagingPrivacy,
        allowUnsolicitedRequests: nextState.allowUnsolicitedRequests,
        showOnlineStatus: nextState.showOnlineStatus !== false,
        showInGlobalFriends: nextState.showInGlobalFriends !== false,
        allowFriendRequests: nextState.allowFriendRequests !== false,
      }).catch(() => {});
    }
    showToast(`Messaging privacy updated to: ${nextPrivacy}`, 'success');
  };

  const handleUpdateExtendedPrivacy = async (patch: Partial<UserPrivacySettings>) => {
    const myId = user.email || user.userId || 'guest-user';
    const nextState: UserPrivacySettings = { ...msgPrivacy, ...patch };
    setMsgPrivacy(nextState);
    try {
      const res = await fetch(`/api/privacy/${encodeURIComponent(myId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.privacy) setMsgPrivacy(data.privacy);
      }
      if (firebaseUser) {
        syncPrivacySettingsToFirestore(firebaseUser, {
          messagingPrivacy: nextState.messagingPrivacy,
          allowUnsolicitedRequests: nextState.allowUnsolicitedRequests,
          showOnlineStatus: nextState.showOnlineStatus !== false,
          showInGlobalFriends: nextState.showInGlobalFriends !== false,
          allowFriendRequests: nextState.allowFriendRequests !== false,
        }).catch(() => {});
      }
      fetchMessages();
      fetchMyFriends();
      showToast('Privacy settings updated.', 'success');
    } catch {
      showToast('Failed to save privacy settings.', 'error');
    }
  };

  const handleSubmitServerAgeVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    const myId = user.email || user.userId || 'guest-user';
    setVerifySubmitting(true);
    try {
      const res = await fetch('/api/age-verification/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: myId,
          birthDate: verifyDobInput,
          idDocType: verifyDocType,
          idLast4: verifyIdLast4,
          issuingCountry: verifyCountry,
          adultAttestation: verifyAttestation,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Adult 18+ verification denied.', 'error');
        fetchAgeVerificationStatus();
        return;
      }
      setAgeVerifyStatus(data);
      setUser((prev) => ({ ...prev, verified: true, birthDate: verifyDobInput }));
      if (firebaseUser) {
        const birth = new Date(verifyDobInput);
        const calcAge = Math.max(18, new Date().getFullYear() - birth.getFullYear());
        syncAgeVerificationToFirestore(firebaseUser, {
          status: 'verified',
          method: data.method || 'dob_and_id_assurance',
          age: calcAge,
          idDocType: verifyDocType,
          issuingCountry: verifyCountry,
        }).catch(() => {});
      }
      setAgeModalOpen(false);
      showToast('18+ Adult Verification confirmed! You can now start free video calls.', 'success');
    } catch {
      showToast('Network error verifying adult eligibility.', 'error');
    } finally {
      setVerifySubmitting(false);
    }
  };

  const handleOpenReport = (
    targetType: 'video' | 'short' | 'livestream' | 'user' | 'message',
    targetId: string
  ) => {
    setReportModalTarget({ targetType, targetId });
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportModalTarget) return;
    const myId = user.email || user.userId || 'guest-user';
    try {
      const res = await fetch('/api/moderation/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: myId,
          targetType: reportModalTarget.targetType,
          targetId: reportModalTarget.targetId,
          reason: reportReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (firebaseUser && data.report?.id) {
          submitReportToFirestore(firebaseUser, {
            id: data.report.id,
            targetType: reportModalTarget.targetType,
            targetId: reportModalTarget.targetId,
            reason: reportReason,
          }).catch(() => {});
        }
        showToast('Safety report submitted to OrioLiveCall moderation team.', 'success');
        setReportModalTarget(null);
        fetchModerationReports();
      }
    } catch {}
  };

  const registerAndSyncProfileId = useCallback(
    async (targetUser: UserProfile, fbUserObj?: FirebaseUser | null) => {
      try {
        const res = await fetch('/api/profile/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountKey: targetUser.uid || targetUser.email || targetUser.userId,
            legacyUserId: targetUser.userId,
            requestedProfileId: targetUser.profileId,
            name: targetUser.name,
            country: targetUser.country,
            gender: targetUser.gender,
            avatar: targetUser.avatar,
            bio: targetUser.bio,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.profileId && data.profileId !== targetUser.profileId) {
            const nextUser = { ...targetUser, profileId: data.profileId };
            setUser(nextUser);
            if (fbUserObj) {
              syncUserToFirestore(fbUserObj, nextUser).catch(() => {});
            }
          }
        }
      } catch {}
    },
    []
  );

  const searchProfilesDirectory = useCallback(async (queryText: string) => {
    setProfileSearchQuery(queryText);
    try {
      const res = await fetch(`/api/profiles/search?q=${encodeURIComponent(queryText)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setProfileDirectoryResults(data);
        }
      }
    } catch {}
  }, []);

  const handleCopyProfileId = async (idToCopy?: string) => {
    const val = idToCopy || user.profileId || user.userId;
    try {
      await navigator.clipboard.writeText(val);
      setCopiedProfileId(true);
      showToast(`Copied Profile ID: ${val}`, 'success');
      setTimeout(() => setCopiedProfileId(false), 2000);
    } catch {
      showToast(`Profile ID: ${val}`, 'info');
    }
  };

  const handleShareProfileLink = async (idToShare?: string) => {
    const val = idToShare || user.profileId || user.userId;
    const shareUrl = `${window.location.origin}${window.location.pathname}?profile=${encodeURIComponent(val)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'OrioLiveCall Profile',
          text: `Connect with me on OrioLiveCall (${val})`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
      }
      showToast(`Shareable Profile Link copied: ?profile=${val}`, 'success');
    } catch {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast(`Profile Link copied: ${shareUrl}`, 'success');
      } catch {
        showToast(`Share Link: ${shareUrl}`, 'info');
      }
    }
  };

  // Handle ?profile=ORI-XXXXXX deep link on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetProfileId = params.get('profile');
    if (targetProfileId) {
      fetch(`/api/profiles/by-id/${encodeURIComponent(targetProfileId)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((found) => {
          if (found) {
            setSelectedProfileForModal(found);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  useEffect(() => {
    if (authStep === 'authenticated') {
      fetchWallet();
      fetchMessages();
      fetchShorts();
      fetchSubscriptions();
      fetchAgeVerificationStatus();
      fetchWebrtcConfig();
      fetchMyFriends();
      registerAndSyncProfileId(user, firebaseUser);
      searchProfilesDirectory('');
      requestCameraPermission();
    }
  }, [authStep]);

  // Socket.io connection + WebRTC + Mutual Match Acceptance + Gemini Live Audio Bridge
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    const myId = user.email || user.userId || 'guest-user';
    newSocket.emit("join-room", myId);

    newSocket.on("presence-update", ({ onlineUserIds: ids }: { onlineUserIds: string[] }) => {
      if (Array.isArray(ids)) setOnlineUserIds(ids);
    });

    newSocket.on("new-message", (msg: MessageItem & { isRequest?: boolean }) => {
      if (msg.isRequest) {
        setMessageRequests(prev => [msg, ...prev]);
      } else {
        setMessages(prev => [msg, ...prev]);
      }
    });

    newSocket.on("match-proposed", (data: ProposedMatchInfo) => {
      setProposedMatch({
        ...data,
        acceptedByMe: false,
        acceptedByPartner: false,
      });
      setChatState('confirming');
    });

    newSocket.on("partner-accepted-match", ({ sessionId }: { sessionId: string }) => {
      setProposedMatch((prev) =>
        prev && prev.sessionId === sessionId ? { ...prev, acceptedByPartner: true } : prev
      );
    });

    newSocket.on("match-accepted", async (data) => {
      setProposedMatch(null);
      setActiveSessionId(data.sessionId || null);
      setPartnerInfo({
        socketId: data.partnerSocketId,
        userId: data.partnerUserId,
        profileId: data.partnerProfileId,
        name: data.partnerName,
        country: data.partnerCountry,
        gender: data.partnerGender
      });
      setChatState('connected');
      initWebRTC(newSocket, data.partnerSocketId, data.initiator, data.sessionId);
    });

    newSocket.on("match-declined", ({ reason, byPartner }: { reason?: string; byPartner?: boolean }) => {
      setProposedMatch(null);
      setActiveSessionId(null);
      cleanupWebRTC();
      setPartnerInfo(null);
      setChatState('idle');
      showToast(
        byPartner
          ? reason === 'consent_timeout'
            ? 'Match acceptance timed out. Click FREE VIDEO CALL NOW to find someone new.'
            : 'Partner declined the call. Click FREE VIDEO CALL NOW to match again.'
          : 'Call proposal cancelled.',
        'info'
      );
    });

    newSocket.on("match-error", ({ code, error }: { code?: string; error?: string }) => {
      setProposedMatch(null);
      setActiveSessionId(null);
      setChatState('idle');
      showToast(error || 'Unable to join matching queue.', 'error');
      if (code === 'ADULT_VERIFICATION_REQUIRED' || code === 'AGE_RESTRICTED') {
        setAgeModalOpen(true);
      }
      if (code === 'ACCOUNT_SUSPENDED') {
        fetchAgeVerificationStatus();
      }
    });

    newSocket.on("account-suspended", ({ reason }: { reason?: string }) => {
      cleanupWebRTC();
      setProposedMatch(null);
      setPartnerInfo(null);
      setChatState('disconnected');
      fetchAgeVerificationStatus();
      showToast(`Account suspended: ${reason || 'Safety policy violation.'}`, 'error');
    });

    newSocket.on("waiting-for-match", () => {
      setChatState('searching');
    });

    newSocket.on("partner-disconnected", ({ reason }: { reason?: string } = {}) => {
      cleanupWebRTC();
      setProposedMatch(null);
      setActiveSessionId(null);
      setPartnerInfo(null);
      setChatState((prev) => {
        if (prev === 'connected' || prev === 'reconnecting' || prev === 'confirming') {
          if (reason && reason !== 'ended' && reason !== 'skipped') {
            showToast('Your call partner disconnected.', 'info');
          }
          return 'disconnected';
        }
        return prev;
      });
    });

    newSocket.on("webrtc-offer", async ({ sender, offer }) => {
      if (!pcRef.current) createPeerConnection(newSocket, sender);
      try {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pcRef.current?.createAnswer();
        await pcRef.current?.setLocalDescription(answer);
        newSocket.emit("webrtc-answer", { target: sender, answer });
      } catch (err) {
        console.error("Error handling WebRTC offer:", err);
      }
    });

    newSocket.on("webrtc-answer", async ({ answer }) => {
      try {
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error("Error handling WebRTC answer:", err);
      }
    });

    newSocket.on("webrtc-ice-candidate", async ({ candidate }) => {
      try {
        if (candidate && pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    // AI Global Talking Live Events
    newSocket.on("ai-live-ready", () => {
      setAiLiveConnecting(false);
      setAiLiveActive(true);
      showToast('AI Global Partner connected! Speak or type below to talk.', 'success');
    });

    newSocket.on("ai-live-transcript", ({ role, text }: { role: 'user' | 'ai'; text: string }) => {
      if (!text?.trim()) return;
      setAiTalkMessages((prev) => [
        ...prev.slice(-25),
        { role, text, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
    });

    newSocket.on("ai-live-audio", ({ audio }: { audio: string }) => {
      if (!isSpeakerOnRef.current || !audio) return;
      try {
        if (!outputAudioCtxRef.current) {
          outputAudioCtxRef.current = new AudioContext({ sampleRate: 24000 });
          nextPlayTimeRef.current = outputAudioCtxRef.current.currentTime;
        }
        const ctx = outputAudioCtxRef.current;
        if (ctx.state === 'suspended') ctx.resume();
        const float32 = base64Pcm16ToFloat32(audio);
        const buffer = ctx.createBuffer(1, float32.length, 24000);
        buffer.copyToChannel(new Float32Array(float32), 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
        source.start(startAt);
        nextPlayTimeRef.current = startAt + buffer.duration;
      } catch (err) {
        console.error('Audio playback error:', err);
      }
    });

    newSocket.on("ai-live-error", ({ message }: { message: string }) => {
      setAiLiveConnecting(false);
      setAiLiveActive(false);
      showToast(message || 'Live voice AI unavailable, you can still use AI Text & Voice Talk below.', 'info');
    });

    newSocket.on("ai-live-closed", () => {
      setAiLiveActive(false);
      setAiLiveConnecting(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user.userId, user.email, preferences]);

  // Start AI Global Talking Call
  const startAiGlobalCall = async () => {
    cleanupWebRTC();
    if (socket) socket.emit("leave-queue");
    setPartnerInfo({
      socketId: 'ai-global-partner',
      name: `AI Partner (${preferences.targetCountry === 'all' ? 'Global' : preferences.targetCountry})`,
      country: preferences.targetCountry === 'all' ? 'Global' : preferences.targetCountry,
      gender: preferences.targetGender,
    });
    setChatState('ai-talking');
    setAiLiveConnecting(true);
    setAiTalkMessages([
      {
        role: 'ai',
        text: lang === 'bn'
          ? 'হ্যালো! আমি আপনার এআই গ্লোবাল পার্টনার। কথা বলতে মাইক্রোফোনে বলুন অথবা নিচে লিখুন!'
          : 'Hello! I am your AI Global Partner on OrioLiveCall. Speak into your mic or type below to talk in English or Bengali!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    // Ensure mic/camera active
    let activeStream = streamRef.current;
    if (!activeStream) {
      activeStream = await requestCameraPermission(videoQuality, selectedCameraId, selectedMicId, isCameraOn, true);
    }

    // Start 16kHz PCM capture for Live API
    try {
      if (activeStream && activeStream.getAudioTracks().length > 0) {
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        inputAudioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(activeStream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioCtx.destination);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!isMicOnRef.current || !socket) return;
          const pcmBase64 = float32ToBase64Pcm16(e.inputBuffer.getChannelData(0));
          socket.emit("ai-live-audio", { audio: pcmBase64 });
        };
      }
    } catch (audioErr) {
      console.warn('Live mic stream fallback to push-to-talk text/audio:', audioErr);
    }

    if (socket) {
      socket.emit("ai-live-start", {
        partnerCountry: preferences.targetCountry === 'all' ? 'Global' : preferences.targetCountry,
        language: lang,
        voiceName: aiVoiceName,
      });
    }
  };

  const stopAiGlobalCall = () => {
    if (socket) socket.emit("ai-live-stop");
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }
    if (outputAudioCtxRef.current) {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }
    setAiLiveActive(false);
    setAiLiveConnecting(false);
    setPartnerInfo(null);
    setChatState('idle');
  };

  // Send message to AI Global Partner (Text + Spoken WAV reply)
  const handleSendAiTalkText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptInput.trim() || aiSendingText) return;
    const promptText = aiPromptInput.trim();
    setAiPromptInput('');
    setAiSendingText(true);

    const userMsg: AiTalkMessage = {
      role: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setAiTalkMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/gemini/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          partnerCountry: preferences.targetCountry === 'all' ? 'Global' : preferences.targetCountry,
          language: lang,
          history: aiTalkMessages.slice(-6),
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setAiTalkMessages((prev) => [
          ...prev,
          {
            role: 'ai',
            text: data.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        if (data.audioBase64 && isSpeakerOnRef.current) {
          const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
          audio.play().catch((err) => console.warn('WAV play blocked:', err));
        }
      } else if (data.error) {
        showToast(data.error, 'error');
      }
    } catch (err) {
      console.error('AI talk error:', err);
      showToast('Could not reach AI Global Talk service.', 'error');
    } finally {
      setAiSendingText(false);
    }
  };


  const createPeerConnection = (sock: Socket, partnerId: string, sessionId?: string | null) => {
    const pc = new RTCPeerConnection({
      iceServers: webrtcConfig.iceServers?.length
        ? webrtcConfig.iceServers
        : [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, streamRef.current!);
      });
    }

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
      evaluateNetworkRef.current();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sock.emit("webrtc-ice-candidate", { target: partnerId, candidate: event.candidate });
      }
    };

    pc.oniceconnectionstatechange = () => {
      const ice = pc.iceConnectionState;
      if (ice === 'connected' || ice === 'completed') {
        setChatState((prev) => (prev === 'reconnecting' || prev === 'connected' ? 'connected' : prev));
        if (sessionId) sock.emit('session-status', { sessionId, status: 'connected' });
      } else if (ice === 'disconnected' || ice === 'checking') {
        setChatState((prev) => (prev === 'connected' ? 'reconnecting' : prev));
        if (sessionId) sock.emit('session-status', { sessionId, status: 'reconnecting' });
      } else if (ice === 'failed' || ice === 'closed') {
        setChatState((prev) => (prev === 'connected' || prev === 'reconnecting' ? 'disconnected' : prev));
        if (sessionId) sock.emit('session-status', { sessionId, status: 'disconnected' });
      }
      evaluateNetworkRef.current();
    };

    pc.onconnectionstatechange = () => {
      evaluateNetworkRef.current();
    };

    pcRef.current = pc;
    return pc;
  };

  const initWebRTC = async (sock: Socket, partnerId: string, initiator: boolean, sessionId?: string | null) => {
    const pc = createPeerConnection(sock, partnerId, sessionId);
    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sock.emit("webrtc-offer", { target: partnerId, offer });
      } catch (err) {
        console.error("Error creating WebRTC offer:", err);
      }
    }
  };

  const cleanupWebRTC = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const startMatching = async () => {
    if (!socket) return;
    if (authStep !== 'authenticated') {
      setAuthStep('signin');
      return;
    }
    if (!ageVerifyStatus?.verified) {
      setAgeModalOpen(true);
      showToast('Server 18+ Adult Verification is required before starting live video calls.', 'info');
      return;
    }

    // Explicit Camera & Microphone permission check BEFORE joining queue
    let activeStream = streamRef.current;
    const hasLiveTrack = activeStream?.getTracks().some((tr) => tr.readyState === 'live');
    if (!activeStream || !hasLiveTrack) {
      activeStream = await requestCameraPermission(videoQuality, selectedCameraId, selectedMicId, true, true);
      if (!activeStream) {
        showToast('Camera & microphone permission is required before entering video matching.', 'error');
        return;
      }
      setIsCameraOn(true);
      setIsMicOn(true);
    }

    if (chatState === 'ai-talking') stopAiGlobalCall();
    const myId = user.email || user.userId;

    // Persist matching preferences to backend + Firestore
    fetch(`/api/preferences/${encodeURIComponent(myId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetGender: preferences.targetGender,
        targetCountry: preferences.targetCountry,
        voluntaryGender: user.gender,
        preferredQuality: videoQuality,
      }),
    }).catch(() => {});
    if (firebaseUser) {
      syncUserPreferencesToFirestore(firebaseUser, {
        targetGender: preferences.targetGender,
        targetCountry: preferences.targetCountry,
        voluntaryGender: user.gender,
        preferredQuality: videoQuality,
      }).catch(() => {});
    }

    setProposedMatch(null);
    setChatState('searching');
    socket.emit("join-queue", {
      userId: myId,
      profileId: user.profileId,
      name: user.name || "Adult User",
      gender: user.gender,
      country: user.country,
      targetGender: preferences.targetGender,
      targetCountry: preferences.targetCountry,
      mediaReady: true,
    });
  };

  const handleRespondToMatchProposal = (accept: boolean) => {
    if (!socket || !proposedMatch) return;
    if (!accept) {
      socket.emit('respond-match', { sessionId: proposedMatch.sessionId, accept: false });
      setProposedMatch(null);
      setChatState('idle');
      return;
    }
    setProposedMatch((prev) => (prev ? { ...prev, acceptedByMe: true } : prev));
    socket.emit('respond-match', { sessionId: proposedMatch.sessionId, accept: true });
  };

  const cancelMatching = () => {
    if (socket) socket.emit("leave-queue");
    setProposedMatch(null);
    setChatState('idle');
  };

  const buildCallFeedbackSnapshot = (actionTrigger: 'next_person' | 'end_call'): CallFeedbackSession => ({
    actionTrigger,
    callMode: chatState === 'ai-talking' ? 'ai_global_talk' : 'random_video',
    partnerName:
      partnerInfo?.name ||
      (chatState === 'ai-talking' ? 'AI Global Partner' : 'Video Chat Partner'),
    partnerCountry:
      partnerInfo?.country ||
      (preferences.targetCountry === 'all' ? 'Global' : preferences.targetCountry),
    durationSec: callDurationSec,
    videoQuality: networkStats.qualityTier === 'OFF' || networkStats.qualityTier === 'Pending' ? 'SD' : networkStats.qualityTier,
    stabilityStatus: networkStats.status,
    rttMs: networkStats.rttMs,
  });

  const handleNextPerson = () => {
    const snapshot = buildCallFeedbackSnapshot('next_person');
    if (chatState === 'ai-talking') {
      stopAiGlobalCall();
    } else if (socket) {
      cleanupWebRTC();
      socket.emit("skip-partner");
    }
    setProposedMatch(null);
    setActiveSessionId(null);
    setPartnerInfo(null);
    setChatState('idle');
    setPostCallFeedbackSession(snapshot);
  };

  const handleEndCall = () => {
    const snapshot = buildCallFeedbackSnapshot('end_call');
    if (chatState === 'ai-talking') {
      stopAiGlobalCall();
    } else if (socket) {
      cleanupWebRTC();
      socket.emit("end-call");
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setProposedMatch(null);
    setActiveSessionId(null);
    setChatState('idle');
    setPartnerInfo(null);
    setPostCallFeedbackSession(snapshot);
  };

  const proceedAfterPostCallRating = (session: CallFeedbackSession) => {
    setPostCallFeedbackSession(null);
    if (session.actionTrigger === 'next_person') {
      if (session.callMode === 'ai_global_talk') {
        startAiGlobalCall();
      } else {
        startMatching();
      }
    }
  };

  const handleSubmitPostCallRating = async (payload: {
    overallRating: number;
    callQualityRating: number;
    tags: string[];
    comment: string;
  }) => {
    if (!postCallFeedbackSession) return;
    setSubmittingCallRating(true);
    const activeSession = postCallFeedbackSession;
    const myId = user.email || user.userId || 'guest-user';
    try {
      const res = await fetch('/api/call-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: myId,
          actionTrigger: activeSession.actionTrigger,
          callMode: activeSession.callMode,
          partnerName: activeSession.partnerName,
          partnerCountry: activeSession.partnerCountry,
          overallRating: payload.overallRating,
          callQualityRating: payload.callQualityRating,
          durationSec: activeSession.durationSec,
          videoQuality: activeSession.videoQuality,
          stabilityStatus: activeSession.stabilityStatus,
          rttMs: activeSession.rttMs,
          tags: payload.tags,
          comment: payload.comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not submit call rating.', 'error');
        return;
      }

      if (firebaseUser && data.rating?.id) {
        saveCallRatingToFirestore(firebaseUser, {
          id: data.rating.id,
          actionTrigger: activeSession.actionTrigger,
          callMode: activeSession.callMode,
          partnerName: activeSession.partnerName,
          partnerCountry: activeSession.partnerCountry,
          overallRating: payload.overallRating,
          callQualityRating: payload.callQualityRating,
          durationSec: activeSession.durationSec,
          videoQuality: activeSession.videoQuality,
          stabilityStatus: activeSession.stabilityStatus,
          tags: payload.tags,
          comment: payload.comment,
        }).catch(() => {});
      }

      showToast(
        lang === 'bn'
          ? 'আপনার মতামতের জন্য ধন্যবাদ!'
          : 'Thank you for rating your call experience!',
        'success'
      );
      fetchCallRatings();
      proceedAfterPostCallRating(activeSession);
    } catch {
      showToast('Network error submitting call feedback.', 'error');
    } finally {
      setSubmittingCallRating(false);
    }
  };

  const fetchAiIcebreakers = async () => {
    setLoadingIcebreakers(true);
    try {
      const res = await fetch("/api/gemini/icebreaker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerCountry: partnerInfo?.country, topic: "fun global conversation" })
      });
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (Array.isArray(data)) setIcebreakers(data);
      }
    } catch (err) {
      console.error("Failed to fetch icebreakers:", err);
      setIcebreakers([
        { english: "What is the most beautiful place in your country?", bengali: "আপনার দেশের সবচেয়ে সুন্দর জায়গা কোনটি?" },
        { english: "What is your favorite traditional food?", bengali: "আপনার প্রিয় ঐতিহ্যবাহী খাবার কী?" }
      ]);
    } finally {
      setLoadingIcebreakers(false);
    }
  };

  const verifyAgeWithCalendar = () => {
    if (!ageLicenseAgreed) {
      showToast("Please confirm you are 18+ and accept the License & Safety Disclaimer.", 'error');
      return;
    }
    if (!birthDateInput) {
      showToast("Please select your date of birth.", 'error');
      return;
    }
    const birthDateObj = new Date(birthDateInput);
    const today = new Date();
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const m = today.getMonth() - birthDateObj.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }

    if (isNaN(age) || age < 18) {
      showToast(t.underageError, 'error');
      return;
    }

    setUser(prev => ({ ...prev, birthDate: birthDateInput, age, verified: true }));
    setAuthStep('profile-setup');
  };

  // Wallet Handlers
  const handleSendMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = user.email || user.userId || 'guest';
    try {
      const res = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userId,
          recipientEmail: sendRecipient,
          amount: parseFloat(sendAmount),
          currency: 'USD',
          description: sendDesc || 'Global Money Transfer'
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Transferred $${sendAmount} to ${sendRecipient}. TX: ${data.txId}`, 'success');
        setSendRecipient('');
        setSendAmount('');
        setSendDesc('');
        fetchWallet();
      } else {
        showToast(data.error || 'Transfer failed', 'error');
      }
    } catch {
      showToast('Transfer request failed', 'error');
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = user.email || user.userId || 'guest';
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          amount: parseFloat(withdrawAmount),
          method: withdrawMethod,
          accountDetails: user.email || user.userId
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Withdrawal submitted. TX: ${data.txId}`, 'success');
        setWithdrawAmount('');
        fetchWallet();
      } else {
        showToast(data.error || 'Withdrawal failed', 'error');
      }
    } catch {
      showToast('Withdrawal request failed', 'error');
    }
  };

  const handleDispute = async () => {
    if (!selectedTxForDispute || !disputeReason) return;
    const userId = user.email || user.userId || 'guest';
    try {
      const res = await fetch('/api/wallet/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, txId: selectedTxForDispute, reason: disputeReason })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Dispute request submitted for review.', 'success');
        setSelectedTxForDispute(null);
        setDisputeReason('');
        fetchWallet();
      }
    } catch {
      showToast('Could not submit dispute.', 'error');
    }
  };

  const handleSendGift = () => {
    if (!wallet || wallet.balance < selectedGiftType.price) {
      showToast("Insufficient wallet balance for this gift.", 'error');
      return;
    }
    setGiftAnimationActive(true);
    setTimeout(() => {
      setGiftAnimationActive(false);
      setShowGiftModal(false);
      showToast(`Sent ${selectedGiftType.name} to ${giftTargetName || 'Creator'}!`, 'success');
      fetchWallet();
    }, 1800);
  };

  const handleSubscribeCheckout = async () => {
    if (!subTargetCreator) return;
    const myId = user.email || user.userId || 'guest-user';
    const price = subPlanType === 'monthly' ? (subTargetCreator.monthlyPrice || 19.99) : (subTargetCreator.yearlyPrice || 149.99);
    try {
      const res = await fetch('/api/subscriptions/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: myId,
          creatorId: subTargetCreator.id,
          creatorName: subTargetCreator.name,
          plan: subPlanType,
          price,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Insufficient balance for subscription checkout.", 'error');
        return;
      }
      setCreators(prev => prev.map(c => c.id === subTargetCreator.id ? { ...c, isSubscribed: true } : c));
      if (firebaseUser) {
        syncSubscriptionToFirestore(firebaseUser, {
          creatorId: subTargetCreator.id,
          creatorName: subTargetCreator.name,
          plan: subPlanType,
          price,
          status: 'active',
          expiresAt: data.subscription?.expiresAt,
        }).catch(() => {});
      }
      setShowSubscriptionModal(false);
      showToast(`Subscribed to ${subTargetCreator.name} (${subPlanType.toUpperCase()})! TX: ${data.txId}`, 'success');
      fetchWallet();
      fetchSubscriptions();
    } catch {
      showToast('Failed to process subscription checkout', 'error');
    }
  };

  const handleCancelSubscription = async (subscriptionId: string, requestRefund: boolean) => {
    const myId = user.email || user.userId || 'guest-user';
    try {
      const res = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: myId, subscriptionId, requestRefund }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          data.refunded
            ? `Subscription cancelled & 24h guarantee refund issued (${data.refundTxId}).`
            : 'Subscription renewal cancelled.',
          'success'
        );
        fetchWallet();
        fetchSubscriptions();
      }
    } catch {}
  };

  const handleLogout = async () => {
    try {
      await signOutFirebase();
    } catch {}
    localStorage.removeItem('oriolivecall_auth');
    setAuthStep('welcome');
    showToast('Logged out successfully.', 'info');
  };

  // SPLASH LOADING SCREEN WITH PERFECTLY SIZED APP LOGO
  if (isInitializing) {
    return (
      <div className="fixed inset-0 z-50 bg-[#05060f] flex flex-col items-center justify-center p-6 space-y-6">
        <div className="relative">
          <div className="w-72 sm:w-96 h-36 sm:h-44 rounded-3xl overflow-hidden bg-[#05060f] border border-purple-500/40 shadow-2xl shadow-purple-600/40 flex items-center justify-center">
            <img
              src="/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg"
              alt="OrioLiveCall App Logo"
              className="w-full h-full object-cover object-center"
            />
          </div>
          <div className="absolute -inset-2 rounded-[28px] border border-purple-500/25 animate-pulse pointer-events-none" />
        </div>
        <div className="w-56 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-purple-500/20">
          <div className="w-full h-full bg-gradient-to-r from-purple-600 via-violet-500 to-blue-500 animate-pulse" />
        </div>
        <p className="text-[11px] text-purple-300/90 font-semibold tracking-widest uppercase">
          Loading OrioLiveCall...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-purple-600 selection:text-white">
      
      {/* NON-BLOCKING TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed top-20 right-6 z-[70] max-w-sm px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
          toast.type === 'error'
            ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
            : toast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
            : 'bg-slate-900/95 border-purple-500/50 text-slate-100'
        }`}>
          <span className="text-xs font-medium flex-1">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP BAR & LOGO-CONTROLLED HIDDEN NAVIGATION MENU */}
      <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md sticky top-0 z-50">
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setNavOpen(!navOpen)}
            className="flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-xl p-1"
            aria-label="Toggle Navigation Menu"
          >
            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-[#05060f] border border-purple-500/40 flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-105 transition-transform shrink-0">
              <img
                src="/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg"
                alt="OrioLiveCall Logo"
                className="w-[56.2222px] h-[44.2222px] -mr-[11px] -mt-[2px] -mb-[3px] pr-0 object-cover translate-x-[70%] scale-[2.65]"
              />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-purple-300 bg-clip-text text-transparent whitespace-nowrap">
                  {t.brand}
                </span>
                <span className="text-xs text-purple-400 group-hover:rotate-180 transition-transform">
                  {navOpen ? <X className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </div>
              <div className="text-[10px] text-purple-400 font-medium tracking-wide">
                {t.tagline}
              </div>
            </div>
          </button>
        </div>

        {/* Desktop Quick Nav */}
        <nav className="hidden xl:flex items-center gap-4 text-xs font-medium text-slate-400">
          <button onClick={() => setActiveTab('home')} className={`hover:text-white ${activeTab === 'home' ? 'text-white font-bold' : ''}`}>{t.navHome}</button>
          <button onClick={() => setActiveTab('chat')} className={`hover:text-white ${activeTab === 'chat' ? 'text-white font-bold' : ''}`}>{t.navChat}</button>
          <button onClick={() => { setActiveTab('friends'); fetchMyFriends(); }} className={`hover:text-white flex items-center gap-1 ${activeTab === 'friends' ? 'text-white font-bold' : ''}`}>
            <span>{t.navFriends}</span>
          </button>
          <button onClick={() => setActiveTab('videos')} className={`hover:text-white ${activeTab === 'videos' ? 'text-white font-bold' : ''}`}>{t.navVideos}</button>
          <button onClick={() => setActiveTab('community')} className={`hover:text-white ${activeTab === 'community' ? 'text-white font-bold' : ''}`}>{t.navCommunity}</button>
          <button onClick={() => { setActiveTab('messages'); fetchMessages(); fetchMyFriends(); }} className={`hover:text-white flex items-center gap-1 ${activeTab === 'messages' ? 'text-white font-bold' : ''}`}>
            <span>{t.navMessages}</span>
            {messageRequests.length > 0 && <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-[9px] text-white">{messageRequests.length}</span>}
          </button>
          <button onClick={() => { setActiveTab('shorts'); fetchShorts(); }} className={`hover:text-white ${activeTab === 'shorts' ? 'text-white font-bold' : ''}`}>{t.navShorts}</button>
          <button onClick={() => setActiveTab('live')} className={`hover:text-white ${activeTab === 'live' ? 'text-white font-bold' : ''}`}>{t.navLive}</button>
          <button onClick={() => setActiveTab('wallet')} className={`hover:text-white ${activeTab === 'wallet' ? 'text-white font-bold' : ''}`}>{t.navWallet}</button>
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              setGiftTargetName('Global Creator');
              setShowGiftModal(true);
            }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 text-xs font-semibold text-amber-300 hover:text-white transition-all"
            title="Give Gift"
          >
            <Gift className="w-3.5 h-3.5 text-amber-400" />
            <span>Give Gift</span>
          </button>

          <button
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-all"
          >
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <span>{lang === 'en' ? 'বাংলা' : 'English'}</span>
          </button>

          {authStep === 'authenticated' ? (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => { setActiveTab('wallet'); fetchWallet(); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-950/60 border border-purple-800/60 text-xs font-medium text-purple-200 hover:border-purple-600 transition-colors"
                title={`Saved User ID: ${user.userId}`}
              >
                <Wallet className="w-3.5 h-3.5 text-purple-400" />
                <span>${wallet?.balance?.toFixed(2) || '250.00'}</span>
              </button>
              <button
                onClick={() => setActiveTab('profile')}
                className="hidden md:flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
              >
                <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-purple-500" />
                <div>
                  <div className="text-xs font-bold text-white leading-tight flex items-center gap-1">
                    <span>{user.name}</span>
                    {firebaseUser && (
                      <span title="Firebase Verified" className="inline-flex">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono text-purple-300">{user.profileId || user.userId}</div>
                </div>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setActiveTab('chat');
                setAuthStep('signin');
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg hover:from-purple-500 hover:to-blue-500 shadow-lg shadow-purple-600/25 transition-all whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* --- ALL 23 NAVIGATION ITEMS DROPDOWN MENU --- */}
      {navOpen && (
        <div className="absolute top-20 left-6 z-50 w-80 p-5 rounded-3xl bg-slate-900/98 backdrop-blur-xl border border-slate-800 shadow-2xl space-y-2 animate-in fade-in slide-in-from-top-4 duration-200 max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg overflow-hidden bg-[#05060f] border border-purple-500/40 shrink-0">
                <img
                  src="/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg"
                  alt="OrioLiveCall"
                  className="w-full h-full object-cover translate-x-[70%] scale-[2.65]"
                />
              </div>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">OrioLiveCall Menu</span>
            </div>
            <button onClick={() => setNavOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col space-y-1 text-xs">
            {[
              { id: 'home', label: t.navHome, icon: Home },
              { id: 'chat', label: t.navChat, icon: Video },
              { id: 'friends', label: t.navFriends, icon: UserPlus },
              { id: 'videos', label: t.navVideos, icon: Play },
              { id: 'community', label: t.navCommunity, icon: Users },
              { id: 'messages', label: t.navMessages, icon: MessageSquare },
              { id: 'shorts', label: t.navShorts, icon: Flame },
              { id: 'live', label: t.navLive, icon: Radio },
              { id: 'creators', label: t.navCreators, icon: Compass },
              { id: 'profile', label: t.navProfile, icon: User },
              { id: 'creator-dashboard', label: t.navCreatorDash, icon: BarChart3 },
              { id: 'wallet', label: t.navWallet, icon: Wallet },
              { id: 'send-money', label: t.navSend, icon: Send },
              { id: 'receive-money', label: t.navReceive, icon: ArrowDownLeft },
              { id: 'history', label: t.navHistory, icon: RefreshCcw },
              { id: 'gifts', label: t.navGifts, icon: Gift },
              { id: 'subscriptions', label: t.navSubs, icon: Crown },
              { id: 'payment-methods', label: t.navPayMethods, icon: CreditCard },
              { id: 'notifications', label: t.navNotifs, icon: Bell },
              { id: 'settings', label: t.navSettings, icon: SettingsIcon },
              { id: 'help', label: t.navHelp, icon: HelpIcon },
              { id: 'privacy-policy', label: t.navPrivacy, icon: Shield },
              { id: 'terms', label: t.navTerms, icon: FileText },
              { id: 'guidelines', label: t.navGuidelines, icon: CheckCircle2 },
              { id: 'admin', label: t.navAdmin, icon: ShieldAlert },
            ].map(item => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as any);
                    setNavOpen(false);
                    if (item.id === 'admin') {
                      fetchModerationReports();
                      fetchPromotions();
                      fetchCallRatings();
                      fetchAdminUsers();
                    }
                    if (item.id === 'home') fetchPromotions();
                    if (item.id === 'friends') fetchMyFriends();
                    if (item.id === 'messages') { fetchMessages(); fetchMyFriends(); }
                    if (item.id === 'subscriptions') fetchSubscriptions();
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all text-left ${activeTab === item.id ? 'bg-purple-600 text-white font-bold shadow-md' : 'text-slate-200 hover:bg-slate-800'}`}
                >
                  <IconComp className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              onClick={() => { setNavOpen(false); handleLogout(); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-rose-400 hover:bg-rose-950/40 transition-all text-left"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{t.navLogout}</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col">
        
        {/* --- 1. HOME TAB WITH PERMANENT 16:9 PREVIEW, BANNER & CAROUSEL --- */}
        {activeTab === 'home' && (
          <HomepageShowcaseSection
            lang={lang}
            promotions={promotions}
            isAdmin={true}
            onNavigateTab={(tab) => {
              setActiveTab(tab as any);
              if (tab === 'admin') {
                fetchModerationReports();
                fetchPromotions();
                fetchAdminUsers();
              }
              if (tab === 'friends') fetchMyFriends();
              if (tab === 'messages') { fetchMessages(); fetchMyFriends(); }
              if (tab === 'subscriptions') fetchSubscriptions();
            }}
            onStartAiTalk={startAiGlobalCall}
          />
        )}

        {/* --- 2. RANDOM VIDEO CHAT & AI GLOBAL TALKING TAB --- */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col">
            {authStep !== 'authenticated' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
                <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
                  
                  {authStep === 'welcome' && (
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 mx-auto rounded-2xl overflow-hidden bg-[#05060f] border border-purple-500/50 flex items-center justify-center shadow-xl shadow-purple-500/35">
                        <img
                          src="/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg"
                          alt="OrioLiveCall Logo"
                          className="w-full h-full object-cover translate-x-[70%] scale-[2.65]"
                        />
                      </div>
                      <h2 className="text-2xl font-bold text-white">{t.brand}</h2>
                      <p className="text-sm text-slate-400">{t.tagline}</p>

                      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-left cursor-pointer hover:border-purple-500/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={google18Checked}
                          onChange={(e) => setGoogle18Checked(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-purple-600 rounded cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] text-slate-300 leading-relaxed">
                          I confirm I am <strong className="text-white">18+ years old</strong> and allow{' '}
                          <strong className="text-purple-300">Google Sign-In & essential cookies</strong>.
                        </span>
                      </label>

                      <div className="pt-1 space-y-3">
                        <button
                          onClick={() => {
                            if (!google18Checked) {
                              showToast('Please tick the 18+ years confirmation box above first.', 'error');
                              return;
                            }
                            handleGoogleSignIn();
                          }}
                          disabled={authLoading}
                          className="w-full py-3 px-4 rounded-xl bg-white text-slate-900 font-bold text-sm shadow-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                          </svg>
                          <span>{authLoading ? 'Connecting Firebase...' : t.googleSignIn}</span>
                        </button>

                        <button
                          onClick={() => setAuthStep('age-verify')}
                          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 hover:opacity-95 transition-all flex items-center justify-center gap-2"
                        >
                          <Shield className="w-4 h-4" />
                          <span>Get Started with Calendar DOB</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {authStep === 'age-verify' && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 text-purple-400">
                        <Calendar className="w-6 h-6" />
                        <h3 className="text-lg font-bold text-white">{t.ageCheckTitle}</h3>
                      </div>
                      <p className="text-xs text-slate-400">{t.ageCheckDesc}</p>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-300">{t.birthDateLabel}</label>
                        <input
                          type="date"
                          value={birthDateInput}
                          onChange={(e) => setBirthDateInput(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ageLicenseAgreed}
                          onChange={(e) => setAgeLicenseAgreed(e.target.checked)}
                          className="mt-0.5 accent-purple-600"
                        />
                        <span className="text-[11px] text-slate-300 leading-relaxed">
                          I confirm that I am <strong className="text-white">18 years or older</strong> and accept the{' '}
                          <span className="text-purple-300 font-semibold">OrioLiveCall License Disclaimer</span>, privacy-first policy, and strict <strong className="text-emerald-300">non-explicit safe content rules</strong>.
                        </span>
                      </label>
                      <button
                        onClick={verifyAgeWithCalendar}
                        className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-500 transition-all shadow-lg shadow-purple-600/30"
                      >
                        {t.verifyBtn}
                      </button>
                    </div>
                  )}

                  {authStep === 'profile-setup' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-white">Complete Your Profile</h3>
                        <span className="text-xs font-mono text-purple-400 px-2.5 py-1 rounded-lg bg-purple-950 border border-purple-800">
                          Saved ID: {user.userId}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-slate-300">{t.nameLabel}</label>
                          <input
                            type="text"
                            placeholder="Your Name"
                            value={user.name}
                            onChange={(e) => setUser({ ...user, name: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-300">{t.genderLabel}</label>
                          <select
                            value={user.gender}
                            onChange={(e: any) => setUser({ ...user, gender: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm mt-1"
                          >
                            <option value="girls">Female / নারী</option>
                            <option value="boys">Male / পুরুষ</option>
                            <option value="other">Other / অন্যান্য</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-300">{t.countryLabel}</label>
                          <select
                            value={user.country}
                            onChange={(e) => setUser({ ...user, country: e.target.value })}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm mt-1"
                          >
                            <option value="Bangladesh">Bangladesh</option>
                            <option value="India">India</option>
                            <option value="United States">United States</option>
                            <option value="United Kingdom">United Kingdom</option>
                            <option value="Canada">Canada</option>
                            <option value="Australia">Australia</option>
                            <option value="Other">Other Countries</option>
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!user.name) setUser({ ...user, name: "Adult User" });
                          setAuthStep('authenticated');
                        }}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold text-sm hover:opacity-95 transition-all"
                      >
                        {t.saveProfile}
                      </button>
                    </div>
                  )}

                  {authStep === 'signin' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#05060f] border border-purple-500/40 shrink-0">
                            <img
                              src="/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg"
                              alt="OrioLiveCall Logo"
                              className="w-full h-full object-cover translate-x-[70%] scale-[2.65]"
                            />
                          </div>
                          <h3 className="text-lg font-bold text-white">Sign In to OrioLiveCall</h3>
                        </div>
                        <span className="text-xs font-mono text-purple-400">ID: {user.userId}</span>
                      </div>

                      <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer hover:border-purple-500/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={google18Checked}
                          onChange={(e) => setGoogle18Checked(e.target.checked)}
                          className="mt-0.5 w-4 h-4 accent-purple-600 rounded cursor-pointer shrink-0"
                        />
                        <span className="text-[11px] text-slate-300 leading-relaxed">
                          I confirm I am <strong className="text-white">18+ years old</strong> and allow Google Sign-In & cookies.
                        </span>
                      </label>

                      <button
                        onClick={() => {
                          if (!google18Checked) {
                            showToast('Please tick the 18+ years confirmation box first.', 'error');
                            return;
                          }
                          handleGoogleSignIn();
                        }}
                        disabled={authLoading}
                        className="w-full py-3 px-4 rounded-xl bg-white text-slate-900 font-bold text-sm shadow-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>{authLoading ? 'Connecting Firebase...' : t.googleSignIn}</span>
                      </button>

                      <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-800"></div>
                        <span className="flex-shrink mx-4 text-slate-500 text-xs uppercase">Or Email</span>
                        <div className="flex-grow border-t border-slate-800"></div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-medium text-slate-300">{t.emailLabel}</label>
                          <input
                            type="email"
                            placeholder="user@example.com"
                            value={emailInput}
                            onChange={(e) => setEmailInput(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-300">{t.passwordLabel}</label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={passInput}
                            onChange={(e) => setPassInput(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm mt-1"
                          />
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setUser(prev => ({ ...prev, email: emailInput || 'user@oriolivecall.com', name: emailInput.split('@')[0] || 'Verified User', verified: true }));
                          setAuthStep('authenticated');
                        }}
                        className="w-full py-3 rounded-xl bg-purple-600 text-white font-semibold text-sm hover:bg-purple-500 transition-all"
                      >
                        Sign In
                      </button>
                      <button
                        onClick={() => setAuthStep('age-verify')}
                        className="w-full text-xs text-purple-400 hover:underline text-center"
                      >
                        Need an account? Register with Calendar Date of Birth
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )}

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6 max-w-7xl mx-auto w-full">
              
              {/* Left Sidebar Controls */}
              <div className="lg:col-span-1 space-y-6">
                
                <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
                      <Sliders className="w-4 h-4" />
                      <span>Free Video Connect</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-950 border border-slate-700 text-slate-300">
                      {chatState === 'searching'
                        ? 'Connecting'
                        : chatState === 'confirming'
                          ? 'Mutual Consent'
                          : chatState === 'connected'
                            ? 'Connected'
                            : chatState === 'reconnecting'
                              ? 'Reconnecting'
                              : chatState === 'disconnected'
                                ? 'Disconnected'
                                : chatState === 'ai-talking'
                                  ? 'AI Talk'
                                  : 'Ready'}
                    </span>
                  </div>

                  {/* Adult 18+ Server Verification Status */}
                  <div className={`p-3 rounded-2xl border flex items-center justify-between gap-2 ${
                    ageVerifyStatus?.verified
                      ? 'bg-emerald-950/30 border-emerald-500/40'
                      : 'bg-amber-950/30 border-amber-500/40'
                  }`}>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                        <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${ageVerifyStatus?.verified ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <span>{ageVerifyStatus?.verified ? '18+ Adult Verified' : '18+ Verification Required'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {ageVerifyStatus?.verified
                          ? `${ageVerifyStatus.method || '18+ Verified'} • Free access unlocked`
                          : 'Required before entering video matching'}
                      </div>
                    </div>
                    {!ageVerifyStatus?.verified && (
                      <button
                        type="button"
                        onClick={() => setAgeModalOpen(true)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 text-[10px] font-extrabold hover:bg-amber-400 shrink-0"
                      >
                        Verify 18+
                      </button>
                    )}
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 text-[10px] text-emerald-200 space-y-1">
                    <div className="font-bold">100% Free Random Video Matching</div>
                    <div className="text-slate-400">No subscription required. No call recording by default.</div>
                  </div>

                  {/* Firebase & Google Account Status Chip */}
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-white flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${firebaseUser ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                        <span>{firebaseUser ? 'Google Firebase Linked' : 'Local Session'}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {firebaseUser?.email || (firebaseOnline ? 'Firestore Ready' : 'Connect Google Account')}
                      </div>
                    </div>
                    {!firebaseUser && (
                      <button
                        onClick={handleGoogleSignIn}
                        disabled={authLoading}
                        className="px-2.5 py-1.5 rounded-lg bg-white text-slate-900 text-[10px] font-bold hover:bg-slate-200 shrink-0"
                      >
                        Google Link
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">{t.selectGender}</label>
                    <p className="text-[10px] text-slate-500">Matched strictly using voluntary profile settings.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(['girls', 'boys', 'any'] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setPreferences({ ...preferences, targetGender: g })}
                          className={`py-2 px-2 text-xs font-semibold rounded-xl border transition-all capitalize ${preferences.targetGender === g ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-300">{t.selectCountry}</label>
                    <select
                      value={preferences.targetCountry}
                      onChange={(e) => setPreferences({ ...preferences, targetCountry: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="all">All Countries (Worldwide)</option>
                      <option value="Bangladesh">Bangladesh</option>
                      <option value="India">India</option>
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                    </select>
                  </div>

                  {/* Quick Pre-Call Camera & Mic & Settings Toggles */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={toggleCamera}
                      className={`py-2.5 px-2 rounded-xl border text-[11px] font-semibold flex flex-col items-center gap-1 transition-all ${isCameraOn ? 'bg-slate-950 border-slate-700 text-emerald-300' : 'bg-rose-950/50 border-rose-500/60 text-rose-300'}`}
                    >
                      {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      <span>{isCameraOn ? 'Cam ON' : 'Cam OFF'}</span>
                    </button>
                    <button
                      onClick={toggleMic}
                      className={`py-2.5 px-2 rounded-xl border text-[11px] font-semibold flex flex-col items-center gap-1 transition-all ${isMicOn ? 'bg-slate-950 border-slate-700 text-emerald-300' : 'bg-rose-950/50 border-rose-500/60 text-rose-300'}`}
                    >
                      {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      <span>{isMicOn ? 'Mic ON' : 'Mic OFF'}</span>
                    </button>
                    <button
                      onClick={() => { refreshDevices(); setShowCallSettings(true); }}
                      className="py-2.5 px-2 rounded-xl border bg-slate-950 border-slate-700 text-purple-300 hover:border-purple-500 text-[11px] font-semibold flex flex-col items-center gap-1 transition-all"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      <span>Settings</span>
                    </button>
                  </div>

                  {(chatState === 'idle' || chatState === 'disconnected') && (
                    <div className="space-y-2.5 pt-1">
                      <button
                        onClick={startMatching}
                        className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 hover:opacity-95 transition-all flex items-center justify-center gap-2"
                      >
                        <PhoneCall className="w-4 h-4" />
                        <span>{t.startChat}</span>
                      </button>
                      <button
                        onClick={startAiGlobalCall}
                        className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-xl shadow-emerald-600/25 hover:opacity-95 transition-all flex items-center justify-center gap-2"
                      >
                        <Bot className="w-4 h-4" />
                        <span>{t.startAiTalk}</span>
                      </button>
                    </div>
                  )}

                  {chatState === 'searching' && (
                    <div className="space-y-2.5">
                      <button
                        onClick={cancelMatching}
                        className="w-full py-3.5 px-4 rounded-2xl bg-rose-600/20 border border-rose-500 text-rose-300 font-semibold text-sm hover:bg-rose-600/30 transition-all flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>{t.cancelSearch}</span>
                      </button>
                      <button
                        onClick={startAiGlobalCall}
                        className="w-full py-2.5 px-4 rounded-xl bg-emerald-600/20 border border-emerald-500/60 text-emerald-300 font-semibold text-xs hover:bg-emerald-600/30 transition-all flex items-center justify-center gap-2"
                      >
                        <Bot className="w-4 h-4" />
                        <span>Switch to AI Global Talk</span>
                      </button>
                    </div>
                  )}

                  {chatState === 'confirming' && (
                    <button
                      onClick={() => handleRespondToMatchProposal(false)}
                      className="w-full py-3 px-4 rounded-xl bg-rose-600/20 border border-rose-500 text-rose-300 font-bold text-xs hover:bg-rose-600/30 transition-all flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      <span>Decline & Cancel Match</span>
                    </button>
                  )}

                  {(chatState === 'connected' || chatState === 'reconnecting' || chatState === 'ai-talking') && (
                    <div className="space-y-2">
                      <button
                        onClick={toggleFullscreen}
                        className="w-full py-3 px-4 rounded-xl bg-indigo-600/25 border border-indigo-500/60 text-indigo-200 font-bold text-xs hover:bg-indigo-600/40 transition-all flex items-center justify-center gap-2"
                      >
                        <Maximize className="w-4 h-4" />
                        <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Video Call'}</span>
                      </button>
                      <button
                        onClick={handleEndCall}
                        className="w-full py-3 px-4 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 transition-all flex items-center justify-center gap-2"
                      >
                        <PhoneOff className="w-4 h-4" />
                        <span>{t.endCall}</span>
                      </button>
                    </div>
                  )}
                </div>

                {chatState === 'connected' && (
                  <div className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs">
                        <Sparkles className="w-4 h-4" />
                        <span>{t.aiIcebreaker}</span>
                      </div>
                      <button
                        onClick={fetchAiIcebreakers}
                        className="text-[10px] text-purple-400 hover:underline"
                      >
                        {loadingIcebreakers ? 'Loading...' : t.generateIcebreaker}
                      </button>
                    </div>
                    <div className="space-y-2 text-xs">
                      {icebreakers.length > 0 ? (
                        icebreakers.map((ib, i) => (
                          <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1">
                            <p className="text-slate-200 font-medium">EN: {ib.english}</p>
                            <p className="text-purple-300">বাংলা: {ib.bengali}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-500 italic text-[11px]">Click 'Get AI Question' for instant bilingual icebreakers.</p>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Main Video Stage (Fullscreen-enabled container including all controls!) */}
              <div className="lg:col-span-3 flex flex-col space-y-4">
                <div
                  ref={videoStageRef}
                  className={`relative flex-1 bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl flex flex-col justify-between ${
                    isFullscreen ? 'w-screen h-screen rounded-none' : 'rounded-3xl min-h-[540px]'
                  }`}
                >
                  {/* Video Background / Remote Stream / Mutual Consent / Reconnecting / Disconnected */}
                  <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                    {(chatState === 'connected' || chatState === 'reconnecting') ? (
                      <>
                        <video
                          ref={remoteVideoRef}
                          autoPlay
                          playsInline
                          muted={!isSpeakerOn}
                          style={getVideoEffectsStyle()}
                          className="w-full h-full object-cover transition-all"
                        />
                        {chatState === 'reconnecting' && (
                          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 p-6 text-center">
                            <RefreshCw className="w-10 h-10 text-amber-400 animate-spin" />
                            <h3 className="text-lg font-bold text-white">Reconnecting WebRTC Peer...</h3>
                            <p className="text-xs text-slate-300">Checking network stability and ICE path.</p>
                            <button
                              onClick={handleEndCall}
                              className="mt-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500"
                            >
                              {t.endCall}
                            </button>
                          </div>
                        )}
                      </>
                    ) : chatState === 'confirming' && proposedMatch ? (
                      <div className="w-full h-full flex items-center justify-center p-6 pb-24 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/40 via-slate-950 to-slate-950">
                        <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900/95 border border-purple-500/50 shadow-2xl space-y-4 text-center">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/40 text-purple-200 text-[11px] font-bold">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Mutual Acceptance Required (18+ Verified Match)</span>
                          </div>
                          <div>
                            <h3 className="text-xl font-extrabold text-white">{proposedMatch.partnerName}</h3>
                            <p className="text-xs text-slate-400 mt-1">
                              {proposedMatch.partnerCountry} • Self-selected profile: <span className="capitalize text-purple-300">{proposedMatch.partnerGender}</span>
                            </p>
                          </div>
                          <p className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
                            Both peers must click Accept before live video &amp; audio connect. No call recording by default.
                          </p>
                          {proposedMatch.acceptedByMe ? (
                            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>Waiting for {proposedMatch.partnerName} to accept...</span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleRespondToMatchProposal(false)}
                                className="py-3 px-4 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-rose-600 hover:text-white transition-all"
                              >
                                Decline
                              </button>
                              <button
                                onClick={() => handleRespondToMatchProposal(true)}
                                className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs hover:opacity-95 shadow-lg transition-all"
                              >
                                Accept Call
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : chatState === 'disconnected' ? (
                      <div className="text-center space-y-4 p-8 pb-24">
                        <div className="w-16 h-16 mx-auto rounded-full bg-rose-600/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                          <PhoneOff className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold text-white">Call Disconnected</h3>
                          <p className="text-xs text-slate-400 max-w-md mx-auto">
                            The live WebRTC call session ended. Start another free global video call or adjust preferences.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <button
                            onClick={startMatching}
                            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xs shadow-lg hover:opacity-95 flex items-center gap-2"
                          >
                            <PhoneCall className="w-4 h-4" />
                            <span>Find Next Person</span>
                          </button>
                          <button
                            onClick={() => setChatState('idle')}
                            className="px-5 py-3 rounded-2xl bg-slate-800 text-slate-200 font-bold text-xs hover:bg-slate-700"
                          >
                            Back to Setup
                          </button>
                        </div>
                      </div>
                    ) : chatState === 'ai-talking' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 pb-28 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/40 via-slate-950 to-slate-950">
                        <div className="relative mb-4">
                          <div className={`w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-500 via-purple-600 to-blue-500 flex items-center justify-center shadow-2xl shadow-purple-500/40 ${aiLiveActive ? 'animate-pulse' : ''}`}>
                            <Bot className="w-14 h-14 text-white" />
                          </div>
                          <span className="absolute -bottom-1 right-0 px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase">
                            {aiLiveConnecting ? 'Connecting' : aiLiveActive ? 'Live Voice' : 'AI Ready'}
                          </span>
                        </div>
                        <h3 className="text-xl font-extrabold text-white">
                          AI Global Partner • {preferences.targetCountry === 'all' ? 'Worldwide' : preferences.targetCountry}
                        </h3>
                        <p className="text-xs text-purple-300 mb-4">
                          Voice: {aiVoiceName} • Bilingual (English / বাংলা)
                        </p>

                        {/* Conversation Transcript & Text/Voice Input Box */}
                        <div className="w-full max-w-xl bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 max-h-60">
                          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {aiTalkMessages.map((m, idx) => (
                              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`px-3 py-2 rounded-xl text-xs max-w-[85%] ${m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-100 border border-slate-700'}`}>
                                  <span>{m.text}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <form onSubmit={handleSendAiTalkText} className="flex gap-2">
                            <input
                              type="text"
                              value={aiPromptInput}
                              onChange={(e) => setAiPromptInput(e.target.value)}
                              placeholder={lang === 'bn' ? 'এআই-এর সাথে কথা বলতে লিখুন...' : 'Speak with mic or type here to talk...'}
                              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-purple-500"
                            />
                            <button
                              type="submit"
                              disabled={aiSendingText}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                            >
                              {aiSendingText ? '...' : 'Talk'}
                            </button>
                          </form>
                        </div>
                      </div>
                    ) : chatState === 'searching' ? (
                      <div className="text-center space-y-4 p-8">
                        <div className="w-20 h-20 mx-auto rounded-full bg-purple-600/20 border-2 border-purple-500/50 flex items-center justify-center animate-spin">
                          <Globe className="w-10 h-10 text-purple-400" />
                        </div>
                        <h3 className="text-lg font-bold text-white">{t.searching}</h3>
                        <p className="text-xs text-slate-400">Connecting only with verified 18+ adults using voluntary profile filters...</p>
                      </div>
                    ) : (
                      <div className="text-center space-y-5 p-8 pb-24">
                        <div className="w-20 h-20 mx-auto rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-purple-400">
                          <Video className="w-8 h-8" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold text-white">Ready to Meet the World?</h3>
                          <p className="text-xs text-slate-400 max-w-md mx-auto">
                            Start a free 1-to-1 global video call with mutual acceptance &amp; verified 18+ safety, or start an AI Global Talk call.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <button
                            onClick={startMatching}
                            className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-extrabold text-sm shadow-lg hover:opacity-95 flex items-center gap-2"
                          >
                            <PhoneCall className="w-4 h-4" />
                            <span>{t.startChat}</span>
                          </button>
                          <button
                            onClick={startAiGlobalCall}
                            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg hover:opacity-95 flex items-center gap-2"
                          >
                            <Bot className="w-4 h-4" />
                            <span>{t.startAiTalk}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Top Partner Status & Dynamic Connection Stability + WebRTC Resolution HUD */}
                  <div className="relative z-20 m-4 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
                    {(chatState === 'connected' || chatState === 'ai-talking') && partnerInfo ? (
                      <div className="pointer-events-auto px-4 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-800 flex items-center gap-3 shadow-lg">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-xs font-bold text-white">{partnerInfo.name}</span>
                        <span className="text-[10px] text-slate-400">({partnerInfo.country})</span>
                        <span className="text-[10px] font-mono text-emerald-300 bg-slate-950 px-2 py-0.5 rounded">
                          {formatDuration(callDurationSec)}
                        </span>
                      </div>
                    ) : (
                      <div />
                    )}

                    {/* Dynamic Connection Stability (Signal Bars) + Live WebRTC Resolution Indicator */}
                    <div className="relative pointer-events-auto">
                      <button
                        type="button"
                        onClick={() => setShowNetworkDetails((v) => !v)}
                        title={lang === 'bn' ? 'নেটওয়ার্ক ও রেজোলিউশন বিস্তারিত দেখুন' : 'Inspect live WebRTC & network stability'}
                        className={`px-3 py-2 rounded-xl bg-slate-900/85 backdrop-blur-md border flex items-center gap-2.5 shadow-lg transition-all hover:bg-slate-900 ${
                          networkStats.status === 'offline' || networkStats.status === 'poor'
                            ? 'border-rose-500/60'
                            : networkStats.status === 'reconnecting' || networkStats.status === 'fair'
                              ? 'border-amber-500/60'
                              : 'border-emerald-500/40'
                        }`}
                      >
                        {/* Signal Strength Bars or Offline Icon */}
                        {networkStats.signalBars === 0 ? (
                          <WifiOff className="w-4 h-4 text-rose-400 animate-pulse" />
                        ) : (
                          <div className="flex items-end gap-[2.5px] h-4" aria-label={`Signal ${networkStats.signalBars} of 4`}>
                            {([1, 2, 3, 4] as const).map((bar) => {
                              const active = networkStats.signalBars >= bar;
                              const barColor =
                                networkStats.signalBars >= 4
                                  ? 'bg-emerald-400'
                                  : networkStats.signalBars === 3
                                    ? 'bg-teal-400'
                                    : networkStats.signalBars === 2
                                      ? 'bg-amber-400'
                                      : 'bg-rose-400';
                              const heights = ['h-1.5', 'h-2.5', 'h-3', 'h-4'];
                              return (
                                <span
                                  key={bar}
                                  className={`w-1 rounded-sm transition-all duration-300 ${heights[bar - 1]} ${
                                    active
                                      ? `${barColor} ${networkStats.status === 'reconnecting' ? 'animate-pulse' : ''}`
                                      : 'bg-slate-700'
                                  }`}
                                />
                              );
                            })}
                          </div>
                        )}

                        {/* Stability Label + Live Latency */}
                        <div className="text-left leading-tight">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold">
                            <span
                              className={
                                networkStats.status === 'offline' || networkStats.status === 'poor'
                                  ? 'text-rose-300'
                                  : networkStats.status === 'reconnecting' || networkStats.status === 'fair'
                                    ? 'text-amber-300'
                                    : 'text-emerald-300'
                              }
                            >
                              {networkStats.status === 'excellent'
                                ? lang === 'bn' ? 'চমৎকার' : 'Excellent'
                                : networkStats.status === 'good'
                                  ? lang === 'bn' ? 'ভালো' : 'Good'
                                  : networkStats.status === 'fair'
                                    ? lang === 'bn' ? 'মাঝারি' : 'Fair'
                                    : networkStats.status === 'poor'
                                      ? lang === 'bn' ? 'দুর্বল' : 'Poor'
                                      : networkStats.status === 'reconnecting'
                                        ? lang === 'bn' ? 'পুনঃসংযোগ...' : 'Reconnecting'
                                        : lang === 'bn' ? 'অফলাইন' : 'Offline'}
                            </span>
                            {networkStats.rttMs !== null && (
                              <span className="text-[10px] font-mono text-slate-400">
                                {networkStats.rttMs}ms
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-300 flex items-center gap-1.5">
                            <span>
                              {networkStats.qualityTier === 'OFF'
                                ? 'Cam OFF'
                                : networkStats.width && networkStats.height
                                  ? `${networkStats.width}×${networkStats.height}`
                                  : 'Measuring...'}
                            </span>
                            {networkStats.fps !== null && networkStats.qualityTier !== 'OFF' && (
                              <span className="text-slate-400">{networkStats.fps}fps</span>
                            )}
                          </div>
                        </div>

                        {/* Resolution Tier Pill (honestly reflects measured track dimensions only) */}
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold tracking-wide ${
                            networkStats.qualityTier === '4K'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : networkStats.qualityTier === 'HD'
                                ? 'bg-purple-500/25 text-purple-200 border border-purple-500/40'
                                : networkStats.qualityTier === 'SD'
                                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                  : networkStats.qualityTier === 'Pending'
                                    ? 'bg-slate-800 text-slate-300 border border-slate-700'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {networkStats.qualityTier}
                        </span>
                      </button>

                      {/* Expandable Real-Time WebRTC Telemetry & Adaptive Quality Popover */}
                      {showNetworkDetails && (
                        <div className="absolute right-0 mt-2 w-72 p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl space-y-3 text-xs z-30">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="font-bold text-white flex items-center gap-1.5">
                              <Activity className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Live WebRTC Telemetry</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowNetworkDetails(false)}
                              className="text-slate-400 hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                              <div className="text-slate-400">Stability</div>
                              <div className="font-bold text-white capitalize">
                                {networkStats.status} ({networkStats.signalBars}/4)
                              </div>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                              <div className="text-slate-400">Measured Res</div>
                              <div className="font-bold text-purple-300 font-mono">
                                {networkStats.width && networkStats.height
                                  ? `${networkStats.width}×${networkStats.height}`
                                  : networkStats.qualityTier}
                              </div>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                              <div className="text-slate-400">Latency (RTT)</div>
                              <div className="font-bold text-emerald-300 font-mono">
                                {networkStats.rttMs !== null ? `${networkStats.rttMs} ms` : 'Measuring...'}
                              </div>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                              <div className="text-slate-400">Bitrate / ICE</div>
                              <div className="font-bold text-sky-300 font-mono truncate">
                                {networkStats.bitrateKbps !== null
                                  ? `${networkStats.bitrateKbps} kbps`
                                  : webrtcConfig.turnConfigured
                                    ? 'STUN+TURN'
                                    : 'STUN'}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                            <span className="text-[11px] text-slate-300 font-medium">Adaptive Bitrate</span>
                            <button
                              type="button"
                              onClick={() => setAutoAdaptiveQuality((v) => !v)}
                              className={`w-10 h-5 rounded-full transition-colors relative p-0.5 ${autoAdaptiveQuality ? 'bg-emerald-500' : 'bg-slate-700'}`}
                            >
                              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${autoAdaptiveQuality ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-1.5">
                            {(['SD', 'HD', '4K'] as VideoQuality[]).map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => {
                                  setVideoQuality(q);
                                  if (isCameraOn) requestCameraPermission(q);
                                }}
                                className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                                  videoQuality === q ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
                                }`}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Local PiP Camera Preview (Shows Camera Off overlay cleanly when off) */}
                  <div className="absolute bottom-24 right-6 z-20 w-44 h-32 rounded-2xl bg-slate-950 border-2 border-slate-800 overflow-hidden shadow-2xl">
                    {isCameraOn ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={getVideoEffectsStyle()}
                        className={`w-full h-full object-cover transition-all ${facingMode === 'user' ? 'transform -scale-x-100' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 gap-1.5">
                        <VideoOff className="w-6 h-6 text-rose-400" />
                        <span className="text-[10px] font-semibold text-rose-300">Camera Off</span>
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-[10px] text-slate-300 flex items-center justify-between w-[calc(100%-16px)]">
                      <span>You</span>
                      <span className="text-purple-400 font-bold">{isCameraOn ? networkStats.qualityTier : 'OFF'}</span>
                    </div>
                  </div>

                  {/* Inline Call Settings Drawer (Works in Normal & Fullscreen!) */}
                  {showCallSettings && (
                    <div className="absolute bottom-24 left-6 z-30 w-80 p-5 rounded-3xl bg-slate-900/95 backdrop-blur-xl border border-purple-500/40 shadow-2xl space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <SettingsIcon className="w-4 h-4 text-purple-400" />
                          <span>Call Settings (Audio & Video)</span>
                        </span>
                        <button onClick={() => setShowCallSettings(false)} className="text-slate-400 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-400">Camera Device</label>
                          <select
                            value={selectedCameraId}
                            onChange={(e) => {
                              setSelectedCameraId(e.target.value);
                              if (isCameraOn) requestCameraPermission(videoQuality, e.target.value, selectedMicId, true, isMicOn);
                            }}
                            className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                          >
                            {availableCameras.length > 0 ? (
                              availableCameras.map((cam, i) => (
                                <option key={cam.deviceId || i} value={cam.deviceId}>
                                  {cam.label || `Camera ${i + 1}`}
                                </option>
                              ))
                            ) : (
                              <option value="">Default Camera</option>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-400">Microphone Device</label>
                          <select
                            value={selectedMicId}
                            onChange={(e) => {
                              setSelectedMicId(e.target.value);
                              if (isMicOn) requestCameraPermission(videoQuality, selectedCameraId, e.target.value, isCameraOn, true);
                            }}
                            className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                          >
                            {availableMics.length > 0 ? (
                              availableMics.map((mic, i) => (
                                <option key={mic.deviceId || i} value={mic.deviceId}>
                                  {mic.label || `Microphone ${i + 1}`}
                                </option>
                              ))
                            ) : (
                              <option value="">Default Microphone</option>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-400">AI Global Voice</label>
                          <select
                            value={aiVoiceName}
                            onChange={(e) => setAiVoiceName(e.target.value as any)}
                            className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                          >
                            {['Zephyr', 'Kore', 'Puck', 'Fenrir', 'Charon'].map((v) => (
                              <option key={v} value={v}>{v}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-300">Camera Status</span>
                          <button
                            onClick={toggleCamera}
                            className={`px-3 py-1 rounded-lg font-bold ${isCameraOn ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                          >
                            {isCameraOn ? 'ON' : 'OFF'}
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-300">Microphone Status</span>
                          <button
                            onClick={toggleMic}
                            className={`px-3 py-1 rounded-lg font-bold ${isMicOn ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                          >
                            {isMicOn ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Advanced Video Controls & Filters Menu */}
                  {showFilterMenu && (
                    <div className="absolute bottom-24 right-6 z-30 w-72 p-5 rounded-3xl bg-slate-900/95 backdrop-blur-xl border border-purple-500/40 shadow-2xl space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                          <Wand2 className="w-4 h-4 text-purple-400" />
                          <span>HD Video & Beauty Filters</span>
                        </span>
                        <button onClick={() => setShowFilterMenu(false)} className="text-slate-400 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-400">Resolution (Adaptive)</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['SD', 'HD', '4K'] as VideoQuality[]).map(q => (
                            <button
                              key={q}
                              onClick={() => {
                                setVideoQuality(q);
                                if (isCameraOn) requestCameraPermission(q);
                              }}
                              className={`py-1.5 rounded-xl text-xs font-bold transition-all ${videoQuality === q ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-400">AR Filter</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(['none', 'neon', 'vintage', 'cosmic', 'rainbow', 'sunset'] as ArFilter[]).map(f => (
                            <button
                              key={f}
                              onClick={() => setActiveFilter(f)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize text-left transition-all ${activeFilter === f ? 'bg-purple-600 text-white font-bold' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-slate-400">Lighting Effects</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'normal', label: 'Normal' },
                            { id: 'studio', label: 'Studio Glow' },
                            { id: 'contour', label: 'Contour' },
                            { id: 'warm', label: 'Warm Tone' }
                          ].map(l => (
                            <button
                              key={l.id}
                              onClick={() => setLightingEffect(l.id as any)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-medium text-left transition-all ${lightingEffect === l.id ? 'bg-purple-600 text-white font-bold' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'}`}
                            >
                              {l.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                        <span className="text-xs text-slate-300 font-medium">Background Blur</span>
                        <button
                          onClick={() => setBgBlur(!bgBlur)}
                          className={`w-11 h-6 rounded-full transition-colors relative p-1 ${bgBlur ? 'bg-purple-600' : 'bg-slate-800'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${bgBlur ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Unified Bottom Floating Call Controls Bar (Works in Normal & Fullscreen!) */}
                  <div className="relative z-20 mt-auto p-3.5 m-4 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 flex flex-wrap items-center justify-center gap-2.5 shadow-2xl">
                    <button
                      onClick={toggleCamera}
                      className={`p-3 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${isCameraOn ? 'bg-slate-800 border-slate-700 text-white' : 'bg-rose-600/20 border-rose-500 text-rose-400'}`}
                      title={isCameraOn ? 'Turn Camera OFF' : 'Turn Camera ON'}
                    >
                      {isCameraOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                      <span className="hidden sm:inline">{isCameraOn ? 'Cam ON' : 'Cam OFF'}</span>
                    </button>

                    <button
                      onClick={toggleMic}
                      className={`p-3 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${isMicOn ? 'bg-slate-800 border-slate-700 text-white' : 'bg-rose-600/20 border-rose-500 text-rose-400'}`}
                      title={isMicOn ? 'Mute Mic' : 'Unmute Mic'}
                    >
                      {isMicOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                      <span className="hidden sm:inline">{isMicOn ? 'Mic ON' : 'Muted'}</span>
                    </button>

                    <button
                      onClick={toggleSpeaker}
                      className={`p-3 rounded-xl border transition-all ${isSpeakerOn ? 'bg-slate-800 border-slate-700 text-white' : 'bg-rose-600/20 border-rose-500 text-rose-400'}`}
                      title={isSpeakerOn ? 'Speaker ON' : 'Speaker OFF'}
                    >
                      {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={switchCamera}
                      className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 transition-colors"
                      title="Switch Front/Back Camera"
                    >
                      <RefreshIcon className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => { refreshDevices(); setShowCallSettings(!showCallSettings); setShowFilterMenu(false); }}
                      className={`px-3 py-3 rounded-xl border font-semibold text-xs transition-all flex items-center gap-1.5 ${showCallSettings ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'}`}
                      title="Call Settings"
                    >
                      <SettingsIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">Settings</span>
                    </button>

                    <button
                      onClick={() => { setShowFilterMenu(!showFilterMenu); setShowCallSettings(false); }}
                      className={`px-3 py-3 rounded-xl border font-semibold text-xs transition-all flex items-center gap-1.5 ${showFilterMenu || activeFilter !== 'none' || bgBlur ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'}`}
                      title="HD Video, Beauty & AR Filters"
                    >
                      <Wand2 className="w-4 h-4 text-purple-300" />
                      <span className="hidden sm:inline">HD & Filters</span>
                    </button>

                    <button
                      onClick={toggleFullscreen}
                      className={`px-3 py-3 rounded-xl border font-semibold text-xs transition-all flex items-center gap-1.5 ${isFullscreen ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'}`}
                      title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Call'}
                    >
                      {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                      <span className="hidden sm:inline">{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
                    </button>

                    {(chatState === 'connected' || chatState === 'reconnecting' || chatState === 'ai-talking') && (
                      <>
                        {chatState !== 'ai-talking' && partnerInfo && (
                          <>
                            <button
                              onClick={() => handleOpenReport('user', partnerInfo.name)}
                              className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 hover:bg-amber-600/20 hover:border-amber-500/50 transition-all"
                              title="Report Partner"
                            >
                              <Flag className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                const myId = user.email || user.userId || 'guest-user';
                                if (socket && partnerInfo.socketId) {
                                  socket.emit('block-user', {
                                    targetSocketId: partnerInfo.socketId,
                                    targetUserId: partnerInfo.userId || partnerInfo.name,
                                    reason: 'Blocked during live video call',
                                  });
                                } else {
                                  await fetch('/api/privacy/block', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      userId: myId,
                                      blockedUserId: partnerInfo.userId || partnerInfo.name,
                                      blockedName: partnerInfo.name,
                                      reason: 'Blocked during live video call',
                                    }),
                                  }).catch(() => {});
                                }
                                showToast(`${partnerInfo.name} blocked and call ended.`, 'success');
                                handleEndCall();
                              }}
                              className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 hover:bg-rose-600 hover:text-white transition-all"
                              title="Block & End Call"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => {
                            setGiftTargetName(partnerInfo?.name || 'Partner');
                            setShowGiftModal(true);
                          }}
                          className="px-3.5 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all flex items-center gap-1.5"
                        >
                          <Gift className="w-4 h-4" />
                          <span className="hidden md:inline">Gift</span>
                        </button>

                        <button
                          onClick={handleNextPerson}
                          className="px-4 py-3 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 transition-all flex items-center gap-1.5"
                        >
                          <SkipForward className="w-4 h-4" />
                          <span>{t.nextPerson}</span>
                        </button>

                        <button
                          onClick={handleEndCall}
                          className="px-4 py-3 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 transition-all flex items-center gap-1.5"
                        >
                          <PhoneOff className="w-4 h-4" />
                          <span>{t.endCall}</span>
                        </button>
                      </>
                    )}
                  </div>

                  {postCallFeedbackSession && isFullscreen && (
                    <PostCallRatingModal
                      lang={lang}
                      session={postCallFeedbackSession}
                      submitting={submittingCallRating}
                      isFullscreenStage={true}
                      onSubmit={handleSubmitPostCallRating}
                      onSkip={() => proceedAfterPostCallRating(postCallFeedbackSession)}
                      onReportIssue={() => {
                        const reportedTarget = postCallFeedbackSession.partnerName || 'call-partner';
                        setPostCallFeedbackSession(null);
                        if (document.fullscreenElement) {
                          document.exitFullscreen().catch(() => {});
                        }
                        handleOpenReport('user', reportedTarget);
                      }}
                    />
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* --- 2A. GLOBAL FRIENDS DISCOVERY & REQUESTS TAB --- */}
        {activeTab === 'friends' && (
          <GlobalFriendsView
            lang={lang}
            currentUserId={user.email || user.userId || 'guest-user'}
            currentUserName={user.name || 'Orio Member'}
            currentUserProfileId={user.profileId}
            currentUserAvatar={user.avatar}
            currentUserCountry={user.country}
            privacy={msgPrivacy}
            firebaseUser={firebaseUser}
            socket={socket}
            onStartPrivateMessage={(peerId) => {
              setSelectedDmPeer(peerId);
              setActiveTab('messages');
              fetchMessages();
              fetchMyFriends();
            }}
            onOpenReport={(targetType, targetId) => handleOpenReport(targetType, targetId)}
            onRefreshPrivacyAndMessages={() => {
              fetchMessages();
              fetchMyFriends();
            }}
            showToast={showToast}
          />
        )}

        {/* --- 2B. VIDEO SEARCH, FREE WATCH & PRIVATE ACCESS TAB --- */}
        {activeTab === 'videos' && (
          <VideoDiscoveryWatch
            lang={lang}
            currentUserId={user.email || user.userId || 'guest-user'}
            creators={creators}
            follows={follows}
            subscriptions={subscriptions}
            followerCounts={followerCounts}
            subscriberCounts={subscriberCounts}
            onToggleFollow={handleToggleFollow}
            onOpenSubscribeModal={(cid, cname) => {
              const found = creators.find((c) => c.id === cid) || {
                id: cid,
                name: cname,
                username: `@${cname.toLowerCase().replace(/\s+/g, '_')}`,
                country: 'Global',
                gender: 'Female',
                avatar: user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                bio: 'OrioLiveCall Creator',
                creatorBadge: true,
                online: true,
                subscribersCount: subscriberCounts[cid] || 0,
                monthlyPrice: 19.99,
                yearlyPrice: 149.99,
              };
              setSubTargetCreator(found);
              setShowSubscriptionModal(true);
            }}
            onOpenGiftModal={(creatorName) => {
              setGiftTargetName(creatorName);
              setShowGiftModal(true);
            }}
            onOpenReport={(targetType, targetId) => handleOpenReport(targetType, targetId)}
            onSyncLikeFirestore={(videoId, liked) => {
              if (firebaseUser) {
                toggleVideoLikeInFirestore(firebaseUser, videoId, liked).catch(() => {});
              }
            }}
            showToast={showToast}
          />
        )}

        {/* --- 3. GLOBAL COMMUNITY TAB --- */}
        {activeTab === 'community' && (
          <div className="max-w-7xl mx-auto p-8 space-y-8 w-full flex-1">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
                <Users className="w-8 h-8 text-purple-400" />
                <span>Global Community & Verified Creators</span>
              </h1>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative w-64 sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={profileSearchQuery}
                    onChange={(e) => searchProfilesDirectory(e.target.value)}
                    placeholder="Search Profile ID (ORI-100001) or name..."
                    className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <button
                  onClick={() => setActiveTab('videos')}
                  className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-xs font-bold text-purple-200 hover:bg-purple-600/30 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  <span>Watch Free Videos</span>
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {(profileSearchQuery.trim() ? profileDirectoryResults : (profileDirectoryResults.length > 0 ? profileDirectoryResults : creators)).map(creator => {
                const isFollowing = follows.includes(creator.id);
                const realFollowers = followerCounts[creator.id] ?? 0;
                const realSubs = subscriberCounts[creator.id] ?? creator.subscribersCount ?? 0;
                return (
                  <div key={creator.id} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4 flex flex-col justify-between">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-4">
                        <img src={creator.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover border-2 border-purple-500" />
                        <div>
                          <h3 className="font-bold text-white text-base">{creator.name}</h3>
                          {creator.profileId && (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-purple-600/20 border border-purple-500/30 text-[10px] font-mono text-purple-300 mt-0.5">
                              {creator.profileId}
                            </span>
                          )}
                          <p className="text-xs text-purple-300 mt-0.5">
                            {creator.country} • {realFollowers} Followers • {realSubs} Subs
                          </p>
                          <span className={`inline-flex items-center gap-1 text-[10px] mt-1 font-semibold ${creator.online ? 'text-emerald-400' : 'text-slate-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${creator.online ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                            {creator.online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenReport('user', creator.id)}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-rose-400"
                        title="Report User"
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-300">{creator.bio}</p>
                    <div className="grid grid-cols-4 gap-2">
                      <button onClick={() => setSelectedProfileForModal(creator)} className="py-2 px-2 rounded-xl bg-slate-950 text-slate-200 text-xs font-semibold hover:bg-slate-800">Profile</button>
                      <button
                        onClick={() => handleToggleFollow(creator.id)}
                        className={`py-2 px-2 rounded-xl text-xs font-semibold ${isFollowing ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-950 text-slate-200 hover:bg-slate-800'}`}
                      >
                        {isFollowing ? 'Following' : 'Follow'}
                      </button>
                      <button onClick={() => { setGiftTargetName(creator.name); setShowGiftModal(true); }} className="py-2 px-2 rounded-xl bg-amber-500/10 text-amber-300 text-xs font-semibold hover:bg-amber-500/20">Gift</button>
                      <button onClick={() => { setSubTargetCreator(creator); setShowSubscriptionModal(true); }} className="py-2 px-2 rounded-xl bg-purple-600 text-white text-xs font-bold">Join</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- 4. LIVE MESSAGING, REQUESTS & PRIVACY CONTROLS TAB --- */}
        {activeTab === 'messages' && (
          <MessagingAndPrivacyView
            currentUserId={user.email || user.userId || 'guest-user'}
            contacts={creators}
            friends={myFriendsList}
            initialSelectedPeer={selectedDmPeer}
            messages={messages}
            requests={messageRequests}
            onlineUserIds={onlineUserIds}
            privacy={msgPrivacy}
            onRefreshMessages={() => { fetchMessages(); fetchMyFriends(); }}
            onUpdatePrivacy={handleUpdateMsgPrivacy}
            onUpdateExtendedPrivacy={handleUpdateExtendedPrivacy}
            onOpenGiftModal={(targetName) => {
              setGiftTargetName(targetName);
              setShowGiftModal(true);
            }}
            onOpenReport={(targetType, targetId) => handleOpenReport(targetType, targetId)}
            showToast={showToast}
          />
        )}

        {/* --- 5. HOT SHORTS TAB --- */}
        {activeTab === 'shorts' && (
          <div className="max-w-xl mx-auto p-6 flex-1 flex flex-col items-center justify-center relative w-full space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchShorts(shortsSearch);
              }}
              className="w-full max-w-sm flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={shortsSearch}
                  onChange={(e) => setShortsSearch(e.target.value)}
                  placeholder="Search shorts or #hashtags..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <button type="submit" className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold">
                Find
              </button>
            </form>

            <div className="relative w-full max-w-sm h-[580px] bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col justify-between">
              {shorts.length > 0 ? (
                <>
                  <video src={shorts[currentShortIdx]?.videoUrl} autoPlay loop playsInline className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/40 pointer-events-none"></div>
                  <div className="relative z-10 p-5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <img src={shorts[currentShortIdx]?.creatorAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-purple-400" />
                      <span className="font-bold text-white text-sm">{shorts[currentShortIdx]?.creatorName}</span>
                    </div>
                    <button
                      onClick={() => handleOpenReport('short', shorts[currentShortIdx].id)}
                      className="p-2 rounded-xl bg-black/50 text-slate-300 hover:text-rose-400"
                      title="Report Short"
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="relative z-10 p-5 space-y-3">
                    <p className="text-xs text-slate-100">{shorts[currentShortIdx]?.description}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => {
                          const s = shorts[currentShortIdx];
                          const res = await fetch('/api/shorts/like', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ shortId: s.id }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setShorts(prev => prev.map((item, idx) => idx === currentShortIdx ? { ...item, likes: data.likes } : item));
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Heart className="w-3.5 h-3.5" />
                        <span>{shorts[currentShortIdx]?.likes || 0}</span>
                      </button>
                      <button
                        onClick={() => {
                          setGiftTargetName(shorts[currentShortIdx]?.creatorName || 'Creator');
                          setShowGiftModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        <span>Gift</span>
                      </button>
                      <div className="flex-1" />
                      <button onClick={() => setCurrentShortIdx((currentShortIdx - 1 + shorts.length) % shorts.length)} className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs">Prev</button>
                      <button onClick={() => setCurrentShortIdx((currentShortIdx + 1) % shorts.length)} className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold">Next</button>
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!shortCommentInput.trim()) return;
                        const res = await fetch('/api/shorts/comment', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            shortId: shorts[currentShortIdx].id,
                            user: user.name,
                            text: shortCommentInput.trim(),
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          showToast(data.error || 'Comment blocked by moderation', 'error');
                          return;
                        }
                        setShorts(prev => prev.map((item, idx) => idx === currentShortIdx ? { ...item, comments: data.comments, commentsCount: data.comments.length } : item));
                        setShortCommentInput('');
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={shortCommentInput}
                        onChange={(e) => setShortCommentInput(e.target.value)}
                        placeholder="Add respectful comment..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-black/60 border border-slate-700 text-xs text-white"
                      />
                      <button type="submit" className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-bold">Post</button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 m-auto">No shorts matched your search.</div>
              )}
            </div>
          </div>
        )}

        {/* --- 6. FREE & PREMIUM GLOBAL LIVESTREAMS TAB --- */}
        {activeTab === 'live' && (
          <LiveStreamsHub
            currentUserId={user.email || user.userId || 'guest-user'}
            currentUserName={user.name}
            socket={socket}
            follows={follows}
            onToggleFollow={handleToggleFollow}
            onOpenGiftModal={(creatorName) => {
              setGiftTargetName(creatorName);
              setShowGiftModal(true);
            }}
            onOpenReport={(targetType, targetId) => handleOpenReport(targetType, targetId)}
            onWalletUpdated={fetchWallet}
            showToast={showToast}
          />
        )}

        {/* --- 7. DISCOVER CREATORS TAB (WITH PROFILE ID SEARCH) --- */}
        {activeTab === 'creators' && (
          <div className="max-w-6xl mx-auto p-8 space-y-6 w-full flex-1">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-3xl font-bold text-white">Discover Global Creators</h1>
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={profileSearchQuery}
                  onChange={(e) => searchProfilesDirectory(e.target.value)}
                  placeholder="Search by Profile ID (ORI-100001) or @username..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {(profileSearchQuery.trim() ? profileDirectoryResults : (profileDirectoryResults.length > 0 ? profileDirectoryResults : creators)).map(c => (
                <div key={c.id} onClick={() => setSelectedProfileForModal(c)} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 cursor-pointer hover:border-purple-500 transition-colors space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <img src={c.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover border border-purple-500/40" />
                    {c.profileId && (
                      <span className="px-2.5 py-1 rounded-lg bg-purple-600/20 border border-purple-500/30 font-mono text-[11px] font-bold text-purple-300">
                        {c.profileId}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{c.name}</h3>
                    <div className="text-[11px] text-slate-400">{c.username} • {c.country}</div>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-2">{c.bio}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- 8. MY PROFILE TAB (EASY PROFILE ID, COPY, SHARE LINK & SEARCH) --- */}
        {activeTab === 'profile' && (
          <div className="max-w-4xl mx-auto p-8 space-y-6 w-full flex-1">
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <img src={user.avatar} alt="" className="w-24 h-24 rounded-3xl object-cover border-4 border-purple-500" />
                <div className="space-y-2 text-center md:text-left flex-1">
                  <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                    <span className="px-3 py-1 rounded-xl bg-purple-600/25 border border-purple-500/50 text-xs font-mono font-bold text-purple-200">
                      Profile ID: {user.profileId || 'ORI-100004'}
                    </span>
                    <button
                      onClick={() => handleCopyProfileId(user.profileId || 'ORI-100004')}
                      className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white flex items-center gap-1.5"
                    >
                      {copiedProfileId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                      <span>{copiedProfileId ? 'Copied ID' : 'Copy Profile ID'}</span>
                    </button>
                    <button
                      onClick={() => handleShareProfileLink(user.profileId || 'ORI-100004')}
                      className="px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white flex items-center gap-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Share Profile Link</span>
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-slate-400">Account Ref: {user.userId}</p>
                  <p className="text-xs text-slate-400">{user.email} • {user.country}</p>
                  <p className="text-xs text-slate-300">{user.bio}</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
                <span>Your unique <strong className="text-purple-300">ORI-XXXXXX</strong> Profile ID stays permanently unchanged unless an authorized account migration is requested.</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('subscriptions')}
                    className="px-3 py-1.5 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-200 font-bold"
                  >
                    Subscriptions
                  </button>
                  <button
                    onClick={() => setActiveTab('payment-methods')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 font-bold"
                  >
                    Payment Methods
                  </button>
                </div>
              </div>

              {!firebaseUser && (
                <button
                  onClick={handleGoogleSignIn}
                  className="px-5 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold shadow-lg"
                >
                  Connect Google Firebase Account
                </button>
              )}
            </div>

            {/* Search Profile ID Directory right from My Profile */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-base font-bold text-white">Find Any Account by Profile ID or Username</h2>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={profileSearchQuery}
                    onChange={(e) => searchProfilesDirectory(e.target.value)}
                    placeholder="Enter ORI-100001 or @username..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                {(profileDirectoryResults.length > 0 ? profileDirectoryResults : creators).slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfileForModal(p)}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500 text-left flex items-center gap-3 transition-colors"
                  >
                    <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">{p.name}</div>
                      <div className="text-[10px] font-mono text-purple-300">{p.profileId || p.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- 9. CREATOR DASHBOARD TAB --- */}
        {activeTab === 'creator-dashboard' && (
          <CreatorDashboardView
            creatorId={user.email || user.userId || 'guest-user'}
            creatorName={user.name}
            creatorAvatar={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
            onSyncVideoFirestore={(video) => {
              if (firebaseUser) saveVideoToFirestore(firebaseUser, video).catch(() => {});
            }}
            onSyncLiveFirestore={(streamItem) => {
              if (firebaseUser) saveLiveStreamToFirestore(firebaseUser, streamItem).catch(() => {});
            }}
            showToast={showToast}
          />
        )}

        {/* --- 10-13. WALLET & MONEY SYSTEM TABS --- */}
        {['wallet', 'send-money', 'receive-money', 'history'].includes(activeTab) && (
          <div className="max-w-6xl mx-auto p-8 space-y-8 w-full flex-1">
            <div className="flex flex-wrap justify-between items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white">Wallet & Global Financial Ledger</h1>
                <p className="text-xs text-slate-400 mt-1">Profile ID: {user.profileId || user.userId}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setActiveTab('payment-methods')}
                  className="px-4 py-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-xs font-bold text-purple-200 hover:bg-purple-600/30 flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <span>Payment Methods Center</span>
                </button>
                <div className="text-xl font-extrabold text-emerald-400">${wallet?.balance?.toFixed(2) || '1850.00'} USD</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <form onSubmit={handleSendMoney} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-base font-bold text-white">Send Money</h3>
                <input
                  type="text"
                  required
                  placeholder="Recipient Email or ORIO-ID"
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Amount (USD)"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Note"
                  value={sendDesc}
                  onChange={(e) => setSendDesc(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <button type="submit" className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold">Transfer Funds</button>
              </form>

              <form onSubmit={handleWithdraw} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
                <h3 className="text-base font-bold text-white">Withdraw Funds</h3>
                <select
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="bKash / Mobile Banking">bKash / Mobile Banking</option>
                  <option value="Bank Wire Transfer">International Bank Wire</option>
                  <option value="Visa / Mastercard">Visa / Mastercard</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Withdrawal Amount (USD)"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold">Request Withdrawal</button>
              </form>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white">Transaction History & Receipts</h3>
              <div className="space-y-2">
                {wallet?.transactions?.map((tx, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-slate-950 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-mono text-purple-300">{tx.txId}</div>
                      <div className="text-slate-400">{tx.description}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-emerald-400">${tx.amount.toFixed(2)}</span>
                      {tx.status === 'completed' && (
                        <button onClick={() => setSelectedTxForDispute(tx.txId)} className="text-purple-400 hover:underline">Dispute</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {selectedTxForDispute && (
                <div className="p-4 rounded-2xl bg-slate-950 border border-purple-700 space-y-2">
                  <input
                    type="text"
                    placeholder="Reason for dispute..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleDispute} className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold">Submit</button>
                    <button onClick={() => setSelectedTxForDispute(null)} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- 14. GIFT SHOP TAB --- */}
        {activeTab === 'gifts' && (
          <div className="max-w-6xl mx-auto p-8 space-y-6 w-full flex-1">
            <h1 className="text-3xl font-bold text-white">Virtual Gift Shop</h1>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { name: 'Red Rose 🌹', price: 10 },
                { name: 'Diamond Crown 👑', price: 50 },
                { name: 'Super Star ⭐', price: 100 },
                { name: 'Luxury Car 🏎️', price: 500 }
              ].map(g => (
                <div key={g.name} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
                  <div className="text-4xl">🎁</div>
                  <div className="font-bold text-white">{g.name}</div>
                  <div className="text-amber-400 font-bold">${g.price} USD</div>
                  <button onClick={() => { setGiftTargetName('Creator'); setShowGiftModal(true); }} className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold">Send Gift</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- 15. SUBSCRIPTION PURCHASE CENTER TAB --- */}
        {activeTab === 'subscriptions' && (
          <SubscriptionCenterView
            currentUserId={user.email || user.userId || 'guest-user'}
            walletBalance={wallet?.balance ?? 1850}
            creators={profileDirectoryResults.length > 0 ? profileDirectoryResults : creators}
            follows={follows}
            subscriptions={subscriptions}
            followerCounts={followerCounts}
            subscriberCounts={subscriberCounts}
            recentCreatorUploads={recentCreatorUploads}
            firebaseUser={firebaseUser}
            onToggleFollow={handleToggleFollow}
            onRefreshAll={() => {
              fetchSubscriptions();
              fetchWallet();
            }}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            showToast={showToast}
          />
        )}

        {/* --- 15B. PAYMENT METHODS CENTER TAB --- */}
        {activeTab === 'payment-methods' && (
          <PaymentMethodsCenterView
            currentUserId={user.email || user.userId || 'guest-user'}
            walletBalance={wallet?.balance ?? 1850}
            firebaseUser={firebaseUser}
            onWalletUpdated={fetchWallet}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            showToast={showToast}
          />
        )}

        {/* --- 16. NOTIFICATIONS TAB --- */}
        {activeTab === 'notifications' && (
          <div className="max-w-4xl mx-auto p-8 space-y-6 w-full flex-1">
            <h1 className="text-3xl font-bold text-white">Browser & Platform Notifications</h1>
            <div className="space-y-3">
              {appNotifications.map(n => (
                <div key={n.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-200">{n.title}</span>
                  <span className="text-slate-500">{n.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- 17. PRIVACY & SETTINGS TAB --- */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto p-8 space-y-6 w-full flex-1">
            <h1 className="text-3xl font-bold text-white">Privacy, Camera & Call Settings</h1>
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-slate-800">
                <span>Camera Default State</span>
                <button
                  onClick={toggleCamera}
                  className={`px-3 py-1.5 rounded-lg font-bold ${isCameraOn ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                >
                  {isCameraOn ? 'Camera ON' : 'Camera OFF'}
                </button>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800">
                <span>Microphone Default State</span>
                <button
                  onClick={toggleMic}
                  className={`px-3 py-1.5 rounded-lg font-bold ${isMicOn ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}
                >
                  {isMicOn ? 'Mic ON' : 'Mic OFF'}
                </button>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800">
                <span>Google Firebase Sync</span>
                <span className="font-mono text-purple-300">{firebaseUser ? firebaseUser.email : 'Not Linked'}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-800">
                <span>Browser Push Notifications</span>
                <button
                  onClick={() => {
                    setNotificationsEnabled(true);
                    showToast(notificationsEnabled ? 'Notifications already active!' : 'Browser notifications enabled!', 'success');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-bold"
                >
                  {notificationsEnabled ? 'Enabled' : 'Enable'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- 18-21. LEGAL, SAFETY RULES & SUPPORT PAGES --- */}
        {['help', 'privacy-policy', 'terms', 'guidelines'].includes(activeTab) && (
          <div className="max-w-4xl mx-auto p-8 space-y-6 w-full flex-1">
            <h1 className="text-3xl font-bold text-white capitalize">{activeTab.replace('-', ' ')}</h1>
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-sm text-slate-300 leading-relaxed space-y-4">
              <p><strong className="text-white">18+ Strict Eligibility & License Disclaimer:</strong> OrioLiveCall is exclusively for verified adults aged 18+. Use of this site constitutes acceptance of our age requirement, essential security cookies, and safety rules.</p>
              <p><strong className="text-white">Non-Explicit Safe Content Only:</strong> Sexually explicit, abusive, violent, or illegal uploads, livestreams, and messages are strictly prohibited. Automated keyword filters and human moderation actively review reports.</p>
              <p><strong className="text-white">Private Content & Privacy-First Defaults:</strong> Private videos and paid premium livestreams enforce server-side access permissions; unauthorized links cannot be accessed. Default messaging rules route unknown senders to Message Requests, and users may block or report anyone anytime.</p>
              <p><strong className="text-white">WebRTC Calls:</strong> All 1-on-1 live video calls require explicit camera/microphone consent and run peer-to-peer without server video recording.</p>
            </div>
          </div>
        )}

        {/* --- 22. ADMIN & SAFETY MODERATION DASHBOARD --- */}
        {activeTab === 'admin' && (
          <div className="max-w-6xl mx-auto p-8 space-y-6 w-full flex-1">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <ShieldAlert className="w-8 h-8 text-rose-500" />
                <span>Admin & Safety Moderation Dashboard</span>
              </h1>
              <button
                onClick={fetchModerationReports}
                className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
              >
                Refresh Queue
              </button>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400">Firebase Project</div>
                <div className="text-sm font-bold text-emerald-400">{firebaseOnline ? 'Connected & Rules Deployed' : 'Checking...'}</div>
              </div>
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400">Open Moderation Reports</div>
                <div className="text-2xl font-bold text-rose-400">
                  {moderationReports.filter(r => r.status === 'pending').length}
                </div>
              </div>
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400">Automated Safety Filter</div>
                <div className="text-2xl font-bold text-purple-400">Active</div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h2 className="text-lg font-bold text-white">Reported Content & Human Moderation Queue</h2>
              {moderationReports.length === 0 ? (
                <p className="text-xs text-slate-400">No safety reports submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {moderationReports.map(rep => (
                    <div key={rep.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="font-bold text-white">
                          [{rep.targetType.toUpperCase()}] {rep.targetId}
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] ${rep.status === 'pending' ? 'bg-amber-500/20 text-amber-300' : rep.status === 'removed' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                            {rep.status}
                          </span>
                        </div>
                        <div className="text-slate-400">Reason: {rep.reason} • Reporter: {rep.reporterId}</div>
                      </div>
                      {rep.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={async () => {
                              await fetch('/api/moderation/resolve', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reportId: rep.id, decision: 'approve_safe' }),
                              });
                              fetchModerationReports();
                              showToast('Marked content safe.', 'info');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold"
                          >
                            Approve Safe
                          </button>
                          <button
                            onClick={async () => {
                              await fetch('/api/moderation/resolve', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ reportId: rep.id, decision: 'remove' }),
                              });
                              fetchModerationReports();
                              showToast('Content removed.', 'success');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold"
                          >
                            Remove Content
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-white">Post-Call Quality & Experience Ratings</h2>
                <button
                  type="button"
                  onClick={fetchCallRatings}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Refresh Ratings
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Total Call Ratings</div>
                  <div className="text-xl font-bold text-white mt-1">{callRatingSummary?.totalCount ?? 0}</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Avg. Experience Score</div>
                  <div className="text-xl font-bold text-amber-400 mt-1">
                    {callRatingSummary?.averageOverall ? `${callRatingSummary.averageOverall} / 5` : 'No ratings yet'}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <div className="text-slate-400">Avg. Audio/Video Quality</div>
                  <div className="text-xl font-bold text-emerald-400 mt-1">
                    {callRatingSummary?.averageCallQuality ? `${callRatingSummary.averageCallQuality} / 5` : 'No ratings yet'}
                  </div>
                </div>
              </div>
              {callRatingSummary && callRatingSummary.ratings.length > 0 && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {callRatingSummary.ratings.slice(0, 10).map((r) => (
                    <div key={r.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white">
                          {r.partnerName} ({r.partnerCountry}) · {r.actionTrigger === 'next_person' ? 'Next Person' : 'End Call'}
                        </div>
                        <div className="text-slate-400">
                          Experience: {r.overallRating}/5 · Quality: {r.callQualityRating}/5 ({r.videoQuality})
                          {r.tags.length > 0 ? ` · ${r.tags.join(', ')}` : ''}
                        </div>
                        {r.comment && <div className="text-slate-300 italic">"{r.comment}"</div>}
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(r.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-white">User Adult 18+ Verification &amp; Safety Suspensions</h2>
                <button
                  type="button"
                  onClick={fetchAdminUsers}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
                >
                  Refresh Users
                </button>
              </div>
              {adminUsers.length === 0 ? (
                <p className="text-xs text-slate-400">No user verification or safety records loaded yet.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {adminUsers.map((u) => {
                    const userReportsCount = moderationReports.filter(
                      (r) => r.targetId === u.id || r.targetId === u.name || r.targetId === u.profileId
                    ).length;
                    return (
                    <div
                      key={u.id}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-white flex items-center gap-2 flex-wrap">
                          <span>{u.name}</span>
                          <span className="text-[10px] font-mono text-purple-300">{u.profileId}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.ageStatus === 'verified'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : u.ageStatus === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            18+ Status: {u.ageStatus}
                          </span>
                          {u.suspended && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                              SUSPENDED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {u.country} • Reports against user: {userReportsCount}
                          {u.suspendedReason ? ` • Reason: ${u.suspendedReason}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const nextSuspended = !u.suspended;
                          const res = await fetch('/api/admin/users/suspend', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              targetUserId: u.id,
                              suspended: nextSuspended,
                              reason: nextSuspended ? 'Suspended by safety moderation admin' : '',
                            }),
                          });
                          if (res.ok) {
                            fetchAdminUsers();
                            showToast(
                              nextSuspended ? `Suspended ${u.name}.` : `Restored ${u.name}.`,
                              'info'
                            );
                          }
                        }}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${
                          u.suspended
                            ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                            : 'bg-rose-600 text-white hover:bg-rose-500'
                        }`}
                      >
                        {u.suspended ? 'Unsuspend' : 'Suspend User'}
                      </button>
                    </div>
                  );})}
                </div>
              )}
            </div>

            <AdminPromoManager
              promotions={promotions}
              onPromotionsUpdated={setPromotions}
              showToast={showToast}
            />
          </div>
        )}
      </main>

      {/* --- GOOGLE COOKIE & 18+ YEARS TICK-MARK CONSENT BANNER --- */}
      {cookieConsentOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/98 backdrop-blur-xl border-t border-purple-500/50 p-4 sm:p-5 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3 max-w-3xl">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#05060f] border border-purple-500/40 shrink-0 mt-0.5">
              <img
                src="/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg"
                alt="OrioLiveCall"
                className="w-full h-full object-cover translate-x-[70%] scale-[2.65]"
              />
            </div>
            <div className="text-xs text-slate-300 leading-relaxed space-y-2">
              <div className="font-bold text-white flex items-center gap-2">
                <Cookie className="w-4 h-4 text-purple-400" />
                <span>Google Firebase Cookies &amp; 18+ Age Confirmation</span>
              </div>
              <p>
                Google Authentication, Firebase security, and OrioLiveCall use cookies for login &amp; safety. Please tick the <strong className="text-white">18+ Years Checkmark</strong> below and click <strong className="text-purple-300">Allow Cookies</strong>.
              </p>
              <label className={`inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                cookie18Checked
                  ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-200'
                  : 'bg-slate-950 border-purple-500/40 text-slate-200 hover:border-purple-400'
              }`}>
                <input
                  type="checkbox"
                  checked={cookie18Checked}
                  onChange={(e) => setCookie18Checked(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer shrink-0"
                />
                <span className="text-[11px] font-semibold">
                  ✓ I am 18+ years old &amp; allow Google/OrioLiveCall cookies (আমার বয়স ১৮+ এবং আমি কুকি অনুমোদন করছি)
                </span>
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto justify-end">
            <button
              onClick={() => {
                if (!cookie18Checked) {
                  showToast('Please click the 18+ years tick mark first before allowing cookies.', 'error');
                  return;
                }
                localStorage.setItem('oriolivecall_cookie_consent', 'accepted');
                localStorage.setItem('oriolivecall_age18_confirmed', 'true');
                setGoogle18Checked(true);
                setCookieConsentOpen(false);
                showToast('18+ confirmed & Google cookies allowed!', 'success');
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all flex items-center gap-1.5 ${
                cookie18Checked
                  ? 'bg-gradient-to-r from-emerald-600 to-purple-600 text-white hover:opacity-95'
                  : 'bg-purple-600/40 text-purple-200 border border-purple-500/40 hover:bg-purple-600/60'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Allow Cookies</span>
            </button>
            <button
              onClick={() => {
                localStorage.setItem('oriolivecall_cookie_consent', 'rejected');
                setCookieConsentOpen(false);
                showToast('Optional cookies declined; essential security cookies remain active.', 'info');
              }}
              className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              Essential Only
            </button>
          </div>
        </div>
      )}

      {/* --- GIVE GIFT MODAL --- */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 relative overflow-hidden">
            {giftAnimationActive && (
              <div className="absolute inset-0 bg-purple-950/95 z-50 flex flex-col items-center justify-center space-y-4">
                <div className="text-6xl animate-bounce">{selectedGiftType.icon}</div>
                <h3 className="text-2xl font-black text-white">Sending {selectedGiftType.name}!</h3>
              </div>
            )}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Gift className="w-5 h-5 text-amber-400" />
                <span>Give Gift to {giftTargetName || 'Creator'}</span>
              </h3>
              <button onClick={() => setShowGiftModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Red Rose 🌹', price: 10, icon: '🌹' },
                { name: 'Diamond Crown 👑', price: 50, icon: '👑' },
                { name: 'Super Star ⭐', price: 100, icon: '⭐' },
                { name: 'Luxury Sports Car 🏎️', price: 500, icon: '🏎️' }
              ].map(g => (
                <button
                  key={g.name}
                  onClick={() => setSelectedGiftType(g)}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${selectedGiftType.name === g.name ? 'bg-purple-600/30 border-purple-500 shadow-lg' : 'bg-slate-950 border-slate-800'}`}
                >
                  <span className="text-2xl">{g.icon}</span>
                  <div className="mt-2">
                    <div className="font-bold text-white text-xs">{g.name}</div>
                    <div className="text-[11px] text-amber-400 font-bold">${g.price} USD</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={handleSendGift} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-extrabold text-xs shadow-xl">
              Confirm & Send Gift (${selectedGiftType.price})
            </button>
          </div>
        </div>
      )}

      {/* --- PAID SUBSCRIPTION CHECKOUT MODAL --- */}
      {showSubscriptionModal && subTargetCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-400" />
                <span>Subscribe to {subTargetCreator.name}</span>
              </h3>
              <button onClick={() => setShowSubscriptionModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setSubPlanType('monthly')} className={`p-4 rounded-2xl border text-left ${subPlanType === 'monthly' ? 'bg-purple-600/30 border-purple-500' : 'bg-slate-950 border-slate-800'}`}>
                <div className="font-bold text-white text-xs">Monthly</div>
                <div className="text-sm font-extrabold text-purple-300 mt-1">${subTargetCreator.monthlyPrice} /mo</div>
              </button>
              <button onClick={() => setSubPlanType('yearly')} className={`p-4 rounded-2xl border text-left ${subPlanType === 'yearly' ? 'bg-purple-600/30 border-purple-500' : 'bg-slate-950 border-slate-800'}`}>
                <div className="font-bold text-white text-xs">Yearly</div>
                <div className="text-sm font-extrabold text-purple-300 mt-1">${subTargetCreator.yearlyPrice} /yr</div>
              </button>
            </div>
            <button onClick={handleSubscribeCheckout} className="w-full py-3.5 rounded-xl bg-purple-600 text-white font-bold text-xs shadow-xl">
              Confirm Secure Subscription
            </button>
          </div>
        </div>
      )}

      {/* --- POST-CALL RATING & QUALITY FEEDBACK MODAL --- */}
      {postCallFeedbackSession && !isFullscreen && (
        <PostCallRatingModal
          lang={lang}
          session={postCallFeedbackSession}
          submitting={submittingCallRating}
          onSubmit={handleSubmitPostCallRating}
          onSkip={() => proceedAfterPostCallRating(postCallFeedbackSession)}
          onReportIssue={() => {
            const reportedTarget = postCallFeedbackSession.partnerName || 'call-partner';
            setPostCallFeedbackSession(null);
            handleOpenReport('user', reportedTarget);
          }}
        />
      )}

      {/* --- CREATOR PROFILE MODAL --- */}
      {selectedProfileForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-lg p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Creator Profile</h3>
              <button onClick={() => setSelectedProfileForModal(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex items-center gap-6">
              <img src={selectedProfileForModal.avatar} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-500" />
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">{selectedProfileForModal.name}</h2>
                <p className="text-xs font-mono text-purple-300">{selectedProfileForModal.username}</p>
                {selectedProfileForModal.profileId && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded-md bg-purple-600/25 border border-purple-500/40 font-mono text-[11px] font-bold text-purple-200">
                      {selectedProfileForModal.profileId}
                    </span>
                    <button
                      onClick={() => handleCopyProfileId(selectedProfileForModal.profileId)}
                      className="text-[11px] text-purple-300 hover:text-white flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copy ID
                    </button>
                    <button
                      onClick={() => handleShareProfileLink(selectedProfileForModal.profileId)}
                      className="text-[11px] text-purple-300 hover:text-white flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Share
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-300 bg-slate-950 p-4 rounded-2xl">{selectedProfileForModal.bio}</p>
            <div className="flex gap-3">
              <button onClick={() => { setGiftTargetName(selectedProfileForModal.name); setSelectedProfileForModal(null); setShowGiftModal(true); }} className="flex-1 py-3 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs">Give Gift</button>
              <button onClick={() => { setSubTargetCreator(selectedProfileForModal); setSelectedProfileForModal(null); setShowSubscriptionModal(true); }} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold text-xs">Subscribe</button>
            </div>
          </div>
        </div>
      )}

      {/* --- SAFETY REPORT MODAL --- */}
      {reportModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <form onSubmit={handleSubmitReport} className="w-full max-w-md p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Flag className="w-4 h-4 text-rose-400" />
                <span>Report {reportModalTarget.targetType}</span>
              </h3>
              <button type="button" onClick={() => setReportModalTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Reason for Safety Report</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="Inappropriate or explicit content">Inappropriate or explicit content</option>
                <option value="Harassment or unsolicited spam">Harassment or unsolicited spam</option>
                <option value="Underage or impersonation concern">Underage or impersonation concern</option>
                <option value="Illegal or harmful content">Illegal or harmful content</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setReportModalTarget(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold">
                Cancel
              </button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold">
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- SERVER-VALIDATED ADULT 18+ VERIFICATION MODAL --- */}
      {ageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <form
            onSubmit={handleSubmitServerAgeVerification}
            className="w-full max-w-md p-7 rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>18+ Adult Eligibility Verification</span>
              </h3>
              <button type="button" onClick={() => setAgeModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Live video matching is restricted strictly to adults aged 18+. Your exact birth date and hashed ID reference are validated server-side and never displayed publicly.
            </p>

            {!ageVerifyStatus?.thirdPartyKycConfigured && (
              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-[11px] text-amber-200">
                Server DOB &amp; cryptographic ID-reference assurance is active. External automated 3P ID/KYC document API is not connected in this environment.
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Date of Birth (Must be 18+)</label>
                <input
                  type="date"
                  required
                  value={verifyDobInput}
                  onChange={(e) => setVerifyDobInput(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">ID Document Type</label>
                  <select
                    value={verifyDocType}
                    onChange={(e) => setVerifyDocType(e.target.value as any)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                  >
                    <option value="national_id">National ID / NID</option>
                    <option value="passport">Passport</option>
                    <option value="driver_license">Driver&apos;s License</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300">ID Last 4+ Chars</label>
                  <input
                    type="text"
                    required
                    minLength={4}
                    maxLength={12}
                    placeholder="e.g. 4829"
                    value={verifyIdLast4}
                    onChange={(e) => setVerifyIdLast4(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Issuing Country</label>
                <input
                  type="text"
                  required
                  value={verifyCountry}
                  onChange={(e) => setVerifyCountry(e.target.value)}
                  placeholder="Bangladesh"
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifyAttestation}
                  onChange={(e) => setVerifyAttestation(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 mt-0.5 shrink-0"
                />
                <span className="text-[11px] text-slate-300 leading-relaxed">
                  I confirm I am at least 18 years old and accept OrioLiveCall&apos;s Adult Safety &amp; Community Rules.
                </span>
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setAgeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifySubmitting}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold disabled:opacity-50"
              >
                {verifySubmitting ? 'Verifying...' : 'Verify 18+ Status'}
              </button>
            </div>
          </form>
        </div>
      )}

      <footer className="py-6 px-6 border-t border-slate-800/80 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-2.5">
        <div className="w-7 h-7 rounded-lg overflow-hidden bg-[#05060f] border border-purple-500/40 shrink-0">
          <img
            src="/assets/aistudio/7fe1f9ca-cea4-4205-ad16-563ba4b11d39_3bbe7aa0.jpg"
            alt="OrioLiveCall"
            className="w-[27.2222px] h-full object-cover translate-x-[70%] scale-[2.65]"
          />
        </div>
        <p>{t.rightsReserved}</p>
      </footer>

      {/* --- FLOATING ORIO AI HELP CENTER (VISIBLE ACROSS ALL PAGES, NON-BLOCKING) --- */}
      {!isFullscreen && (
        <OrioAiHelpCenter
          lang={lang}
          onChangeLang={setLang}
          userProfileId={user.profileId || 'ORI-100004'}
          userName={user.name}
          balance={wallet?.balance ?? 1850}
          activeSubsCount={subscriptions.filter((s) => s.status === 'active').length}
          onNavigateTab={(tab) => setActiveTab(tab as any)}
          bottomOffsetClass={cookieConsentOpen ? 'bottom-28 md:bottom-24' : 'bottom-5'}
          showToast={showToast}
        />
      )}
    </div>
  );
}
