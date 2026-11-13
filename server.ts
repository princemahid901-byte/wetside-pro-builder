import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import dotenv from "dotenv";
import crypto from "crypto";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json({ limit: "15mb" }));

// Directories for real video uploads & persistent backend state
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "videos");
const DATA_DIR = path.resolve(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "oriolivecall-state.json");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".mp4").replace(/[^a-zA-Z0-9.]/g, "") || ".mp4";
    cb(null, `vid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 80 * 1024 * 1024 }, // 80 MB real video upload limit
});

// Initialize Google GenAI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// --- AUTOMATED CONTENT SAFETY & MODERATION ---
const BLOCKED_CONTENT_PATTERNS = [
  /\b(porn|xxx|nude|nudity|explicit|sex|nsfw|escort|hentai|erotic)\b/i,
  /\b(gore|snuff|self-harm|suicide|terror|underage)\b/i,
  /\b(scam|phishing|credit card dump|stolen)\b/i,
];

function moderateText(text: string): { ok: boolean; reason?: string } {
  const clean = (text || "").trim();
  for (const pat of BLOCKED_CONTENT_PATTERNS) {
    if (pat.test(clean)) {
      return {
        ok: false,
        reason:
          "Blocked by automated safety moderation: OrioLiveCall strictly prohibits explicit/sexual, harmful, or illegal content.",
      };
    }
  }
  return { ok: true };
}

// --- DATA MODELS ---
interface WalletTransaction {
  txId: string;
  type: "deposit" | "send" | "receive" | "withdraw" | "refund" | "gift" | "subscription" | "live_ticket";
  amount: number;
  currency: string;
  counterparty?: string;
  status: "completed" | "pending" | "disputed" | "refunded";
  timestamp: string;
  description: string;
}

interface WalletAccount {
  userId: string;
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
}

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  image?: string;
  timestamp: string;
  read: boolean;
  isRequest?: boolean;
}

interface ShortVideo {
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

interface VideoRecord {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  title: string;
  description: string;
  category: string;
  hashtags: string[];
  visibility: "public" | "private" | "premium";
  allowedViewers: string[];
  localFilename?: string;
  externalUrl?: string;
  thumbnailUrl: string;
  safeContent: boolean;
  moderationStatus: "approved" | "pending" | "removed";
  views: number;
  likedBy: string[];
  createdAt: string;
}

interface SubscriptionRecord {
  id: string;
  userId: string;
  creatorId: string;
  creatorName: string;
  plan: "monthly" | "yearly";
  planScope?: "creator" | "platform";
  price: number;
  status: "active" | "cancelled";
  txId: string;
  paymentMethodLabel?: string;
  createdAt: string;
  renewalDate?: string;
  expiresAt: string;
  autoRenew: boolean;
}

interface ProfileDirectoryRecord {
  id: string;
  profileId: string; // e.g. ORI-100001
  accountKey: string;
  legacyUserId?: string;
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
  updatedAt: string;
}

interface PaymentMethodRecord {
  id: string;
  userId: string;
  methodType: "bank_transfer" | "debit_card" | "credit_card" | "mobile_banking";
  provider: string;
  label: string;
  maskedNumber: string;
  holderName: string;
  expiry?: string;
  isDefault: boolean;
  verified: boolean;
  createdAt: string;
}

interface LiveStreamRecord {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  title: string;
  description: string;
  category: string;
  accessType: "free" | "premium";
  price: number;
  streamUrl: string;
  thumbnailUrl: string;
  isLive: boolean;
  likedBy: string[];
  createdAt: string;
  chatHistory: Array<{ id: string; userId: string; userName: string; text: string; timestamp: string }>;
}

interface LivePassRecord {
  id: string;
  userId: string;
  streamId: string;
  creatorId: string;
  price: number;
  txId: string;
  status: "active" | "refunded";
  purchasedAt: string;
  expiresAt: string;
}

interface UserPrivacySettings {
  messagingPrivacy: "everyone" | "friends" | "followers" | "subscribers" | "nobody";
  allowUnsolicitedRequests: boolean;
  blockedUsers: string[];
  showOnlineStatus: boolean;
  showInGlobalFriends: boolean;
  allowFriendRequests: boolean;
}

interface VideoSessionRecord {
  sessionId: string;
  userAId: string;
  userBId: string;
  acceptedA: boolean;
  acceptedB: boolean;
  status: "pending_consent" | "connecting" | "connected" | "reconnecting" | "disconnected" | "ended";
  recordingEnabled: false;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
  endedReason?: string;
}

interface UserPreferencesRecord {
  userId: string;
  targetGender: "girls" | "boys" | "any";
  targetCountry: string;
  voluntaryGender?: string;
  preferredQuality: "SD" | "HD" | "4K";
  updatedAt: string;
}

interface AgeVerificationRecord {
  userId: string;
  status: "unverified" | "verified" | "rejected" | "suspended";
  method: "dob_and_id_assurance" | "admin_verified";
  age: number;
  idDocType?: string;
  idRefHash?: string; // One-way salted hash; never exposed publicly
  issuingCountry?: string;
  verifiedAt?: string;
  suspendedReason?: string;
  updatedAt: string;
}

interface FriendRequestRecord {
  id: string;
  senderId: string;
  senderName: string;
  senderProfileId?: string;
  senderAvatar?: string;
  senderCountry?: string;
  recipientId: string;
  recipientName: string;
  recipientProfileId?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

interface FriendshipRecord {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
}

interface BlockedUserRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: string;
}

interface ModerationReport {
  id: string;
  reporterId: string;
  targetType: "video" | "short" | "livestream" | "user" | "message";
  targetId: string;
  reason: string;
  status: "pending" | "approved_safe" | "removed";
  createdAt: string;
}

interface CallRatingRecord {
  id: string;
  userId: string;
  actionTrigger: "next_person" | "end_call";
  callMode: "random_video" | "ai_global_talk";
  partnerName: string;
  partnerCountry: string;
  overallRating: number;
  callQualityRating: number;
  durationSec: number;
  videoQuality: string;
  stabilityStatus: string;
  rttMs: number | null;
  tags: string[];
  comment: string;
  createdAt: string;
}

// --- IN-MEMORY + PERSISTENT DISK STORE ---
const userWallets = new Map<string, WalletAccount>();
const messagesStore: Message[] = [
  {
    id: "msg-1",
    senderId: "support@oriolivecall.com",
    recipientId: "guest-user",
    text: "Welcome to OrioLiveCall! Private messaging respects your privacy settings.",
    timestamp: new Date().toISOString(),
    read: false,
    isRequest: false,
  },
];

const shortsStore: ShortVideo[] = [
  {
    id: "short-1",
    creatorName: "Sophia Vance",
    creatorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lights-playing-with-her-hair-41584-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
    description: "Exploring the vibrant neon streets of Tokyo! #travel #tokyo #neon #vibe",
    hashtags: ["travel", "tokyo", "neon", "vibe"],
    likes: 0,
    commentsCount: 0,
    shares: 0,
    comments: [],
  },
  {
    id: "short-2",
    creatorName: "Liam Rocker",
    creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    videoUrl: "https://assets.mixkit.co/videos/preview/mixkit-musician-playing-on-stage-with-colorful-lights-41982-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400",
    description: "Live concert acoustic session! #livemusic #rock #concert",
    hashtags: ["livemusic", "rock", "concert"],
    likes: 0,
    commentsCount: 0,
    shares: 0,
    comments: [],
  },
];

const videosStore: VideoRecord[] = [
  {
    id: "vid-1",
    creatorId: "creator-1",
    creatorName: "Sophia Vance",
    creatorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    title: "Tokyo Midnight Neon City Walk & Street Culture",
    description: "Join a safe, scenic evening walk through Tokyo Shibuya and Shinjuku alleys with live photography tips.",
    category: "Travel",
    hashtags: ["tokyo", "travel", "nightwalk", "photography"],
    visibility: "public",
    allowedViewers: [],
    externalUrl: "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lights-playing-with-her-hair-41584-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600",
    safeContent: true,
    moderationStatus: "approved",
    views: 0,
    likedBy: [],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "vid-2",
    creatorId: "creator-2",
    creatorName: "Aarav Rahman",
    creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    title: "Acoustic Stage Session & Bengali Folk Fusion",
    description: "Live stage rehearsal and guitar arrangements from Dhaka acoustic studio.",
    category: "Music",
    hashtags: ["music", "acoustic", "dhaka", "concert"],
    visibility: "public",
    allowedViewers: [],
    externalUrl: "https://assets.mixkit.co/videos/preview/mixkit-musician-playing-on-stage-with-colorful-lights-41982-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600",
    safeContent: true,
    moderationStatus: "approved",
    views: 0,
    likedBy: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "vid-3",
    creatorId: "creator-1",
    creatorName: "Sophia Vance",
    creatorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    title: "Creator Masterclass: Lighting & HD Streaming Setup",
    description: "Members-only breakdown of ring lighting, camera framing, and low-latency audio settings.",
    category: "Education",
    hashtags: ["creator", "streaming", "lighting", "tutorial"],
    visibility: "premium",
    allowedViewers: [],
    externalUrl: "https://assets.mixkit.co/videos/preview/mixkit-woman-taking-pictures-with-a-vintage-camera-42425-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600",
    safeContent: true,
    moderationStatus: "approved",
    views: 0,
    likedBy: [],
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: "vid-4",
    creatorId: "creator-3",
    creatorName: "Elena Rostova",
    creatorAvatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150",
    title: "Morning Yoga & Mobility Flow for Desk Creators",
    description: "Free 15-minute daily stretch and posture routine for healthy screen habits.",
    category: "Fitness",
    hashtags: ["fitness", "wellness", "yoga", "morning"],
    visibility: "public",
    allowedViewers: [],
    externalUrl: "https://assets.mixkit.co/videos/preview/mixkit-young-woman-practicing-yoga-at-home-42430-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600",
    safeContent: true,
    moderationStatus: "approved",
    views: 0,
    likedBy: [],
    createdAt: new Date(Date.now() - 21600000).toISOString(),
  },
];

const liveStreamsStore: LiveStreamRecord[] = [
  {
    id: "live-1",
    creatorId: "creator-1",
    creatorName: "Sophia Vance",
    creatorAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    title: "Tokyo Sunset Q&A & Street Music Walk (Free Public Live)",
    description: "Open public stream! Say hello from your country in moderated live chat.",
    category: "Travel",
    accessType: "free",
    price: 0,
    streamUrl: "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lights-playing-with-her-hair-41584-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600",
    isLive: true,
    likedBy: [],
    createdAt: new Date().toISOString(),
    chatHistory: [],
  },
  {
    id: "live-2",
    creatorId: "creator-2",
    creatorName: "Aarav Rahman",
    creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    title: "Backstage Concert Rehearsal & Songwriting Workshop",
    description: "Premium paid broadcast with live audio Q&A and full backstage tour.",
    category: "Music",
    accessType: "premium",
    price: 9.99,
    streamUrl: "https://assets.mixkit.co/videos/preview/mixkit-musician-playing-on-stage-with-colorful-lights-41982-large.mp4",
    thumbnailUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600",
    isLive: true,
    likedBy: [],
    createdAt: new Date().toISOString(),
    chatHistory: [],
  },
];

const followsStore = new Map<string, string[]>(); // userId -> creatorIds[]
const subscriptionsStore: SubscriptionRecord[] = [];
const livePassesStore: LivePassRecord[] = [];
const watchHistoryStore = new Map<string, string[]>(); // userId -> videoIds[]
const savedVideosStore = new Map<string, string[]>(); // userId -> videoIds[]
const userPrivacyStore = new Map<string, UserPrivacySettings>();
const approvedRequestersStore = new Map<string, string[]>(); // recipientId -> senderIds[]
const reportsStore: ModerationReport[] = [];
const paymentMethodsStore = new Map<string, PaymentMethodRecord[]>(); // userId -> masked payment methods
let nextProfileSeq = 100004;
const profileDirectoryStore: ProfileDirectoryRecord[] = [
  {
    id: "creator-1",
    profileId: "ORI-100001",
    accountKey: "creator-1",
    name: "Sophia Vance",
    username: "@sophia_tokyo",
    country: "Japan",
    gender: "Female",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    bio: "Tokyo nightlife vlogger, live music streaming & 1-on-1 chats! 🌃✨",
    creatorBadge: true,
    online: false,
    subscribersCount: 0,
    monthlyPrice: 19.99,
    yearlyPrice: 149.99,
    livestreamUrl: "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lights-playing-with-her-hair-41584-large.mp4",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "creator-2",
    profileId: "ORI-100002",
    accountKey: "creator-2",
    name: "Anika Rahman",
    username: "@anika_dhaka",
    country: "Bangladesh",
    gender: "Female",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    bio: "Cultural Q&A, acoustic music and daily live shows from Dhaka! 🇧🇩❤️",
    creatorBadge: true,
    online: false,
    subscribersCount: 0,
    monthlyPrice: 14.99,
    yearlyPrice: 119.99,
    livestreamUrl: "https://assets.mixkit.co/videos/preview/mixkit-musician-playing-on-stage-with-colorful-lights-41982-large.mp4",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "creator-3",
    profileId: "ORI-100003",
    accountKey: "creator-3",
    name: "Jessica Miller",
    username: "@jessica_nyc",
    country: "United States",
    gender: "Female",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
    bio: "New York wellness & live lifestyle streams. Join my private chat! 🗽",
    creatorBadge: true,
    online: false,
    subscribersCount: 0,
    monthlyPrice: 24.99,
    yearlyPrice: 199.99,
    livestreamUrl: "",
    updatedAt: new Date().toISOString(),
  },
];

// Live presence, viewer rooms & Global Video Connect / Friends stores
const onlineUsers = new Map<string, Set<string>>(); // userId -> socketIds
const liveStreamViewers = new Map<string, Set<string>>(); // streamId -> socketIds
const callRatingsStore: CallRatingRecord[] = [];
const videoSessionsStore: VideoSessionRecord[] = [];
const userPreferencesStore = new Map<string, UserPreferencesRecord>();
const ageVerificationStore = new Map<string, AgeVerificationRecord>();
const friendRequestsStore: FriendRequestRecord[] = [];
const friendshipsStore: FriendshipRecord[] = [];
const blockedUsersStore: BlockedUserRecord[] = [];
const suspendedAccountsStore = new Map<string, { userId: string; reason: string; suspendedAt: string }>();
const rateLimitBuckets = new Map<string, number[]>();

// Promotional Homepage Preview, Separate Ad Banner & Auto-Rotating Carousel Store
const promotionsStore = {
  preview: {
    enabled: true,
    headline: "OrioLiveCall Platform Preview · HD & 4K Live Calling",
    caption: "Watch how creators connect globally with verified Profile IDs, AI Global Talk, and multi-stream HD calling.",
    mediaUrl: "/assets/aistudio/Global_video_call_platform_features_4219cb14_b0135f23.mp4",
    posterUrl: "/assets/aistudio/preview_livecall_16x9.jpg",
    autoplay: true,
    ctaLabel: "Launch Live Chat",
    ctaTab: "chat",
    updatedAt: new Date().toISOString(),
  },
  banner: {
    enabled: true,
    sponsorLabel: "Featured Platform Offer · 18+ Verified",
    title: "Unlock Unlimited Creator Access & Ad-Free Global HD Calls",
    subtitle: "Join OrioLiveCall All-Access Monthly or Yearly plans with instant Bank, Card & bKash/Nagad checkout.",
    imageUrl: "/assets/aistudio/preview_brand_16x9.jpg",
    ctaLabel: "Explore Plans",
    ctaTab: "subscriptions",
    accentTheme: "purple",
    updatedAt: new Date().toISOString(),
  },
  carousel: [
    {
      id: "ad-slide-1",
      title: "Connect with Top Global Creators in HD & 4K",
      subtitle: "Search creators instantly by @username or unique Profile ID like ORI-100001.",
      sponsor: "Creator Spotlight",
      category: "Discovery",
      imageUrl: "/assets/aistudio/preview_creators_16x9.jpg",
      ctaLabel: "Discover Creators",
      ctaTab: "creators",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "ad-slide-2",
      title: "Real-Time Multilingual 1-on-1 & Group Calling",
      subtitle: "Switch seamlessly between peer-to-peer random chat and AI Global Talk in English & Bengali.",
      sponsor: "OrioLiveCall Live Engine",
      category: "Video Calls",
      imageUrl: "/assets/aistudio/preview_livecall_16x9.jpg",
      ctaLabel: "Start Video Chat",
      ctaTab: "chat",
      active: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "ad-slide-3",
      title: "Free Public Videos & Verified Premium Streams",
      subtitle: "Stream free community concerts or support creators with transparent memberships & receipts.",
      sponsor: "Live & VOD Hub",
      category: "Streaming",
      imageUrl: "/assets/aistudio/preview_brand_16x9.jpg",
      ctaLabel: "Browse Free Videos",
      ctaTab: "videos",
      active: true,
      createdAt: new Date().toISOString(),
    },
  ],
};

// Load persisted state if exists
try {
  if (fs.existsSync(STATE_FILE)) {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (Array.isArray(raw.wallets)) {
      for (const [k, v] of raw.wallets) userWallets.set(k, v);
    }
    if (Array.isArray(raw.videos) && raw.videos.length > 0) {
      videosStore.splice(0, videosStore.length, ...raw.videos);
    }
    if (Array.isArray(raw.liveStreams) && raw.liveStreams.length > 0) {
      liveStreamsStore.splice(0, liveStreamsStore.length, ...raw.liveStreams);
    }
    if (Array.isArray(raw.subscriptions)) {
      subscriptionsStore.push(...raw.subscriptions);
    }
    if (Array.isArray(raw.livePasses)) {
      livePassesStore.push(...raw.livePasses);
    }
    if (Array.isArray(raw.follows)) {
      for (const [k, v] of raw.follows) followsStore.set(k, v);
    }
    if (Array.isArray(raw.watchHistory)) {
      for (const [k, v] of raw.watchHistory) watchHistoryStore.set(k, v);
    }
    if (Array.isArray(raw.savedVideos)) {
      for (const [k, v] of raw.savedVideos) savedVideosStore.set(k, v);
    }
    if (Array.isArray(raw.privacy)) {
      for (const [k, v] of raw.privacy) userPrivacyStore.set(k, v);
    }
    if (Array.isArray(raw.approvedRequesters)) {
      for (const [k, v] of raw.approvedRequesters) approvedRequestersStore.set(k, v);
    }
    if (Array.isArray(raw.reports)) {
      reportsStore.push(...raw.reports);
    }
    if (Array.isArray(raw.messages) && raw.messages.length > 0) {
      messagesStore.splice(0, messagesStore.length, ...raw.messages);
    }
    if (Array.isArray(raw.paymentMethods)) {
      for (const [k, v] of raw.paymentMethods) paymentMethodsStore.set(k, v);
    }
    if (Array.isArray(raw.profileDirectory) && raw.profileDirectory.length > 0) {
      profileDirectoryStore.splice(0, profileDirectoryStore.length, ...raw.profileDirectory);
    }
    if (typeof raw.nextProfileSeq === "number" && raw.nextProfileSeq > nextProfileSeq) {
      nextProfileSeq = raw.nextProfileSeq;
    }
    if (raw.promotions && typeof raw.promotions === "object") {
      if (raw.promotions.preview) {
        promotionsStore.preview = { ...promotionsStore.preview, ...raw.promotions.preview };
      }
      if (raw.promotions.banner) {
        promotionsStore.banner = { ...promotionsStore.banner, ...raw.promotions.banner };
      }
      if (Array.isArray(raw.promotions.carousel) && raw.promotions.carousel.length > 0) {
        promotionsStore.carousel = raw.promotions.carousel;
      }
    }
    if (Array.isArray(raw.callRatings)) {
      callRatingsStore.push(...raw.callRatings);
    }
    if (Array.isArray(raw.videoSessions)) {
      videoSessionsStore.push(...raw.videoSessions.slice(0, 300));
    }
    if (Array.isArray(raw.userPreferences)) {
      for (const [k, v] of raw.userPreferences) userPreferencesStore.set(k, v);
    }
    if (Array.isArray(raw.ageVerifications)) {
      for (const [k, v] of raw.ageVerifications) ageVerificationStore.set(k, v);
    }
    if (Array.isArray(raw.friendRequests)) {
      friendRequestsStore.push(...raw.friendRequests);
    }
    if (Array.isArray(raw.friendships)) {
      friendshipsStore.push(...raw.friendships);
    }
    if (Array.isArray(raw.blockedUsersRecords)) {
      blockedUsersStore.push(...raw.blockedUsersRecords);
    }
    if (Array.isArray(raw.suspendedAccounts)) {
      for (const [k, v] of raw.suspendedAccounts) suspendedAccountsStore.set(k, v);
    }
  }
} catch (err) {
  console.warn("Could not restore state file (starting fresh):", err);
}

let persistTimer: NodeJS.Timeout | null = null;
function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const snapshot = {
        wallets: Array.from(userWallets.entries()),
        videos: videosStore,
        liveStreams: liveStreamsStore,
        subscriptions: subscriptionsStore,
        livePasses: livePassesStore,
        follows: Array.from(followsStore.entries()),
        watchHistory: Array.from(watchHistoryStore.entries()),
        savedVideos: Array.from(savedVideosStore.entries()),
        privacy: Array.from(userPrivacyStore.entries()),
        approvedRequesters: Array.from(approvedRequestersStore.entries()),
        reports: reportsStore,
        messages: messagesStore.slice(0, 500),
        paymentMethods: Array.from(paymentMethodsStore.entries()),
        profileDirectory: profileDirectoryStore,
        nextProfileSeq,
        promotions: promotionsStore,
        callRatings: callRatingsStore.slice(0, 300),
        videoSessions: videoSessionsStore.slice(0, 300),
        userPreferences: Array.from(userPreferencesStore.entries()),
        ageVerifications: Array.from(ageVerificationStore.entries()),
        friendRequests: friendRequestsStore.slice(0, 500),
        friendships: friendshipsStore.slice(0, 500),
        blockedUsersRecords: blockedUsersStore.slice(0, 500),
        suspendedAccounts: Array.from(suspendedAccountsStore.entries()),
      };
      fs.writeFileSync(STATE_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    } catch (err) {
      console.error("Failed to persist state:", err);
    }
  }, 400);
}

function getOrCreateWallet(rawId?: string): WalletAccount {
  const userId = rawId && rawId.trim() !== "" && rawId !== "undefined" ? rawId : "guest-user";
  if (!userWallets.has(userId)) {
    userWallets.set(userId, {
      userId,
      balance: 250.0,
      currency: "USD",
      transactions: [
        {
          txId: `ORIO-TX-${Math.floor(100000 + Math.random() * 900000)}`,
          type: "deposit",
          amount: 250.0,
          currency: "USD",
          status: "completed",
          timestamp: new Date().toISOString(),
          description: "Welcome Global Wallet Credit",
        },
      ],
    });
    schedulePersist();
  }
  return userWallets.get(userId)!;
}

function getPrivacy(userId: string): UserPrivacySettings {
  if (!userPrivacyStore.has(userId)) {
    userPrivacyStore.set(userId, {
      messagingPrivacy: "followers", // Privacy-first default: prevents unsolicited inbox clutter
      allowUnsolicitedRequests: true,
      blockedUsers: [],
      showOnlineStatus: true,
      showInGlobalFriends: true,
      allowFriendRequests: true,
    });
  }
  const priv = userPrivacyStore.get(userId)!;
  if (typeof priv.showOnlineStatus !== "boolean") priv.showOnlineStatus = true;
  if (typeof priv.showInGlobalFriends !== "boolean") priv.showInGlobalFriends = true;
  if (typeof priv.allowFriendRequests !== "boolean") priv.allowFriendRequests = true;
  return priv;
}

function checkRateLimit(bucketKey: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(bucketKey) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    rateLimitBuckets.set(bucketKey, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitBuckets.set(bucketKey, timestamps);
  return true;
}

function getUserAliases(rawId: string): Set<string> {
  const clean = String(rawId || "").trim();
  const set = new Set<string>();
  if (!clean) return set;
  set.add(clean);
  const entry = profileDirectoryStore.find(
    (p) =>
      p.id === clean ||
      p.accountKey === clean ||
      p.profileId === clean ||
      p.legacyUserId === clean ||
      p.username === clean
  );
  if (entry) {
    set.add(entry.id);
    if (entry.accountKey) set.add(entry.accountKey);
    if (entry.profileId) set.add(entry.profileId);
    if (entry.legacyUserId) set.add(entry.legacyUserId);
    if (entry.username) set.add(entry.username);
  }
  return set;
}

function isMutuallyBlocked(userA: string, userB: string): boolean {
  if (!userA || !userB) return false;
  const aliasesA = getUserAliases(userA);
  const aliasesB = getUserAliases(userB);

  for (const a of aliasesA) {
    const privA = userPrivacyStore.get(a);
    if (privA?.blockedUsers.some((b) => aliasesB.has(b))) return true;
  }
  for (const b of aliasesB) {
    const privB = userPrivacyStore.get(b);
    if (privB?.blockedUsers.some((a) => aliasesA.has(a))) return true;
  }
  return blockedUsersStore.some(
    (rec) =>
      (aliasesA.has(rec.blockerId) && aliasesB.has(rec.blockedId)) ||
      (aliasesB.has(rec.blockerId) && aliasesA.has(rec.blockedId))
  );
}

function areFriends(userA: string, userB: string): boolean {
  const aliasesA = getUserAliases(userA);
  const aliasesB = getUserAliases(userB);
  return friendshipsStore.some(
    (f) =>
      (aliasesA.has(f.userAId) && aliasesB.has(f.userBId)) ||
      (aliasesB.has(f.userAId) && aliasesA.has(f.userBId))
  );
}

function findPrivacyForAliases(rawId: string): UserPrivacySettings {
  const aliases = getUserAliases(rawId);
  for (const id of aliases) {
    if (userPrivacyStore.has(id)) return getPrivacy(id);
  }
  return getPrivacy(rawId);
}

function isAccountSuspended(rawId: string): { suspended: boolean; reason?: string } {
  const aliases = getUserAliases(rawId);
  for (const id of aliases) {
    const s = suspendedAccountsStore.get(id);
    if (s) return { suspended: true, reason: s.reason };
  }
  return { suspended: false };
}

function getAgeVerificationForUser(rawId: string): AgeVerificationRecord | null {
  const aliases = getUserAliases(rawId);
  for (const id of aliases) {
    const rec = ageVerificationStore.get(id);
    if (rec) return rec;
  }
  return null;
}

function checkAdultEligibility(rawId: string): { allowed: boolean; code?: string; reason?: string } {
  if (!rawId || rawId === "guest-user") {
    return {
      allowed: false,
      code: "AGE_VERIFICATION_REQUIRED",
      reason: "Server-verified 18+ adult verification is required before entering live video matching.",
    };
  }
  const susp = isAccountSuspended(rawId);
  if (susp.suspended) {
    return {
      allowed: false,
      code: "ACCOUNT_SUSPENDED",
      reason: `Your account is suspended from live features: ${susp.reason || "Safety policy violation."}`,
    };
  }
  const rec = getAgeVerificationForUser(rawId);
  if (!rec) {
    return {
      allowed: false,
      code: "AGE_VERIFICATION_REQUIRED",
      reason: "Complete 18+ Adult Verification (Date of Birth + ID Assurance) before joining video calls.",
    };
  }
  if (rec.status === "suspended") {
    return {
      allowed: false,
      code: "ACCOUNT_SUSPENDED",
      reason: rec.suspendedReason || "Account suspended by moderation.",
    };
  }
  if (rec.status !== "verified" || rec.age < 18) {
    return {
      allowed: false,
      code: rec.age < 18 ? "UNDERAGE_BLOCKED" : "AGE_VERIFICATION_REQUIRED",
      reason:
        rec.age < 18
          ? "Access Denied: Users under 18 are strictly blocked from restricted live-video features."
          : "Adult eligibility verification is required before live video matching.",
    };
  }
  return { allowed: true };
}

function resolveLivePresence(targetId: string, viewerId?: string): { online: boolean | null; onlineVisible: boolean } {
  if (viewerId && isMutuallyBlocked(viewerId, targetId)) {
    return { online: null, onlineVisible: false };
  }
  const privacy = findPrivacyForAliases(targetId);
  if (!privacy.showOnlineStatus) {
    return { online: null, onlineVisible: false };
  }
  const aliases = getUserAliases(targetId);
  let isSocketOnline = false;
  for (const a of aliases) {
    const sockets = onlineUsers.get(a);
    if (sockets && sockets.size > 0) {
      isSocketOnline = true;
      break;
    }
  }
  return { online: isSocketOnline, onlineVisible: true };
}

function computeAgeFromBirthDate(birthDateStr: string): number {
  const dob = new Date(birthDateStr);
  if (Number.isNaN(dob.getTime())) return -1;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

function allocateUniqueProfileId(
  accountKey: string,
  requestedProfileId?: string,
  authorizedMigration?: boolean
): string {
  const existing = profileDirectoryStore.find(
    (p) => p.accountKey === accountKey || p.id === accountKey || p.legacyUserId === accountKey
  );
  if (existing) {
    if (
      authorizedMigration &&
      requestedProfileId &&
      /^ORI-[0-9]{6,12}$/.test(requestedProfileId) &&
      !profileDirectoryStore.some((p) => p.profileId === requestedProfileId && p.accountKey !== accountKey)
    ) {
      existing.profileId = requestedProfileId;
      schedulePersist();
    }
    return existing.profileId;
  }

  let candidate =
    requestedProfileId && /^ORI-[0-9]{6,12}$/.test(requestedProfileId) ? requestedProfileId : "";
  if (!candidate || profileDirectoryStore.some((p) => p.profileId === candidate)) {
    while (profileDirectoryStore.some((p) => p.profileId === `ORI-${nextProfileSeq}`)) {
      nextProfileSeq += 1;
    }
    candidate = `ORI-${nextProfileSeq}`;
    nextProfileSeq += 1;
  }
  return candidate;
}

function maskAccountIdentifier(raw: string, methodType: PaymentMethodRecord["methodType"]): string {
  const clean = String(raw || "").trim();
  const last4 = clean.replace(/\s+/g, "").slice(-4) || "0000";
  if (methodType === "debit_card" || methodType === "credit_card") {
    return `•••• •••• •••• ${last4}`;
  }
  if (methodType === "mobile_banking") {
    const prefix = clean.slice(0, 4);
    return `${prefix}••••${last4.slice(-2)}`;
  }
  return `ACCT-••••-${last4}`;
}

function hasActiveCreatorSubscription(userId: string, creatorId: string): boolean {
  if (!userId || !creatorId) return false;
  if (userId === creatorId) return true;
  const now = Date.now();
  return subscriptionsStore.some(
    (s) =>
      s.userId === userId &&
      (s.creatorId === creatorId || s.creatorId === "platform-pass") &&
      s.status === "active" &&
      new Date(s.expiresAt).getTime() > now
  );
}

function canViewerAccessVideo(video: VideoRecord, viewerId?: string): { hasAccess: boolean; reason?: string } {
  if (video.moderationStatus === "removed") {
    return { hasAccess: false, reason: "Removed by moderation" };
  }
  if (video.visibility === "public") {
    return { hasAccess: true };
  }
  if (viewerId && viewerId === video.creatorId) {
    return { hasAccess: true };
  }
  if (video.visibility === "private") {
    if (viewerId && video.allowedViewers.includes(viewerId)) {
      return { hasAccess: true };
    }
    return { hasAccess: false, reason: "Private video: creator authorization required" };
  }
  if (video.visibility === "premium") {
    if (viewerId && hasActiveCreatorSubscription(viewerId, video.creatorId)) {
      return { hasAccess: true };
    }
    return { hasAccess: false, reason: "Active creator membership required" };
  }
  return { hasAccess: false, reason: "Unauthorized" };
}

function serializeVideoForViewer(video: VideoRecord, viewerId?: string) {
  const access = canViewerAccessVideo(video, viewerId);
  const viewerLiked = viewerId ? video.likedBy.includes(viewerId) : false;
  const viewerSaved = viewerId ? (savedVideosStore.get(viewerId) || []).includes(video.id) : false;
  return {
    id: video.id,
    creatorId: video.creatorId,
    creatorName: video.creatorName,
    creatorAvatar: video.creatorAvatar,
    title: video.title,
    description: video.description,
    category: video.category,
    hashtags: video.hashtags,
    visibility: video.visibility,
    thumbnailUrl: video.thumbnailUrl,
    safeContent: video.safeContent,
    moderationStatus: video.moderationStatus,
    views: video.views,
    likesCount: video.likedBy.length,
    likedByViewer: viewerLiked,
    savedByViewer: viewerSaved,
    hasAccess: access.hasAccess,
    accessReason: access.reason || null,
    // NEVER expose private/premium direct URLs to unauthorized callers!
    streamUrl: access.hasAccess
      ? `/api/videos/${encodeURIComponent(video.id)}/stream?viewerId=${encodeURIComponent(viewerId || "guest-user")}`
      : null,
    allowedViewers: viewerId === video.creatorId ? video.allowedViewers : undefined,
    createdAt: video.createdAt,
  };
}

function hasLiveAccess(stream: LiveStreamRecord, viewerId?: string): boolean {
  if (stream.accessType === "free") return true;
  if (!viewerId) return false;
  if (viewerId === stream.creatorId) return true;
  if (hasActiveCreatorSubscription(viewerId, stream.creatorId)) return true;
  const now = Date.now();
  return livePassesStore.some(
    (p) =>
      p.userId === viewerId &&
      p.streamId === stream.id &&
      p.status === "active" &&
      new Date(p.expiresAt).getTime() > now
  );
}

// --- GEMINI AI ROUTES ---
app.post("/api/gemini/icebreaker", async (req, res) => {
  try {
    const { partnerCountry, topic } = req.body;
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: `Generate 3 fun, friendly, and respectful icebreaker questions in both English and Bengali for a live video chat with someone from ${partnerCountry || "anywhere"}. Topic: ${topic || "general introduction"}. Format as JSON array of objects with 'english' and 'bengali' keys.`,
      config: {
        responseMimeType: "application/json",
      },
    });
    const text = response.text || "[]";
    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error("Gemini icebreaker error:", error);
    res.status(500).json({ error: error.message || "Failed to generate icebreakers" });
  }
});

app.post("/api/gemini/talk", async (req, res) => {
  try {
    const { message, partnerCountry, language, history } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message text is required" });
    }

    const targetLang = language === "bn" ? "Bengali and English" : "English (with friendly Bengali greeting when appropriate)";
    const systemPrompt = `You are a friendly, warm, human-like Global Conversation Partner from ${partnerCountry || "around the world"} on OrioLiveCall live video chat. Speak naturally in ${targetLang}. Keep responses conversational, engaging, and concise (2-3 sentences max) so it feels like a real live call.`;

    const contextLines = Array.isArray(history)
      ? history.slice(-6).map((h: any) => `${h.role === "user" ? "Caller" : "Partner"}: ${h.text}`).join("\n")
      : "";

    const promptText = contextLines
      ? `${contextLines}\nCaller: ${message}\nPartner:`
      : `Caller: ${message}\nPartner:`;

    const textResp = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: promptText,
      config: { systemInstruction: systemPrompt },
    });

    const replyText = (textResp.text || "Hello! It is great to talk with you from across the world!").trim();

    let audioBase64: string | null = null;
    try {
      const ttsResp = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [{ role: "user", parts: [{ text: replyText }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
        },
      });
      audioBase64 = ttsResp.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (ttsErr) {
      console.warn("TTS generation fallback (text still returned):", ttsErr);
    }

    res.json({
      reply: replyText,
      audioBase64,
      audioMimeType: audioBase64 ? "audio/wav" : null,
    });
  } catch (error: any) {
    console.error("Gemini talk error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI talk response" });
  }
});

// --- ORIO AI HELP CENTER ASSISTANT ---
function buildDeterministicHelpFallback(question: string, lang: "en" | "bn", userContext: any) {
  const q = question.toLowerCase();
  const pid = userContext?.profileId || "ORI-100004";

  if (q.includes("profile id") || q.includes("id") || q.includes("আইডি")) {
    return {
      reply:
        lang === "bn"
          ? `আপনার অনন্য OrioLiveCall প্রোফাইল আইডি হলো **${pid}**। আপনি "My Profile" পাতায় গিয়ে এক ক্লিকে "Copy Profile ID" বা "Share Profile Link" ব্যবহার করতে পারেন এবং যেকোনো ক্রিয়েটরকে তাদের @username বা ORI-XXXXXX আইডি দিয়ে খুঁজতে পারেন।`
          : `Your unique OrioLiveCall Profile ID is **${pid}**. Open **My Profile** to copy your ID or share your direct profile link, or search any creator by their @username or \`ORI-XXXXXX\` ID in Global Community or Discover Creators.`,
      suggestedTab: "profile",
      suggestedLabel: lang === "bn" ? "আমার প্রোফাইল দেখুন" : "Open My Profile",
    };
  }
  if (q.includes("subscri") || q.includes("plan") || q.includes("member") || q.includes("সাবস্ক্র")) {
    return {
      reply:
        lang === "bn"
          ? "আমাদের Subscription Purchase Center-এ মাসিক (Monthly) ও বার্ষিক (Yearly) প্ল্যান এবং ক্রিয়েটর মেম্বারশিপ রয়েছে। ক্রয়ের আগে মূল্য, মেয়াদ, নবায়নের তারিখ ও বাতিলের নিয়ম স্পষ্টভাবে দেখানো হয়। ২৪ ঘণ্টার মধ্যে রিফান্ড ও যেকোনো সময় নবায়ন বাতিল করা যায়।"
          : "Visit our **Subscription Purchase Center** to view Monthly & Yearly Platform Passes or individual Creator Memberships. Every plan shows exact pricing, duration, renewal/expiry dates, payment receipts, and one-click cancellation before checkout.",
      suggestedTab: "subscriptions",
      suggestedLabel: lang === "bn" ? "সাবস্ক্রিপশন সেন্টার" : "Subscription Center",
    };
  }
  if (q.includes("pay") || q.includes("card") || q.includes("bank") || q.includes("bkash") || q.includes("টাকা") || q.includes("পেমেন্ট") || q.includes("wallet")) {
    return {
      reply:
        lang === "bn"
          ? "Payment Methods Center-এ আপনি ব্যাংক ট্রান্সফার, ডেবিট কার্ড, ক্রেডিট কার্ড এবং মোবাইল ব্যাংকিং (bKash/Nagad/Rocket) যুক্ত করতে ও ওয়ালেটে টাকা জমা করতে পারেন। সব কার্ড/ব্যাংক নম্বর মাস্ক করে সুরক্ষিত রাখা হয় এবং প্রতিটি লেনদেনের রসিদ পাওয়া যায়।"
          : "In the **Payment Methods Center**, you can securely add Bank Transfer, Debit Card, Credit Card, or Mobile Banking (bKash, Nagad, Rocket) using masked storage, top up your Wallet, and resolve payment issues or disputes in Transaction History.",
      suggestedTab: "payment-methods",
      suggestedLabel: lang === "bn" ? "পেমেন্ট মেথড সেন্টার" : "Payment Methods Center",
    };
  }
  if (q.includes("live") || q.includes("video") || q.includes("লাইভ") || q.includes("ভিডিও")) {
    return {
      reply:
        lang === "bn"
          ? "সকল পাবলিক ভিডিও এবং Free Live স্ট্রিম সম্পূর্ণ ফ্রি দেখা যায়। প্রিমিয়াম ভিডিও এবং প্রিমিয়াম লাইভের জন্য সক্রিয় সাবস্ক্রিপশন বা লাইভ পাস প্রয়োজন, এবং প্রাইভেট ভিডিও কেবল অনুমোদিত দর্শকদের জন্য সংরক্ষিত।"
          : "All public videos in **Videos & Search** and **Free Live** streams are 100% free to watch! Premium videos/livestreams unlock with a verified membership or pass, while Private videos require explicit creator authorization.",
      suggestedTab: "videos",
      suggestedLabel: lang === "bn" ? "ফ্রি ভিডিও দেখুন" : "Browse Videos",
    };
  }
  if (q.includes("privac") || q.includes("report") || q.includes("block") || q.includes("রিপোর্ট") || q.includes("প্রাইভেসি")) {
    return {
      reply:
        lang === "bn"
          ? "Live Messaging ও Settings-এ আপনি কে আপনাকে মেসেজ করতে পারবে (Followers / Subscribers / Everyone / Nobody) তা নির্ধারণ করতে পারেন এবং যেকোনো অননুমোদিত ব্যবহারকারী বা কনটেন্ট ব্লক ও রিপোর্ট করতে পারেন।"
          : "Manage who can message you under **Live Messaging & Privacy Settings** (Followers, Subscribers, Everyone, or Nobody), or click the Flag/Report button on any profile, video, short, or livestream to alert our moderation team.",
      suggestedTab: "messages",
      suggestedLabel: lang === "bn" ? "প্রাইভেসি ও মেসেজ" : "Privacy & Messages",
    };
  }
  return {
    reply:
      lang === "bn"
        ? "স্বাগতম **Orio AI Help Center**-এ! আমি অ্যাকাউন্ট তৈরি (Google Firebase বা ১৮+ ক্যালেন্ডার জন্মতারিখ), প্রোফাইল আইডি (`ORI-XXXXXX`), সাবস্ক্রিপশন প্ল্যান, পেমেন্ট মেথড, ফ্রি/প্রিমিয়াম ভিডিও, লাইভস্ট্রিম এবং রিপোর্ট ও প্রাইভেসি বিষয়ে সাহায্য করতে পারি। আপনার প্রশ্নটি লিখুন!"
        : "Welcome to **Orio AI Help Center**! I can help you with creating/verifying your 18+ account, finding your `ORI-XXXXXX` Profile ID, Subscription Plans, Payment Methods (Bank, Debit/Credit Card, Mobile Banking), Free vs Premium Videos & Live, Privacy Settings, and Safety Reports.",
    suggestedTab: "home",
    suggestedLabel: lang === "bn" ? "হোম পাতা" : "Explore Platform",
  };
}

