import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, Shield, Ban, Flag, Trash2, Check, X, Inbox,
  Video, Phone, Search, UserPlus, Image as ImageIcon, Film, Camera,
  FlipHorizontal, Loader2, Paperclip
} from 'lucide-react';
import { UserPrivacySettings, GlobalFriendProfile } from '../types/orio';

interface MessageItem {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  image?: string;
  video?: string;
  timestamp: string;
  read: boolean;
  isRequest?: boolean;
}

interface ChatContact {
  id: string;
  name: string;
  username: string;
  avatar: string;
  profileId?: string;
  online?: boolean | null;
  onlineVisible?: boolean;
}

interface Props {
  currentUserId: string;
  currentUserName?: string;
  currentUserProfileId?: string;
  currentUserAvatar?: string;
  contacts: ChatContact[];
  friends?: ChatContact[];
  initialSelectedPeer?: string | null;
  messages: MessageItem[];
  requests: MessageItem[];
  onlineUserIds: string[];
  privacy: UserPrivacySettings;
  onRefreshMessages: () => void;
  onUpdatePrivacy: (nextPrivacy: UserPrivacySettings['messagingPrivacy']) => void;
  onUpdateExtendedPrivacy?: (patch: Partial<UserPrivacySettings>) => void;
  onOpenGiftModal?: (targetName: string) => void;
  onOpenReport: (targetType: 'user' | 'message', targetId: string) => void;
  onStartDirectCall?: (peerId: string, peerName?: string, callType?: 'video' | 'audio') => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const MessagingAndPrivacyView: React.FC<Props> = ({
  currentUserId,
  currentUserName = 'User',
  currentUserProfileId = '',
  currentUserAvatar = '',
  contacts,
  friends = [],
  initialSelectedPeer,
  messages,
  requests,
  onlineUserIds,
  privacy,
  onRefreshMessages,
  onUpdatePrivacy,
  onUpdateExtendedPrivacy,
  onOpenReport,
  onStartDirectCall,
  showToast,
}) => {
  const [boxTab, setBoxTab] = useState<'chats' | 'requests' | 'find'>('chats');
  const [selectedPeer, setSelectedPeer] = useState<string>(
    initialSelectedPeer || friends[0]?.id || contacts[0]?.username || 'support@oriolivecall.com'
  );
  const [input, setInput] = useState('');

  // Search Friend by ID / Name inside Private Messaging
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendResults, setFriendResults] = useState<GlobalFriendProfile[]>([]);
  const [searchingFriends, setSearchingFriends] = useState(false);

