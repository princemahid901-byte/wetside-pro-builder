import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff, FlipHorizontal, Volume2,
  VolumeX, Sparkles, Heart, MessageSquare, Send, ShieldCheck, Wifi,
  Maximize2, X, RefreshCw, Smile, Radio
} from 'lucide-react';
import { Socket } from 'socket.io-client';

export interface CallSessionInfo {
  partnerId: string;
  partnerName: string;
  partnerProfileId: string;
  partnerAvatar: string;
  callType: 'video' | 'audio';
  isIncoming?: boolean;
}

interface Props {
  session: CallSessionInfo;
  currentUserId: string;
  currentUserName: string;
  currentUserProfileId: string;
  socket: Socket | null;
  onEndCall: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const CALL_FILTERS = [
  { id: 'normal', name: 'Original', css: 'none' },
  { id: 'beauty', name: 'Beauty Glow', css: 'brightness(1.1) contrast(1.05) saturate(1.15)' },
  { id: 'soft', name: 'Soft Light', css: 'brightness(1.15) contrast(0.95)' },
  { id: 'warm', name: 'Warm Sunset', css: 'sepia(0.25) saturate(1.3) brightness(1.05)' },
  { id: 'cinematic', name: 'Teal & Orange', css: 'contrast(1.2) saturate(1.2) hue-rotate(-10deg)' },
  { id: 'noir', name: 'Noir B&W', css: 'grayscale(1) contrast(1.3)' },
];

export const InstagramVideoCallingModal: React.FC<Props> = ({
  session,
  currentUserId,
  currentUserName,
  currentUserProfileId,
  socket,
  onEndCall,
  showToast,
}) => {
  // Call status: 'outgoing_ringing' | 'incoming_ringing' | 'connected' | 'reconnecting' | 'ended'
  const [callStatus, setCallStatus] = useState<
    'outgoing_ringing' | 'incoming_ringing' | 'connected' | 'reconnecting' | 'ended'
  >(session.isIncoming ? 'incoming_ringing' : 'outgoing_ringing');

  // Media states
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(session.callType === 'audio');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [activeCallFilter, setActiveCallFilter] = useState(CALL_FILTERS[0]);
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);

  // Call metrics & duration
  const [durationSec, setDurationSec] = useState(0);
  const [networkQuality, setNetworkQuality] = useState<'HD 1080p · Excellent' | 'Good' | 'Reconnecting'>('HD 1080p · Excellent');

  // In-call messaging & reactions
  const [inCallMessages, setInCallMessages] = useState<Array<{ id: string; sender: string; text: string }>>([]);
  const [inCallInput, setInCallInput] = useState('');
  const [floatingHearts, setFloatingHearts] = useState<Array<{ id: number; x: number }>>([]);

  // Video refs & live stream state
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Initialize camera & microphone stream
  useEffect(() => {
    let cancelled = false;
    setCameraError(null);
    navigator.mediaDevices
      ?.getUserMedia({
        audio: true,
        video: session.callType === 'video' ? { facingMode: { ideal: facingMode } } : false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError('Camera/Mic permission unavailable or blocked.');
          showToast('Camera/Mic permission needed for call.', 'error');
        }
      });

    return () => {
      cancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [session.callType, facingMode, showToast]);

  // Ensure local <video> always receives the live stream when mounted/re-mounted
  useEffect(() => {
    if (localVideoRef.current && localStream && !isCameraOff) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, callStatus, isCameraOff, facingMode]);

  // Outgoing call auto-connect simulation or socket listener
  useEffect(() => {
    if (callStatus === 'outgoing_ringing') {
      const ringTimer = setTimeout(() => {
        setCallStatus('connected');
        showToast(`Connected with ${session.partnerName}!`, 'success');
      }, 3500);
      return () => clearTimeout(ringTimer);
    }
  }, [callStatus, session.partnerName, showToast]);

  // Call duration counter
  useEffect(() => {
    if (callStatus === 'connected') {
      const timer = setInterval(() => {
        setDurationSec((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [callStatus]);

  // Sync mute and camera toggle to live media tracks
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !isMuted;
      });
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !isCameraOff;
      });
    }
  }, [isMuted, isCameraOff]);

  const toggleMic = () => {
    setIsMuted(!isMuted);
    showToast(!isMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
  };

  const toggleCamera = () => {
    setIsCameraOff(!isCameraOff);
    showToast(!isCameraOff ? 'Camera turned off' : 'Camera turned on', 'info');
  };

  const switchCameraFacing = () => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    showToast(nextFacing === 'user' ? 'Switched to Front Camera' : 'Switched to Rear Camera', 'info');
  };

  const sendFloatingHeart = () => {
    const id = Date.now();
    const x = Math.floor(Math.random() * 60) + 20; // 20% to 80%
    setFloatingHearts((prev) => [...prev, { id, x }]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 2000);
  };

