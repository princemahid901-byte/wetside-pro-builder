import React, { useState, useEffect } from 'react';
import {
  Radio, Lock, Crown, Users, Heart, UserPlus, UserCheck, Send, Flag,
  Gift, ShieldCheck, CheckCircle2, RefreshCcw
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import { LiveStreamItem } from '../types/orio';

interface Props {
  currentUserId: string;
  currentUserName: string;
  socket: Socket | null;
  follows: string[];
  onToggleFollow: (creatorId: string) => void;
  onOpenGiftModal: (creatorName: string) => void;
  onOpenReport: (targetType: 'livestream', targetId: string) => void;
  onWalletUpdated: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const LiveStreamsHub: React.FC<Props> = ({
  currentUserId,
  currentUserName,
  socket,
  follows,
  onToggleFollow,
  onOpenGiftModal,
  onOpenReport,
  onWalletUpdated,
  showToast,
}) => {
  const [liveCategory, setLiveCategory] = useState<'all' | 'free' | 'premium'>('all');
  const [streams, setStreams] = useState<LiveStreamItem[]>([]);
  const [activeStream, setActiveStream] = useState<LiveStreamItem | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [pendingPurchaseStream, setPendingPurchaseStream] = useState<LiveStreamItem | null>(null);

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

  const handlePurchasePremiumLive = async (stream: LiveStreamItem) => {
    setPurchasingId(stream.id);
    try {
      const res = await fetch(`/api/livestreams/${encodeURIComponent(stream.id)}/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Purchase failed', 'error');
        return;
      }
      showToast(`Premium Live unlocked! Receipt: ${data.txId}`, 'success');
      setPendingPurchaseStream(null);
      onWalletUpdated();
      await fetchStreams();
    } catch (err) {
      showToast('Failed to process payment verification.', 'error');
    } finally {
      setPurchasingId(null);
    }
  };

  const handleRequestRefund = async (streamId: string) => {
    try {
      const res = await fetch(`/api/livestreams/${encodeURIComponent(streamId)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Refund window expired', 'error');
        return;
      }
      showToast(`Ticket cancelled & refunded! TX: ${data.refundTxId}`, 'success');
      onWalletUpdated();
      await fetchStreams();
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

  const filtered = streams.filter((s) => {
    if (liveCategory === 'free') return s.accessType === 'free';
    if (liveCategory === 'premium') return s.accessType === 'premium';
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6 w-full flex-1">
      {/* Header & Free/Premium Category Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Radio className="w-7 h-7 text-rose-500 animate-pulse" />
            <span>Global Livestreams — Free & Premium Live</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Free public streams are open to all verified users with moderated live chat. Premium Live passes are verified on the server.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-2xl border border-slate-800 self-start">
          {[
            { id: 'all', label: 'All Streams' },
            { id: 'free', label: 'Free Live' },
            { id: 'premium', label: 'Premium Live' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLiveCategory(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                liveCategory === tab.id ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
                      {activeStream.accessType === 'premium' ? 'PREMIUM LIVE' : 'FREE LIVE'}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-black/75 text-white text-[10px] font-bold flex items-center gap-1">
                      <Users className="w-3 h-3 text-purple-300" />
                      {activeStream.viewerCount} watching
                    </span>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-extrabold text-white">{activeStream.title}</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    Premium Live broadcast by {activeStream.creatorName}. Ticket Price:{' '}
                    <span className="text-amber-400 font-bold">${activeStream.price.toFixed(2)} USD</span> (24h pass • Instant refund eligible within 15 min).
                  </p>
                  <button
                    onClick={() => setPendingPurchaseStream(activeStream)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-extrabold text-xs shadow-xl"
                  >
                    Unlock Premium Live (${activeStream.price.toFixed(2)})
                  </button>
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
                  onClick={() => onOpenGiftModal(activeStream.creatorName)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5"
                >
                  <Gift className="w-4 h-4" />
                  <span>Gift</span>
                </button>

                {activeStream.accessType === 'premium' && activeStream.hasAccess && activeStream.expiresAt && (
                  <button
                    onClick={() => handleRequestRefund(activeStream.id)}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <RefreshCcw className="w-3.5 h-3.5" />
                    <span>Cancel & Refund</span>
                  </button>
                )}

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
              {s.hasAccess && s.streamUrl ? (
                <video src={s.streamUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
              ) : (
                <img src={s.thumbnailUrl} alt={s.title} className="w-full h-full object-cover blur-[2px] opacity-70" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                    s.accessType === 'premium' ? 'bg-amber-500 text-slate-950' : 'bg-rose-600 text-white'
                  }`}
                >
                  {s.accessType === 'premium' ? `PREMIUM LIVE • $${s.price.toFixed(2)}` : 'FREE LIVE'}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-black/75 text-white text-[10px] font-bold">
                  {s.viewerCount} viewers
                </span>
              </div>
              {!s.hasAccess && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-center p-4">
                  <Lock className="w-8 h-8 text-amber-400 mb-2" />
                  <span className="text-xs font-bold text-white">Server-Protected Paid Stream</span>
                </div>
              )}
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
                {!s.hasAccess ? (
                  <button
                    onClick={() => setPendingPurchaseStream(s)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 font-extrabold text-xs"
                  >
                    Buy Pass (${s.price.toFixed(2)})
                  </button>
                ) : (
                  <button
                    onClick={() => setActiveStream(s)}
                    className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-xs"
                  >
                    Watch Live
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Explicit Pre-Purchase Verification Modal for Premium Live */}
      {pendingPurchaseStream && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-md p-7 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
              <Crown className="w-5 h-5" />
              <span>Confirm Premium Live Access</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="font-bold text-white">{pendingPurchaseStream.title}</div>
              <div className="text-slate-400">Creator: {pendingPurchaseStream.creatorName}</div>
              <div className="flex justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-300">Ticket Price:</span>
                <span className="font-extrabold text-amber-400">${pendingPurchaseStream.price.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Access Duration:</span>
                <span className="text-emerald-300 font-semibold">24 Hours Full Access</span>
              </div>
              <div className="flex items-start gap-1.5 pt-2 text-[11px] text-slate-400">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Cancel & request an automatic wallet refund within 15 minutes of purchase. Server verifies payment before streaming.</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPendingPurchaseStream(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                disabled={purchasingId === pendingPurchaseStream.id}
                onClick={() => handlePurchasePremiumLive(pendingPurchaseStream)}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 text-xs font-extrabold disabled:opacity-60"
              >
                {purchasingId === pendingPurchaseStream.id ? 'Verifying...' : `Pay $${pendingPurchaseStream.price.toFixed(2)} & Watch`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