  // Photo & Video Attachments
  const [pendingMedia, setPendingMedia] = useState<{ url: string; mediaType: 'image' | 'video'; name: string } | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Quick Working Camera Snap Modal inside Messaging
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (initialSelectedPeer) {
      setSelectedPeer(initialSelectedPeer);
      setBoxTab('chats');
    }
  }, [initialSelectedPeer]);

  // Search Directory by Profile ID (ORI-...) / Username / Name
  useEffect(() => {
    if (boxTab !== 'find') return;
    let active = true;
    setSearchingFriends(true);
    const params = new URLSearchParams({
      viewerId: currentUserId,
      q: friendSearchQuery.trim(),
    });
    fetch(`/api/friends/directory?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active && Array.isArray(data)) {
          setFriendResults(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSearchingFriends(false);
      });
    return () => {
      active = false;
    };
  }, [boxTab, friendSearchQuery, currentUserId]);

  // Working Camera lifecycle for Camera Snap modal
  useEffect(() => {
    if (!cameraModalOpen) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      return;
    }
    let cancelled = false;
    setCameraError(null);
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: cameraFacing } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          cameraVideoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError('Could not access camera. Please allow camera permissions.');
        }
      });
    return () => {
      cancelled = true;
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [cameraModalOpen, cameraFacing]);

  // Merge friends, creator contacts, and active message peers without duplicates
  const mergedContacts: ChatContact[] = React.useMemo(() => {
    const map = new Map<string, ChatContact>();
    for (const f of friends) {
      map.set(f.id, f);
    }
    for (const c of contacts) {
      if (!map.has(c.username) && !map.has(c.id)) {
        map.set(c.username, c);
      }
    }
    for (const m of messages) {
      const peerId = m.senderId === currentUserId ? m.recipientId : m.senderId;
      if (
        peerId &&
        peerId !== 'support@oriolivecall.com' &&
        !map.has(peerId) &&
        !Array.from(map.values()).some((x) => x.id === peerId || x.username === peerId)
      ) {
        map.set(peerId, {
          id: peerId,
          name: peerId,
          username: peerId,
          avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        });
      }
    }
    return Array.from(map.values());
  }, [friends, contacts, messages, currentUserId]);

  useEffect(() => {
    if (!selectedPeer) return;
    fetch('/api/messages/mark-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, partnerId: selectedPeer }),
    }).catch(() => {});
  }, [selectedPeer, messages.length, currentUserId]);

  const uploadMediaFile = async (file: File) => {
    setUploadingMedia(true);
    try {
      const form = new FormData();
      form.append('mediaFile', file);
      const res = await fetch('/api/messages/upload-media', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to upload media', 'error');
        return;
      }
      setPendingMedia({
        url: data.url,
        mediaType: data.mediaType === 'video' ? 'video' : 'image',
        name: file.name || (data.mediaType === 'video' ? 'Video Clip' : 'Photo'),
      });
      showToast(`${data.mediaType === 'video' ? 'Video' : 'Photo'} ready to send!`, 'success');
    } catch {
      showToast('Network error uploading photo/video', 'error');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleCaptureCameraSnap = async () => {
    const vid = cameraVideoRef.current;
    if (!vid || !vid.videoWidth) {
      showToast('Camera preview is still loading.', 'info');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = vid.videoWidth;
    canvas.height = vid.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (cameraFacing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `camera-snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setCameraModalOpen(false);
      await uploadMediaFile(file);
    }, 'image/jpeg', 0.9);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !pendingMedia) || !selectedPeer) return;
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          recipientId: selectedPeer,
          text: input.trim(),
          image: pendingMedia?.mediaType === 'image' ? pendingMedia.url : undefined,
          video: pendingMedia?.mediaType === 'video' ? pendingMedia.url : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Message blocked by recipient privacy settings', 'error');
        return;
      }
      setInput('');
      setPendingMedia(null);
      if (data.message?.isRequest) {
        showToast('Sent as a Message Request (pending recipient acceptance).', 'info');
      }
      onRefreshMessages();
    } catch {
      showToast('Failed to send message', 'error');
    }
  };

  const handleAddFriendFromSearch = async (profile: GlobalFriendProfile) => {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          senderName: currentUserName,
          senderProfileId: currentUserProfileId,
          senderAvatar: currentUserAvatar,
          recipientId: profile.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not send friend request.', 'error');
        return;
      }
      showToast(`Friend request sent to ${profile.name}!`, 'success');
      setFriendResults((prev) =>
        prev.map((item) =>
          item.id === profile.id ? { ...item, friendshipStatus: 'outgoing_pending' } : item
        )
      );
      onRefreshMessages();
    } catch {
      showToast('Network error sending friend request.', 'error');
    }
  };

  const handleRequestAction = async (senderId: string, action: 'accept' | 'decline' | 'block') => {
    await fetch('/api/messages/request-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, senderId, action }),
    });
    showToast(
      action === 'accept' ? `Accepted ${senderId}` : action === 'block' ? `Blocked ${senderId}` : 'Request declined',
      'info'
    );
    onRefreshMessages();
  };

  const handleBlockPeer = async (targetId: string) => {
    const isBlocked = privacy.blockedUsers.includes(targetId);
    await fetch('/api/privacy/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, targetId, block: !isBlocked }),
    });
    showToast(isBlocked ? `Unblocked ${targetId}` : `Blocked ${targetId}`, 'info');
    onRefreshMessages();
  };

  const handleDeleteThread = async (partnerId: string) => {
    await fetch('/api/messages/delete-thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, partnerId }),
    });
    showToast('Conversation deleted', 'info');
    onRefreshMessages();
  };

  const activeThreadMessages = messages
    .filter(
      (m) =>
        (m.senderId === currentUserId && m.recipientId === selectedPeer) ||
        (m.senderId === selectedPeer && m.recipientId === currentUserId) ||
        (selectedPeer === 'support@oriolivecall.com' && m.senderId === 'support@oriolivecall.com')
    )
    .slice()
    .reverse();

  const unreadByPeer = (peer: string, altPeer?: string) =>
    messages.filter(
      (m) =>
        (m.senderId === peer || (altPeer && m.senderId === altPeer)) &&
        m.recipientId === currentUserId &&
        !m.read
    ).length;

  const selectedContactInfo = mergedContacts.find(
    (c) => c.id === selectedPeer || c.username === selectedPeer || c.profileId === selectedPeer
  );
  const selectedPeerDisplayName =
    selectedPeer === 'support@oriolivecall.com'
      ? 'OrioLiveCall Safety & Support'
      : selectedContactInfo?.name || selectedPeer;

  const isPeerOnline =
    selectedPeer === 'support@oriolivecall.com' ||
    onlineUserIds.includes(selectedPeer) ||
    mergedContacts.some((c) => (c.id === selectedPeer || c.username === selectedPeer) && c.online === true);
  const isPeerBlocked = privacy.blockedUsers.includes(selectedPeer);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 w-full flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[620px]">
      {/* Left Sidebar: Inbox, Requests, Find Friend by ID & Privacy Defaults */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <span>Private Messaging</span>
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
            Free &amp; Private
          </span>
        </div>

        {/* Chats / Requests / Search Friend ID Tabs */}
        <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setBoxTab('chats')}
            className={`py-2 rounded-lg text-[11px] font-bold transition-colors ${
              boxTab === 'chats' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Inbox
          </button>
          <button
            type="button"
            onClick={() => setBoxTab('find')}
            className={`py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
              boxTab === 'find' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Search className="w-3 h-3" />
            <span>Add / ID</span>
          </button>
          <button
            type="button"
            onClick={() => setBoxTab('requests')}
            className={`py-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors ${
              boxTab === 'requests' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Inbox className="w-3 h-3" />
            <span>Req ({requests.length})</span>
          </button>
        </div>

        {/* Messaging & Presence Privacy Controls */}
        {boxTab !== 'find' && (
          <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                <Shield className="w-3 h-3 text-purple-400" />
                Who can message me directly?
              </label>
              <select
                value={privacy.messagingPrivacy}
                onChange={(e) => onUpdatePrivacy(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="followers">Connections &amp; Followers (Recommended)</option>
                <option value="friends">Global Friends Only</option>
                <option value="everyone">Everyone (Allow All)</option>
                <option value="nobody">Nobody (Pause All Incoming)</option>
              </select>
            </div>

            {onUpdateExtendedPrivacy && (
              <div className="space-y-1.5 pt-1 border-t border-slate-800/80 text-[11px]">
                <label className="flex items-center justify-between cursor-pointer text-slate-300">
                  <span>Show Online Status</span>
                  <input
                    type="checkbox"
                    checked={privacy.showOnlineStatus !== false}
                    onChange={(e) => onUpdateExtendedPrivacy({ showOnlineStatus: e.target.checked })}
                    className="accent-purple-600 rounded"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer text-slate-300">
                  <span>Appear in Global Friends</span>
                  <input
                    type="checkbox"
                    checked={privacy.showInGlobalFriends !== false}
                    onChange={(e) => onUpdateExtendedPrivacy({ showInGlobalFriends: e.target.checked })}
                    className="accent-purple-600 rounded"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2 overflow-y-auto flex-1 max-h-[400px]">
          {boxTab === 'find' ? (
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  placeholder="Search ID (ORI-100001) or name..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 focus:border-pink-500 text-xs text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              {searchingFriends ? (
                <div className="text-center py-6 text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span>Searching IDs...</span>
                </div>
              ) : friendResults.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">
                  No users matched "{friendSearchQuery}".
                </p>
              ) : (
                friendResults.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={p.avatar} alt={p.name} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white truncate">{p.name}</div>
                        <div className="text-[10px] font-mono text-purple-300">{p.profileId}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.friendshipStatus === 'none' && (
                        <button
                          type="button"
                          onClick={() => handleAddFriendFromSearch(p)}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center gap-1"
                        >
                          <UserPlus className="w-3 h-3" />
                          <span>Add Friend</span>
                        </button>
                      )}
                      {p.friendshipStatus === 'friends' && (
                        <span className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold">
                          Friends ✓
                        </span>
                      )}
                      {p.friendshipStatus === 'outgoing_pending' && (
                        <span className="px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300 text-[10px] font-bold">
                          Pending
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPeer(p.id);
                          setBoxTab('chats');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3 text-pink-400" />
                        <span>Message</span>
                      </button>
                      {onStartDirectCall && (
                        <>
                          <button
                            type="button"
                            onClick={() => onStartDirectCall(p.id, p.name, 'video')}
                            className="p-1.5 rounded-lg bg-purple-600/20 text-purple-200 hover:bg-purple-600/40"
                            title="Video Call"
                          >
                            <Video className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onStartDirectCall(p.id, p.name, 'audio')}
                            className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/40"
                            title="Audio Call"
                          >
                            <Phone className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : boxTab === 'chats' ? (
            <>
              <button
                onClick={() => setSelectedPeer('support@oriolivecall.com')}
                className={`w-full p-3 rounded-2xl flex items-center justify-between text-left border transition-all ${
                  selectedPeer === 'support@oriolivecall.com' ? 'bg-purple-600/20 border-purple-500' : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs">OL</div>
                  <div>
                    <div className="font-bold text-xs text-white">OrioLiveCall Safety &amp; Support</div>
                    <div className="text-[10px] text-emerald-400">Online • Official</div>
                  </div>
                </div>
              </button>
              {mergedContacts.map((c) => {
                const peerKey = c.id && c.id !== c.username ? c.id : c.username;
                const onlineVisible = c.onlineVisible !== false;
                const online = onlineVisible && (c.online === true || onlineUserIds.includes(c.username) || onlineUserIds.includes(c.id));
                const unread = unreadByPeer(peerKey, c.username);
                const isSelected = selectedPeer === peerKey || selectedPeer === c.username;
                return (
                  <button
                    key={c.id || c.username}
                    onClick={() => setSelectedPeer(peerKey)}
                    className={`w-full p-3 rounded-2xl flex items-center justify-between text-left border transition-all ${
                      isSelected ? 'bg-purple-600/20 border-purple-500' : 'bg-slate-950 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img src={c.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                        <span
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                            online ? 'bg-emerald-400' : 'bg-slate-500'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate">{c.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {!onlineVisible ? 'Status Hidden' : online ? 'Online' : 'Offline'}
                        </div>
                      </div>
                    </div>
                    {unread > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">{unread}</span>
                    )}
                  </button>
                );
              })}
            </>
          ) : requests.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">No pending message requests.</p>
          ) : (
            requests.map((reqMsg) => (
              <div key={reqMsg.id} className="p-3 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2 text-xs">
                <div className="font-bold text-white truncate">{reqMsg.senderId}</div>
                <p className="text-slate-300 text-[11px] line-clamp-2">{reqMsg.text || '[Media attachment]'}</p>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => handleRequestAction(reqMsg.senderId, 'accept')}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Accept
                  </button>
                  <button
                    onClick={() => handleRequestAction(reqMsg.senderId, 'decline')}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-[10px] font-bold flex items-center justify-center gap-1"
                  >
                    <X className="w-3 h-3" /> Decline
                  </button>
                  <button
                    onClick={() => handleRequestAction(reqMsg.senderId, 'block')}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 text-rose-400 text-[10px] font-bold"
                  >
                    Block
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Chat Thread */}
      <div className="md:col-span-2 p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPeerOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <div className="min-w-0">
              <h3 className="font-bold text-white text-sm truncate">{selectedPeerDisplayName}</h3>
              <span className="text-[10px] text-slate-400">{isPeerOnline ? 'Online Now' : 'Offline'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onStartDirectCall && selectedPeer !== 'support@oriolivecall.com' && (
              <>
                <button
                  type="button"
                  onClick={() => onStartDirectCall(selectedPeer, selectedPeerDisplayName, 'video')}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#f43f8e] to-purple-600 hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all whitespace-nowrap"
                  title="Direct 1-to-1 HD Video Call"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Video Call</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartDirectCall(selectedPeer, selectedPeerDisplayName, 'audio')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/35 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all whitespace-nowrap"
                  title="Direct 1-to-1 Audio Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Audio Call</span>
                </button>
              </>
            )}
            <button
              onClick={() => handleBlockPeer(selectedPeer)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 ${
                isPeerBlocked ? 'bg-rose-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-rose-400'
              }`}
            >
              <Ban className="w-3.5 h-3.5" /> {isPeerBlocked ? 'Unblock' : 'Block'}
            </button>
            <button
              onClick={() => onOpenReport('user', selectedPeer)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400"
              title="Report User"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDeleteThread(selectedPeer)}
              className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-rose-400"
              title="Delete Conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 max-h-[380px] pr-1">
          {activeThreadMessages.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-12">
              No messages yet. Send a text, photo, video, or start a live Video/Audio call!
            </p>
          ) : (
            activeThreadMessages.map((msg) => {
              const mine = msg.senderId === currentUserId;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`p-3 rounded-2xl text-xs max-w-md space-y-2 ${
                      mine ? 'bg-purple-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-200'
                    }`}
                  >
                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Shared photo"
                        className="rounded-xl max-h-60 w-full object-cover border border-white/10"
                      />
                    )}
                    {msg.video && (
                      <video
                        src={msg.video}
                        controls
                        playsInline
                        preload="metadata"
                        className="rounded-xl max-h-60 w-full bg-black border border-white/10"
                      />
                    )}
                    {msg.text && <p className="leading-relaxed break-words">{msg.text}</p>}
                    <div className="text-[9px] opacity-70">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pending Photo/Video Attachment Preview */}
        {(pendingMedia || uploadingMedia) && (
          <div className="mb-2 p-2.5 rounded-2xl bg-slate-950 border border-purple-500/40 flex items-center justify-between gap-3">
            {uploadingMedia ? (
              <div className="flex items-center gap-2 text-xs text-purple-300">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading photo/video...</span>
              </div>
            ) : pendingMedia ? (
              <div className="flex items-center gap-3 min-w-0">
                {pendingMedia.mediaType === 'image' ? (
                  <img src={pendingMedia.url} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0" />
                ) : (
                  <video src={pendingMedia.url} className="w-16 h-12 rounded-xl object-cover bg-black border border-slate-700 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{pendingMedia.name}</div>
                  <div className="text-[10px] text-emerald-400 uppercase">{pendingMedia.mediaType} ready to send</div>
                </div>
              </div>
            ) : null}
            {!uploadingMedia && (
              <button
                type="button"
                onClick={() => setPendingMedia(null)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Composer with Photo, Video, Camera Snap & Send */}
        <form onSubmit={sendMessage} className="pt-3 border-t border-slate-800 space-y-2.5">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMediaFile(file);
              e.target.value = '';
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadMediaFile(file);
              e.target.value = '';
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isPeerBlocked || uploadingMedia}
              onClick={() => photoInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500 text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              <span>Send Photo</span>
            </button>
            <button
              type="button"
              disabled={isPeerBlocked || uploadingMedia}
              onClick={() => videoInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500 text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Film className="w-3.5 h-3.5 text-pink-400" />
              <span>Send Video</span>
            </button>
            <button
              type="button"
              disabled={isPeerBlocked || uploadingMedia}
              onClick={() => setCameraModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500 text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5 text-purple-400" />
              <span>Camera Snap</span>
            </button>
          </div>

          <div className="flex gap-2.5">
            <input
              type="text"
              disabled={isPeerBlocked}
              placeholder={isPeerBlocked ? 'User is blocked. Unblock to message.' : 'Type a private message or caption...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 focus:border-purple-500 text-white text-xs disabled:opacity-50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={isPeerBlocked || uploadingMedia || (!input.trim() && !pendingMedia)}
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </div>
        </form>
      </div>

      {/* Live Working Camera Snap Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Camera Photo Capture</span>
              </div>
              <button
                type="button"
                onClick={() => setCameraModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="aspect-video bg-black relative overflow-hidden flex items-center justify-center">
              {cameraError ? (
                <p className="text-xs text-rose-300 px-6 text-center">{cameraError}</p>
              ) : (
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
                />
              )}
            </div>

            <div className="p-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCameraFacing((f) => (f === 'user' ? 'environment' : 'user'))}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <FlipHorizontal className="w-4 h-4" />
                <span>Flip Cam</span>
              </button>
              <button
                type="button"
                disabled={!!cameraError}
                onClick={handleCaptureCameraSnap}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-purple-600 hover:brightness-110 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Paperclip className="w-4 h-4" />
                <span>Capture &amp; Attach Photo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