app.post("/api/gemini/help-center", async (req, res) => {
  const { question, language, history, userContext } = req.body || {};
  const lang: "en" | "bn" = language === "bn" ? "bn" : "en";
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Question is required" });
  }

  const fallback = buildDeterministicHelpFallback(question, lang, userContext);

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(fallback);
    }

    const systemInstruction = `You are "Orio AI Help Center", the official bilingual (English and Bengali) support assistant for the OrioLiveCall platform ("Meet the World. Talk Beyond Borders.").
Only state real OrioLiveCall features:
1. Account Creation: Sign in with Google (Firebase Auth) OR register with 18+ Calendar Date of Birth + License Disclaimer agreement. Every account gets a unique immutable Profile ID like "ORI-100001".
2. Easy Profile ID System: Users view/copy their ORI-XXXXXX Profile ID on My Profile, share their "?profile=ORI-XXXXXX" link, and search creators by username or Profile ID in Global Community / Discover Creators.
3. Subscription Purchase Center: Platform All-Access Pass & individual Creator Memberships (Monthly 30-day & Yearly 365-day). Unlocks Premium Videos, Premium Livestreams, and Subscriber Priority Text Messaging (never claim unlimited messaging includes unlimited video calling). Price, duration, renewal date, expiry date, auto-renew toggle, cancel anytime, 24h refund guarantee, and receipts are visible before and after purchase.
4. Payment Methods Center: Supports Bank Transfer, Debit Card, Credit Card, and Mobile Banking (bKash, Nagad, Rocket) with masked account storage (never stores CVV or raw full card numbers), default method selection, Wallet Top-Up, and Transaction History receipts/disputes.
5. Videos & Livestreams: Public videos and Free Live are 100% free. Private videos require creator approval; Premium videos/live require active subscription/pass enforced on backend. Strictly non-explicit safe content (18+).
6. Privacy & Moderation: Messaging privacy settings (followers/subscribers/everyone/nobody), Message Requests inbox, Block & Report buttons on videos, shorts, livestreams, messages, and profiles.

Current signed-in user context: Profile ID=${userContext?.profileId || "ORI-100004"}, Name=${userContext?.name || "Member"}, Balance=$${userContext?.balance ?? "250.00"} USD, Active Subscriptions=${userContext?.activeSubsCount ?? 0}.
Respond concisely (2-4 clear sentences) in ${lang === "bn" ? "Bengali (বাংলা) with key feature names clear" : "English (or Bengali if the user wrote in Bengali)"}. Do not invent fake fees, URLs, or features.`;

    const recentHistory = Array.isArray(history)
      ? history
          .slice(-6)
          .map((h: any) => `${h.role === "user" ? "User" : "HelpCenter"}: ${h.text}`)
          .join("\n")
      : "";

    const contents = recentHistory
      ? `${recentHistory}\nUser: ${question}\nHelpCenter:`
      : `User: ${question}\nHelpCenter:`;

    const aiResp = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents,
      config: { systemInstruction },
    });

    const reply = (aiResp.text || "").trim() || fallback.reply;
    res.json({
      reply,
      suggestedTab: fallback.suggestedTab,
      suggestedLabel: fallback.suggestedLabel,
    });
  } catch (err) {
    console.warn("Help center Gemini fallback used:", err);
    res.json(fallback);
  }
});

