import React, { useState, useEffect } from 'react';
import {
  Upload, Video, Radio, DollarSign, Users, Heart, Trash2, Lock, Globe, Crown
} from 'lucide-react';
import { VideoFeedItem, LiveStreamItem, SubscriptionItem } from '../types/orio';

interface CreatorDashboardData {
  videos: VideoFeedItem[];
  streams: LiveStreamItem[];
  subscribers: SubscriptionItem[];
  followerCount: number;
  totalVideoLikes: number;
  totalEarnings: number;
  transactions: Array<{ txId: string; type: string; amount: number; description: string; timestamp: string; status: string }>;
}

interface Props {
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  onSyncVideoFirestore?: (video: {
    id: string;
    creatorName: string;
    title: string;
    description: string;
    category: string;
    visibility: 'public' | 'private' | 'premium';
    thumbnailUrl?: string;
    safeContent: boolean;
    moderationStatus: 'approved' | 'pending' | 'flagged';
  }) => void;
  onSyncLiveFirestore?: (streamItem: {
    id: string;
    creatorName: string;
    title: string;
    category: string;
    accessType: 'free' | 'premium';
    price: number;
    isLive: boolean;
  }) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const CreatorDashboardView: React.FC<Props> = ({
  creatorId,
  creatorName,
  creatorAvatar,
  onSyncVideoFirestore,
  onSyncLiveFirestore,
  showToast,
}) => {
  const [data, setData] = useState<CreatorDashboardData | null>(null);

  // Upload Video State
  const [vidTitle, setVidTitle] = useState('');
  const [vidDesc, setVidDesc] = useState('');
  const [vidCategory, setVidCategory] = useState('Lifestyle');
  const [vidTags, setVidTags] = useState('creator, vlogs');
  const [vidVisibility, setVidVisibility] = useState<'public' | 'private' | 'premium'>('public');
  const [vidAllowedViewers, setVidAllowedViewers] = useState('');
  const [vidExternalUrl, setVidExternalUrl] = useState('');
  const [vidFile, setVidFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Start Livestream State
  const [liveTitle, setLiveTitle] = useState('');
  const [liveCategory, setLiveCategory] = useState('Music');
  const [liveAccessType, setLiveAccessType] = useState<'free' | 'premium'>('free');
  const [livePrice, setLivePrice] = useState('9.99');
  const [startingLive, setStartingLive] = useState(false);

  const loadDashboard = async () => {
    try {
      const res = await fetch(`/api/creator/${encodeURIComponent(creatorId)}/dashboard`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error('Creator dashboard load error:', err);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [creatorId]);

  const handleUploadVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vidTitle.trim()) {
      showToast('Please enter a video title', 'error');
      return;
    }
    if (!vidFile && !vidExternalUrl.trim()) {
      showToast('Select an MP4/WebM video file or enter a valid video URL.', 'error');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('creatorId', creatorId);
      form.append('creatorName', creatorName);
      form.append('creatorAvatar', creatorAvatar);
      form.append('title', vidTitle.trim());
      form.append('description', vidDesc.trim());
      form.append('category', vidCategory);
      form.append('hashtags', vidTags);
      form.append('visibility', vidVisibility);
      form.append('allowedViewers', vidAllowedViewers);
      if (vidFile) form.append('videoFile', vidFile);
      else form.append('externalUrl', vidExternalUrl.trim());

      const res = await fetch('/api/videos/upload', { method: 'POST', body: form });
      const result = await res.json();
      if (!res.ok) {
        showToast(result.error || 'Upload blocked or failed', 'error');
        return;
      }
      onSyncVideoFirestore?.({
        id: result.video.id,
        creatorName,
        title: result.video.title,
        description: result.video.description,
        category: result.video.category,
        visibility: result.video.visibility,
        thumbnailUrl: result.video.thumbnailUrl,
        safeContent: true,
        moderationStatus: 'approved',
      });
      setVidTitle('');
      setVidDesc('');
      setVidExternalUrl('');
      setVidFile(null);
      showToast('Non-explicit video uploaded and published!', 'success');
      loadDashboard();
    } catch (err) {
      showToast('Failed to upload video', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleChangeVisibility = async (videoId: string, visibility: 'public' | 'private' | 'premium') => {
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, visibility }),
      });
      if (res.ok) {
        showToast(`Updated visibility to ${visibility}`, 'success');
        loadDashboard();
      }
    } catch {}
  };

