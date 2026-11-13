export type Language = 'en' | 'bn';

export interface VideoFeedItem {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  title: string;
  description: string;
  category: string;
  hashtags: string[];
  visibility: 'public' | 'private' | 'premium';
  thumbnailUrl: string;
  safeContent: boolean;
  moderationStatus: 'approved' | 'pending' | 'removed';
  views: number;
  likesCount: number;
  likedByViewer: boolean;
  savedByViewer: boolean;
  hasAccess: boolean;
  accessReason: string | null;
  streamUrl: string | null;
  allowedViewers?: string[];
  createdAt: string;
}

export interface SubscriptionItem {
  id: string;
  userId: string;
  creatorId: string;
  creatorName: string;
  plan: 'monthly' | 'yearly';
  planScope?: 'creator' | 'platform';
  price: number;
  status: 'active' | 'cancelled';
  txId: string;
  paymentMethodLabel?: string;
  createdAt: string;
  renewalDate?: string;
  expiresAt: string;
  autoRenew: boolean;
}

export interface ProfileDirectoryEntry {
  id: string;
  profileId: string; // e.g. ORI-100001
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
}

export type PaymentMethodType = 'bank_transfer' | 'debit_card' | 'credit_card' | 'mobile_banking';

export interface PaymentMethodRecord {
  id: string;
  userId: string;
  methodType: PaymentMethodType;
  provider: string;
  label: string;
  maskedNumber: string;
  holderName: string;
  expiry?: string;
  isDefault: boolean;
  verified: boolean;
  createdAt: string;
}

export interface HelpChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedTab?: string;
  suggestedLabel?: string;
}

export interface LiveStreamItem {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  title: string;
  description: string;
  category: string;
  accessType: 'free' | 'premium';
  price: number;
  thumbnailUrl: string;
  isLive: boolean;
  viewerCount: number;
  likesCount: number;
  likedByViewer: boolean;
  hasAccess: boolean;
  expiresAt: string | null;
  streamUrl: string | null;
  chatHistory: Array<{
    id: string;
    userId: string;
    userName: string;
    text: string;
    timestamp: string;
  }>;
  createdAt: string;
}

export interface ModerationReportItem {
  id: string;
  reporterId: string;
  targetType: 'video' | 'short' | 'livestream' | 'user' | 'message';
  targetId: string;
  reason: string;
  status: 'pending' | 'approved_safe' | 'removed';
  createdAt: string;
}

export interface UserPrivacySettings {
  messagingPrivacy: 'everyone' | 'friends' | 'followers' | 'subscribers' | 'nobody';
  allowUnsolicitedRequests: boolean;
  blockedUsers: string[];
  showOnlineStatus?: boolean;
  showInGlobalFriends?: boolean;
  allowFriendRequests?: boolean;
}

export interface MatchingQueueEntry {
  userId: string;
  socketId: string;
  name: string;
  gender: string;
  country: string;
  targetGender: string;
  targetCountry: string;
  joinedAt: string;
}

export type VideoSessionStatus =
  | 'pending_consent'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'ended';

export interface VideoSessionRecord {
  sessionId: string;
  userAId: string;
  userBId: string;
  acceptedA: boolean;
  acceptedB: boolean;
  status: VideoSessionStatus;
  recordingEnabled: false;
  startedAt: string;
  connectedAt?: string;
  endedAt?: string;
  endedReason?: string;
}

export interface UserPreferencesRecord {
  userId: string;
  targetGender: 'girls' | 'boys' | 'any';
  targetCountry: string;
  voluntaryGender?: string;
  preferredQuality: 'SD' | 'HD' | '4K';
  updatedAt: string;
}

export type AgeVerificationStatus = 'unverified' | 'verified' | 'rejected' | 'suspended';

export interface AgeVerificationPublicStatus {
  userId: string;
  status: AgeVerificationStatus;
  verified: boolean;
  isAdult: boolean;
  method?: string;
  verifiedAt?: string;
  suspendedReason?: string;
  thirdPartyKycConfigured: boolean;
}

export interface FriendRequestRecord {
  id: string;
  senderId: string;
  senderName: string;
  senderProfileId?: string;
  senderAvatar?: string;
  senderCountry?: string;
  recipientId: string;
  recipientName: string;
  recipientProfileId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface FriendshipRecord {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: string;
}

export interface BlockedUserRecord {
  id: string;
  blockerId: string;
  blockedId: string;
  reason?: string;
  createdAt: string;
}

export interface GlobalFriendProfile {
  id: string;
  profileId: string;
  name: string;
  username: string;
  country: string;
  gender: string;
  avatar: string;
  bio: string;
  creatorBadge: boolean;
  online: boolean | null;
  onlineVisible: boolean;
  friendshipStatus: 'none' | 'friends' | 'outgoing_pending' | 'incoming_pending';
  pendingRequestId?: string;
  allowFriendRequests: boolean;
  messagingPrivacy: string;
  canMessage: boolean;
  isBlocked: boolean;
}

export interface ProposedMatchInfo {
  sessionId: string;
  partnerSocketId: string;
  partnerUserId: string;
  partnerProfileId?: string;
  partnerName: string;
  partnerCountry: string;
  partnerGender: string;
  acceptedByMe: boolean;
  acceptedByPartner: boolean;
  initiator: boolean;
  expiresAt: string;
}

export type PromotionTargetTab =
  | 'chat'
  | 'friends'
  | 'videos'
  | 'live'
  | 'creators'
  | 'subscriptions'
  | 'payment-methods'
  | 'shorts'
  | 'gifts';

export interface HomepagePreviewConfig {
  enabled: boolean;
  headline: string;
  caption: string;
  mediaUrl: string;
  posterUrl: string;
  autoplay: boolean;
  ctaLabel: string;
  ctaTab: PromotionTargetTab;
  updatedAt: string;
}

export interface PromoBannerConfig {
  enabled: boolean;
  sponsorLabel: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaTab: PromotionTargetTab;
  accentTheme: 'purple' | 'emerald' | 'amber' | 'rose';
  updatedAt: string;
}

export interface AdCarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  sponsor: string;
  category: string;
  imageUrl: string;
  ctaLabel: string;
  ctaTab: PromotionTargetTab;
  active: boolean;
  createdAt: string;
}

export interface PromotionsConfig {
  preview: HomepagePreviewConfig;
  banner: PromoBannerConfig;
  carousel: AdCarouselSlide[];
}

export type CallActionTrigger = 'next_person' | 'end_call';
export type CallModeType = 'random_video' | 'ai_global_talk';

export interface CallFeedbackSession {
  actionTrigger: CallActionTrigger;
  callMode: CallModeType;
  partnerName: string;
  partnerCountry: string;
  durationSec: number;
  videoQuality: string;
  stabilityStatus: string;
  rttMs: number | null;
}

export interface CallRatingRecord {
  id: string;
  userId: string;
  actionTrigger: CallActionTrigger;
  callMode: CallModeType;
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

export interface CallRatingSummary {
  totalCount: number;
  averageOverall: number;
  averageCallQuality: number;
  ratings: CallRatingRecord[];
}