// --- EASY PROFILE ID DIRECTORY & SEARCH SYSTEM (ORI-100001) ---
app.post("/api/profile/register", (req, res) => {
  const {
    accountKey,
    legacyUserId,
    requestedProfileId,
    authorizedMigration,
    name,
    username,
    country,
    gender,
    avatar,
    bio,
  } = req.body || {};

  const key = String(accountKey || legacyUserId || "").trim();
  if (!key) {
    return res.status(400).json({ error: "Account identifier is required" });
  }

  const profileId = allocateUniqueProfileId(key, requestedProfileId, Boolean(authorizedMigration));
  let entry = profileDirectoryStore.find(
    (p) => p.accountKey === key || p.id === key || p.legacyUserId === key || p.profileId === profileId
  );

  const cleanName = String(name || "Orio Member").trim().slice(0, 100);
  const cleanUsername =
    username && String(username).trim()
      ? String(username).trim().slice(0, 60)
      : `@${cleanName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20) || "member"}_${profileId.slice(-4)}`;

  if (entry) {
    entry.name = cleanName || entry.name;
    if (username) entry.username = cleanUsername;
    if (country) entry.country = String(country).slice(0, 80);
    if (gender) entry.gender = String(gender).slice(0, 30);
    if (avatar) entry.avatar = String(avatar).slice(0, 500);
    if (bio) entry.bio = String(bio).slice(0, 500);
    entry.online = resolveLivePresence(entry.id).online ?? false;
    entry.updatedAt = new Date().toISOString();
  } else {
    entry = {
      id: key,
      profileId,
      accountKey: key,
      legacyUserId,
      name: cleanName,
      username: cleanUsername,
      country: String(country || "Bangladesh").slice(0, 80),
      gender: String(gender || "other").slice(0, 30),
      avatar: String(avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150").slice(0, 500),
      bio: String(bio || "Verified OrioLiveCall Member").slice(0, 500),
      creatorBadge: true,
      online: false,
      subscribersCount: 0,
      monthlyPrice: 14.99,
      yearlyPrice: 119.99,
      updatedAt: new Date().toISOString(),
    };
    profileDirectoryStore.push(entry);
  }

  schedulePersist();
  res.json({ success: true, profileId: entry.profileId, profile: entry });
});

app.get("/api/profiles/search", (req, res) => {
  const q = ((req.query.q as string) || "").trim().toLowerCase();
  const viewerId = ((req.query.viewerId as string) || "").trim();
  const list = q
    ? profileDirectoryStore.filter(
        (p) =>
          p.profileId.toLowerCase().includes(q) ||
          p.username.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.country.toLowerCase().includes(q)
      )
    : profileDirectoryStore;

  res.json(
    list
      .filter((p) => !viewerId || !isMutuallyBlocked(viewerId, p.id))
      .map((p) => {
        const presence = resolveLivePresence(p.id, viewerId);
        return {
          id: p.id,
          profileId: p.profileId,
          name: p.name,
          username: p.username,
          country: p.country,
          gender: p.gender,
          avatar: p.avatar,
          bio: p.bio,
          creatorBadge: p.creatorBadge,
          online: presence.online === true,
          onlineVisible: presence.onlineVisible,
          subscribersCount: p.subscribersCount,
          monthlyPrice: p.monthlyPrice,
          yearlyPrice: p.yearlyPrice,
          livestreamUrl: p.livestreamUrl || "",
        };
      })
  );
});

app.get("/api/profiles/by-id/:profileId", (req, res) => {
  const target = String(req.params.profileId || "").trim().toLowerCase();
  const viewerId = ((req.query.viewerId as string) || "").trim();
  const found = profileDirectoryStore.find(
    (p) =>
      p.profileId.toLowerCase() === target ||
      p.username.toLowerCase() === target ||
      p.id.toLowerCase() === target
  );
  if (!found || (viewerId && isMutuallyBlocked(viewerId, found.id))) {
    return res.status(404).json({ error: "Profile ID not found" });
  }
  const presence = resolveLivePresence(found.id, viewerId);
  res.json({
    id: found.id,
    profileId: found.profileId,
    name: found.name,
    username: found.username,
    country: found.country,
    gender: found.gender,
    avatar: found.avatar,
    bio: found.bio,
    creatorBadge: found.creatorBadge,
    online: presence.online === true,
    onlineVisible: presence.onlineVisible,
    subscribersCount: found.subscribersCount,
    monthlyPrice: found.monthlyPrice,
    yearlyPrice: found.yearlyPrice,
    livestreamUrl: found.livestreamUrl || "",
  });
});

// --- WEBRTC STUN / TURN ICE SERVER CONFIG ---
app.get("/api/webrtc/config", (_req, res) => {
  const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ];

  const turnUrl = (process.env.TURN_URL || "").trim();
  const turnUser = (process.env.TURN_USERNAME || "").trim();
  const turnCred = (process.env.TURN_CREDENTIAL || "").trim();
  const turnConfigured = Boolean(turnUrl);

  if (turnConfigured) {
    iceServers.push({
      urls: turnUrl,
      ...(turnUser ? { username: turnUser } : {}),
      ...(turnCred ? { credential: turnCred } : {}),
    });
  }

  res.json({
    iceServers,
    stunConfigured: true,
    turnConfigured,
  });
});

// --- USER MATCHING & VOLUNTARY PREFERENCES ---
app.get("/api/preferences/:userId", (req, res) => {
  const userId = String(req.params.userId || "guest-user").trim();
  const existing = userPreferencesStore.get(userId);
  res.json(
    existing || {
      userId,
      targetGender: "any",
      targetCountry: "all",
      voluntaryGender: "",
      preferredQuality: "HD",
      updatedAt: new Date().toISOString(),
    }
  );
});

app.post("/api/preferences/:userId", (req, res) => {
  const userId = String(req.params.userId || "guest-user").trim();
  const { targetGender, targetCountry, voluntaryGender, preferredQuality } = req.body || {};
  const record: UserPreferencesRecord = {
    userId,
    targetGender: ["girls", "boys", "any"].includes(targetGender) ? targetGender : "any",
    targetCountry: String(targetCountry || "all").slice(0, 80),
    voluntaryGender: voluntaryGender ? String(voluntaryGender).slice(0, 32) : "",
    preferredQuality: ["SD", "HD", "4K"].includes(preferredQuality) ? preferredQuality : "HD",
    updatedAt: new Date().toISOString(),
  };
  userPreferencesStore.set(userId, record);
  schedulePersist();
  res.json({ success: true, preferences: record });
});

// --- SERVER-VALIDATED 18+ ADULT AGE VERIFICATION (NEVER EXPOSES RAW DOCS/DOB PUBLICLY) ---
app.get("/api/age-verification/:userId", (req, res) => {
  const userId = String(req.params.userId || "guest-user").trim();
  const susp = isAccountSuspended(userId);
  const rec = getAgeVerificationForUser(userId);
  const thirdPartyKycConfigured = Boolean(process.env.AGE_VERIFICATION_PROVIDER_KEY);

  if (susp.suspended) {
    return res.json({
      userId,
      status: "suspended",
      verified: false,
      isAdult: false,
      suspendedReason: susp.reason,
      thirdPartyKycConfigured,
    });
  }

  if (!rec) {
    return res.json({
      userId,
      status: "unverified",
      verified: false,
      isAdult: false,
      thirdPartyKycConfigured,
    });
  }

  res.json({
    userId: rec.userId,
    status: rec.status,
    verified: rec.status === "verified" && rec.age >= 18,
    isAdult: rec.age >= 18,
    method: rec.method,
    verifiedAt: rec.verifiedAt,
    suspendedReason: rec.suspendedReason,
    thirdPartyKycConfigured,
  });
});

