import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Play, Pause, Volume2, VolumeX, Maximize, Heart, Bookmark,
  ShieldCheck, Lock, Crown, Flag, Flame, Clock, Sparkles, UserPlus,
  UserCheck, Gift, X, Filter
} from 'lucide-react';
import { VideoFeedItem, SubscriptionItem, Language } from '../types/orio';

interface CreatorSummary {
  id: string;
  name: string;
  username: string;
  country: string;
  avatar: string;
  bio: string;
  subscribersCount: number;
  monthlyPrice: number;
  yearlyPrice: number;
}

interface Props {
  lang: Language;
  currentUserId: string;
  creators: CreatorSummary[];
  follows: string[];
  subscriptions: SubscriptionItem[];
  followerCounts: Record<string, number>;
  subscriberCounts: Record<string, number>;
  onToggleFollow: (creatorId: string) => void;
  onOpenSubscribeModal: (creatorId: string, creatorName: string) => void;
  onOpenGiftModal: (creatorName: string) => void;
  onOpenReport: (targetType: 'video', targetId: string) => void;
  onSyncLikeFirestore?: (videoId: string, liked: boolean) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const CATEGORIES = ['All', 'Travel', 'Music', 'Education', 'Fitness', 'Technology', 'Lifestyle'];

export const VideoDiscoveryWatch: React.FC<Props> = ({
  lang,
  currentUserId,
  creators,
  follows,
  subscriptions,
  followerCounts,
  subscriberCounts,
  onToggleFollow,
  onOpenSubscribeModal,
  onOpenGiftModal,
  onOpenReport,
  onSyncLikeFirestore,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('oriolivecall_recent_searches') || '[]');
    } catch {
      return [];
    }
  });
  const [category, setCategory] = useState('All');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private' | 'premium'>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'recent'>('trending');
  const [safeOnly, setSafeOnly] = useState(true);
  const [viewMode, setViewMode] = useState<'discover' | 'history' | 'saved'>('discover');

  const [videos, setVideos] = useState<VideoFeedItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<VideoFeedItem[]>([]);
  const [savedVideos, setSavedVideos] = useState<VideoFeedItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoFeedItem | null>(null);
  const [relatedVideos, setRelatedVideos] = useState<VideoFeedItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Video player custom controls
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);

  const fetchVideos = async (overrideQ?: string) => {
    setLoading(true);
    try {
      const q = overrideQ !== undefined ? overrideQ : searchQuery;
      const params = new URLSearchParams({
        q,
        category,
        visibility: visibilityFilter,
        sort: sortBy,
        safeOnly: String(safeOnly),
        viewerId: currentUserId,
      });
      const res = await fetch(`/api/videos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to search videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLibrary = async () => {
    try {
      const res = await fetch(`/api/user/${encodeURIComponent(currentUserId)}/library`);
      if (res.ok) {
        const data = await res.json();
        setWatchHistory(data.watchHistory || []);
        setSavedVideos(data.savedVideos || []);
      }
    } catch (err) {
      console.error('Library fetch error:', err);
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchLibrary();
  }, [category, visibilityFilter, sortBy, safeOnly, currentUserId, subscriptions.length]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/videos/suggestions?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(Array.isArray(data) ? data : []);
        }
      } catch {}
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e?: React.FormEvent, explicitTerm?: string) => {
    e?.preventDefault();
    const term = (explicitTerm !== undefined ? explicitTerm : searchQuery).trim();
    if (explicitTerm !== undefined) setSearchQuery(term);
    setShowSuggestions(false);
    if (term) {
      const next = [term, ...recentSearches.filter((r) => r !== term)].slice(0, 6);
      setRecentSearches(next);
      localStorage.setItem('oriolivecall_recent_searches', JSON.stringify(next));
    }
    fetchVideos(term);
  };

  const openVideoWatch = async (vid: VideoFeedItem) => {
    setSelectedVideo(vid);
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(vid.id)}?viewerId=${encodeURIComponent(currentUserId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.video) setSelectedVideo(data.video);
        if (Array.isArray(data.related)) setRelatedVideos(data.related);
        if (data.video?.hasAccess) {
          await fetch(`/api/videos/${encodeURIComponent(vid.id)}/view`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUserId }),
          });
          fetchLibrary();
        }
      }
    } catch (err) {
      console.error('Open video watch error:', err);
    }
  };

  const handleLikeVideo = async (videoId: string) => {
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        setVideos((prev) =>
          prev.map((v) => (v.id === videoId ? { ...v, likedByViewer: data.liked, likesCount: data.likesCount } : v))
        );
        if (selectedVideo?.id === videoId) {
          setSelectedVideo((prev) => (prev ? { ...prev, likedByViewer: data.liked, likesCount: data.likesCount } : null));
        }
        onSyncLikeFirestore?.(videoId, data.liked);
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  const handleSaveVideo = async (videoId: string) => {
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(videoId)}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        setVideos((prev) => prev.map((v) => (v.id === videoId ? { ...v, savedByViewer: data.saved } : v)));
        if (selectedVideo?.id === videoId) {
          setSelectedVideo((prev) => (prev ? { ...prev, savedByViewer: data.saved } : null));
        }
        fetchLibrary();
        showToast(data.saved ? 'Saved to your video library' : 'Removed from saved videos', 'info');
      }
    } catch (err) {
      console.error('Save video error:', err);
    }
  };

  const togglePlayerPlay = () => {
    const el = videoElRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const togglePlayerMute = () => {
    const el = videoElRef.current;
    if (!el) return;
    el.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (videoElRef.current) {
      videoElRef.current.volume = val;
      videoElRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const togglePlayerFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await playerContainerRef.current?.requestFullscreen?.();
      } else {
        await document.exitFullscreen();
      }
    } catch {}
  };

  const displayedList =
    viewMode === 'history' ? watchHistory : viewMode === 'saved' ? savedVideos : videos;

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-6 w-full flex-1">
      {/* Header + Library Mode Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white flex items-center gap-3">
            <Play className="w-7 h-7 text-purple-400" />
            <span>{lang === 'bn' ? 'ভিডিও সার্চ ও ফ্রি ওয়াচ' : 'Video Discovery & Free Watch'}</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Watch public creator videos completely free. Private & Premium videos are protected on the backend.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-2xl border border-slate-800 self-start">
          {[
            { id: 'discover', label: 'Discover', icon: Flame },
            { id: 'history', label: `History (${watchHistory.length})`, icon: Clock },
            { id: 'saved', label: `Saved (${savedVideos.length})`, icon: Bookmark },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setViewMode(tab.id as any);
                  setSelectedVideo(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === tab.id ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search Bar, Suggestions, Recent Searches & Filters */}
      {viewMode === 'discover' && (
        <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl">
          <form onSubmit={handleSearchSubmit} className="relative flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Search videos by title, creator, category, or #hashtag..."
                className="w-full pl-11 pr-10 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-purple-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    fetchVideos('');
                  }}
                  className="absolute right-3 top-3 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Search Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-30 overflow-hidden">
                  {suggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSearchSubmit(undefined, sug)}
                      className="w-full px-4 py-2.5 text-left text-xs text-slate-200 hover:bg-purple-600/20 flex items-center gap-2 border-b border-slate-800/60 last:border-b-0"
                    >
                      <Search className="w-3.5 h-3.5 text-purple-400" />
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xs shadow-lg hover:opacity-95 shrink-0"
            >
              Search Videos
            </button>
          </form>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="text-slate-400 font-medium">Recent:</span>
              {recentSearches.map((term) => (
                <button
                  key={term}
                  onClick={() => handleSearchSubmit(undefined, term)}
                  className="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-300 hover:border-purple-500"
                >
                  {term}
                </button>
              ))}
              <button
                onClick={() => {
                  setRecentSearches([]);
                  localStorage.removeItem('oriolivecall_recent_searches');
                }}
                className="text-slate-500 hover:text-rose-400 underline ml-1"
              >
                Clear
              </button>
            </div>
          )}

          {/* Category + Access + Safe Content Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    category === cat ? 'bg-purple-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
              >
                <option value="all">All Access Levels</option>
                <option value="public">Free Public Only</option>
                <option value="private">Authorized Private</option>
                <option value="premium">Premium Memberships</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs"
              >
                <option value="trending">Trending & Popular</option>
                <option value="recent">Newest Uploads</option>
              </select>

              <button
                onClick={() => setSafeOnly((v) => !v)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 ${
                  safeOnly
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Safe Filter: {safeOnly ? 'ON' : 'OFF'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Video Theater View */}
      {selectedVideo && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div
              ref={playerContainerRef}
              className="relative rounded-3xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video flex flex-col justify-center"
            >
              {selectedVideo.hasAccess && selectedVideo.streamUrl ? (
                <>
                  <video
                    ref={videoElRef}
                    src={selectedVideo.streamUrl}
                    poster={selectedVideo.thumbnailUrl}
                    autoPlay
                    playsInline
                    controls
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    className="w-full h-full object-contain bg-black"
                  />
                  {/* Quick Custom Overlay Toolbar */}
                  <div className="bg-slate-900/95 px-4 py-2.5 border-t border-slate-800 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <button onClick={togglePlayerPlay} className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-purple-600">
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button onClick={togglePlayerMute} className="p-1.5 rounded-lg bg-slate-800 text-white">
                        {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="w-20 accent-purple-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase text-[10px]">
                        {selectedVideo.visibility === 'public' ? 'FREE PUBLIC WATCH' : `${selectedVideo.visibility} UNLOCKED`}
                      </span>
                      <button onClick={togglePlayerFullscreen} className="p-1.5 rounded-lg bg-slate-800 text-white hover:bg-purple-600">
                        <Maximize className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {selectedVideo.visibility === 'premium' ? 'Premium Membership Video' : 'Private Video Protected'}
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    {selectedVideo.accessReason || 'This video is restricted and protected on the server.'}
                  </p>
                  {selectedVideo.visibility === 'premium' && (
                    <button
                      onClick={() => onOpenSubscribeModal(selectedVideo.creatorId, selectedVideo.creatorName)}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xs shadow-lg inline-flex items-center gap-2"
                    >
                      <Crown className="w-4 h-4" />
                      <span>Subscribe to {selectedVideo.creatorName}</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Video Metadata & Action Bar */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                      {selectedVideo.category}
                    </span>
                    <span className="text-[11px] text-slate-400">{selectedVideo.views} views</span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white">{selectedVideo.title}</h2>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleLikeVideo(selectedVideo.id)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                      selectedVideo.likedByViewer
                        ? 'bg-rose-600 border-rose-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-rose-500'
                    }`}
                  >
                    <Heart className="w-4 h-4" />
                    <span>{selectedVideo.likesCount}</span>
                  </button>

                  <button
                    onClick={() => handleSaveVideo(selectedVideo.id)}
                    className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                      selectedVideo.savedByViewer
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-purple-500'
                    }`}
                  >
                    <Bookmark className="w-4 h-4" />
                    <span>{selectedVideo.savedByViewer ? 'Saved' : 'Save'}</span>
                  </button>

                  <button
                    onClick={() => onOpenGiftModal(selectedVideo.creatorName)}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Gift className="w-4 h-4" />
                    <span>Gift</span>
                  </button>

                  <button
                    onClick={() => onOpenReport('video', selectedVideo.id)}
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Report</span>
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{selectedVideo.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedVideo.hashtags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleSearchSubmit(undefined, `#${tag}`)}
                    className="text-[11px] text-purple-300 bg-purple-950/60 px-2.5 py-0.5 rounded-full hover:bg-purple-900"
                  >
                    #{tag}
                  </button>
                ))}
              </div>

              {/* Creator Profile Strip with Free Follow & Paid Membership Subscribe */}
              <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedVideo.creatorAvatar}
                    alt={selectedVideo.creatorName}
                    className="w-12 h-12 rounded-2xl object-cover border border-purple-500"
                  />
                  <div>
                    <div className="font-bold text-white text-sm flex items-center gap-1.5">
                      <span>{selectedVideo.creatorName}</span>
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {(followerCounts[selectedVideo.creatorId] || 0)} followers •{' '}
                      {(subscriberCounts[selectedVideo.creatorId] || 0)} active members
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleFollow(selectedVideo.creatorId)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      follows.includes(selectedVideo.creatorId)
                        ? 'bg-emerald-600/20 border border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border border-slate-700 text-white hover:border-purple-500'
                    }`}
                  >
                    {follows.includes(selectedVideo.creatorId) ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Following (Free)</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow Free</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onOpenSubscribeModal(selectedVideo.creatorId, selectedVideo.creatorName)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
                  >
                    <Crown className="w-3.5 h-3.5" />
                    <span>Subscribe</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Related Videos Sidebar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Related Recommendations</span>
              </h3>
              <button onClick={() => setSelectedVideo(null)} className="text-xs text-purple-400 hover:underline">
                Back to Grid
              </button>
            </div>

            <div className="space-y-3">
              {relatedVideos.map((rel) => (
                <button
                  key={rel.id}
                  onClick={() => openVideoWatch(rel)}
                  className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-purple-500/60 flex gap-3 text-left transition-all"
                >
                  <div className="relative w-28 h-16 rounded-xl overflow-hidden bg-slate-950 shrink-0">
                    <img src={rel.thumbnailUrl} alt={rel.title} className="w-full h-full object-cover" />
                    {rel.visibility !== 'public' && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-[9px] font-bold text-amber-300 uppercase">
                        {rel.visibility}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-bold text-xs text-white line-clamp-2">{rel.title}</div>
                    <div className="text-[11px] text-purple-300">{rel.creatorName}</div>
                    <div className="text-[10px] text-slate-400">{rel.views} views • {rel.likesCount} likes</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Video Discovery Grid */}
      {!selectedVideo && (
        <>
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-400">Searching verified videos...</div>
          ) : displayedList.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-2">
              <p className="text-sm font-bold text-white">No videos found matching your current filter.</p>
              <p className="text-xs text-slate-400">Try clearing filters or upload a non-explicit video in the Creator Dashboard.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedList.map((vid) => (
                <div
                  key={vid.id}
                  className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-xl flex flex-col justify-between hover:border-purple-500/60 transition-all"
                >
                  <div onClick={() => openVideoWatch(vid)} className="relative h-48 bg-slate-950 cursor-pointer group">
                    <img
                      src={vid.thumbnailUrl}
                      alt={vid.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          vid.visibility === 'public'
                            ? 'bg-emerald-500/90 text-slate-950'
                            : vid.visibility === 'premium'
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-purple-600 text-white'
                        }`}
                      >
                        {vid.visibility === 'public' ? 'FREE WATCH' : vid.visibility}
                      </span>
                      <span className="px-2 py-1 rounded-full bg-black/70 text-[10px] text-slate-200">
                        {vid.category}
                      </span>
                    </div>
                    <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-lg">
                      {vid.hasAccess ? <Play className="w-4 h-4 ml-0.5" /> : <Lock className="w-4 h-4" />}
                    </div>
                  </div>

                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <h3
                        onClick={() => openVideoWatch(vid)}
                        className="font-bold text-white text-sm line-clamp-2 cursor-pointer hover:text-purple-300"
                      >
                        {vid.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <img src={vid.creatorAvatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        <span className="text-xs text-purple-300 font-medium">{vid.creatorName}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                      <span>{vid.views} views</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLikeVideo(vid.id)}
                          className={`flex items-center gap-1 ${vid.likedByViewer ? 'text-rose-400 font-bold' : 'hover:text-white'}`}
                        >
                          <Heart className="w-3.5 h-3.5" />
                          <span>{vid.likesCount}</span>
                        </button>
                        <button
                          onClick={() => handleSaveVideo(vid.id)}
                          className={vid.savedByViewer ? 'text-purple-400' : 'hover:text-white'}
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onOpenReport('video', vid.id)} className="hover:text-rose-400" title="Report Video">
                          <Flag className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* New Creator Uploads Strip */}
      {creators.length > 0 && viewMode === 'discover' && !selectedVideo && (
        <div className="p-6 rounded-3xl bg-slate-900/70 border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Featured Verified Creators — Follow Free or Subscribe</span>
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {creators.map((c) => {
              const isFollowing = follows.includes(c.id);
              return (
                <div key={c.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img src={c.avatar} alt={c.name} className="w-11 h-11 rounded-xl object-cover" />
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-white truncate">{c.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {followerCounts[c.id] || 0} followers • {subscriberCounts[c.id] || 0} members
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => onToggleFollow(c.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold ${
                        isFollowing ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-white'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button
                      onClick={() => onOpenSubscribeModal(c.id, c.name)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white text-[10px] font-bold"
                    >
                      Sub
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
