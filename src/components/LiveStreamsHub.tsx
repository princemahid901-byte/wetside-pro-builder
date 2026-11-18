import React, { useState, useEffect } from 'react';
import {
  Radio, Users, Heart, UserPlus, UserCheck, Send, Flag, ShieldCheck
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { LiveStreamItem } from '../types/orio';

interface Props {
  currentUserId: string;
  currentUserName: string;
  socket: Socket | null;
  follows: string[];
  onToggleFollow: (creatorId: string) => void;
  onOpenReport: (targetType: 'livestream', targetId: string) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const LiveStreamsHub: React.FC<Props> = ({
  currentUserId,
  currentUserName,
  socket,
  follows,
  onToggleFollow,
  onOpenReport,
  showToast,
}) => {
  const [streams, setStreams] = useState<LiveStreamItem[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStreamItem | null>(null);
  const [chatInput, setChatInput] = useState('');

  const fetchStreams = async () => {
    try {
      const res = await fetch(`/api/livestreams?viewerId=${encodeURIComponent(currentUserId)}`);
      if (res.ok) {
        const data: LiveStreamItem[] = await res.json();
        setStreams(data);
        if (activeStream) {
          const updated = data.find((s) => s.id === activeStream.id);
          if (updated) setActiveStream(updated);
        }
      }
    } catch (err) {
      console.error('Failed to fetch livestreams:', err);
    }
  };

  useEffect(() => {
    fetchStreams();
  }, [currentUserId]);

  useEffect(() => {
    if (!socket) return;

    const handleViewerCount = ({ streamId, viewerCount }: { streamId: string; viewerCount: number }) => {
      setStreams((prev) => prev.map((s) => (s.id === streamId ? { ...s, viewerCount } : s)));
      setActiveStream((prev) => (prev && prev.id === streamId ? { ...prev, viewerCount } : prev));
    };

    const handleChatBroadcast = ({ streamId, message }: { streamId: string; message: any }) => {
      setActiveStream((prev) => {
        if (!prev || prev.id !== streamId) return prev;
        if (prev.chatHistory.some((m) => m.id === message.id)) return prev;
        return { ...prev, chatHistory: [...prev.chatHistory, message] };
      });
    };

    const handleChatError = ({ error }: { error: string }) => {
      showToast(error, 'error');
    };

    const handleUpdated = () => fetchStreams();

    socket.on('live-viewer-count', handleViewerCount);
    socket.on('live-chat-broadcast', handleChatBroadcast);
    socket.on('live-chat-error', handleChatError);
    socket.on('livestreams-updated', handleUpdated);

    return () => {
      socket.off('live-viewer-count', handleViewerCount);
      socket.off('live-chat-broadcast', handleChatBroadcast);
      socket.off('live-chat-error', handleChatError);
      socket.off('livestreams-updated', handleUpdated);
    };
  }, [socket, currentUserId]);

  useEffect(() => {
    if (!socket || !activeStream || !activeStream.hasAccess) return;
    socket.emit('join-live-stream', { streamId: activeStream.id });
    return () => {
      socket.emit('leave-live-stream', { streamId: activeStream.id });
    };
  }, [socket, activeStream?.id, activeStream?.hasAccess]);

  const handleLikeStream = async (streamId: string) => {
    try {
      const res = await fetch(`/api/livestreams/${encodeURIComponent(streamId)}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        setStreams((prev) =>
          prev.map((s) => (s.id === streamId ? { ...s, likedByViewer: data.liked, likesCount: data.likesCount } : s))
        );
        setActiveStream((prev) =>
          prev && prev.id === streamId ? { ...prev, likedByViewer: data.liked, likesCount: data.likesCount } : prev
        );
      }
    } catch {}
  };

  const handleSendLiveChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket || !activeStream) return;
    socket.emit('live-chat-message', {
      streamId: activeStream.id,
      userId: currentUserId,
      userName: currentUserName,
      text: chatInput.trim(),
    });
    setChatInput('');
  };

  const filtered = streams.filter((s) => s.accessType === 'free');

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6 w-full flex-1">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Radio className="w-7 h-7 text-rose-500 animate-pulse" />
            <span>Global Livestreams — 100% Free Live Rooms</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Free public streams are open to all verified 18+ users with moderated live chat and zero fees.
          </p>
        </div>
      </div>

      {/* Active Broadcast Room */}
      {activeStream && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex flex-col justify-center">
              {activeStream.hasAccess && activeStream.streamUrl ? (
                <>
                  <video
                    src={activeStream.streamUrl}
                    autoPlay
                    loop
                    playsInline
                    controls
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold uppercase flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      FREE LIVE
                    </span>
                    <span className="px-3 py-1 rounded-full bg-black/75 text-white text-[10px] font-bold flex items-center gap-1">
                      <Users className="w-3 h-3 text-purple-300" />
                      {activeStream.viewerCount} watching
                    </span>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center space-y-3">
                  <h3 className="text-xl font-extrabold text-white">{activeStream.title}</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Stream offline or unavailable right now.
                  </p>
                </div>
              )}
            </div>

            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src={activeStream.creatorAvatar} alt="" className="w-12 h-12 rounded-2xl object-cover border border-purple-500" />
                <div>
                  <h2 className="font-bold text-white text-base">{activeStream.title}</h2>
                  <p className="text-xs text-purple-300">
                    {activeStream.creatorName} • {activeStream.category}
                  </p>
                  {activeStream.expiresAt && (
                    <p className="text-[10px] text-emerald-300 mt-0.5">
                      Pass expires: {new Date(activeStream.expiresAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleLikeStream(activeStream.id)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                    activeStream.likedByViewer ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  <span>{activeStream.likesCount}</span>
                </button>

                <button
                  onClick={() => onToggleFollow(activeStream.creatorId)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
                    follows.includes(activeStream.creatorId)
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-white'
                  }`}
                >
                  {follows.includes(activeStream.creatorId) ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  <span>{follows.includes(activeStream.creatorId) ? 'Following' : 'Follow'}</span>
                </button>

                <button
                  onClick={() => onOpenReport('livestream', activeStream.id)}
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs"
                >
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Real-Time Moderated Live Chat */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between h-[480px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Moderated Live Chat</span>
              </div>
              <button onClick={() => setActiveStream(null)} className="text-[11px] text-purple-400 hover:underline">
                All Streams
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
              {activeStream.chatHistory.length === 0 ? (
                <p className="text-xs text-slate-500 italic text-center pt-10">
                  Be respectful & kind. Automated moderation is active.
                </p>
              ) : (
                activeStream.chatHistory.map((m) => (
                  <div key={m.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs space-y-0.5">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-purple-300">{m.userName}</span>
                      <span className="text-slate-500">{m.timestamp}</span>
                    </div>
                    <p className="text-slate-200">{m.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleSendLiveChat} className="pt-3 border-t border-slate-800 flex gap-2">
              <input
                type="text"
                disabled={!activeStream.hasAccess}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={activeStream.hasAccess ? 'Say something nice in live chat...' : 'Unlock stream to join chat'}
                className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!activeStream.hasAccess}
                className="px-4 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Livestreams Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {filtered.map((s) => (
          <div key={s.id} className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
            <div onClick={() => setActiveStream(s)} className="relative h-60 rounded-2xl overflow-hidden bg-slate-950 cursor-pointer group">
              {s.streamUrl ? (
                <video src={s.streamUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
              ) : (
                <img src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-600 text-white">
                  FREE LIVE
                </span>
                <span className="px-2.5 py-1 rounded-full bg-black/75 text-white text-[10px] font-bold">
                  {s.viewerCount} viewers
                </span>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src={s.creatorAvatar} alt="" className="w-11 h-11 rounded-2xl object-cover border border-purple-500" />
                <div>
                  <h3 className="font-bold text-white text-sm">{s.title}</h3>
                  <p className="text-xs text-purple-300">
                    {s.creatorName} • {s.category} • {s.likesCount} likes
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setActiveStream(s)}
                  className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs"
                >
                  Watch Live
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