app.post("/api/age-verification/submit", (req, res) => {
  const { userId, birthDate, idDocType, idLast4, issuingCountry, adultAttestation } = req.body || {};
  const cleanUserId = String(userId || "").trim();
  const thirdPartyKycConfigured = Boolean(process.env.AGE_VERIFICATION_PROVIDER_KEY);

  if (!cleanUserId || cleanUserId === "guest-user") {
    return res.status(400).json({ error: "Please sign in or enter a user profile identifier first." });
  }
  if (!checkRateLimit(`age-verify:${cleanUserId}`, 10, 60_000)) {
    return res.status(429).json({ error: "Too many verification attempts. Please wait a minute." });
  }
  const susp = isAccountSuspended(cleanUserId);
  if (susp.suspended) {
    return res.status(403).json({ error: `Account is suspended: ${susp.reason || "Safety violation."}` });
  }

  if (adultAttestation !== true) {
    return res.status(400).json({ error: "Explicit 18+ adult attestation is required." });
  }
  if (!birthDate || typeof birthDate !== "string") {
    return res.status(400).json({ error: "Valid calendar date of birth is required (a checkbox or Google login alone is not sufficient)." });
  }
  const validDocTypes = ["passport", "national_id", "driver_license"];
  if (!validDocTypes.includes(idDocType)) {
    return res.status(400).json({ error: "Select a valid government ID document type (Passport, National ID, or Driver License)." });
  }
  const cleanRef = String(idLast4 || "").replace(/[^a-zA-Z0-9]/g, "");
  if (cleanRef.length < 4 || cleanRef.length > 12) {
    return res.status(400).json({ error: "Enter the last 4-8 alphanumeric characters of your ID document for age-assurance verification." });
  }
  if (!issuingCountry || String(issuingCountry).trim().length < 2) {
    return res.status(400).json({ error: "ID issuing country is required." });
  }

  const age = computeAgeFromBirthDate(birthDate);
  if (age < 0 || age > 125) {
    return res.status(400).json({ error: "Invalid birth date provided." });
  }

  const idRefHash = crypto
    .createHash("sha256")
    .update(`${cleanUserId}:${idDocType}:${cleanRef.slice(-4)}`)
    .digest("hex")
    .slice(0, 24);

  if (age < 18) {
    const rejected: AgeVerificationRecord = {
      userId: cleanUserId,
      status: "rejected",
      method: "dob_and_id_assurance",
      age,
      idDocType,
      idRefHash,
      issuingCountry: String(issuingCountry).trim().slice(0, 80),
      updatedAt: new Date().toISOString(),
    };
    ageVerificationStore.set(cleanUserId, rejected);
    schedulePersist();
    return res.status(403).json({
      error: "Access Denied: You must be at least 18 years old to use restricted OrioLiveCall live-video features.",
      status: "rejected",
      verified: false,
      isAdult: false,
      thirdPartyKycConfigured,
    });
  }

  const verifiedRecord: AgeVerificationRecord = {
    userId: cleanUserId,
    status: "verified",
    method: "dob_and_id_assurance",
    age,
    idDocType,
    idRefHash,
    issuingCountry: String(issuingCountry).trim().slice(0, 80),
    verifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  ageVerificationStore.set(cleanUserId, verifiedRecord);
  schedulePersist();

  res.json({
    success: true,
    userId: cleanUserId,
    status: "verified",
    verified: true,
    isAdult: true,
    method: verifiedRecord.method,
    verifiedAt: verifiedRecord.verifiedAt,
    thirdPartyKycConfigured,
  });
});

// --- PAYMENT METHODS CENTER (BANK TRANSFER, DEBIT/CREDIT CARD, MOBILE BANKING) ---
app.get("/api/payment-methods/:userId", (req, res) => {
  const userId = req.params.userId || "guest-user";
  res.json(paymentMethodsStore.get(userId) || []);
});

app.post("/api/payment-methods/add", (req, res) => {
  const { userId, methodType, provider, label, accountNumber, holderName, expiry, setDefault } = req.body || {};
  if (!userId || !methodType || !provider || !accountNumber) {
    return res.status(400).json({ error: "Payment provider and account/card identifier are required" });
  }
  if (!["bank_transfer", "debit_card", "credit_card", "mobile_banking"].includes(methodType)) {
    return res.status(400).json({ error: "Unsupported payment method type" });
  }

  const list = paymentMethodsStore.get(userId) || [];
  const makeDefault = Boolean(setDefault) || list.length === 0;
  if (makeDefault) {
    for (const item of list) item.isDefault = false;
  }

  const method: PaymentMethodRecord = {
    id: `PM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId,
    methodType,
    provider: String(provider).trim().slice(0, 80),
    label: String(label || `${provider} (${methodType.replace("_", " ")})`).trim().slice(0, 100),
    maskedNumber: maskAccountIdentifier(String(accountNumber), methodType),
    holderName: String(holderName || "Verified Account Holder").trim().slice(0, 100),
    expiry: expiry ? String(expiry).trim().slice(0, 16) : undefined,
    isDefault: makeDefault,
    verified: true,
    createdAt: new Date().toISOString(),
  };

  list.unshift(method);
  paymentMethodsStore.set(userId, list);
  schedulePersist();
  res.json({ success: true, method, methods: list });
});

app.post("/api/payment-methods/default", (req, res) => {
  const { userId, methodId } = req.body || {};
  const list = paymentMethodsStore.get(userId) || [];
  const found = list.find((m) => m.id === methodId);
  if (!found) return res.status(404).json({ error: "Payment method not found" });
  for (const item of list) item.isDefault = item.id === methodId;
  paymentMethodsStore.set(userId, list);
  schedulePersist();
  res.json({ success: true, methods: list });
});

app.delete("/api/payment-methods/:userId/:methodId", (req, res) => {
  const { userId, methodId } = req.params;
  const list = paymentMethodsStore.get(userId) || [];
  const next = list.filter((m) => m.id !== methodId);
  if (next.length > 0 && !next.some((m) => m.isDefault)) {
    next[0].isDefault = true;
  }
  paymentMethodsStore.set(userId, next);
  schedulePersist();
  res.json({ success: true, methods: next });
});

app.post("/api/payment-methods/topup", (req, res) => {
  const { userId, methodId, amount } = req.body || {};
  const numericAmount = Number(amount);
  if (!userId || !numericAmount || numericAmount <= 0 || numericAmount > 10000) {
    return res.status(400).json({ error: "Enter a valid deposit amount between $1 and $10,000 USD" });
  }

  const list = paymentMethodsStore.get(userId) || [];
  const pm = list.find((m) => m.id === methodId) || list.find((m) => m.isDefault);
  if (!pm) {
    return res.status(400).json({ error: "Please add and select a verified payment method first" });
  }

  const wallet = getOrCreateWallet(userId);
  wallet.balance = Number((wallet.balance + numericAmount).toFixed(2));
  const txId = `ORIO-DEP-${Math.floor(100000 + Math.random() * 900000)}`;
  wallet.transactions.unshift({
    txId,
    type: "deposit",
    amount: numericAmount,
    currency: "USD",
    counterparty: `${pm.provider} (${pm.maskedNumber})`,
    status: "completed",
    timestamp: new Date().toISOString(),
    description: `Verified Wallet Top-Up via ${pm.label}`,
  });

  schedulePersist();
  res.json({ success: true, txId, newBalance: wallet.balance, wallet });
});

// --- VIDEO SEARCH, FREE WATCH, PRIVATE PERMISSIONS & REAL VIDEO STREAMING ---
app.get("/api/videos/suggestions", (req, res) => {
  const q = ((req.query.q as string) || "").trim().toLowerCase();
  const visible = videosStore.filter((v) => v.moderationStatus !== "removed" && v.visibility !== "private");
  const pool = new Set<string>();
  for (const v of visible) {
    if (!q || v.title.toLowerCase().includes(q)) pool.add(v.title);
    if (!q || v.creatorName.toLowerCase().includes(q)) pool.add(v.creatorName);
    if (!q || v.category.toLowerCase().includes(q)) pool.add(v.category);
    for (const tag of v.hashtags) {
      if (!q || tag.toLowerCase().includes(q)) pool.add(`#${tag}`);
    }
  }
  res.json(Array.from(pool).slice(0, 8));
});

app.get("/api/videos", (req, res) => {
  const q = ((req.query.q as string) || "").trim().toLowerCase();
  const category = ((req.query.category as string) || "").trim();
  const visibility = ((req.query.visibility as string) || "").trim();
  const creatorId = ((req.query.creatorId as string) || "").trim();
  const safeOnly = req.query.safeOnly !== "false";
  const sort = ((req.query.sort as string) || "recent").trim();
  const viewerId = ((req.query.viewerId as string) || "guest-user").trim();

  let list = videosStore.filter((v) => v.moderationStatus !== "removed");

  // Private videos are hidden unless caller is creator or explicitly authorized viewer
  list = list.filter((v) => {
    if (v.visibility !== "private") return true;
    return v.creatorId === viewerId || v.allowedViewers.includes(viewerId);
  });

  if (safeOnly) {
    list = list.filter((v) => v.safeContent);
  }
  if (category && category !== "All") {
    list = list.filter((v) => v.category.toLowerCase() === category.toLowerCase());
  }
  if (visibility && visibility !== "all") {
    list = list.filter((v) => v.visibility === visibility);
  }
  if (creatorId) {
    list = list.filter((v) => v.creatorId === creatorId);
  }
  if (q) {
    const cleanQ = q.replace(/^#/, "");
    list = list.filter(
      (v) =>
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.creatorName.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.hashtags.some((h) => h.toLowerCase().includes(cleanQ))
    );
  }

  if (sort === "trending") {
    list = [...list].sort((a, b) => b.likedBy.length * 3 + b.views - (a.likedBy.length * 3 + a.views));
  } else {
    list = [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  res.json(list.map((v) => serializeVideoForViewer(v, viewerId)));
});

app.get("/api/videos/:id", (req, res) => {
  const viewerId = ((req.query.viewerId as string) || "guest-user").trim();
  const video = videosStore.find((v) => v.id === req.params.id);
  if (!video || video.moderationStatus === "removed") {
    return res.status(404).json({ error: "Video not found" });
  }
  const serialized = serializeVideoForViewer(video, viewerId);
  const related = videosStore
    .filter(
      (v) =>
        v.id !== video.id &&
        v.moderationStatus !== "removed" &&
        (v.visibility !== "private" || v.creatorId === viewerId || v.allowedViewers.includes(viewerId))
    )
    .slice(0, 6)
    .map((v) => serializeVideoForViewer(v, viewerId));

  res.json({ video: serialized, related });
});

// Backend-enforced video streaming endpoint (supports local disk Range streaming & blocks unauthorized private/premium access)
app.get("/api/videos/:id/stream", (req, res) => {
  const viewerId = ((req.query.viewerId as string) || "guest-user").trim();
  const video = videosStore.find((v) => v.id === req.params.id);
  if (!video) {
    return res.status(404).json({ error: "Video not found" });
  }

  const access = canViewerAccessVideo(video, viewerId);
  if (!access.hasAccess) {
    return res.status(403).json({ error: access.reason || "Unauthorized access to private or premium video" });
  }

  if (video.localFilename) {
    const filePath = path.join(UPLOAD_DIR, video.localFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Video file missing on storage" });
    }
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === ".webm" ? "video/webm" : ext === ".mov" ? "video/quicktime" : "video/mp4";

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mime,
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": mime,
      });
      fs.createReadStream(filePath).pipe(res);
    }
    return;
  }

  if (video.externalUrl) {
    return res.redirect(video.externalUrl);
  }
  res.status(404).json({ error: "No playable video source available" });
});

app.post("/api/videos/upload", upload.single("videoFile"), (req, res) => {
  try {
    const {
      creatorId,
      creatorName,
      creatorAvatar,
      title,
      description,
      category,
      hashtags,
      visibility,
      allowedViewers,
      externalUrl,
      thumbnailUrl,
    } = req.body;

    if (!title || typeof title !== "string" || title.trim().length < 2) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: "Video title is required" });
    }

    const modCheck = moderateText(`${title} ${description || ""} ${hashtags || ""}`);
    if (!modCheck.ok) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: modCheck.reason });
    }

    const cleanTags = Array.isArray(hashtags)
      ? hashtags
      : String(hashtags || "")
          .split(/[,\s#]+/)
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 10);

    const cleanViewers = Array.isArray(allowedViewers)
      ? allowedViewers
      : String(allowedViewers || "")
          .split(/[,\s]+/)
          .map((v) => v.trim())
          .filter(Boolean);

    const vis: "public" | "private" | "premium" =
      visibility === "private" || visibility === "premium" ? visibility : "public";

    if (!req.file && !externalUrl) {
      return res.status(400).json({ error: "Please attach a video file or provide a valid non-explicit video URL." });
    }

    const newVideo: VideoRecord = {
      id: `vid-${Date.now()}`,
      creatorId: creatorId || "guest-user",
      creatorName: creatorName || "Orio Creator",
      creatorAvatar: creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
      title: title.trim().slice(0, 160),
      description: (description || "").trim().slice(0, 1000),
      category: category || "Lifestyle",
      hashtags: cleanTags,
      visibility: vis,
      allowedViewers: cleanViewers,
      localFilename: req.file ? req.file.filename : undefined,
      externalUrl: !req.file ? String(externalUrl).trim() : undefined,
      thumbnailUrl:
        thumbnailUrl && String(thumbnailUrl).trim()
          ? String(thumbnailUrl).trim()
          : "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600",
      safeContent: true,
      moderationStatus: "approved",
      views: 0,
      likedBy: [],
      createdAt: new Date().toISOString(),
    };

    videosStore.unshift(newVideo);
    schedulePersist();
    res.json({ success: true, video: serializeVideoForViewer(newVideo, newVideo.creatorId) });
  } catch (err: any) {
    console.error("Video upload error:", err);
    res.status(500).json({ error: err.message || "Failed to upload video" });
  }
});

app.patch("/api/videos/:id", (req, res) => {
  const { creatorId, visibility, allowedViewers, title, description, category } = req.body;
  const video = videosStore.find((v) => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });
  if (video.creatorId !== creatorId) return res.status(403).json({ error: "Only the creator can modify this video" });

  const modCheck = moderateText(`${title || ""} ${description || ""}`);
  if (!modCheck.ok) return res.status(400).json({ error: modCheck.reason });

  if (visibility === "public" || visibility === "private" || visibility === "premium") video.visibility = visibility;
  if (title) video.title = String(title).trim().slice(0, 160);
  if (description !== undefined) video.description = String(description).trim().slice(0, 1000);
  if (category) video.category = String(category).trim().slice(0, 40);
  if (allowedViewers !== undefined) {
    video.allowedViewers = Array.isArray(allowedViewers)
      ? allowedViewers
      : String(allowedViewers).split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  }
  schedulePersist();
  res.json({ success: true, video: serializeVideoForViewer(video, creatorId) });
});

app.delete("/api/videos/:id", (req, res) => {
  const creatorId = (req.query.creatorId as string) || req.body?.creatorId;
  const idx = videosStore.findIndex((v) => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Video not found" });
  if (videosStore[idx].creatorId !== creatorId) return res.status(403).json({ error: "Only the creator can delete this video" });

  const removed = videosStore.splice(idx, 1)[0];
  if (removed.localFilename) {
    fs.unlink(path.join(UPLOAD_DIR, removed.localFilename), () => {});
  }
  schedulePersist();
  res.json({ success: true });
});

// Database-backed Like / Unlike (no fake likes)
app.post("/api/videos/:id/like", (req, res) => {
  const userId = req.body?.userId || "guest-user";
  const video = videosStore.find((v) => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });

  const idx = video.likedBy.indexOf(userId);
  let liked = false;
  if (idx >= 0) {
    video.likedBy.splice(idx, 1);
    liked = false;
  } else {
    video.likedBy.push(userId);
    liked = true;
  }
  schedulePersist();
  res.json({ success: true, liked, likesCount: video.likedBy.length });
});

// Record view + Watch History
app.post("/api/videos/:id/view", (req, res) => {
  const userId = req.body?.userId || "guest-user";
  const video = videosStore.find((v) => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });

  const access = canViewerAccessVideo(video, userId);
  if (!access.hasAccess) return res.status(403).json({ error: access.reason });

  video.views += 1;
  const history = watchHistoryStore.get(userId) || [];
  const filtered = [video.id, ...history.filter((id) => id !== video.id)].slice(0, 30);
  watchHistoryStore.set(userId, filtered);
  schedulePersist();
  res.json({ success: true, views: video.views });
});

// Toggle Saved Video
app.post("/api/videos/:id/save", (req, res) => {
  const userId = req.body?.userId || "guest-user";
  const video = videosStore.find((v) => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: "Video not found" });

  const list = savedVideosStore.get(userId) || [];
  const idx = list.indexOf(video.id);
  let saved = false;
  if (idx >= 0) {
    list.splice(idx, 1);
    saved = false;
  } else {
    list.unshift(video.id);
    saved = true;
  }
  savedVideosStore.set(userId, list);
  schedulePersist();
  res.json({ success: true, saved });
});

app.get("/api/user/:userId/library", (req, res) => {
  const userId = req.params.userId || "guest-user";
  const histIds = watchHistoryStore.get(userId) || [];
  const savedIds = savedVideosStore.get(userId) || [];

  const watchHistory = histIds
    .map((id) => videosStore.find((v) => v.id === id))
    .filter((v): v is VideoRecord => Boolean(v && v.moderationStatus !== "removed"))
    .map((v) => serializeVideoForViewer(v, userId));

  const savedVideos = savedIds
    .map((id) => videosStore.find((v) => v.id === id))
    .filter((v): v is VideoRecord => Boolean(v && v.moderationStatus !== "removed"))
    .map((v) => serializeVideoForViewer(v, userId));

  res.json({ watchHistory, savedVideos });
});

