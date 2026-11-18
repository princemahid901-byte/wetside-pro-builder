import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  VideoOff,
  Phone,
  Mic,
  MicOff,
  Camera,
  FlipHorizontal,
  User,
  Calendar,
  X,
  ShieldCheck,
  Check,
  Search,
  UserPlus,
  MessageSquare,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { FirebaseUser } from '../firebase';
import type { GlobalFriendProfile } from '../types/orio';

export type TargetChatGroup = 'females' | 'males' | 'everyone';

export interface ReferenceLoginStartPayload {
  userName: string;
  userGender: 'male' | 'female' | 'other';
  userAge: number;
  targetPrefs: TargetChatGroup[];
  minAge: number;
  maxAge: number;
  preferWithFace: boolean;
  callMode?: 'video' | 'audio';
}

interface ReferenceLoginScreenProps {
  initialName?: string;
  initialGender?: 'girls' | 'boys' | 'other';
  initialTargetGender?: 'girls' | 'boys' | 'any';
  initialAge?: number;
  avatarUrl?: string;
  currentUserId?: string;
  currentUserProfileId?: string;
  firebaseUser?: FirebaseUser | null;
  authLoading?: boolean;
  age18Confirmed?: boolean;
  onToggleAge18?: (checked: boolean) => void;
  onStartChat: (payload: ReferenceLoginStartPayload) => void;
  onOpenPrivateMessageWithPeer?: (peerId: string) => void;
  onStartDirectCall?: (
    peerId: string,
    peerName?: string,
    callType?: 'video' | 'audio',
    peerProfileId?: string,
    peerAvatar?: string
  ) => void;
  onGoogleSignIn: () => void;
  onOpenPrivacyPage?: () => void;
  onCloseModal?: () => void;
  compactFirstPage?: boolean;
  showToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const AGE_OPTIONS = Array.from({ length: 53 }, (_, idx) => 18 + idx);
const TARGET_OPTIONS: Array<{ id: TargetChatGroup; label: string }> = [
  { id: 'females', label: 'Females' },
  { id: 'males', label: 'Males' },
  { id: 'everyone', label: 'Everyone' },
];

const CAMERA_FILTERS: Array<{ id: string; label: string; filterClass: string }> = [
  { id: 'original', label: 'Normal', filterClass: '' },
  { id: 'beauty', label: 'Beauty', filterClass: 'brightness-110 contrast-105 saturate-125' },
  { id: 'warm', label: 'Warm', filterClass: 'sepia-[.22] saturate-150 brightness-105' },
  { id: 'noir', label: 'B&W', filterClass: 'grayscale contrast-125' },
];

export const ReferenceLoginScreen: React.FC<ReferenceLoginScreenProps> = ({
  initialName = '',
  initialGender = 'boys',
  initialTargetGender = 'girls',
  initialAge = 19,
  avatarUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
  currentUserId = 'guest-user',
  currentUserProfileId = 'ORI-100001',
  firebaseUser,
  authLoading = false,
  onStartChat,
  onOpenPrivateMessageWithPeer,
  onStartDirectCall,
  onGoogleSignIn,
  onOpenPrivacyPage,
  onCloseModal,
  compactFirstPage = false,
  showToast,
}) => {
  const mappedInitialGender: 'male' | 'female' | 'other' =
    initialGender === 'girls' ? 'female' : initialGender === 'other' ? 'other' : 'male';

  const mappedInitialTargets: TargetChatGroup[] =
    initialTargetGender === 'boys'
      ? ['males']
      : initialTargetGender === 'any'
        ? ['everyone']
        : ['females'];

  const [hubTab, setHubTab] = useState<'call' | 'friends'>('call');

  // Call setup form state
  const [userName, setUserName] = useState<string>(
    firebaseUser?.displayName || (initialName && initialName !== 'Global Verified User' ? initialName : '')
  );
  const [userGender, setUserGender] = useState<'male' | 'female' | 'other'>(mappedInitialGender);
  const [userAge, setUserAge] = useState<number>(initialAge >= 18 && initialAge <= 70 ? initialAge : 19);
  const [targetPrefs, setTargetPrefs] = useState<TargetChatGroup[]>(mappedInitialTargets);
  const [minAge, setMinAge] = useState<number>(18);
  const [maxAge, setMaxAge] = useState<number>(70);
  const [preferWithFace, setPreferWithFace] = useState<boolean>(true);

  // Live Working Camera Studio state
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [micMuted, setMicMuted] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<string>('original');
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Friend Search by Profile ID state
  const [searchIdQuery, setSearchIdQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GlobalFriendProfile[]>([]);
  const [searchingFriends, setSearchingFriends] = useState<boolean>(false);

  const stopCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async (requestedFacing: 'user' | 'environment' = facingMode) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera API is not supported in this browser.');
      return;
    }
    setCameraLoading(true);
    setCameraError(null);
    try {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: requestedFacing } },
        audio: true,
      });
      cameraStreamRef.current = stream;
      stream.getAudioTracks().forEach((t) => {
        t.enabled = !micMuted;
      });
      setCameraActive(true);
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        cameraVideoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError('Camera permission denied or unavailable. Check browser camera access.');
      setCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  useEffect(() => {
    if (cameraActive && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
      cameraVideoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  useEffect(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !micMuted;
      });
    }
  }, [micMuted]);

  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Load directory results when Friend Search tab is active
  useEffect(() => {
    if (hubTab !== 'friends') return;
    let active = true;
    setSearchingFriends(true);
    const params = new URLSearchParams({
      viewerId: currentUserId,
      q: searchIdQuery.trim(),
    });
    fetch(`/api/friends/directory?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active && Array.isArray(data)) {
          setSearchResults(data.slice(0, 6));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSearchingFriends(false);
      });
    return () => {
      active = false;
    };
  }, [hubTab, searchIdQuery, currentUserId]);

  const handleFlipCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    if (cameraActive) {
      startCamera(next);
    }
  };

  const togglePref = (pref: TargetChatGroup) => {
    setTargetPrefs((prev) => {
      if (pref === 'everyone') {
        return prev.includes('everyone') ? [] : ['everyone'];
      }
      const withoutEveryone = prev.filter((item) => item !== 'everyone');
      return withoutEveryone.includes(pref)
        ? withoutEveryone.filter((item) => item !== pref)
        : [...withoutEveryone, pref];
    });
  };

  const handleStartCall = (mode: 'video' | 'audio') => {
    stopCamera();
    onStartChat({
      userName: userName.trim() || firebaseUser?.displayName || 'Guest User',
      userGender,
      userAge,
      targetPrefs: targetPrefs.length > 0 ? targetPrefs : ['everyone'],
      minAge,
      maxAge,
      preferWithFace: mode === 'video' ? preferWithFace : false,
      callMode: mode,
    });
  };

  const handleAddFriendById = async (profile: GlobalFriendProfile) => {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          senderName: userName.trim() || firebaseUser?.displayName || 'Orio Member',
          senderProfileId: currentUserProfileId,
          senderAvatar: firebaseUser?.photoURL || avatarUrl,
          recipientId: profile.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast?.(data.error || 'Could not send friend request.', 'error');
        return;
      }
      setSearchResults((prev) =>
        prev.map((item) =>
          item.id === profile.id ? { ...item, friendshipStatus: 'outgoing_pending' } : item
        )
      );
      showToast?.(`Friend request sent to ${profile.name} (${profile.profileId})!`, 'success');
    } catch {
      showToast?.('Failed to send friend request.', 'error');
    }
  };

  const currentFilterClass =
    CAMERA_FILTERS.find((f) => f.id === activeFilter)?.filterClass || '';

  return (
    <div
      className={`w-full ${
        compactFirstPage ? '' : 'max-w-5xl mx-auto'
      } rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-[#11122b] to-slate-950 text-white shadow-2xl shadow-purple-950/60 border border-purple-500/40 grid grid-cols-1 md:grid-cols-12 relative`}
    >
      {onCloseModal && (
        <button
          type="button"
          onClick={() => {
            stopCamera();
            onCloseModal();
          }}
          aria-label="Close quick start view"
          className="absolute top-3 right-3 z-30 p-1.5 rounded-full bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* LEFT PANEL: BRAND NEW WORKING LIVE CAMERA & AUDIO STUDIO (REPLACES OLD IMAGE) */}
      <div
        className={`md:col-span-5 relative overflow-hidden bg-[#070918] border-b md:border-b-0 md:border-r border-slate-800/90 flex flex-col justify-between ${
          compactFirstPage ? 'min-h-[300px] md:min-h-[520px]' : 'min-h-[340px] md:min-h-[540px]'
        }`}
      >
        {/* Top Studio Status Bar */}
        <div className="relative z-10 p-3.5 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-md">
              <Camera className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <div className="text-xs font-extrabold text-white leading-tight">Live Camera Studio</div>
              <div className="text-[10px] text-emerald-400 font-semibold">
                {cameraActive ? 'Camera & Mic Working' : 'Camera Ready · Free HD'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFlipCamera}
            title="Switch Front / Back Camera"
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 transition-colors"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Center Live Camera Feed or Studio Activation Stage */}
        <div className="relative flex-1 bg-gradient-to-b from-[#0b0e24] via-slate-950 to-[#090b18] flex flex-col items-center justify-center overflow-hidden">
          {cameraActive ? (
            <video
              ref={cameraVideoRef}
              autoPlay
              playsInline
              muted
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-200 ${
                facingMode === 'user' ? '-scale-x-100' : ''
              } ${currentFilterClass}`}
            />
          ) : (
            <div className="p-6 text-center space-y-4 relative z-10 max-w-xs">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-purple-600/30 via-pink-500/20 to-emerald-500/20 border border-purple-400/40 flex items-center justify-center shadow-xl">
                <Video className="w-9 h-9 text-purple-300" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-extrabold text-white">
                  Test Your Camera Before Calling
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Preview your real webcam, check mic audio, apply live filters, or capture photos for private messages.
                </p>
              </div>
              {cameraError && (
                <p className="text-[11px] text-rose-300 bg-rose-950/70 border border-rose-500/40 rounded-xl p-2.5">
                  {cameraError}
                </p>
              )}
              <button
                type="button"
                disabled={cameraLoading}
                onClick={() => startCamera()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-purple-600 hover:brightness-110 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg cursor-pointer disabled:opacity-60"
              >
                {cameraLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>{cameraLoading ? 'Starting Camera...' : 'Turn On Working Camera'}</span>
              </button>
            </div>
          )}

          {/* Subtle gradient scrim when camera is live */}
          {cameraActive && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/90 to-transparent" />
          )}
        </div>

        {/* Bottom Camera Controls & Live Filter Chips */}
        <div className="relative z-10 p-3 bg-slate-950/90 border-t border-slate-800/80 space-y-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {CAMERA_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setActiveFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${
                  activeFilter === f.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => (cameraActive ? stopCamera() : startCamera())}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                cameraActive
                  ? 'bg-rose-600/20 border border-rose-500/40 text-rose-200 hover:bg-rose-600/35'
                  : 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/35'
              }`}
            >
              {cameraActive ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              <span>{cameraActive ? 'Stop Cam' : 'Start Cam'}</span>
            </button>

            <button
              type="button"
              onClick={() => setMicMuted((m) => !m)}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
                micMuted
                  ? 'bg-amber-600/20 border-amber-500/40 text-amber-200'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:border-purple-500'
              }`}
            >
              {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{micMuted ? 'Muted' : 'Mic On'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: BRAND NEW HUB (VIDEO/AUDIO CALL + SEARCH FRIEND ID & PRIVATE MESSAGE) */}
      <div className={`md:col-span-7 flex flex-col justify-between ${compactFirstPage ? 'p-5 sm:p-6' : 'p-6 sm:p-8'} space-y-4`}>
        {/* Top Hub Header & Mode Switcher */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={firebaseUser?.photoURL || avatarUrl}
                alt="Your profile"
                className="w-10 h-10 rounded-xl object-cover border border-purple-500/50 shrink-0"
              />
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                  <span className="truncate">Private Call, Friend ID &amp; Messaging</span>
                </div>
                <div className="text-[10px] font-mono text-purple-300 truncate">
                  Your ID: {currentUserProfileId} · 100% Free Access
                </div>
              </div>
            </div>
          </div>

          {/* 2-Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-950/90 border border-slate-800">
            <button
              type="button"
              onClick={() => setHubTab('call')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                hubTab === 'call'
                  ? 'bg-gradient-to-r from-[#f43f8e] to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video &amp; Audio Call</span>
            </button>
            <button
              type="button"
              onClick={() => setHubTab('friends')}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                hubTab === 'friends'
                  ? 'bg-gradient-to-r from-emerald-600 to-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Find ID &amp; Message</span>
            </button>
          </div>
        </div>

        {/* TAB 1: INSTANT VIDEO & AUDIO CALL SETUP */}
        {hubTab === 'call' ? (
          <div className="space-y-3.5 flex-1">
            {/* Your Name */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Your Name</label>
              <div className="rounded-xl border border-slate-800 bg-slate-950/90 focus-within:border-pink-500 flex items-center h-11 overflow-hidden">
                <input
                  type="text"
                  aria-label="Enter your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  maxLength={40}
                  className="flex-1 h-full px-3.5 text-sm font-medium text-white bg-transparent focus:outline-none placeholder:text-slate-500"
                />
                <div className="w-10 h-6 border-l border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                  <User className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Gender + Years */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Gender</label>
                <div className="rounded-xl border border-slate-800 bg-slate-950/90 focus-within:border-pink-500 flex items-center h-11 overflow-hidden">
                  <select
                    aria-label="Select your gender"
                    value={userGender}
                    onChange={(e) => setUserGender(e.target.value as 'male' | 'female' | 'other')}
                    className="flex-1 h-full px-3 text-sm font-medium text-white bg-slate-950 focus:outline-none cursor-pointer"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Years (Age)</label>
                <div className="rounded-xl border border-slate-800 bg-slate-950/90 focus-within:border-pink-500 flex items-center h-11 overflow-hidden">
                  <select
                    aria-label="Select your age"
                    value={userAge}
                    onChange={(e) => setUserAge(Number(e.target.value))}
                    className="flex-1 h-full px-3 text-sm font-medium text-white bg-slate-950 focus:outline-none cursor-pointer"
                  >
                    {AGE_OPTIONS.map((age) => (
                      <option key={age} value={age}>
                        {age} years
                      </option>
                    ))}
                  </select>
                  <div className="w-9 h-6 border-l border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </div>

            {/* Who do you want to chat with */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">Who do you want to talk with?</label>
              <div className="grid grid-cols-3 gap-2">
                {TARGET_OPTIONS.map((option) => {
                  const selected = targetPrefs.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => togglePref(option.id)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        selected
                          ? 'bg-gradient-to-r from-[#f43f8e] to-purple-600 text-white border-transparent shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-purple-500/50 hover:text-white'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 shrink-0" />}
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Age Range */}
            <div className="rounded-xl bg-slate-950/90 border border-slate-800 px-3.5 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span>{minAge} years</span>
                <span className="text-[10px] uppercase tracking-wider text-purple-300 font-bold">Partner Age Range</span>
                <span>{maxAge} years</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  aria-label="Minimum partner age"
                  min={18}
                  max={Math.max(18, maxAge - 1)}
                  value={minAge}
                  onChange={(e) => setMinAge(Number(e.target.value))}
                  className="w-full accent-[#f43f8e] h-1 cursor-pointer"
                />
                <input
                  type="range"
                  aria-label="Maximum partner age"
                  min={Math.min(70, minAge + 1)}
                  max={70}
                  value={maxAge}
                  onChange={(e) => setMaxAge(Number(e.target.value))}
                  className="w-full accent-purple-500 h-1 cursor-pointer"
                />
              </div>
            </div>

            {/* Face Preference */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={preferWithFace}
                onChange={(e) => setPreferWithFace(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 accent-[#f43f8e] cursor-pointer"
              />
              <span>Prefer live camera face visible</span>
            </label>

            {/* Video Call & Audio Call Primary Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleStartCall('video')}
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-[#f43f8e] via-pink-600 to-purple-600 hover:brightness-110 text-white font-bold text-xs sm:text-sm shadow-lg shadow-pink-600/25 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Video className="w-4 h-4 shrink-0" />
                <span>Start Video Call</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartCall('audio')}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span>Start Audio Call</span>
              </button>
            </div>
          </div>
        ) : (
          /* TAB 2: SEARCH FRIEND BY PROFILE ID, ADD FRIEND, PRIVATE MESSAGE & CALL */
          <div className="space-y-3 flex-1 flex flex-col">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchIdQuery}
                onChange={(e) => setSearchIdQuery(e.target.value)}
                placeholder="Search Friend ID (e.g. ORI-100001), @username or name..."
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-emerald-500 text-xs text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="space-y-2 max-h-[295px] overflow-y-auto pr-1 flex-1">
              {searchingFriends ? (
                <div className="py-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Searching Profile IDs...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No profiles matched "{searchIdQuery}". Try typing <span className="font-mono text-purple-300">ORI-</span> or a name.
                </div>
              ) : (
                searchResults.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 hover:border-purple-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-700" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-purple-300 flex items-center gap-1.5">
                          <span>{p.profileId}</span>
                          <span className="text-slate-600">·</span>
                          <span className="text-slate-400 truncate">{p.country}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {p.friendshipStatus === 'none' && (
                        <button
                          type="button"
                          onClick={() => handleAddFriendById(p)}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      )}
                      {p.friendshipStatus === 'outgoing_pending' && (
                        <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-[10px] font-bold">
                          Pending
                        </span>
                      )}
                      {p.friendshipStatus === 'friends' && (
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                          Friends
                        </span>
                      )}

                      {onOpenPrivateMessageWithPeer && (
                        <button
                          type="button"
                          onClick={() => {
                            stopCamera();
                            onOpenPrivateMessageWithPeer(p.id);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap"
                        >
                          <MessageSquare className="w-3 h-3 text-pink-400" />
                          <span>Message</span>
                        </button>
                      )}

                      {onStartDirectCall && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              stopCamera();
                              onStartDirectCall(p.id, p.name, 'video', p.profileId, p.avatar);
                            }}
                            title={`Video Call ${p.name}`}
                            className="p-1.5 rounded-lg bg-pink-600/25 border border-pink-500/40 text-pink-200 hover:bg-pink-600/40"
                          >
                            <Video className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              stopCamera();
                              onStartDirectCall(p.id, p.name, 'audio', p.profileId, p.avatar);
                            }}
                            title={`Audio Call ${p.name}`}
                            className="p-1.5 rounded-lg bg-emerald-600/25 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/40"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Footer: Optional Google Sign-In & Privacy Link */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          {firebaseUser ? (
            <div className="flex items-center justify-center gap-2 text-xs text-emerald-300 font-semibold bg-emerald-950/40 border border-emerald-500/30 rounded-xl py-2 px-3">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Signed in as {firebaseUser.displayName || firebaseUser.email}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={authLoading}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/60 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{authLoading ? 'Connecting Google...' : 'Optional: Continue with Google'}</span>
            </button>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Photo &amp; Video Private Messaging Supported</span>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {onOpenPrivacyPage ? (
                <button
                  type="button"
                  onClick={onOpenPrivacyPage}
                  className="text-purple-300 hover:text-white hover:underline font-semibold"
                >
                  Privacy &amp; Google Cookies
                </button>
              ) : (
                <a
                  href="/privacy-policy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-300 hover:text-white hover:underline font-semibold"
                >
                  Privacy Policy
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