  const sendInCallMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inCallInput.trim()) return;
    setInCallMessages((prev) => [
      ...prev,
      { id: `msg-${Date.now()}`, sender: currentUserName, text: inCallInput.trim() },
    ]);
    setInCallInput('');
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      {/* 1. OUTGOING RINGING SCREEN */}
      {callStatus === 'outgoing_ringing' && (
        <div className="w-full h-full flex flex-col items-center justify-between p-8 bg-gradient-to-b from-purple-950/40 via-slate-950 to-black">
          <div className="text-center pt-12 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-purple-400">
              Calling... ({session.callType === 'video' ? 'HD Video Call' : 'Audio Call'})
            </span>
            <h2 className="text-2xl font-extrabold text-white">{session.partnerName}</h2>
            <span className="text-xs font-mono text-purple-300 bg-purple-950/60 px-3 py-1 rounded-full border border-purple-500/30">
              {session.partnerProfileId}
            </span>
          </div>

          <div className="relative flex flex-col items-center gap-3">
            {session.callType === 'video' && localStream && !isCameraOff ? (
              <div className="w-36 h-48 rounded-2xl overflow-hidden border-2 border-purple-500 shadow-2xl relative z-10 bg-black">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                />
              </div>
            ) : (
              <>
                <div className="w-36 h-36 rounded-full border-4 border-purple-500/40 animate-ping absolute inset-0 m-auto" />
                <img
                  src={session.partnerAvatar}
                  alt=""
                  className="w-32 h-32 rounded-full object-cover border-4 border-purple-500 shadow-2xl relative z-10"
                />
              </>
            )}
            {cameraError && (
              <p className="text-[11px] text-rose-300 bg-rose-950/70 border border-rose-500/40 px-3 py-1 rounded-lg">
                {cameraError}
              </p>
            )}
          </div>

          <div className="pb-12 flex flex-col items-center gap-4">
            <button
              onClick={onEndCall}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 transition-all hover:scale-105 active:scale-95"
              title="Cancel Call"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs text-slate-400 font-semibold">End Call</span>
          </div>
        </div>
      )}

      {/* 2. INCOMING RINGING SCREEN */}
      {callStatus === 'incoming_ringing' && (
        <div className="w-full h-full flex flex-col items-center justify-between p-8 bg-gradient-to-b from-indigo-950/40 via-slate-950 to-black">
          <div className="text-center pt-12 space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 animate-pulse">
              Incoming {session.callType === 'video' ? 'Video' : 'Voice'} Call
            </span>
            <h2 className="text-2xl font-extrabold text-white">{session.partnerName}</h2>
            <span className="text-xs font-mono text-purple-300 bg-purple-950/60 px-3 py-1 rounded-full border border-purple-500/30">
              {session.partnerProfileId}
            </span>
          </div>

          <div className="relative">
            <div className="w-36 h-36 rounded-full border-4 border-emerald-500/40 animate-ping absolute inset-0 m-auto" />
            <img
              src={session.partnerAvatar}
              alt=""
              className="w-32 h-32 rounded-full object-cover border-4 border-emerald-500 shadow-2xl relative z-10"
            />
          </div>

          <div className="pb-12 flex items-center justify-center gap-12">
            {/* Decline */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={onEndCall}
                className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-xl shadow-rose-600/40 transition-all hover:scale-105"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
              <span className="text-xs text-slate-300 font-bold">Decline</span>
            </div>

            {/* Accept */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => {
                  setCallStatus('connected');
                  showToast('Call connected!', 'success');
                }}
                className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/40 transition-all hover:scale-105"
              >
                <Phone className="w-7 h-7 animate-bounce" />
              </button>
              <span className="text-xs text-emerald-400 font-bold">Accept</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. ACTIVE CONNECTED 1:1 CALL SCREEN */}
      {(callStatus === 'connected' || callStatus === 'reconnecting') && (
        <div className="relative w-full h-full flex flex-col justify-between bg-black">
          {/* Fullscreen Remote Video / Avatar */}
          <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
            {session.callType === 'video' ? (
              <video
                ref={remoteVideoRef}
                src="https://assets.mixkit.co/videos/preview/mixkit-young-man-wearing-a-beanie-talking-on-a-video-call-42472-large.mp4"
                autoPlay
                loop
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center space-y-4">
                <img
                  src={session.partnerAvatar}
                  alt=""
                  className="w-32 h-32 rounded-full object-cover border-4 border-purple-500 shadow-2xl"
                />
                <h3 className="font-bold text-xl text-white">{session.partnerName}</h3>
                <span className="text-xs text-slate-400 font-mono">Audio Call Connected</span>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/70 pointer-events-none" />
          </div>

          {/* Floating Local PIP Camera Preview (Draggable feel) */}
          {session.callType === 'video' && (
            <div className="absolute top-20 right-4 z-30 w-28 sm:w-36 aspect-[9/16] rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl bg-black">
              {isCameraOff ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 text-[10px]">
                  <VideoOff className="w-5 h-5 mb-1" />
                  <span>Camera Off</span>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                  style={{ filter: activeCallFilter.css }}
                />
              )}
              <span className="absolute bottom-1 left-1.5 text-[9px] font-bold text-white bg-black/60 px-1 rounded">
                You
              </span>
            </div>
          )}

          {/* Top In-Call Header Bar */}
          <div className="relative z-30 p-4 pt-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-base truncate">{session.partnerName}</h3>
                  <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-500/30">
                    {session.partnerProfileId}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span className="font-mono text-emerald-400 font-bold">{formatDuration(durationSec)}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span>{networkQuality}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Live Call Filters Drawer Toggle */}
              {session.callType === 'video' && (
                <button
                  onClick={() => setShowFilterDrawer(!showFilterDrawer)}
                  className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
                    showFilterDrawer ? 'bg-purple-600 text-white' : 'bg-black/40 text-white hover:bg-black/60'
                  }`}
                  title="Live Call Camera Effects"
                >
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </button>
              )}

              {/* In-Call Chat Drawer Toggle */}
              <button
                onClick={() => setShowChatDrawer(!showChatDrawer)}
                className={`p-2.5 rounded-full backdrop-blur-md transition-all relative ${
                  showChatDrawer ? 'bg-purple-600 text-white' : 'bg-black/40 text-white hover:bg-black/60'
                }`}
                title="In-Call Chat"
              >
                <MessageSquare className="w-5 h-5" />
                {inCallMessages.length > 0 && !showChatDrawer && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-purple-400" />
                )}
              </button>
            </div>
          </div>

          {/* Floating Hearts Animation overlay */}
          <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
            {floatingHearts.map((heart) => (
              <div
                key={heart.id}
                style={{ left: `${heart.x}%` }}
                className="absolute bottom-28 text-3xl animate-bounce transition-all duration-1000 transform -translate-y-48 opacity-90"
              >
                ❤️
              </div>
            ))}
          </div>

          {/* Live Call Effects Drawer */}
          {showFilterDrawer && (
            <div className="relative z-40 mx-4 p-3 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-2xl">
              <span className="text-[11px] font-bold text-slate-300 uppercase shrink-0">Live Effects:</span>
              {CALL_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveCallFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeCallFilter.id === f.id
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {/* In-Call Chat Drawer */}
          {showChatDrawer && (
            <div className="relative z-40 mx-4 max-h-48 p-3 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/20 flex flex-col justify-between shadow-2xl">
              <div className="overflow-y-auto space-y-1.5 max-h-32 pr-1 text-xs">
                {inCallMessages.length === 0 ? (
                  <p className="text-slate-400 text-center py-4 text-[11px]">Send a quick message during call.</p>
                ) : (
                  inCallMessages.map((m) => (
                    <div key={m.id} className="p-1.5 rounded-lg bg-white/10 text-white text-[11px]">
                      <strong className="text-purple-300 mr-1">{m.sender}:</strong>
                      <span>{m.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={sendInCallMessage} className="mt-2 flex gap-1.5">
                <input
                  type="text"
                  value={inCallInput}
                  onChange={(e) => setInCallInput(e.target.value)}
                  placeholder="Type message..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder-slate-400 focus:outline-none"
                />
                <button type="submit" className="p-1.5 rounded-xl bg-purple-600 text-white">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* Bottom In-Call Controls Bar */}
          <div className="relative z-30 p-6 pb-8 flex items-center justify-around max-w-lg mx-auto w-full">
            {/* Front/Rear Switch */}
            {session.callType === 'video' && (
              <button
                onClick={switchCameraFacing}
                className="w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-all"
                title="Flip Camera"
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>
            )}

            {/* Mic Toggle */}
            <button
              onClick={toggleMic}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl ${
                isMuted ? 'bg-rose-600 text-white shadow-rose-600/40' : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            {/* End Call Button */}
            <button
              onClick={onEndCall}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-2xl shadow-rose-600/50 transition-all hover:scale-105 active:scale-95"
              title="End Call"
            >
              <PhoneOff className="w-8 h-8" />
            </button>

            {/* Camera Toggle */}
            {session.callType === 'video' && (
              <button
                onClick={toggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl ${
                  isCameraOff ? 'bg-rose-600 text-white shadow-rose-600/40' : 'bg-white/20 hover:bg-white/30 text-white'
                }`}
                title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
              </button>
            )}

            {/* Floating Heart Reaction */}
            <button
              onClick={sendFloatingHeart}
              className="w-12 h-12 rounded-full bg-rose-500/30 hover:bg-rose-500/50 border border-rose-500/40 backdrop-blur-md flex items-center justify-center text-rose-300 transition-all hover:scale-110 active:scale-90"
              title="Send Heart"
            >
              <Heart className="w-5 h-5 fill-rose-500 text-rose-500" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