// --- FOLLOW & PAID CREATOR SUBSCRIPTIONS ---
app.get("/api/subscriptions/:userId", (req, res) => {
  const userId = req.params.userId || "guest-user";
  const follows = followsStore.get(userId) || [];
  const subs = subscriptionsStore.filter((s) => s.userId === userId);
  const passes = livePassesStore.filter((p) => p.userId === userId);

  // Follower & subscriber counts by creator
  const followerCounts: Record<string, number> = {};
  for (const [, fList] of followsStore.entries()) {
    for (const cid of fList) {
      followerCounts[cid] = (followerCounts[cid] || 0) + 1;
    }
  }
  const subscriberCounts: Record<string, number> = {};
  const now = Date.now();
  for (const s of subscriptionsStore) {
    if (s.status === "active" && new Date(s.expiresAt).getTime() > now) {
      subscriberCounts[s.creatorId] = (subscriberCounts[s.creatorId] || 0) + 1;
    }
  }

  // New uploads from followed/subscribed creators
  const followedOrSubbed = new Set([...follows, ...subs.filter((s) => s.status === "active").map((s) => s.creatorId)]);
  const recentCreatorUploads = videosStore
    .filter((v) => followedOrSubbed.has(v.creatorId) && v.moderationStatus !== "removed")
    .filter((v) => v.visibility !== "private" || v.allowedViewers.includes(userId))
    .slice(0, 6)
    .map((v) => serializeVideoForViewer(v, userId));

  res.json({
    follows,
    subscriptions: subs,
    livePasses: passes,
    followerCounts,
    subscriberCounts,
    recentCreatorUploads,
  });
});

app.post("/api/subscriptions/follow", (req, res) => {
  const { userId, creatorId } = req.body;
  if (!userId || !creatorId) return res.status(400).json({ error: "userId and creatorId required" });

  const current = followsStore.get(userId) || [];
  const idx = current.indexOf(creatorId);
  let following = false;
  if (idx >= 0) {
    current.splice(idx, 1);
    following = false;
  } else {
    current.push(creatorId);
    following = true;
  }
  followsStore.set(userId, current);
  schedulePersist();
  res.json({ success: true, following, follows: current });
});

app.post("/api/subscriptions/purchase", (req, res) => {
  const { userId, creatorId, creatorName, plan, planScope, price, autoRenew, paymentMethodId } = req.body;
  const numericPrice = Number(price);
  if (!userId || !creatorId || !numericPrice || numericPrice <= 0) {
    return res.status(400).json({ error: "Invalid subscription details" });
  }

  const wallet = getOrCreateWallet(userId);
  const methods = paymentMethodsStore.get(userId) || [];
  const chosenMethod = paymentMethodId ? methods.find((m) => m.id === paymentMethodId) : null;
  let paymentMethodLabel = "OrioLiveCall Wallet Balance";

  if (chosenMethod) {
    paymentMethodLabel = `${chosenMethod.provider} (${chosenMethod.maskedNumber})`;
  } else if (wallet.balance < numericPrice) {
    return res.status(400).json({
      error: "Insufficient wallet balance. Add a payment method or top up in Payment Methods Center.",
    });
  } else {
    wallet.balance = Number((wallet.balance - numericPrice).toFixed(2));
  }

  const txId = `ORIO-SUB-${Math.floor(100000 + Math.random() * 900000)}`;
  wallet.transactions.unshift({
    txId,
    type: "subscription",
    amount: numericPrice,
    currency: "USD",
    counterparty: creatorName || creatorId,
    status: "completed",
    timestamp: new Date().toISOString(),
    description: `${plan === "yearly" ? "Yearly" : "Monthly"} ${planScope === "platform" ? "Platform Pass" : "Creator Membership"} (${creatorName || creatorId}) via ${paymentMethodLabel}`,
  });

  if (creatorId !== "platform-pass") {
    const creatorWallet = getOrCreateWallet(creatorId);
    creatorWallet.balance = Number((creatorWallet.balance + numericPrice).toFixed(2));
    creatorWallet.transactions.unshift({
      txId,
      type: "receive",
      amount: numericPrice,
      currency: "USD",
      counterparty: userId,
      status: "completed",
      timestamp: new Date().toISOString(),
      description: `Membership revenue from ${userId} (${plan})`,
    });
  }

  const days = plan === "yearly" ? 365 : 30;
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  const renewFlag = Boolean(autoRenew);

  // Replace or update existing subscription
  const existing = subscriptionsStore.find((s) => s.userId === userId && s.creatorId === creatorId);
  let subRecord: SubscriptionRecord;
  if (existing) {
    existing.plan = plan === "yearly" ? "yearly" : "monthly";
    existing.planScope = planScope === "platform" ? "platform" : "creator";
    existing.price = numericPrice;
    existing.status = "active";
    existing.txId = txId;
    existing.paymentMethodLabel = paymentMethodLabel;
    existing.expiresAt = expiresAt;
    existing.renewalDate = expiresAt;
    existing.autoRenew = renewFlag;
    subRecord = existing;
  } else {
    subRecord = {
      id: `sub-${Date.now()}`,
      userId,
      creatorId,
      creatorName: creatorName || creatorId,
      plan: plan === "yearly" ? "yearly" : "monthly",
      planScope: planScope === "platform" ? "platform" : "creator",
      price: numericPrice,
      status: "active",
      txId,
      paymentMethodLabel,
      createdAt: new Date().toISOString(),
      renewalDate: expiresAt,
      expiresAt,
      autoRenew: renewFlag,
    };
    subscriptionsStore.unshift(subRecord);
  }

  schedulePersist();
  res.json({ success: true, subscription: subRecord, txId, newBalance: wallet.balance });
});

app.post("/api/subscriptions/toggle-renew", (req, res) => {
  const { userId, subscriptionId, autoRenew } = req.body || {};
  const sub = subscriptionsStore.find((s) => s.id === subscriptionId && s.userId === userId);
  if (!sub) return res.status(404).json({ error: "Subscription not found" });
  sub.autoRenew = Boolean(autoRenew);
  schedulePersist();
  res.json({ success: true, subscription: sub });
});

app.post("/api/subscriptions/cancel", (req, res) => {
  const { userId, subscriptionId, requestRefund } = req.body;
  const sub = subscriptionsStore.find((s) => s.id === subscriptionId && s.userId === userId);
  if (!sub) return res.status(404).json({ error: "Subscription not found" });

  sub.status = "cancelled";
  sub.autoRenew = false;

  let refunded = false;
  let refundTxId: string | null = null;
  if (requestRefund && Date.now() - new Date(sub.createdAt).getTime() <= 86400000) {
    const wallet = getOrCreateWallet(userId);
    wallet.balance = Number((wallet.balance + sub.price).toFixed(2));
    refundTxId = `ORIO-REF-${Math.floor(100000 + Math.random() * 900000)}`;
    wallet.transactions.unshift({
      txId: refundTxId,
      type: "refund",
      amount: sub.price,
      currency: "USD",
      counterparty: sub.creatorName,
      status: "completed",
      timestamp: new Date().toISOString(),
      description: `24h Guarantee Refund for ${sub.creatorName} membership`,
    });
    refunded = true;
  }

  schedulePersist();
  res.json({ success: true, subscription: sub, refunded, refundTxId });
});

// --- FREE & PREMIUM LIVESTREAMS + MODERATED LIVE CHAT ---
app.get("/api/livestreams", (req, res) => {
  const viewerId = ((req.query.viewerId as string) || "guest-user").trim();
  const list = liveStreamsStore.map((s) => {
    const access = hasLiveAccess(s, viewerId);
    const activePass = livePassesStore.find(
      (p) => p.userId === viewerId && p.streamId === s.id && p.status === "active" && new Date(p.expiresAt).getTime() > Date.now()
    );
    return {
      id: s.id,
      creatorId: s.creatorId,
      creatorName: s.creatorName,
      creatorAvatar: s.creatorAvatar,
      title: s.title,
      description: s.description,
      category: s.category,
      accessType: s.accessType,
      price: s.price,
      thumbnailUrl: s.thumbnailUrl,
      isLive: s.isLive,
      viewerCount: (liveStreamViewers.get(s.id)?.size || 0) + (s.isLive ? 1 : 0),
      likesCount: s.likedBy.length,
      likedByViewer: s.likedBy.includes(viewerId),
      hasAccess: access,
      expiresAt: activePass?.expiresAt || null,
      // Strictly protect Premium Live video URL from unauthorized viewers!
      streamUrl: access ? s.streamUrl : null,
      chatHistory: access ? s.chatHistory.slice(-40) : [],
      createdAt: s.createdAt,
    };
  });
  res.json(list);
});

app.post("/api/livestreams/create", (req, res) => {
  const { creatorId, creatorName, creatorAvatar, title, description, category, accessType, price, streamUrl, thumbnailUrl } = req.body;
  if (!title || typeof title !== "string" || title.trim().length < 3) {
    return res.status(400).json({ error: "Livestream title is required" });
  }
  const mod = moderateText(`${title} ${description || ""}`);
  if (!mod.ok) return res.status(400).json({ error: mod.reason });

  const isPremium = accessType === "premium";
  const ticketPrice = isPremium ? Math.max(1, Number(price || 4.99)) : 0;

  const newStream: LiveStreamRecord = {
    id: `live-${Date.now()}`,
    creatorId: creatorId || "guest-user",
    creatorName: creatorName || "Orio Creator",
    creatorAvatar: creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    title: title.trim().slice(0, 160),
    description: (description || "").trim().slice(0, 500),
    category: category || "Lifestyle",
    accessType: isPremium ? "premium" : "free",
    price: ticketPrice,
    streamUrl: streamUrl || "https://assets.mixkit.co/videos/preview/mixkit-musician-playing-on-stage-with-colorful-lights-41982-large.mp4",
    thumbnailUrl: thumbnailUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600",
    isLive: true,
    likedBy: [],
    createdAt: new Date().toISOString(),
    chatHistory: [],
  };

  liveStreamsStore.unshift(newStream);
  schedulePersist();
  io.emit("livestreams-updated");
  res.json({ success: true, stream: newStream });
});

app.post("/api/livestreams/:id/end", (req, res) => {
  const { creatorId } = req.body;
  const stream = liveStreamsStore.find((s) => s.id === req.params.id);
  if (!stream) return res.status(404).json({ error: "Stream not found" });
  if (stream.creatorId !== creatorId) return res.status(403).json({ error: "Only the creator can end this stream" });
  stream.isLive = false;
  schedulePersist();
  io.emit("livestreams-updated");
  res.json({ success: true });
});

app.post("/api/livestreams/:id/like", (req, res) => {
  const userId = req.body?.userId || "guest-user";
  const stream = liveStreamsStore.find((s) => s.id === req.params.id);
  if (!stream) return res.status(404).json({ error: "Stream not found" });

  const idx = stream.likedBy.indexOf(userId);
  let liked = false;
  if (idx >= 0) {
    stream.likedBy.splice(idx, 1);
    liked = false;
  } else {
    stream.likedBy.push(userId);
    liked = true;
  }
  schedulePersist();
  res.json({ success: true, liked, likesCount: stream.likedBy.length });
});

app.post("/api/livestreams/:id/purchase", (req, res) => {
  const { userId } = req.body;
  const stream = liveStreamsStore.find((s) => s.id === req.params.id);
  if (!stream) return res.status(404).json({ error: "Livestream not found" });
  if (stream.accessType === "free") return res.json({ success: true, hasAccess: true });

  const wallet = getOrCreateWallet(userId);
  if (wallet.balance < stream.price) {
    return res.status(400).json({ error: "Insufficient wallet balance to unlock this Premium Live event" });
  }

  wallet.balance = Number((wallet.balance - stream.price).toFixed(2));
  const txId = `ORIO-LIVE-${Math.floor(100000 + Math.random() * 900000)}`;
  wallet.transactions.unshift({
    txId,
    type: "live_ticket",
    amount: stream.price,
    currency: "USD",
    counterparty: stream.creatorName,
    status: "completed",
    timestamp: new Date().toISOString(),
    description: `Premium Live Pass: ${stream.title} (24h access)`,
  });

  const creatorWallet = getOrCreateWallet(stream.creatorId);
  creatorWallet.balance = Number((creatorWallet.balance + stream.price).toFixed(2));
  creatorWallet.transactions.unshift({
    txId,
    type: "receive",
    amount: stream.price,
    currency: "USD",
    counterparty: userId,
    status: "completed",
    timestamp: new Date().toISOString(),
    description: `Premium Live Ticket Sale: ${stream.title}`,
  });

  const expiresAt = new Date(Date.now() + 86400000).toISOString();
  const pass: LivePassRecord = {
    id: `pass-${Date.now()}`,
    userId,
    streamId: stream.id,
    creatorId: stream.creatorId,
    price: stream.price,
    txId,
    status: "active",
    purchasedAt: new Date().toISOString(),
    expiresAt,
  };
  livePassesStore.unshift(pass);
  schedulePersist();

  res.json({
    success: true,
    pass,
    txId,
    expiresAt,
    newBalance: wallet.balance,
    streamUrl: stream.streamUrl,
  });
});

app.post("/api/livestreams/:id/refund", (req, res) => {
  const { userId } = req.body;
  const pass = livePassesStore.find((p) => p.streamId === req.params.id && p.userId === userId && p.status === "active");
  if (!pass) return res.status(404).json({ error: "Active Premium Live pass not found" });

  // 15-minute buyer protection cancellation/refund policy
  if (Date.now() - new Date(pass.purchasedAt).getTime() > 15 * 60 * 1000) {
    return res.status(400).json({ error: "15-minute cancellation & instant refund window has expired" });
  }

  pass.status = "refunded";
  const wallet = getOrCreateWallet(userId);
  wallet.balance = Number((wallet.balance + pass.price).toFixed(2));
  const refundTxId = `ORIO-LREF-${Math.floor(100000 + Math.random() * 900000)}`;
  wallet.transactions.unshift({
    txId: refundTxId,
    type: "refund",
    amount: pass.price,
    currency: "USD",
    counterparty: pass.creatorId,
    status: "completed",
    timestamp: new Date().toISOString(),
    description: `Premium Live Ticket Refund (${pass.txId})`,
  });
  schedulePersist();
  res.json({ success: true, refundTxId, newBalance: wallet.balance });
});

// --- CREATOR DASHBOARD AGGREGATE ---
app.get("/api/creator/:creatorId/dashboard", (req, res) => {
  const creatorId = req.params.creatorId || "guest-user";
  const myVideos = videosStore
    .filter((v) => v.creatorId === creatorId && v.moderationStatus !== "removed")
    .map((v) => serializeVideoForViewer(v, creatorId));
  const myStreams = liveStreamsStore.filter((s) => s.creatorId === creatorId);
  const mySubscribers = subscriptionsStore.filter((s) => s.creatorId === creatorId && s.status === "active");

  let followerCount = 0;
  for (const [, list] of followsStore.entries()) {
    if (list.includes(creatorId)) followerCount += 1;
  }

  const totalVideoLikes = myVideos.reduce((acc, v) => acc + v.likesCount, 0);
  const wallet = getOrCreateWallet(creatorId);
  const earningsTxs = wallet.transactions.filter((t) => t.type === "receive" || t.type === "gift");
  const totalEarnings = earningsTxs.reduce((acc, t) => acc + t.amount, 0);

  res.json({
    videos: myVideos,
    streams: myStreams,
    subscribers: mySubscribers,
    followerCount,
    totalVideoLikes,
    totalEarnings,
    transactions: wallet.transactions,
  });
});

// --- WALLET & MONEY TRANSFER LEDGER ---
app.get("/api/wallet/:userId?", (req, res) => {
  const userId = req.params.userId || (req.query.userId as string) || "guest-user";
  const wallet = getOrCreateWallet(userId);
  res.json(wallet);
});

app.post("/api/wallet/send", (req, res) => {
  const { senderId, recipientEmail, amount, currency, description } = req.body;
  if (!senderId || !recipientEmail || !amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid transfer parameters" });
  }

  const senderWallet = getOrCreateWallet(senderId);
  if (senderWallet.balance < amount) {
    return res.status(400).json({ error: "Insufficient wallet balance" });
  }

  senderWallet.balance = Number((senderWallet.balance - Number(amount)).toFixed(2));
  const txId = `ORIO-TX-${Math.floor(100000 + Math.random() * 900000)}`;

  senderWallet.transactions.unshift({
    txId,
    type: "send",
    amount: Number(amount),
    currency: currency || "USD",
    counterparty: recipientEmail,
    status: "completed",
    timestamp: new Date().toISOString(),
    description: description || "Global Money Transfer",
  });

  const recipientWallet = getOrCreateWallet(recipientEmail);
  recipientWallet.balance = Number((recipientWallet.balance + Number(amount)).toFixed(2));
  recipientWallet.transactions.unshift({
    txId,
    type: "receive",
    amount: Number(amount),
    currency: currency || "USD",
    counterparty: senderId,
    status: "completed",
    timestamp: new Date().toISOString(),
    description: description || "Global Money Received",
  });

  schedulePersist();
  res.json({ success: true, txId, newBalance: senderWallet.balance });
});

app.post("/api/wallet/withdraw", (req, res) => {
  const { userId, amount, method, accountDetails } = req.body;
  const wallet = getOrCreateWallet(userId);
  if (wallet.balance < amount) {
    return res.status(400).json({ error: "Insufficient balance for withdrawal" });
  }

  wallet.balance = Number((wallet.balance - Number(amount)).toFixed(2));
  const txId = `ORIO-WD-${Math.floor(100000 + Math.random() * 900000)}`;
  wallet.transactions.unshift({
    txId,
    type: "withdraw",
    amount: Number(amount),
    currency: "USD",
    counterparty: method || "Bank/Mobile Banking",
    status: "pending",
    timestamp: new Date().toISOString(),
    description: `Withdrawal request to ${accountDetails || "Account"}`,
  });

  schedulePersist();
  res.json({ success: true, txId, newBalance: wallet.balance });
});