  const handleDeleteVideo = async (videoId: string) => {
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}?creatorId=${encodeURIComponent(creatorId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        showToast('Video removed', 'info');
        loadDashboard();
      }
    } catch {}
  };

  const handleStartLive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!liveTitle.trim()) return;
    setStartingLive(true);
    try {
      const res = await fetch('/api/livestreams/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId,
          creatorName,
          creatorAvatar,
          title: liveTitle.trim(),
          category: liveCategory,
          accessType: liveAccessType,
          price: liveAccessType === 'premium' ? Number(livePrice) : 0,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast(result.error || 'Could not start stream', 'error');
        return;
      }
      onSyncLiveFirestore?.({
        id: result.stream.id,
        creatorName,
        title: result.stream.title,
        category: result.stream.category,
        accessType: result.stream.accessType,
        price: result.stream.price,
        isLive: true,
      });
      setLiveTitle('');
      showToast(`${liveAccessType === 'premium' ? 'Premium Live' : 'Free Live'} broadcast is now live!`, 'success');
      loadDashboard();
    } finally {
      setStartingLive(false);
    }
  };

  const handleEndLive = async (streamId: string) => {
    await fetch(`/api/livestreams/${encodeURIComponent(streamId)}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorId }),
    });
    showToast('Livestream ended', 'info');
    loadDashboard();
  };

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 w-full flex-1">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white">Creator Studio & Monetization Dashboard</h1>
          <p className="text-xs text-slate-400">
            Upload public/private/premium non-explicit videos, manage Free & Premium Live broadcasts, and track real earnings.
          </p>
        </div>
      </div>

      {/* Real Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-emerald-400" /> Verified Earnings</div>
          <div className="text-2xl font-black text-emerald-400">${(data?.totalEarnings || 0).toFixed(2)}</div>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Crown className="w-4 h-4 text-purple-400" /> Paid Subscribers</div>
          <div className="text-2xl font-black text-purple-400">{data?.subscribers?.length || 0}</div>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Users className="w-4 h-4 text-sky-400" /> Free Followers</div>
          <div className="text-2xl font-black text-sky-400">{data?.followerCount || 0}</div>
        </div>
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5"><Heart className="w-4 h-4 text-rose-400" /> Total Video Likes</div>
          <div className="text-2xl font-black text-rose-400">{data?.totalVideoLikes || 0}</div>
        </div>
      </div>

      {/* Upload Video & Start Livestream Forms */}
      <div className="grid lg:grid-cols-2 gap-6">
        <form onSubmit={handleUploadVideo} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-400" />
            <span>Upload Video (Public, Private, or Premium)</span>
          </h2>
          <input
            type="text"
            required
            value={vidTitle}
            onChange={(e) => setVidTitle(e.target.value)}
            placeholder="Video Title (e.g. Dhaka Evening Acoustic Walk)"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
          />
          <textarea
            rows={2}
            value={vidDesc}
            onChange={(e) => setVidDesc(e.target.value)}
            placeholder="Non-explicit description..."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={vidCategory}
              onChange={(e) => setVidCategory(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            >
              {['Lifestyle', 'Music', 'Travel', 'Education', 'Fitness', 'Technology'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={vidVisibility}
              onChange={(e) => setVidVisibility(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            >
              <option value="public">Public (Free Watch)</option>
              <option value="private">Private (Authorized Only)</option>
              <option value="premium">Premium (Members Only)</option>
            </select>
          </div>
          <input
            type="text"
            value={vidTags}
            onChange={(e) => setVidTags(e.target.value)}
            placeholder="Hashtags (comma separated: travel, music)"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
          />
          {vidVisibility === 'private' && (
            <input
              type="text"
              value={vidAllowedViewers}
              onChange={(e) => setVidAllowedViewers(e.target.value)}
              placeholder="Authorized Viewer IDs / Emails (comma separated)"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-purple-500/40 text-xs text-white"
            />
          )}
          <div className="space-y-2">
            <label className="block text-[11px] text-slate-400">Attach Video File (.mp4 / .webm)</label>
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => setVidFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-purple-600 file:text-white file:font-bold"
            />
            <input
              type="url"
              value={vidExternalUrl}
              onChange={(e) => setVidExternalUrl(e.target.value)}
              placeholder="Or paste an external video URL (.mp4)"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            />
          </div>
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xs shadow-lg disabled:opacity-50"
          >
            {uploading ? 'Uploading & Moderating...' : 'Upload Video'}
          </button>
        </form>

        {/* Manage Free & Premium Livestreams */}
        <form onSubmit={handleStartLive} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-rose-500" />
            <span>Launch Free Live or Premium Live</span>
          </h2>
          <input
            type="text"
            required
            value={liveTitle}
            onChange={(e) => setLiveTitle(e.target.value)}
            placeholder="Broadcast Title (e.g. Live Guitar Q&A Session)"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={liveCategory}
              onChange={(e) => setLiveCategory(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            >
              {['Music', 'Travel', 'Education', 'Fitness', 'Lifestyle'].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={liveAccessType}
              onChange={(e) => setLiveAccessType(e.target.value as any)}
              className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            >
              <option value="free">Free Live (Public)</option>
              <option value="premium">Premium Live (Paid Ticket)</option>
            </select>
          </div>
          {liveAccessType === 'premium' && (
            <div>
              <label className="text-[11px] text-slate-400">Ticket Price (USD)</label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={livePrice}
                onChange={(e) => setLivePrice(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-amber-500/40 text-xs text-white"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={startingLive}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-purple-600 text-white font-bold text-xs shadow-lg disabled:opacity-50"
          >
            {startingLive ? 'Starting...' : 'Go Live Now'}
          </button>

          {data && data.streams.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2 max-h-44 overflow-y-auto">
              <div className="text-xs font-bold text-slate-300">Your Livestreams</div>
              {data.streams.map((st) => (
                <div key={st.id} className="p-3 rounded-xl bg-slate-950 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-white">{st.title}</div>
                    <div className="text-[10px] text-purple-300">
                      {st.accessType === 'premium' ? `Premium ($${st.price})` : 'Free'} • {st.isLive ? 'LIVE' : 'Ended'}
                    </div>
                  </div>
                  {st.isLive && (
                    <button
                      type="button"
                      onClick={() => handleEndLive(st.id)}
                      className="px-3 py-1 rounded-lg bg-rose-600/20 text-rose-300 text-[10px] font-bold"
                    >
                      End Stream
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* Manage Uploaded Videos */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-400" />
          <span>Manage Public, Private & Premium Videos ({data?.videos?.length || 0})</span>
        </h2>
        {!data || data.videos.length === 0 ? (
          <p className="text-xs text-slate-400">You have not uploaded any videos yet.</p>
        ) : (
          <div className="space-y-3">
            {data.videos.map((v) => (
              <div key={v.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={v.thumbnailUrl} alt="" className="w-20 h-12 rounded-xl object-cover shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-white truncate">{v.title}</div>
                    <div className="text-[11px] text-slate-400">
                      {v.views} views • {v.likesCount} likes • {v.category}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(['public', 'private', 'premium'] as const).map((vis) => (
                    <button
                      key={vis}
                      onClick={() => handleChangeVisibility(v.id, vis)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold capitalize flex items-center gap-1 ${
                        v.visibility === vis ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {vis === 'public' ? <Globe className="w-3 h-3" /> : vis === 'private' ? <Lock className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
                      {vis}
                    </button>
                  ))}
                  <button
                    onClick={() => handleDeleteVideo(v.id)}
                    className="p-2 rounded-lg bg-rose-600/15 text-rose-400 hover:bg-rose-600/30"
                    title="Delete Video"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Receipts */}
      {data && data.transactions.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-3">
          <h3 className="text-base font-bold text-white">Creator Earnings & Transactions</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {data.transactions.slice(0, 12).map((tx) => (
              <div key={tx.txId} className="p-3 rounded-xl bg-slate-950 flex justify-between items-center text-xs">
                <div>
                  <span className="font-mono text-purple-300">{tx.txId}</span>
                  <div className="text-slate-400">{tx.description}</div>
                </div>
                <span className="font-bold text-emerald-400">${tx.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
