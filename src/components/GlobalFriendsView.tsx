import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  UserPlus,
  UserCheck,
  UserX,
  MessageSquare,
  Ban,
  Flag,
  Clock,
  Globe,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  FriendRequestRecord,
  GlobalFriendProfile,
  Language,
  UserPrivacySettings,
} from '../types/orio';
import {
  FirebaseUser,
  syncBlockedUserToFirestore,
  syncFriendRequestToFirestore,
} from '../firebase';

interface GlobalFriendsViewProps {
  lang: Language;
  currentUserId: string;
  currentUserName: string;
  currentUserProfileId?: string;
  currentUserAvatar?: string;
  currentUserCountry?: string;
  privacy: UserPrivacySettings;
  firebaseUser: FirebaseUser | null;
  socket: any;
  onStartPrivateMessage: (peerIdentifier: string) => void;
  onOpenReport: (targetType: 'user', targetId: string) => void;
  onRefreshPrivacyAndMessages: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

type FriendsSubTab = 'discover' | 'friends' | 'requests' | 'blocked';

export const GlobalFriendsView: React.FC<GlobalFriendsViewProps> = ({
  lang,
  currentUserId,
  currentUserName,
  currentUserProfileId,
  currentUserAvatar,
  currentUserCountry,
  privacy,
  firebaseUser,
  socket,
  onStartPrivateMessage,
  onOpenReport,
  onRefreshPrivacyAndMessages,
  showToast,
}) => {
  const [subTab, setSubTab] = useState<FriendsSubTab>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');

  const [directory, setDirectory] = useState<GlobalFriendProfile[]>([]);
  const [myFriends, setMyFriends] = useState<GlobalFriendProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestRecord[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestRecord[]>([]);
  const [blockedList, setBlockedList] = useState<string[]>(privacy.blockedUsers || []);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        viewerId: currentUserId,
        q: searchQuery.trim(),
        country: countryFilter,
        gender: genderFilter,
      });
      const res = await fetch(`/api/friends/directory?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setDirectory(data);
      }
    } catch {
      showToast('Failed to load Global Friends directory.', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, searchQuery, countryFilter, genderFilter, showToast]);

  const loadMyRelationships = useCallback(async () => {
    try {
      const res = await fetch(`/api/friends/${encodeURIComponent(currentUserId)}`);
      if (res.ok) {
        const data = await res.json();
        setMyFriends(data.friends || []);
        setIncomingRequests(data.incomingRequests || []);
        setOutgoingRequests(data.outgoingRequests || []);
        setBlockedList(data.blockedUsers || []);
      }
    } catch {
      // silent fallback
    }
  }, [currentUserId]);

  useEffect(() => {
    loadDirectory();
    loadMyRelationships();
  }, [loadDirectory, loadMyRelationships]);

  useEffect(() => {
    if (!socket) return;
    const handleReload = () => {
      loadDirectory();
      loadMyRelationships();
    };
    socket.on('friend-request-received', handleReload);
    socket.on('friend-request-updated', handleReload);
    socket.on('presence-update', handleReload);
    return () => {
      socket.off('friend-request-received', handleReload);
      socket.off('friend-request-updated', handleReload);
      socket.off('presence-update', handleReload);
    };
  }, [socket, loadDirectory, loadMyRelationships]);

  const handleCopyId = async (profileId: string) => {
    try {
      await navigator.clipboard.writeText(profileId);
      setCopiedId(profileId);
      showToast(`Copied Profile ID: ${profileId}`, 'success');
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      showToast(`Profile ID: ${profileId}`, 'info');
    }
  };

  const handleSendFriendRequest = async (profile: GlobalFriendProfile) => {
    if (!currentUserId || currentUserId === 'guest-user') {
      showToast('Please sign in first to send friend requests.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          senderName: currentUserName,
          senderProfileId: currentUserProfileId,
          senderAvatar: currentUserAvatar,
          senderCountry: currentUserCountry,
          recipientId: profile.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not send friend request.', 'error');
        return;
      }
      if (firebaseUser && data.request?.id) {
        syncFriendRequestToFirestore(firebaseUser, {
          id: data.request.id,
          senderUid: firebaseUser.uid,
          recipientUid: profile.id,
          status: 'pending',
        }).catch(() => {});
      }
      showToast(`Friend request sent to ${profile.name}!`, 'success');
      loadDirectory();
      loadMyRelationships();
    } catch {
      showToast('Network error sending friend request.', 'error');
    }
  };

  const handleRespondRequest = async (
    requestId: string,
    action: 'accept' | 'reject' | 'cancel'
  ) => {
    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          userId: currentUserId,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not update friend request.', 'error');
        return;
      }
      if (firebaseUser && data.request?.id) {
        syncFriendRequestToFirestore(firebaseUser, {
          id: data.request.id,
          senderUid: data.request.senderId,
          recipientUid: data.request.recipientId,
          status: data.request.status,
        }).catch(() => {});
      }
      showToast(
        action === 'accept'
          ? 'Friend request accepted!'
          : action === 'reject'
          ? 'Friend request rejected.'
          : 'Friend request cancelled.',
        action === 'accept' ? 'success' : 'info'
      );
      loadDirectory();
      loadMyRelationships();
    } catch {
      showToast('Network error responding to friend request.', 'error');
    }
  };

  const handleRemoveFriend = async (targetId: string, name: string) => {
    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, targetId }),
      });
      if (res.ok) {
        showToast(`Removed ${name} from Global Friends.`, 'info');
        loadDirectory();
        loadMyRelationships();
      }
    } catch {
      showToast('Could not remove friend.', 'error');
    }
  };

  const handleToggleBlock = async (targetId: string, block: boolean) => {
    try {
      const res = await fetch('/api/privacy/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          targetId,
          block,
          reason: block ? 'Blocked from Global Friends' : undefined,
        }),
      });
      if (res.ok) {
        if (firebaseUser) {
          syncBlockedUserToFirestore(firebaseUser, targetId, block).catch(() => {});
        }
        showToast(block ? `Blocked ${targetId}.` : `Unblocked ${targetId}.`, 'info');
        loadDirectory();
        loadMyRelationships();
        onRefreshPrivacyAndMessages();
      }
    } catch {
      showToast('Failed to update block list.', 'error');
    }
  };

  const renderPresenceBadge = (p: GlobalFriendProfile) => {
    if (!p.onlineVisible || p.online === null) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Status Hidden
        </span>
      );
    }
    return p.online ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Online
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Offline
      </span>
    );
  };

  const renderProfileCard = (p: GlobalFriendProfile) => {
    return (
      <div
        key={p.id}
        className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col justify-between gap-4 hover:border-purple-500/40 transition-colors"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <img
                src={p.avatar}
                alt={p.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-purple-500/50 shrink-0"
              />
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-white text-sm truncate">{p.name}</h3>
                  {p.creatorBadge && (
                    <span title="Verified Profile" className="inline-flex">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopyId(p.profileId)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-600/20 border border-purple-500/30 text-[10px] font-mono text-purple-300 hover:bg-purple-600/30"
                    title="Copy Profile ID"
                  >
                    <span>{p.profileId}</span>
                    {copiedId === p.profileId ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                  </button>
                  <span className="text-[11px] text-slate-400 truncate">{p.username}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderPresenceBadge(p)}
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3 text-purple-400" />
                    {p.country}
                  </span>
                  {p.gender && p.gender !== 'Not set' && (
                    <span className="text-[10px] text-slate-400">· {p.gender}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleBlock(p.id, true)}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400"
                title={`Block ${p.name}`}
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onOpenReport('user', p.id)}
                className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-amber-400"
                title={`Report ${p.name}`}
              >
                <Flag className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-300 line-clamp-2">{p.bio}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          {p.friendshipStatus === 'none' && (
            <button
              type="button"
              disabled={!p.allowFriendRequests}
              onClick={() => handleSendFriendRequest(p)}
              className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{p.allowFriendRequests ? 'Add Friend' : 'Requests Off'}</span>
            </button>
          )}

          {p.friendshipStatus === 'outgoing_pending' && p.pendingRequestId && (
            <button
              type="button"
              onClick={() => handleRespondRequest(p.pendingRequestId!, 'cancel')}
              className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Cancel Request</span>
            </button>
          )}

          {p.friendshipStatus === 'incoming_pending' && p.pendingRequestId && (
            <>
              <button
                type="button"
                onClick={() => handleRespondRequest(p.pendingRequestId!, 'accept')}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept</span>
              </button>
              <button
                type="button"
                onClick={() => handleRespondRequest(p.pendingRequestId!, 'reject')}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
              >
                Reject
              </button>
            </>
          )}

          {p.friendshipStatus === 'friends' && (
            <button
              type="button"
              onClick={() => handleRemoveFriend(p.id, p.name)}
              className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-rose-600/20 hover:border-rose-500/40 hover:text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              title="Click to remove from friends"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Friends · Remove</span>
            </button>
          )}

          <button
            type="button"
            disabled={!p.canMessage}
            onClick={() => onStartPrivateMessage(p.id)}
            title={
              p.canMessage
                ? 'Open Private Message'
                : `Messaging restricted (${p.messagingPrivacy})`
            }
            className="py-2 px-3 rounded-xl bg-slate-950 border border-slate-700 hover:border-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white flex items-center gap-1.5"
          >
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            <span>{p.canMessage ? 'Message' : 'DM Locked'}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-6 w-full flex-1">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-purple-400" />
            <span>
              {lang === 'bn'
                ? 'গ্লোবাল ফ্রেন্ডস ও ডিসকভারি'
                : 'Global Friends & Public Directory'}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Discover public profiles by @username, unique Profile ID (e.g. ORI-100001), country, or voluntarily selected profile preferences. Online indicators strictly obey user privacy settings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            loadDirectory();
            loadMyRelationships();
          }}
          className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 hover:border-purple-500 flex items-center gap-2 self-start lg:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-purple-400 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Sub-navigation tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'discover', label: `Discover People (${directory.length})` },
          { id: 'friends', label: `My Friends (${myFriends.length})` },
          {
            id: 'requests',
            label: `Friend Requests (${incomingRequests.length + outgoingRequests.length})`,
          },
          { id: 'blocked', label: `Blocked (${blockedList.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as FriendsSubTab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              subTab === tab.id
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'discover' && (
        <div className="space-y-5">
          {/* Search & Filters */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6 space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">
                Search by @username, Profile ID, or Name
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. ORI-100001 or @sophia_tokyo..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">Country</label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="all">All Countries</option>
                <option value="Bangladesh">Bangladesh</option>
                <option value="India">India</option>
                <option value="Japan">Japan</option>
                <option value="United States">United States</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Canada">Canada</option>
                <option value="Australia">Australia</option>
              </select>
            </div>

            <div className="md:col-span-3 space-y-1">
              <label className="text-[11px] font-semibold text-slate-400">
                Voluntary Profile Gender
              </label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="all">Any Profile Gender</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 px-1">
            Privacy Note: Gender preferences only match voluntarily self-selected profile fields. OrioLiveCall never infers gender from camera video, face, or voice.
          </div>

          {directory.length === 0 ? (
            <div className="p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
              No public profiles match your search criteria. Try clearing filters or searching another Profile ID.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {directory.map(renderProfileCard)}
            </div>
          )}
        </div>
      )}

      {subTab === 'friends' && (
        <div className="space-y-4">
          {myFriends.length === 0 ? (
            <div className="p-10 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-3">
              <p className="text-xs text-slate-400">
                You have not added any Global Friends yet.
              </p>
              <button
                type="button"
                onClick={() => setSubTab('discover')}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold"
              >
                Discover People
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {myFriends.map(renderProfileCard)}
            </div>
          )}
        </div>
      )}

      {subTab === 'requests' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Incoming Requests ({incomingRequests.length})</span>
            </h2>
            {incomingRequests.length === 0 ? (
              <p className="text-xs text-slate-500">No incoming friend requests.</p>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-xs text-white truncate">
                        {req.senderName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {req.senderProfileId || req.senderId}
                        {req.senderCountry ? ` · ${req.senderCountry}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRespondRequest(req.id, 'accept')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondRequest(req.id, 'reject')}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleBlock(req.senderId, true)}
                        className="p-1.5 rounded-xl bg-rose-600/20 text-rose-300 hover:bg-rose-600/30"
                        title="Block sender"
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Sent Requests ({outgoingRequests.length})</span>
            </h2>
            {outgoingRequests.length === 0 ? (
              <p className="text-xs text-slate-500">No outgoing pending requests.</p>
            ) : (
              <div className="space-y-3">
                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="font-bold text-xs text-white truncate">
                        {req.recipientName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {req.recipientProfileId || req.recipientId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRespondRequest(req.id, 'cancel')}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600/30 text-slate-200 hover:text-rose-200 text-xs font-bold shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'blocked' && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <UserX className="w-4 h-4 text-rose-400" />
            <span>Blocked Users ({blockedList.length})</span>
          </h2>
          {blockedList.length === 0 ? (
            <p className="text-xs text-slate-500">
              You have not blocked any users. Blocked users cannot match with you in calls, send friend requests, or send private messages.
            </p>
          ) : (
            <div className="space-y-2">
              {blockedList.map((blockedId) => (
                <div
                  key={blockedId}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-slate-200">{blockedId}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleBlock(blockedId, false)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-600/30 text-slate-200 hover:text-emerald-200 font-bold"
                  >
                    Unblock
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