app.post("/api/wallet/dispute", (req, res) => {
  const { userId, txId, reason } = req.body;
  const wallet = getOrCreateWallet(userId);
  const tx = wallet.transactions.find((t) => t.txId === txId);
  if (!tx) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  tx.status = "disputed";
  wallet.transactions.unshift({
    txId: `ORIO-DSP-${Math.floor(100000 + Math.random() * 900000)}`,
    type: "refund",
    amount: tx.amount,
    currency: tx.currency,
    status: "pending",
    timestamp: new Date().toISOString(),
    description: `Dispute filed for TX ${txId}: ${reason}`,
  });

  schedulePersist();
  res.json({ success: true, message: "Dispute registered successfully for review" });
});

// --- PRIVACY-FIRST PRIVATE MESSAGING, GLOBAL FRIENDS & BLOCKS ---
app.get("/api/privacy/:userId", (req, res) => {
  res.json(getPrivacy(req.params.userId || "guest-user"));
});

app.post("/api/privacy/:userId", (req, res) => {
  const userId = req.params.userId || "guest-user";
  const current = getPrivacy(userId);
  const {
    messagingPrivacy,
    allowUnsolicitedRequests,
    showOnlineStatus,
    showInGlobalFriends,
    allowFriendRequests,
  } = req.body || {};

  if (["everyone", "friends", "followers", "subscribers", "nobody"].includes(messagingPrivacy)) {
    current.messagingPrivacy = messagingPrivacy;
  }
  if (typeof allowUnsolicitedRequests === "boolean") {
    current.allowUnsolicitedRequests = allowUnsolicitedRequests;
  }
  if (typeof showOnlineStatus === "boolean") {
    current.showOnlineStatus = showOnlineStatus;
  }
  if (typeof showInGlobalFriends === "boolean") {
    current.showInGlobalFriends = showInGlobalFriends;
  }
  if (typeof allowFriendRequests === "boolean") {
    current.allowFriendRequests = allowFriendRequests;
  }

  userPrivacyStore.set(userId, current);
  schedulePersist();
  const visibleOnlineIds = Array.from(onlineUsers.keys()).filter(
    (id) => findPrivacyForAliases(id).showOnlineStatus === true
  );
  io.emit("presence-update", { onlineUserIds: visibleOnlineIds });
  res.json({ success: true, privacy: current });
});

