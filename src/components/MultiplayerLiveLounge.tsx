import React, { useState, useEffect, useRef } from 'react';
import {
  Users, Video, VideoOff, Mic, MicOff, MonitorUp, Hand, LayoutGrid,
  Maximize2, PhoneOff, Send, MessageSquare, Gift, ShieldCheck, Sparkles,
  Volume2, VolumeX, Copy, Check, UserPlus, Radio, RefreshCw, Smile
} from 'lucide-react';
import { Socket } from 'socket.io-client';

interface Participant {
  id: string;
  name: string;
  profileId: string;
  country: string;
  avatar: string;
  videoUrl?: string;
  isLocal?: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isHandRaised: boolean;
  isSpeaking: boolean;
  role: 'host' | 'co-host' | 'participant';
}

interface RoomChatMessage {
  id: string;
  senderName: string;
  senderProfileId: string;
  text: string;
  timestamp: string;
  isHost?: boolean;
  giftTag?: string;
}

interface Props {
  currentUserId: string;
  currentUserName: string;
  currentUserProfileId: string;
  socket: Socket | null;
  onOpenGiftModal?: (targetName: string) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const INITIAL_PEERS: Participant[] = [
  {
    id: 'peer-elena',
    name: 'Elena Rostova',
    profileId: 'ORI-100204',
    country: 'Spain 🇪🇸',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-girl-in-neon-lights-playing-with-her-hair-41584-large.mp4',
    isMuted: false,
    isCameraOff: false,
    isHandRaised: false,
    isSpeaking: true,
    role: 'host',
  },
  {
    id: 'peer-liam',
    name: 'Liam Vance',
    profileId: 'ORI-100189',
    country: 'United Kingdom 🇬🇧',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-young-man-wearing-a-beanie-talking-on-a-video-call-42472-large.mp4',
    isMuted: false,
    isCameraOff: false,
    isHandRaised: false,
    isSpeaking: false,
    role: 'co-host',
  },
  {
    id: 'peer-mei',
    name: 'Mei Lin',
    profileId: 'ORI-100342',
    country: 'Japan 🇯🇵',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-talking-on-a-video-call-with-her-laptop-42470-large.mp4',
    isMuted: true,
    isCameraOff: false,
    isHandRaised: true,
    isSpeaking: false,
    role: 'participant',
  },
  {
    id: 'peer-carlos',
    name: 'Carlos Silva',
    profileId: 'ORI-100411',
    country: 'Brazil 🇧🇷',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    isMuted: false,
    isCameraOff: true,
    isHandRaised: false,
    isSpeaking: false,
    role: 'participant',
  },
  {
    id: 'peer-aisha',
    name: 'Aisha Al-Mansoor',
    profileId: 'ORI-100523',
    country: 'UAE 🇦🇪',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fashion-model-posing-in-neon-lights-42469-large.mp4',
    isMuted: false,
    isCameraOff: false,
    isHandRaised: false,
    isSpeaking: false,
    role: 'participant',
  },
];

export const MultiplayerLiveLounge: React.FC<Props> = ({
  currentUserId,
  currentUserName,
  currentUserProfileId,
  socket,
  onOpenGiftModal,
  showToast,
}) => {
  const [roomName, setRoomName] = useState('Global Live Lounge #101');
  const [roomId, setRoomId] = useState('ORIO-ROOM-7789');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'spotlight' | 'cinema'>('grid');
  const [spotlightId, setSpotlightId] = useState<string>('local-user');

  // Media controls
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(90);

  // Participants & chat
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([
    {
      id: 'msg-1',
      senderName: 'Elena Rostova',
      senderProfileId: 'ORI-100204',
      text: 'Welcome to the Global Live Room everyone! Feel free to raise your hand to speak.',
      timestamp: 'Just now',
      isHost: true,
    },
    {
      id: 'msg-2',
      senderName: 'Liam Vance',
      senderProfileId: 'ORI-100189',
      text: 'Audio & video are super smooth on my end! Hello from London.',
      timestamp: 'Just now',
    },
    {
      id: 'msg-3',
      senderName: 'Mei Lin',
      senderProfileId: 'ORI-100342',
      text: 'Excited to chat with 5+ people at once without lag!',
      timestamp: 'Just now',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteProfileId, setInviteProfileId] = useState('');

  // Local media stream
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Initialize local participant and peers
  useEffect(() => {
    const localUser: Participant = {
      id: 'local-user',
      name: `${currentUserName || 'You'} (You)`,
      profileId: currentUserProfileId || 'ORI-100001',
      country: 'Your Location 🌐',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200',
      isLocal: true,
      isMuted,
      isCameraOff,
      isHandRaised,
      isSpeaking: false,
      role: 'participant',
    };

    setParticipants([localUser, ...INITIAL_PEERS]);

    // Request local camera and audio
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        // Fallback gracefully without throwing
      });

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [currentUserName, currentUserProfileId]);

  // Sync media toggles to local participant state
  useEffect(() => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.isLocal
          ? {
              ...p,
              isMuted,
              isCameraOff,
              isHandRaised,
            }
          : p
      )
    );

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !isMuted;
      });
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !isCameraOff;
      });
    }

    if (socket) {
      socket.emit('multiplayer-state-update', {
        roomId,
        userId: currentUserId,
        isMuted,
        isCameraOff,
        isHandRaised,
      });
    }
  }, [isMuted, isCameraOff, isHandRaised, currentUserId, roomId, socket]);

  // Periodic active speaker simulation across 5+ participants
  useEffect(() => {
    const timer = setInterval(() => {
      setParticipants((prev) => {
        const candidateIds = prev.filter((p) => !p.isMuted).map((p) => p.id);
        if (candidateIds.length === 0) return prev;
        const randomSpeakerId = candidateIds[Math.floor(Math.random() * candidateIds.length)];
        return prev.map((p) => ({
          ...p,
          isSpeaking: p.id === randomSpeakerId,
        }));
      });
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const toggleMic = () => {
    setIsMuted(!isMuted);
    showToast(!isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
  };

  const toggleCamera = () => {
    setIsCameraOff(!isCameraOff);
    showToast(!isCameraOff ? 'Camera turned off' : 'Camera turned on', 'info');
  };

  const toggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    showToast(next ? 'Hand raised to speak' : 'Hand lowered', 'info');
    if (next) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          senderName: currentUserName || 'You',
          senderProfileId: currentUserProfileId || 'ORI-100001',
          text: '✋ Raised hand to speak',
          timestamp: 'Just now',
        },
      ]);
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);
        showToast('Screen sharing started', 'success');
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current && localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
      } catch {
        showToast('Screen share permission denied or cancelled', 'info');
      }
    } else {
      setIsScreenSharing(false);
      if (localStreamRef.current && localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      showToast('Screen sharing stopped', 'info');
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: RoomChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: currentUserName || 'You',
      senderProfileId: currentUserProfileId || 'ORI-100001',
      text: chatInput.trim(),
      timestamp: 'Just now',
    };

    setChatMessages((prev) => [...prev, newMsg]);
    setChatInput('');

    if (socket) {
      socket.emit('multiplayer-chat-message', {
        roomId,
        message: newMsg,
      });
    }
  };

  const copyRoomInvite = () => {
    const inviteText = `Join my OrioLiveCall 5+ Video Lounge!\nRoom: ${roomName}\nRoom ID: ${roomId}\nLink: ${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(inviteText);
    setCopiedLink(true);
    showToast('Room invite copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleInviteProfileId = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteProfileId.trim()) return;
    showToast(`Invite sent directly to Profile ID ${inviteProfileId.trim().toUpperCase()}!`, 'success');
    setInviteProfileId('');
    setInviteModalOpen(false);
  };

  const activeSpotlightParticipant = participants.find((p) => p.id === spotlightId) || participants[0];

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 flex-1 flex flex-col space-y-4">
      {/* Top Header Bar */}
      <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
            <Radio className="w-5 h-5 animate-pulse text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-white">{roomName}</h1>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                LIVE · {participants.length} on Call
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Multiplayer Video Lounge · Room Code: <strong className="text-purple-300">{roomId}</strong> · 100% Free
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Controls */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                layoutMode === 'grid' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View (All 5+ visible evenly)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid (5+)</span>
            </button>
            <button
              onClick={() => setLayoutMode('spotlight')}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
                layoutMode === 'spotlight' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
              title="Spotlight View (Active speaker large)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Spotlight</span>
            </button>
          </div>

          <button
            onClick={() => setInviteModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all"
          >
            <UserPlus className="w-4 h-4 text-purple-400" />
            <span>Invite (Profile ID)</span>
          </button>

          <button
            onClick={copyRoomInvite}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
            title="Copy Invite Link"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Share Link'}</span>
          </button>
        </div>
      </div>

      {/* Main Video Arena + Side Live Room Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-[560px]">
        {/* Video Canvas Arena */}
        <div className="lg:col-span-3 rounded-3xl bg-slate-950 border border-slate-800 p-3 sm:p-4 flex flex-col justify-between shadow-2xl relative overflow-hidden">
          {/* Active Layout Rendering */}
          {layoutMode === 'grid' ? (
            /* Responsive Grid Layout for 5+ Participants */
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1 auto-rows-fr">
              {participants.map((p) => {
                const isSpotlighted = p.id === spotlightId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSpotlightId(p.id)}
                    className={`relative rounded-2xl overflow-hidden bg-slate-900 border-2 transition-all cursor-pointer group flex flex-col justify-between shadow-lg ${
                      p.isSpeaking
                        ? 'border-purple-500 shadow-purple-600/30 ring-2 ring-purple-500/50'
                        : isSpotlighted
                        ? 'border-indigo-500'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Video Stream or Avatar fallback */}
                    {p.isLocal ? (
                      p.isCameraOff ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                          <img src={p.avatar} alt="" className="w-16 h-16 rounded-full border-2 border-purple-500 shadow-lg object-cover" />
                          <span className="text-xs text-slate-400 mt-2">Camera is Off</span>
                        </div>
                      ) : (
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="absolute inset-0 w-full h-full object-cover -scale-x-100"
                        />
                      )
                    ) : p.videoUrl && !p.isCameraOff ? (
                      <video
                        src={p.videoUrl}
                        autoPlay
                        loop
                        playsInline
                        muted
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                        <img src={p.avatar} alt="" className="w-16 h-16 rounded-full border-2 border-slate-700 shadow-lg object-cover" />
                        <span className="text-xs text-slate-400 mt-2">{p.isCameraOff ? 'Camera Off' : 'Connecting feed...'}</span>
                      </div>
                    )}

                    {/* Gradient Overlay for labels */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="relative z-10 p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-slate-200 backdrop-blur-sm border border-white/10">
                          {p.country}
                        </span>
                        {p.role === 'host' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-purple-600 text-white">
                            HOST
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {p.isHandRaised && (
                          <span className="p-1 rounded-full bg-amber-500 text-slate-950 text-xs shadow-md animate-bounce" title="Hand Raised">
                            ✋
                          </span>
                        )}
                        <span
                          className={`p-1.5 rounded-full text-white backdrop-blur-sm ${
                            p.isMuted ? 'bg-rose-600/80' : 'bg-black/60'
                          }`}
                        >
                          {p.isMuted ? <MicOff className="w-3 h-3 text-rose-200" /> : <Mic className="w-3 h-3 text-emerald-400" />}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Details */}
                    <div className="relative z-10 p-2.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-xs text-white truncate">{p.name}</span>
                          {p.isSpeaking && (
                            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" title="Speaking Now" />
                          )}
                        </div>
                        <span className="text-[10px] text-purple-300 font-mono">{p.profileId}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Spotlight Mode: Large main video + thumbnail strip below */
            <div className="flex-1 flex flex-col gap-3 min-h-0">
              <div className="flex-1 relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-purple-500 shadow-xl min-h-[340px]">
                {activeSpotlightParticipant.isLocal ? (
                  activeSpotlightParticipant.isCameraOff ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                      <img src={activeSpotlightParticipant.avatar} alt="" className="w-24 h-24 rounded-full border-2 border-purple-500 object-cover" />
                      <span className="text-sm text-slate-300 mt-2">Camera is Off</span>
                    </div>
                  ) : (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="absolute inset-0 w-full h-full object-cover -scale-x-100"
                    />
                  )
                ) : activeSpotlightParticipant.videoUrl && !activeSpotlightParticipant.isCameraOff ? (
                  <video
                    src={activeSpotlightParticipant.videoUrl}
                    autoPlay
                    loop
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                    <img src={activeSpotlightParticipant.avatar} alt="" className="w-24 h-24 rounded-full border-2 border-slate-700 object-cover" />
                    <span className="text-sm text-slate-400 mt-2">Connecting feed...</span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

                <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-black/60 text-white font-bold text-xs backdrop-blur-md border border-white/10">
                    Spotlight: {activeSpotlightParticipant.name}
                  </span>
                  <span className="text-xs text-purple-300 font-mono bg-purple-950/60 px-2 py-0.5 rounded-lg border border-purple-500/30">
                    {activeSpotlightParticipant.profileId}
                  </span>
                </div>
              </div>

              {/* Participants Strip Below Spotlight */}
              <div className="flex gap-2 overflow-x-auto pb-1 shrink-0">
                {participants.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSpotlightId(p.id)}
                    className={`relative w-28 h-20 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                      p.id === spotlightId ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <img src={p.avatar} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40" />
                    <span className="absolute bottom-1 left-1.5 right-1.5 text-[9px] font-bold text-white truncate text-left">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Smooth Controls Bar at the bottom */}
          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMic}
                className={`p-3 rounded-2xl font-bold flex items-center gap-2 text-xs transition-all shadow-md ${
                  isMuted ? 'bg-rose-600 text-white shadow-rose-600/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Mic ON'}</span>
              </button>

              <button
                onClick={toggleCamera}
                className={`p-3 rounded-2xl font-bold flex items-center gap-2 text-xs transition-all shadow-md ${
                  isCameraOff ? 'bg-rose-600 text-white shadow-rose-600/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                title={isCameraOff ? 'Turn Camera ON' : 'Turn Camera OFF'}
              >
                {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4 text-purple-400" />}
                <span className="hidden sm:inline">{isCameraOff ? 'Camera OFF' : 'Camera ON'}</span>
              </button>

              <button
                onClick={toggleScreenShare}
                className={`p-3 rounded-2xl font-bold flex items-center gap-2 text-xs transition-all shadow-md ${
                  isScreenSharing ? 'bg-indigo-600 text-white shadow-indigo-600/30' : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
                title="Share Screen"
              >
                <MonitorUp className="w-4 h-4 text-indigo-400" />
                <span className="hidden md:inline">{isScreenSharing ? 'Sharing' : 'Share Screen'}</span>
              </button>

              <button
                onClick={toggleHandRaise}
                className={`p-3 rounded-2xl font-bold flex items-center gap-2 text-xs transition-all shadow-md ${
                  isHandRaised ? 'bg-amber-500 text-slate-950 shadow-amber-500/30 font-extrabold' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title="Raise Hand"
              >
                <Hand className="w-4 h-4" />
                <span className="hidden md:inline">{isHandRaised ? 'Hand Raised' : 'Raise Hand'}</span>
              </button>
            </div>

            {/* Volume control & Room Safety */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                {volumeLevel === 0 ? <VolumeX className="w-3.5 h-3.5 text-slate-400" /> : <Volume2 className="w-3.5 h-3.5 text-purple-400" />}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volumeLevel}
                  onChange={(e) => setVolumeLevel(Number(e.target.value))}
                  className="w-16 h-1 accent-purple-500 cursor-pointer"
                />
              </div>

              <button
                onClick={() => {
                  showToast('Left multiplayer room safely.', 'info');
                }}
                className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-600/30 transition-all"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Leave Room</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Live Room Chat & Participants Tab */}
        <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 flex flex-col justify-between shadow-2xl">
          {/* Tab Selection */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                onClick={() => setActiveTab('chat')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'chat' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Live Chat</span>
              </button>
              <button
                onClick={() => setActiveTab('participants')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'participants' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Members ({participants.length})</span>
              </button>
            </div>

            <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero Server Recording</span>
              </div>
              <span className="text-[10px] text-purple-300 font-mono">{roomId}</span>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'chat' ? (
            <div className="flex-1 flex flex-col justify-between min-h-[380px] mt-3">
              {/* Messages Container */}
              <div ref={chatScrollRef} className="space-y-2.5 overflow-y-auto max-h-[380px] pr-1 flex-1">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-white truncate">{msg.senderName}</span>
                        {msg.isHost && (
                          <span className="text-[9px] px-1 rounded bg-purple-600 text-white font-bold">HOST</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">{msg.timestamp}</span>
                    </div>
                    <p className="text-slate-200 text-[11px] leading-relaxed break-words">{msg.text}</p>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="mt-3 flex gap-1.5">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Chat with 5+ people..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all shadow-md shadow-purple-600/30"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          ) : (
            /* Participants Roster List */
            <div className="flex-1 space-y-2 overflow-y-auto max-h-[440px] mt-3 pr-1">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={p.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate flex items-center gap-1">
                        <span>{p.name}</span>
                        {p.isLocal && <span className="text-[10px] text-purple-400 font-normal">(You)</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{p.country} · {p.profileId}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.isSpeaking && (
                      <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" title="Speaking" />
                    )}
                    {p.isMuted ? (
                      <MicOff className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite by Profile ID Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-purple-400" />
                <span>Invite to Video Lounge</span>
              </h3>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕ Close
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enter any user or creator's unique <strong className="text-white">Profile ID</strong> (e.g. <span className="text-purple-300">ORI-100204</span>) to send an instant call invite directly to their live session.
            </p>

            <form onSubmit={handleInviteProfileId} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1 block">Profile ID</label>
                <input
                  type="text"
                  value={inviteProfileId}
                  onChange={(e) => setInviteProfileId(e.target.value)}
                  placeholder="e.g. ORI-100204"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white uppercase placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30"
                >
                  Send Call Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