app.post("/api/privacy/block", (req, res) => {
  const { userId, targetId, block, reason } = req.body || {};
  if (!userId || !targetId) return res.status(400).json({ error: "userId and targetId required" });
  if (!checkRateLimit(`block:${userId}`, 30, 60_000)) {
    return res.status(429).json({ error: "Too many block updates. Slow down." });
  }

  const privacy = getPrivacy(userId);
  const shouldBlock = block !== false;

  if (!shouldBlock) {
    privacy.blockedUsers = privacy.blockedUsers.filter((id) => id !== targetId);
    for (let i = blockedUsersStore.length - 1; i >= 0; i--) {
      if (blockedUsersStore[i].blockerId === userId && blockedUsersStore[i].blockedId === targetId) {
        blockedUsersStore.splice(i, 1);
      }
    }
  } else {
    if (!privacy.blockedUsers.includes(targetId)) {
      privacy.blockedUsers.push(targetId);
    }
    if (!blockedUsersStore.some((b) => b.blockerId === userId && b.blockedId === targetId)) {
      blockedUsersStore.unshift({
        id: `BLK-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        blockerId: userId,
        blockedId: targetId,
        reason: reason ? String(reason).slice(0, 200) : undefined,
        createdAt: new Date().toISOString(),
      });
    }
    // Cancel pending friend requests & remove any friendship between blocked users
    for (const r of friendRequestsStore) {
      if (
        r.status === "pending" &&
        ((r.senderId === userId && r.recipientId === targetId) ||
          (r.senderId === targetId && r.recipientId === userId))
      ) {
        r.status = "cancelled";
        r.updatedAt = new Date().toISOString();
      }
    }
    for (let i = friendshipsStore.length - 1; i >= 0; i--) {
      const f = friendshipsStore[i];
      if ((f.userAId === userId && f.userBId === targetId) || (f.userAId === targetId && f.userBId === userId)) {
        friendshipsStore.splice(i, 1);
      }
    }
  }

  userPrivacyStore.set(userId, privacy);
  schedulePersist();
  res.json({ success: true, blockedUsers: privacy.blockedUsers });
});

// --- GLOBAL FRIENDS DISCOVERY, FRIEND REQUESTS & RELATIONSHIPS ---
app.get("/api/friends/directory", (req, res) => {
  const viewerId = String(req.query.viewerId || "").trim();
  const q = String(req.query.q || "").trim().toLowerCase();
  const country = String(req.query.country || "all").trim().toLowerCase();
  const gender = String(req.query.gender || "all").trim().toLowerCase();

  const viewerAliases = viewerId ? getUserAliases(viewerId) : new Set<string>();

  const results = profileDirectoryStore
    .filter((p) => {
      if (viewerId && (viewerAliases.has(p.id) || viewerAliases.has(p.profileId) || viewerAliases.has(p.accountKey))) {
        return false;
      }
      if (viewerId && isMutuallyBlocked(viewerId, p.id)) return false;
      const priv = findPrivacyForAliases(p.id);
      if (priv.showInGlobalFriends === false) return false;
      const susp = isAccountSuspended(p.id);
      if (susp.suspended) return false;

      if (country && country !== "all" && p.country.toLowerCase() !== country) return false;
      if (gender && gender !== "all" && p.gender.toLowerCase() !== gender) return false;
      if (q) {
        const hay = `${p.profileId} ${p.username} ${p.name} ${p.country}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .map((p) => {
      const priv = findPrivacyForAliases(p.id);
      const presence = resolveLivePresence(p.id, viewerId);
      const targetAliases = getUserAliases(p.id);
      const friend = viewerId ? areFriends(viewerId, p.id) : false;

      let friendshipStatus: "none" | "friends" | "outgoing_pending" | "incoming_pending" = friend ? "friends" : "none";
      let pendingRequestId: string | undefined;

      if (!friend && viewerId) {
        const outgoing = friendRequestsStore.find(
          (r) => r.status === "pending" && viewerAliases.has(r.senderId) && targetAliases.has(r.recipientId)
        );
        const incoming = friendRequestsStore.find(
          (r) => r.status === "pending" && targetAliases.has(r.senderId) && viewerAliases.has(r.recipientId)
        );
        if (outgoing) {
          friendshipStatus = "outgoing_pending";
          pendingRequestId = outgoing.id;
        } else if (incoming) {
          friendshipStatus = "incoming_pending";
          pendingRequestId = incoming.id;
        }
      }

      const canMessage =
        priv.messagingPrivacy !== "nobody" &&
        (priv.messagingPrivacy === "everyone" ||
          friend ||
          priv.allowUnsolicitedRequests ||
          (viewerId ? hasActiveCreatorSubscription(viewerId, p.id) : false));

      return {
        id: p.id,
        profileId: p.profileId,
        name: p.name,
        username: p.username,
        country: p.country,
        gender: p.gender,
        avatar: p.avatar,
        bio: p.bio,
        creatorBadge: p.creatorBadge,
        online: presence.online, // null if showOnlineStatus is false
        onlineVisible: presence.onlineVisible,
        friendshipStatus,
        pendingRequestId,
        allowFriendRequests: priv.allowFriendRequests !== false,
        messagingPrivacy: priv.messagingPrivacy,
        canMessage,
        isBlocked: false,
      };
    });

  res.json(results);
});

app.get("/api/friends/:userId", (req, res) => {
  const userId = String(req.params.userId || "guest-user").trim();
  const aliases = getUserAliases(userId);
  const priv = getPrivacy(userId);

  const friends = friendshipsStore
    .filter((f) => aliases.has(f.userAId) || aliases.has(f.userBId))
    .map((f) => {
      const friendId = aliases.has(f.userAId) ? f.userBId : f.userAId;
      const prof = profileDirectoryStore.find(
        (p) => p.id === friendId || p.profileId === friendId || p.accountKey === friendId
      );
      const presence = resolveLivePresence(friendId, userId);
      const targetPriv = findPrivacyForAliases(friendId);
      return {
        id: prof?.id || friendId,
        profileId: prof?.profileId || friendId,
        name: prof?.name || friendId,
        username: prof?.username || `@${friendId}`,
        country: prof?.country || "Global",
        gender: prof?.gender || "Not set",
        avatar: prof?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
        bio: prof?.bio || "OrioLiveCall Friend",
        creatorBadge: prof?.creatorBadge ?? false,
        online: presence.online,
        onlineVisible: presence.onlineVisible,
        friendshipStatus: "friends" as const,
        allowFriendRequests: targetPriv.allowFriendRequests !== false,
        messagingPrivacy: targetPriv.messagingPrivacy,
        canMessage: targetPriv.messagingPrivacy !== "nobody",
        isBlocked: isMutuallyBlocked(userId, friendId),
      };
    })
    .filter((f) => !f.isBlocked);

  const incomingRequests = friendRequestsStore.filter(
    (r) => r.status === "pending" && aliases.has(r.recipientId) && !isMutuallyBlocked(userId, r.senderId)
  );
  const outgoingRequests = friendRequestsStore.filter(
    (r) => r.status === "pending" && aliases.has(r.senderId) && !isMutuallyBlocked(userId, r.recipientId)
  );

  res.json({
    friends,
    incomingRequests,
    outgoingRequests,
    blockedUsers: priv.blockedUsers,
  });
});

app.post("/api/friends/request", (req, res) => {
  const { senderId, senderName, senderProfileId, senderAvatar, senderCountry, recipientId } = req.body || {};
  const cleanSender = String(senderId || "").trim();
  const cleanRecipient = String(recipientId || "").trim();

  if (!cleanSender || !cleanRecipient || cleanSender === "guest-user") {
    return res.status(400).json({ error: "Valid signed-in senderId and recipientId are required." });
  }
  if (!checkRateLimit(`friend-req:${cleanSender}`, 20, 60_000)) {
    return res.status(429).json({ error: "Too many friend requests sent recently. Please slow down." });
  }
  const senderAliases = getUserAliases(cleanSender);
  const recAliases = getUserAliases(cleanRecipient);
  for (const s of senderAliases) {
    if (recAliases.has(s)) {
      return res.status(400).json({ error: "You cannot send a friend request to yourself." });
    }
  }
  if (isMutuallyBlocked(cleanSender, cleanRecipient)) {
    return res.status(403).json({ error: "Cannot send friend request due to block settings." });
  }

  const targetPrivacy = findPrivacyForAliases(cleanRecipient);
  if (targetPrivacy.allowFriendRequests === false) {
    return res.status(403).json({ error: "This user is not accepting friend requests right now." });
  }

  if (areFriends(cleanSender, cleanRecipient)) {
    return res.status(400).json({ error: "You are already friends." });
  }

  const existing = friendRequestsStore.find(
    (r) =>
      r.status === "pending" &&
      ((senderAliases.has(r.senderId) && recAliases.has(r.recipientId)) ||
        (recAliases.has(r.senderId) && senderAliases.has(r.recipientId)))
  );
  if (existing) {
    return res.status(400).json({ error: "A friend request is already pending between you." });
  }

  const recProfile = profileDirectoryStore.find(
    (p) => p.id === cleanRecipient || p.profileId === cleanRecipient || p.accountKey === cleanRecipient
  );

  const requestRecord: FriendRequestRecord = {
    id: `FR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    senderId: cleanSender,
    senderName: String(senderName || "Orio Member").slice(0, 100),
    senderProfileId: senderProfileId ? String(senderProfileId).slice(0, 32) : undefined,
    senderAvatar: senderAvatar ? String(senderAvatar).slice(0, 500) : undefined,
    senderCountry: senderCountry ? String(senderCountry).slice(0, 80) : undefined,
    recipientId: recProfile?.id || cleanRecipient,
    recipientName: recProfile?.name || cleanRecipient,
    recipientProfileId: recProfile?.profileId,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  friendRequestsStore.unshift(requestRecord);
  schedulePersist();
  io.to(requestRecord.recipientId).emit("friend-request-received", requestRecord);
  res.json({ success: true, request: requestRecord });
});

app.post("/api/friends/respond", (req, res) => {
  const { requestId, userId, action } = req.body || {};
  const cleanUser = String(userId || "").trim();
  const reqRecord = friendRequestsStore.find((r) => r.id === requestId);
  if (!reqRecord) return res.status(404).json({ error: "Friend request not found" });

  const userAliases = getUserAliases(cleanUser);
  const isSender = userAliases.has(reqRecord.senderId);
  const isRecipient = userAliases.has(reqRecord.recipientId);

  if (action === "cancel") {
    if (!isSender) return res.status(403).json({ error: "Only the sender can cancel this request" });
    reqRecord.status = "cancelled";
    reqRecord.updatedAt = new Date().toISOString();
    schedulePersist();
    return res.json({ success: true, request: reqRecord });
  }

  if (!isRecipient) {
    return res.status(403).json({ error: "Only the recipient can accept or reject this request" });
  }
  if (reqRecord.status !== "pending") {
    return res.status(400).json({ error: "Friend request already resolved" });
  }

  if (action === "accept") {
    if (isMutuallyBlocked(reqRecord.senderId, reqRecord.recipientId)) {
      return res.status(403).json({ error: "Cannot accept request while blocked." });
    }
    reqRecord.status = "accepted";
    reqRecord.updatedAt = new Date().toISOString();
    if (!areFriends(reqRecord.senderId, reqRecord.recipientId)) {
      friendshipsStore.unshift({
        id: `FS-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userAId: reqRecord.senderId,
        userBId: reqRecord.recipientId,
        createdAt: new Date().toISOString(),
      });
    }
    io.to(reqRecord.senderId).emit("friend-request-updated", reqRecord);
  } else if (action === "reject") {
    reqRecord.status = "rejected";
    reqRecord.updatedAt = new Date().toISOString();
  } else {
    return res.status(400).json({ error: "Invalid friend response action" });
  }

  schedulePersist();
  res.json({ success: true, request: reqRecord });
});

app.post("/api/friends/remove", (req, res) => {
  const { userId, targetId } = req.body || {};
  const aliasesA = getUserAliases(String(userId || ""));
  const aliasesB = getUserAliases(String(targetId || ""));
  let removed = false;
  for (let i = friendshipsStore.length - 1; i >= 0; i--) {
    const f = friendshipsStore[i];
    if (
      (aliasesA.has(f.userAId) && aliasesB.has(f.userBId)) ||
      (aliasesB.has(f.userAId) && aliasesA.has(f.userBId))
    ) {
      friendshipsStore.splice(i, 1);
      removed = true;
    }
  }
  schedulePersist();
  res.json({ success: true, removed });
});

app.get("/api/messages/:userId?", (req, res) => {
  const userId = req.params.userId || "guest-user";
  const privacy = getPrivacy(userId);
  const blocked = new Set(privacy.blockedUsers);

  const userMsgs = messagesStore.filter(
    (m) =>
      (m.senderId === userId || m.recipientId === userId) &&
      !blocked.has(m.senderId) &&
      !isMutuallyBlocked(userId, m.senderId)
  );

  const accepted = userMsgs.filter((m) => !m.isRequest);
  const requests = userMsgs.filter((m) => m.isRequest && m.recipientId === userId);
  const unreadCount = accepted.filter((m) => m.recipientId === userId && !m.read).length;

  // Only reveal online status for users whose showOnlineStatus privacy permits it
  const visibleOnlineIds = Array.from(onlineUsers.keys()).filter((id) => {
    if (isMutuallyBlocked(userId, id)) return false;
    return findPrivacyForAliases(id).showOnlineStatus === true;
  });

  res.json({
    messages: accepted,
    requests,
    unreadCount,
    privacy,
    onlineUserIds: visibleOnlineIds,
  });
});

app.post("/api/messages/send", (req, res) => {
  const { senderId, recipientId, text, image } = req.body;
  if (!senderId || !recipientId || (!text && !image)) {
    return res.status(400).json({ error: "Invalid message payload" });
  }
  if (!checkRateLimit(`dm:${senderId}`, 30, 60_000)) {
    return res.status(429).json({ error: "Rate limit exceeded. Please wait before sending more messages." });
  }

  const mod = moderateText(text || "");
  if (!mod.ok) return res.status(400).json({ error: mod.reason });

  if (isMutuallyBlocked(senderId, recipientId)) {
    return res.status(403).json({ error: "You cannot message this user due to block settings." });
  }

  const recipientPrivacy = findPrivacyForAliases(recipientId);
  const isApproved = (approvedRequestersStore.get(recipientId) || []).includes(senderId);
  const recipientFollowsSender = (followsStore.get(recipientId) || []).includes(senderId);
  const senderSubscribed = hasActiveCreatorSubscription(senderId, recipientId);
  const isFriend = areFriends(senderId, recipientId);

  let isRequest = false;
  if (recipientPrivacy.messagingPrivacy === "nobody" && !isApproved) {
    return res.status(403).json({ error: "Recipient has disabled incoming private messages." });
  }
  if (recipientPrivacy.messagingPrivacy === "friends" && !isFriend && !isApproved) {
    return res.status(403).json({ error: "Only accepted Global Friends can message this user." });
  }
  if (recipientPrivacy.messagingPrivacy === "subscribers" && !senderSubscribed && !isApproved) {
    if (!recipientPrivacy.allowUnsolicitedRequests) {
      return res.status(403).json({ error: "Only active subscribers can message this creator directly." });
    }
    isRequest = true;
  }
  if (recipientPrivacy.messagingPrivacy === "followers" && !recipientFollowsSender && !isFriend && !senderSubscribed && !isApproved) {
    if (!recipientPrivacy.allowUnsolicitedRequests) {
      return res.status(403).json({ error: "Recipient only accepts direct messages from connections." });
    }
    isRequest = true;
  }

  const newMsg: Message = {
    id: `MSG-${Date.now()}`,
    senderId,
    recipientId,
    text: text || "",
    image,
    timestamp: new Date().toISOString(),
    read: false,
    isRequest,
  };

  messagesStore.unshift(newMsg);
  schedulePersist();
  io.to(recipientId).emit("new-message", newMsg);
  res.json({ success: true, message: newMsg });
});

app.post("/api/messages/request-action", (req, res) => {
  const { userId, senderId, action } = req.body;
  if (!userId || !senderId) return res.status(400).json({ error: "userId and senderId required" });

  if (action === "accept") {
    const approved = approvedRequestersStore.get(userId) || [];
    if (!approved.includes(senderId)) approved.push(senderId);
    approvedRequestersStore.set(userId, approved);
    for (const m of messagesStore) {
      if (m.recipientId === userId && m.senderId === senderId) {
        m.isRequest = false;
      }
    }
  } else if (action === "block" || action === "decline") {
    for (let i = messagesStore.length - 1; i >= 0; i--) {
      if (messagesStore[i].recipientId === userId && messagesStore[i].senderId === senderId) {
        messagesStore.splice(i, 1);
      }
    }
    if (action === "block") {
      const priv = getPrivacy(userId);
      if (!priv.blockedUsers.includes(senderId)) priv.blockedUsers.push(senderId);
      userPrivacyStore.set(userId, priv);
      if (!blockedUsersStore.some((b) => b.blockerId === userId && b.blockedId === senderId)) {
        blockedUsersStore.unshift({
          id: `BLK-${Date.now()}`,
          blockerId: userId,
          blockedId: senderId,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
  schedulePersist();
  res.json({ success: true });
});

app.post("/api/messages/mark-read", (req, res) => {
  const { userId, partnerId } = req.body;
  for (const m of messagesStore) {
    if (m.recipientId === userId && (!partnerId || m.senderId === partnerId)) {
      m.read = true;
    }
  }
  schedulePersist();
  res.json({ success: true });
});

app.post("/api/messages/delete-thread", (req, res) => {
  const { userId, partnerId } = req.body;
  for (let i = messagesStore.length - 1; i >= 0; i--) {
    const m = messagesStore[i];
    if ((m.senderId === userId && m.recipientId === partnerId) || (m.senderId === partnerId && m.recipientId === userId)) {
      messagesStore.splice(i, 1);
    }
  }
  schedulePersist();
  res.json({ success: true });
});

// --- SAFETY & MODERATION REPORTS + ACCOUNT SUSPENSION ---
app.post("/api/moderation/report", (req, res) => {
  const { reporterId, targetType, targetId, reason } = req.body;
  if (!targetType || !targetId || !reason) {
    return res.status(400).json({ error: "Report details required" });
  }
  if (!checkRateLimit(`report:${reporterId || "anon"}`, 15, 60_000)) {
    return res.status(429).json({ error: "Too many reports submitted. Please wait." });
  }
  const rep: ModerationReport = {
    id: `REP-${Date.now()}`,
    reporterId: reporterId || "guest-user",
    targetType,
    targetId,
    reason: String(reason).slice(0, 300),
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  reportsStore.unshift(rep);
  schedulePersist();
  res.json({ success: true, report: rep });
});

app.get("/api/moderation/reports", (_req, res) => {
  res.json(reportsStore);
});

app.get("/api/admin/users", (_req, res) => {
  const users = profileDirectoryStore.map((p) => {
    const ageRec = getAgeVerificationForUser(p.id);
    const susp = isAccountSuspended(p.id);
    return {
      id: p.id,
      profileId: p.profileId,
      name: p.name,
      username: p.username,
      country: p.country,
      ageStatus: susp.suspended ? "suspended" : ageRec?.status || "unverified",
      verified: ageRec?.status === "verified" && (ageRec?.age ?? 0) >= 18,
      suspended: susp.suspended,
      suspendedReason: susp.reason || null,
    };
  });
  res.json(users);
});

app.post("/api/admin/users/suspend", (req, res) => {
  const { userId, suspend, reason } = req.body || {};
  const cleanId = String(userId || "").trim();
  if (!cleanId) return res.status(400).json({ error: "userId is required" });

  const aliases = getUserAliases(cleanId);
  if (suspend === false) {
    for (const a of aliases) {
      suspendedAccountsStore.delete(a);
      const rec = ageVerificationStore.get(a);
      if (rec && rec.status === "suspended") {
        rec.status = rec.age >= 18 ? "verified" : "unverified";
        rec.suspendedReason = undefined;
        rec.updatedAt = new Date().toISOString();
      }
    }
  } else {
    const suspReason = String(reason || "Suspended by OrioLiveCall safety moderation").slice(0, 200);
    for (const a of aliases) {
      suspendedAccountsStore.set(a, {
        userId: a,
        reason: suspReason,
        suspendedAt: new Date().toISOString(),
      });
      const rec = ageVerificationStore.get(a);
      if (rec) {
        rec.status = "suspended";
        rec.suspendedReason = suspReason;
        rec.updatedAt = new Date().toISOString();
      }
      io.to(a).emit("account-suspended", { reason: suspReason });
    }
  }
  schedulePersist();
  res.json({ success: true, userId: cleanId, suspended: suspend !== false });
});

app.post("/api/moderation/resolve", (req, res) => {
  const { reportId, decision } = req.body;
  const rep = reportsStore.find((r) => r.id === reportId);
  if (!rep) return res.status(404).json({ error: "Report not found" });

  if (decision === "remove") {
    rep.status = "removed";
    if (rep.targetType === "video") {
      const vid = videosStore.find((v) => v.id === rep.targetId);
      if (vid) vid.moderationStatus = "removed";
    } else if (rep.targetType === "livestream") {
      const ls = liveStreamsStore.find((s) => s.id === rep.targetId);
      if (ls) ls.isLive = false;
    } else if (rep.targetType === "short") {
      const idx = shortsStore.findIndex((s) => s.id === rep.targetId);
      if (idx >= 0) shortsStore.splice(idx, 1);
    }
  } else {
    rep.status = "approved_safe";
  }
  schedulePersist();
  res.json({ success: true, report: rep });
});

// --- HOT SHORTS VIDEO SYSTEM ---
app.get("/api/shorts", (req, res) => {
  const q = ((req.query.q as string) || "").trim().toLowerCase();
  const filtered = q
    ? shortsStore.filter(
        (s) =>
          s.description.toLowerCase().includes(q) ||
          s.creatorName.toLowerCase().includes(q) ||
          s.hashtags.some((h) => h.toLowerCase().includes(q.replace(/^#/, "")))
      )
    : shortsStore;
  res.json(filtered);
});

app.post("/api/shorts/like", (req, res) => {
  const { shortId } = req.body;
  const short = shortsStore.find((s) => s.id === shortId);
  if (short) {
    short.likes += 1;
    res.json({ success: true, likes: short.likes });
  } else {
    res.status(404).json({ error: "Video not found" });
  }
});

app.post("/api/shorts/comment", (req, res) => {
  const { shortId, user, text } = req.body;
  const mod = moderateText(text || "");
  if (!mod.ok) return res.status(400).json({ error: mod.reason });

  const short = shortsStore.find((s) => s.id === shortId);
  if (short && text) {
    short.comments.unshift({ user: user || "Anonymous", text, time: "Just now" });
    short.commentsCount += 1;
    res.json({ success: true, comments: short.comments });
  } else {
    res.status(400).json({ error: "Invalid comment" });
  }
});

app.post("/api/shorts/upload", (req, res) => {
  const { creatorName, creatorAvatar, videoUrl, thumbnailUrl, description, hashtags } = req.body;
  const mod = moderateText(`${description || ""} ${hashtags || ""}`);
  if (!mod.ok) return res.status(400).json({ error: mod.reason });

  const newShort: ShortVideo = {
    id: `short-${Date.now()}`,
    creatorName: creatorName || "Creator",
    creatorAvatar: creatorAvatar || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
    videoUrl: videoUrl || "https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lights-playing-with-her-hair-41584-large.mp4",
    thumbnailUrl: thumbnailUrl || "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400",
    description: description || "New short video #trending",
    hashtags: Array.isArray(hashtags) ? hashtags : ["trending"],
    likes: 0,
    commentsCount: 0,
    shares: 0,
    comments: [],
  };
  shortsStore.unshift(newShort);
  res.json({ success: true, short: newShort });
});

// --- PROMOTIONAL HOMEPAGE PREVIEW, AD BANNER & CAROUSEL ADMIN SYSTEM ---
app.get("/api/promotions", (_req, res) => {
  res.json(promotionsStore);
});

app.post("/api/promotions/preview", (req, res) => {
  const { enabled, headline, caption, mediaUrl, posterUrl, autoplay, ctaLabel, ctaTab } = req.body || {};
  const mod = moderateText(`${headline || ""} ${caption || ""} ${ctaLabel || ""}`);
  if (!mod.ok) return res.status(400).json({ error: mod.reason });

  promotionsStore.preview = {
    enabled: typeof enabled === "boolean" ? enabled : true, // stays permanently visible unless explicitly overridden
    headline: String(headline || promotionsStore.preview.headline).trim().slice(0, 140),
    caption: String(caption || promotionsStore.preview.caption).trim().slice(0, 320),
    mediaUrl: String(mediaUrl || promotionsStore.preview.mediaUrl).trim(),
    posterUrl: String(posterUrl || promotionsStore.preview.posterUrl).trim(),
    autoplay: typeof autoplay === "boolean" ? autoplay : promotionsStore.preview.autoplay,
    ctaLabel: String(ctaLabel || promotionsStore.preview.ctaLabel).trim().slice(0, 48),
    ctaTab: String(ctaTab || promotionsStore.preview.ctaTab).trim(),
    updatedAt: new Date().toISOString(),
  };
  schedulePersist();
  res.json({ success: true, promotions: promotionsStore });
});

app.post("/api/promotions/banner", (req, res) => {
  const { enabled, sponsorLabel, title, subtitle, imageUrl, ctaLabel, ctaTab, accentTheme } = req.body || {};
  const mod = moderateText(`${sponsorLabel || ""} ${title || ""} ${subtitle || ""} ${ctaLabel || ""}`);
  if (!mod.ok) return res.status(400).json({ error: mod.reason });

  promotionsStore.banner = {
    enabled: typeof enabled === "boolean" ? enabled : promotionsStore.banner.enabled,
    sponsorLabel: String(sponsorLabel || promotionsStore.banner.sponsorLabel).trim().slice(0, 80),
    title: String(title || promotionsStore.banner.title).trim().slice(0, 140),
    subtitle: String(subtitle || promotionsStore.banner.subtitle).trim().slice(0, 280),
    imageUrl: String(imageUrl || promotionsStore.banner.imageUrl).trim(),
    ctaLabel: String(ctaLabel || promotionsStore.banner.ctaLabel).trim().slice(0, 40),
    ctaTab: String(ctaTab || promotionsStore.banner.ctaTab).trim(),
    accentTheme: ["purple", "emerald", "amber", "rose"].includes(accentTheme)
      ? accentTheme
      : promotionsStore.banner.accentTheme,
    updatedAt: new Date().toISOString(),
  };
  schedulePersist();
  res.json({ success: true, promotions: promotionsStore });
});

app.post("/api/promotions/carousel", (req, res) => {
  const { action, slideId, slide } = req.body || {};

  if (action === "delete" && slideId) {
    promotionsStore.carousel = promotionsStore.carousel.filter((s) => s.id !== slideId);
    schedulePersist();
    return res.json({ success: true, promotions: promotionsStore });
  }

  if (action === "toggle" && slideId) {
    const target = promotionsStore.carousel.find((s) => s.id === slideId);
    if (!target) return res.status(404).json({ error: "Carousel slide not found" });
    target.active = !target.active;
    schedulePersist();
    return res.json({ success: true, promotions: promotionsStore });
  }

  const incoming = slide || req.body;
  const mod = moderateText(`${incoming?.title || ""} ${incoming?.subtitle || ""} ${incoming?.sponsor || ""} ${incoming?.category || ""}`);
  if (!mod.ok) return res.status(400).json({ error: mod.reason });

  if (!incoming?.title || !String(incoming.title).trim()) {
    return res.status(400).json({ error: "Advertisement slide title is required." });
  }

  if (action === "update" && slideId) {
    const idx = promotionsStore.carousel.findIndex((s) => s.id === slideId);
    if (idx === -1) return res.status(404).json({ error: "Carousel slide not found" });
    promotionsStore.carousel[idx] = {
      ...promotionsStore.carousel[idx],
      title: String(incoming.title).trim().slice(0, 120),
      subtitle: String(incoming.subtitle || "").trim().slice(0, 260),
      sponsor: String(incoming.sponsor || "Sponsored").trim().slice(0, 60),
      category: String(incoming.category || "Featured").trim().slice(0, 40),
      imageUrl: String(incoming.imageUrl || "/assets/aistudio/preview_brand_16x9.jpg").trim(),
      ctaLabel: String(incoming.ctaLabel || "Explore Now").trim().slice(0, 40),
      ctaTab: String(incoming.ctaTab || "chat").trim(),
      active: typeof incoming.active === "boolean" ? incoming.active : promotionsStore.carousel[idx].active,
    };
  } else {
    const newSlide = {
      id: `ad-slide-${Date.now()}`,
      title: String(incoming.title).trim().slice(0, 120),
      subtitle: String(incoming.subtitle || "Explore live rooms, creators, and memberships.").trim().slice(0, 260),
      sponsor: String(incoming.sponsor || "Sponsored").trim().slice(0, 60),
      category: String(incoming.category || "Promotion").trim().slice(0, 40),
      imageUrl: String(incoming.imageUrl || "/assets/aistudio/preview_creators_16x9.jpg").trim(),
      ctaLabel: String(incoming.ctaLabel || "Explore Now").trim().slice(0, 40),
      ctaTab: String(incoming.ctaTab || "chat").trim(),
      active: typeof incoming.active === "boolean" ? incoming.active : true,
      createdAt: new Date().toISOString(),
    };
    promotionsStore.carousel.unshift(newSlide);
  }

  schedulePersist();
  res.json({ success: true, promotions: promotionsStore });
});

// --- POST-CALL RATING & CALL QUALITY FEEDBACK API ---
app.get("/api/call-ratings", (_req, res) => {
  const totalCount = callRatingsStore.length;
  const averageOverall = totalCount
    ? Number((callRatingsStore.reduce((acc, r) => acc + r.overallRating, 0) / totalCount).toFixed(2))
    : 0;
  const averageCallQuality = totalCount
    ? Number((callRatingsStore.reduce((acc, r) => acc + r.callQualityRating, 0) / totalCount).toFixed(2))
    : 0;

  res.json({
    totalCount,
    averageOverall,
    averageCallQuality,
    ratings: callRatingsStore.slice(0, 50),
  });
});

app.post("/api/call-ratings", (req, res) => {
  const {
    userId,
    actionTrigger,
    callMode,
    partnerName,
    partnerCountry,
    overallRating,
    callQualityRating,
    durationSec,
    videoQuality,
    stabilityStatus,
    rttMs,
    tags,
    comment,
  } = req.body || {};

  const parsedOverall = Number(overallRating);
  const parsedQuality = Number(callQualityRating);
  if (!Number.isFinite(parsedOverall) || parsedOverall < 1 || parsedOverall > 5) {
    return res.status(400).json({ error: "Please provide an overall rating between 1 and 5 stars." });
  }
  if (!Number.isFinite(parsedQuality) || parsedQuality < 1 || parsedQuality > 5) {
    return res.status(400).json({ error: "Please provide a call quality rating between 1 and 5 stars." });
  }

  const safeComment = String(comment || "").trim().slice(0, 400);
  const mod = moderateText(safeComment);
  if (!mod.ok) {
    return res.status(400).json({ error: mod.reason });
  }

  const record: CallRatingRecord = {
    id: `CR-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    userId: String(userId || "guest-user").slice(0, 128),
    actionTrigger: actionTrigger === "next_person" ? "next_person" : "end_call",
    callMode: callMode === "ai_global_talk" ? "ai_global_talk" : "random_video",
    partnerName: String(partnerName || "Partner").slice(0, 100),
    partnerCountry: String(partnerCountry || "Global").slice(0, 80),
    overallRating: Math.round(parsedOverall),
    callQualityRating: Math.round(parsedQuality),
    durationSec: Math.max(0, Math.min(86400, Math.round(Number(durationSec) || 0))),
    videoQuality: String(videoQuality || "HD").slice(0, 16),
    stabilityStatus: String(stabilityStatus || "excellent").slice(0, 32),
    rttMs: typeof rttMs === "number" && Number.isFinite(rttMs) ? Math.round(rttMs) : null,
    tags: Array.isArray(tags) ? tags.slice(0, 8).map((t) => String(t).slice(0, 50)) : [],
    comment: safeComment,
    createdAt: new Date().toISOString(),
  };

  callRatingsStore.unshift(record);
  schedulePersist();
  res.json({ success: true, rating: record });
});

// Fallback for any unhandled /api/* requests so they never return HTML
app.use("/api/*", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

// Matching queue, mutual-consent pending sessions & Gemini Live AI Call state on server
interface WaitingUser {
  socketId: string;
  userId: string;
  profileId?: string;
  name: string;
  gender: string;
  country: string;
  targetGender: string;
  targetCountry: string;
  joinedAt: string;
}

interface PendingMatchContext {
  session: VideoSessionRecord;
  socketA: string;
  socketB: string;
  dataA: WaitingUser;
  dataB: WaitingUser;
  timeoutId: NodeJS.Timeout;
}

let waitingQueue: WaitingUser[] = [];
const activePairs = new Map<string, string>();
const socketSessionMap = new Map<string, string>(); // socketId -> sessionId
const pendingMatches = new Map<string, PendingMatchContext>(); // sessionId -> context
const blockedUsers = new Map<string, Set<string>>();
const aiLiveSessions = new Map<string, any>();

function cleanupPendingMatch(sessionId: string, reason: string, notifyDecliner?: string) {
  const ctx = pendingMatches.get(sessionId);
  if (!ctx) return;
  clearTimeout(ctx.timeoutId);
  pendingMatches.delete(sessionId);
  socketSessionMap.delete(ctx.socketA);
  socketSessionMap.delete(ctx.socketB);
  ctx.session.status = "ended";
  ctx.session.endedAt = new Date().toISOString();
  ctx.session.endedReason = reason;
  schedulePersist();

  io.to(ctx.socketA).emit("match-declined", { sessionId, reason, byPartner: notifyDecliner !== ctx.socketA });
  io.to(ctx.socketB).emit("match-declined", { sessionId, reason, byPartner: notifyDecliner !== ctx.socketB });
}

function terminateActiveCallForSocket(socketId: string, reason: string) {
  const pendingSessId = socketSessionMap.get(socketId);
  if (pendingSessId && pendingMatches.has(pendingSessId)) {
    cleanupPendingMatch(pendingSessId, reason, socketId);
  }

  const sessId = socketSessionMap.get(socketId);
  if (sessId) {
    const sess = videoSessionsStore.find((s) => s.sessionId === sessId);
    if (sess && sess.status !== "ended") {
      sess.status = "ended";
      sess.endedAt = new Date().toISOString();
      sess.endedReason = reason;
      schedulePersist();
    }
    socketSessionMap.delete(socketId);
  }

  const partnerId = activePairs.get(socketId);
  if (partnerId) {
    activePairs.delete(socketId);
    activePairs.delete(partnerId);
    socketSessionMap.delete(partnerId);
    io.to(partnerId).emit("partner-disconnected", { reason });
  }
}

io.on("connection", (socket) => {
  let joinedUserId: string | null = null;
  const joinedStreams = new Set<string>();

  socket.on("join-room", (userId) => {
    if (!userId) return;
    joinedUserId = String(userId);
    socket.join(joinedUserId);
    if (!onlineUsers.has(joinedUserId)) {
      onlineUsers.set(joinedUserId, new Set());
    }
    onlineUsers.get(joinedUserId)!.add(socket.id);
    const visibleOnlineIds = Array.from(onlineUsers.keys()).filter(
      (id) => findPrivacyForAliases(id).showOnlineStatus === true
    );
    io.emit("presence-update", { onlineUserIds: visibleOnlineIds });
  });

  // Live Stream Rooms & Moderated Live Chat
  socket.on("join-live-stream", ({ streamId }) => {
    if (!streamId) return;
    socket.join(`live:${streamId}`);
    joinedStreams.add(streamId);
    if (!liveStreamViewers.has(streamId)) {
      liveStreamViewers.set(streamId, new Set());
    }
    liveStreamViewers.get(streamId)!.add(socket.id);
    io.emit("live-viewer-count", {
      streamId,
      viewerCount: (liveStreamViewers.get(streamId)?.size || 0) + 1,
    });
  });

  socket.on("leave-live-stream", ({ streamId }) => {
    if (!streamId) return;
    socket.leave(`live:${streamId}`);
    joinedStreams.delete(streamId);
    liveStreamViewers.get(streamId)?.delete(socket.id);
    io.emit("live-viewer-count", {
      streamId,
      viewerCount: (liveStreamViewers.get(streamId)?.size || 0) + 1,
    });
  });

  socket.on("live-chat-message", ({ streamId, userId, userName, text }) => {
    const stream = liveStreamsStore.find((s) => s.id === streamId);
    if (!stream || !text) return;
    if (!hasLiveAccess(stream, userId)) {
      socket.emit("live-chat-error", { error: "Access required to chat in this livestream." });
      return;
    }
    const mod = moderateText(text);
    if (!mod.ok) {
      socket.emit("live-chat-error", { error: mod.reason });
      return;
    }
    const msg = {
      id: `LC-${Date.now()}`,
      userId: userId || "guest",
      userName: userName || "Viewer",
      text: String(text).slice(0, 300),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    stream.chatHistory.push(msg);
    if (stream.chatHistory.length > 100) stream.chatHistory.shift();
    schedulePersist();
    io.to(`live:${streamId}`).emit("live-chat-broadcast", { streamId, message: msg });
  });

  // --- REAL-TIME GEMINI LIVE AI GLOBAL TALKING SESSION ---
  socket.on("ai-live-start", async ({ partnerCountry, language, voiceName }) => {
    try {
      const existing = aiLiveSessions.get(socket.id);
      if (existing) {
        try { existing.close(); } catch {}
        aiLiveSessions.delete(socket.id);
      }

      const langDesc = language === "bn"
        ? "Speak naturally in Bengali and English as needed."
        : "Speak naturally in English, and greet warmly.";

      const session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName || "Zephyr" },
            },
          },
          systemInstruction: `You are a warm, engaging, real-time live video call partner from ${partnerCountry || "around the world"} on OrioLiveCall. ${langDesc} Keep spoken turns natural, friendly, and concise like a genuine voice/video call.`,
        },
        callbacks: {
          onopen: () => {
            socket.emit("ai-live-ready", { partnerCountry: partnerCountry || "Global" });
          },
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              socket.emit("ai-live-transcript", { role: "user", text: content.inputTranscription.text });
            }
            if (content?.outputTranscription?.text) {
              socket.emit("ai-live-transcript", { role: "ai", text: content.outputTranscription.text });
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                socket.emit("ai-live-audio", { audio: part.inlineData.data });
              }
            }
            if (content?.interrupted) {
              socket.emit("ai-live-interrupted");
            }
          },
          onerror: (err: any) => {
            console.error("Gemini Live error:", err);
            socket.emit("ai-live-error", { message: err?.message || "Live AI connection error" });
          },
          onclose: () => {
            aiLiveSessions.delete(socket.id);
            socket.emit("ai-live-closed");
          },
        },
      });

      aiLiveSessions.set(socket.id, session);
    } catch (err: any) {
      console.error("Failed to start Gemini Live session:", err);
      socket.emit("ai-live-error", { message: err?.message || "Could not start live AI voice session" });
    }
  });

  socket.on("ai-live-audio", ({ audio }) => {
    const session = aiLiveSessions.get(socket.id);
    if (session && audio) {
      try {
        session.sendRealtimeInput({
          audio: { data: audio, mimeType: "audio/pcm;rate=16000" },
        });
      } catch (err) {
        console.error("Error forwarding audio to Gemini Live:", err);
      }
    }
  });

  socket.on("ai-live-video", ({ image }) => {
    const session = aiLiveSessions.get(socket.id);
    if (session && image) {
      try {
        session.sendRealtimeInput({
          video: { data: image, mimeType: "image/jpeg" },
        });
      } catch (err) {
        console.error("Error forwarding video frame to Gemini Live:", err);
      }
    }
  });

  socket.on("ai-live-stop", () => {
    const session = aiLiveSessions.get(socket.id);
    if (session) {
      try { session.close(); } catch {}
      aiLiveSessions.delete(socket.id);
    }
  });

  socket.on("send-private-message", (msg) => {
    if (msg?.recipientId) {
      io.to(msg.recipientId).emit("new-message", msg);
    }
  });

  // --- FREE GLOBAL VIDEO CONNECT: SERVER-VERIFIED 18+ ELIGIBILITY + MUTUAL ACCEPTANCE ---
  socket.on("join-queue", (userData) => {
    const { userId, profileId, name, gender, country, targetGender, targetCountry, mediaReady } = userData || {};
    const cleanUserId = String(userId || "").trim();

    if (!checkRateLimit(`queue:${cleanUserId || socket.id}`, 18, 60_000)) {
      socket.emit("match-error", {
        code: "RATE_LIMITED",
        error: "Matching requests are temporarily rate-limited. Please wait a few seconds.",
      });
      return;
    }

    const eligibility = checkAdultEligibility(cleanUserId);
    if (!eligibility.allowed) {
      socket.emit("match-error", {
        code: eligibility.code,
        error: eligibility.reason,
      });
      return;
    }

    if (mediaReady === false) {
      socket.emit("match-error", {
        code: "MEDIA_PERMISSION_REQUIRED",
        error: "Camera or microphone permission must be granted before joining live video matching.",
      });
      return;
    }

    waitingQueue = waitingQueue.filter((u) => u.socketId !== socket.id && u.userId !== cleanUserId);

    const reqTargetGender = String(targetGender || "any");
    const reqTargetCountry = String(targetCountry || "all");
    const reqGender = String(gender || "any");
    const reqCountry = String(country || "All");

    let matchIndex = -1;
    for (let i = 0; i < waitingQueue.length; i++) {
      const candidate = waitingQueue[i];
      if (candidate.socketId === socket.id || candidate.userId === cleanUserId) continue;

      // Re-verify candidate hasn't been suspended or blocked in the meantime
      if (!checkAdultEligibility(candidate.userId).allowed) continue;

      const userBlocked = blockedUsers.get(socket.id);
      const candidateBlocked = blockedUsers.get(candidate.socketId);
      if (
        userBlocked?.has(candidate.socketId) ||
        candidateBlocked?.has(socket.id) ||
        isMutuallyBlocked(cleanUserId, candidate.userId)
      ) {
        continue;
      }

      const genderMatchSocket = reqTargetGender === "any" || candidate.gender.toLowerCase() === reqTargetGender.toLowerCase();
      const genderMatchCandidate = candidate.targetGender === "any" || reqGender.toLowerCase() === candidate.targetGender.toLowerCase();

      const countryMatchSocket = reqTargetCountry === "all" || candidate.country.toLowerCase() === reqTargetCountry.toLowerCase();
      const countryMatchCandidate = candidate.targetCountry === "all" || reqCountry.toLowerCase() === candidate.targetCountry.toLowerCase();

      if (genderMatchSocket && genderMatchCandidate && countryMatchSocket && countryMatchCandidate) {
        matchIndex = i;
        break;
      }
    }

    const currentWaiting: WaitingUser = {
      socketId: socket.id,
      userId: cleanUserId,
      profileId: profileId ? String(profileId) : undefined,
      name: String(name || "Verified Adult").slice(0, 80),
      gender: reqGender,
      country: reqCountry,
      targetGender: reqTargetGender,
      targetCountry: reqTargetCountry,
      joinedAt: new Date().toISOString(),
    };

    if (matchIndex !== -1) {
      const partner = waitingQueue.splice(matchIndex, 1)[0];
      const sessionId = `VS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const session: VideoSessionRecord = {
        sessionId,
        userAId: cleanUserId,
        userBId: partner.userId,
        acceptedA: false,
        acceptedB: false,
        status: "pending_consent",
        recordingEnabled: false,
        startedAt: new Date().toISOString(),
      };
      videoSessionsStore.unshift(session);
      if (videoSessionsStore.length > 300) videoSessionsStore.length = 300;
      schedulePersist();

      socketSessionMap.set(socket.id, sessionId);
      socketSessionMap.set(partner.socketId, sessionId);

      const expiresAt = new Date(Date.now() + 35_000).toISOString();
      const timeoutId = setTimeout(() => {
        cleanupPendingMatch(sessionId, "consent_timeout");
      }, 35_000);

      pendingMatches.set(sessionId, {
        session,
        socketA: socket.id,
        socketB: partner.socketId,
        dataA: currentWaiting,
        dataB: partner,
        timeoutId,
      });

      socket.emit("match-proposed", {
        sessionId,
        partnerSocketId: partner.socketId,
        partnerUserId: partner.userId,
        partnerProfileId: partner.profileId,
        partnerName: partner.name,
        partnerCountry: partner.country,
        partnerGender: partner.gender,
        initiator: true,
        expiresAt,
      });

      io.to(partner.socketId).emit("match-proposed", {
        sessionId,
        partnerSocketId: socket.id,
        partnerUserId: currentWaiting.userId,
        partnerProfileId: currentWaiting.profileId,
        partnerName: currentWaiting.name,
        partnerCountry: currentWaiting.country,
        partnerGender: currentWaiting.gender,
        initiator: false,
        expiresAt,
      });
    } else {
      waitingQueue.push(currentWaiting);
      socket.emit("waiting-for-match");
    }
  });

  socket.on("respond-match", ({ sessionId, accept }) => {
    const ctx = pendingMatches.get(sessionId);
    if (!ctx) return;

    const isA = socket.id === ctx.socketA;
    const isB = socket.id === ctx.socketB;
    if (!isA && !isB) return;

    if (!accept) {
      cleanupPendingMatch(sessionId, "declined", socket.id);
      return;
    }

    if (isA) ctx.session.acceptedA = true;
    if (isB) ctx.session.acceptedB = true;

    const partnerSocketId = isA ? ctx.socketB : ctx.socketA;
    io.to(partnerSocketId).emit("partner-accepted-match", { sessionId });

    if (ctx.session.acceptedA && ctx.session.acceptedB) {
      clearTimeout(ctx.timeoutId);
      pendingMatches.delete(sessionId);
      ctx.session.status = "connecting";
      activePairs.set(ctx.socketA, ctx.socketB);
      activePairs.set(ctx.socketB, ctx.socketA);
      schedulePersist();

      io.to(ctx.socketA).emit("match-accepted", {
        sessionId,
        partnerSocketId: ctx.socketB,
        partnerUserId: ctx.dataB.userId,
        partnerProfileId: ctx.dataB.profileId,
        partnerName: ctx.dataB.name,
        partnerCountry: ctx.dataB.country,
        partnerGender: ctx.dataB.gender,
        initiator: true,
      });

      io.to(ctx.socketB).emit("match-accepted", {
        sessionId,
        partnerSocketId: ctx.socketA,
        partnerUserId: ctx.dataA.userId,
        partnerProfileId: ctx.dataA.profileId,
        partnerName: ctx.dataA.name,
        partnerCountry: ctx.dataA.country,
        partnerGender: ctx.dataA.gender,
        initiator: false,
      });
    }
  });

  socket.on("session-status", ({ sessionId, status }) => {
    const sess = videoSessionsStore.find((s) => s.sessionId === sessionId);
    if (!sess) return;
    if (["connecting", "connected", "reconnecting", "disconnected", "ended"].includes(status)) {
      sess.status = status;
      if (status === "connected" && !sess.connectedAt) {
        sess.connectedAt = new Date().toISOString();
      }
      schedulePersist();
    }
  });

  socket.on("leave-queue", () => {
    waitingQueue = waitingQueue.filter((u) => u.socketId !== socket.id);
  });

  socket.on("webrtc-offer", ({ target, offer }) => {
    if (activePairs.get(socket.id) !== target) return;
    io.to(target).emit("webrtc-offer", { sender: socket.id, offer });
  });

  socket.on("webrtc-answer", ({ target, answer }) => {
    if (activePairs.get(socket.id) !== target) return;
    io.to(target).emit("webrtc-answer", { sender: socket.id, answer });
  });

  socket.on("webrtc-ice-candidate", ({ target, candidate }) => {
    if (activePairs.get(socket.id) !== target) return;
    io.to(target).emit("webrtc-ice-candidate", { sender: socket.id, candidate });
  });

  socket.on("skip-partner", () => {
    terminateActiveCallForSocket(socket.id, "skipped");
    socket.emit("partner-disconnected", { reason: "skipped" });
  });

  socket.on("end-call", () => {
    terminateActiveCallForSocket(socket.id, "ended");
    socket.emit("partner-disconnected", { reason: "ended" });
  });

  socket.on("block-user", ({ partnerSocketId, userId, targetUserId }) => {
    if (partnerSocketId) {
      if (!blockedUsers.has(socket.id)) {
        blockedUsers.set(socket.id, new Set());
      }
      blockedUsers.get(socket.id)?.add(partnerSocketId);
    }
    if (userId && targetUserId) {
      const priv = getPrivacy(userId);
      if (!priv.blockedUsers.includes(targetUserId)) priv.blockedUsers.push(targetUserId);
      userPrivacyStore.set(userId, priv);
      if (!blockedUsersStore.some((b) => b.blockerId === userId && b.blockedId === targetUserId)) {
        blockedUsersStore.unshift({
          id: `BLK-${Date.now()}`,
          blockerId: userId,
          blockedId: targetUserId,
          reason: "Blocked during video session",
          createdAt: new Date().toISOString(),
        });
      }
      schedulePersist();
    }

    terminateActiveCallForSocket(socket.id, "blocked");
    socket.emit("partner-disconnected", { reason: "blocked" });
  });

  socket.on("disconnect", () => {
    if (joinedUserId && onlineUsers.has(joinedUserId)) {
      const set = onlineUsers.get(joinedUserId)!;
      set.delete(socket.id);
      if (set.size === 0) onlineUsers.delete(joinedUserId);
      const visibleOnlineIds = Array.from(onlineUsers.keys()).filter(
        (id) => findPrivacyForAliases(id).showOnlineStatus === true
      );
      io.emit("presence-update", { onlineUserIds: visibleOnlineIds });
    }
    for (const sId of joinedStreams) {
      liveStreamViewers.get(sId)?.delete(socket.id);
      io.emit("live-viewer-count", {
        streamId: sId,
        viewerCount: (liveStreamViewers.get(sId)?.size || 0) + 1,
      });
    }
    const aiSess = aiLiveSessions.get(socket.id);
    if (aiSess) {
      try { aiSess.close(); } catch {}
      aiLiveSessions.delete(socket.id);
    }
    waitingQueue = waitingQueue.filter((u) => u.socketId !== socket.id);
    terminateActiveCallForSocket(socket.id, "socket_disconnected");
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`OrioLiveCall server running on http://localhost:${PORT}`);
  });
}

startServer();
