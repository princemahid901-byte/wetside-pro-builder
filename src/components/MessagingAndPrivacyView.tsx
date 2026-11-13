import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Send, Shield, Gift, Ban, Flag, Trash2, Check, X, Inbox
} from 'lucide-react';
import { UserPrivacySettings } from '../types/orio';

interface MessageItem {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  image?: string;
  timestamp: string;
  read: boolean;
  isRequest?: boolean;
}

interface ChatContact {
  id: string;
  name: string;
  username: string;
  avatar: string;
  online?: boolean | null;
  onlineVisible?: boolean;
}

interface Props {
  currentUserId: string;
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
  onOpenGiftModal: (targetName: string) => void;
  onOpenReport: (targetType: 'user' | 'message', targetId: string) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const MessagingAndPrivacyView: React.FC<Props> = ({
  currentUserId,
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
  onOpenGiftModal,
  onOpenReport,
  showToast,
}) => {
  const [boxTab, setBoxTab] = useState<'chats' | 'requests'>('chats');
  const [selectedPeer, setSelectedPeer] = useState<string>(
    initialSelectedPeer || friends[0]?.id || contacts[0]?.username || 'support@oriolivecall.com'
  );
  const [input, setInput] = useState('');

  useEffect(() => {
    if (initialSelectedPeer) {
      setSelectedPeer(initialSelectedPeer);
      setBoxTab('chats');
    }
  }, [initialSelectedPeer]);

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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedPeer) return;
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          recipientId: selectedPeer,
          text: input.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Message blocked by recipient privacy settings', 'error');
        return;
      }
      setInput('');
      if (data.message?.isRequest) {
        showToast('Sent as a Message Request (pending recipient acceptance).', 'info');
      }
      onRefreshMessages();
    } catch {
      showToast('Failed to send message', 'error');
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

  const isPeerOnline =
    selectedPeer === 'support@oriolivecall.com' ||
    onlineUserIds.includes(selectedPeer) ||
    mergedContacts.some((c) => (c.id === selectedPeer || c.username === selectedPeer) && c.online === true);
  const isPeerBlocked = privacy.blockedUsers.includes(selectedPeer);

  return (
    <div className="max-w-6xl mx-auto p-6 w-full flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[600px]">
      {/* Left Sidebar: Inbox, Requests & Privacy-First Defaults */}
      <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <span>Private Messaging</span>
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
            Privacy First
          </span>
        </div>

        {/* Messaging & Presence Privacy Controls */}
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
              <option value="followers">Connections & Followers (Recommended)</option>
              <option value="friends">Global Friends Only</option>
              <option value="subscribers">Subscribers Only (Block Unsolicited)</option>
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
              <label className="flex items-center justify-between cursor-pointer text-slate-300">
                <span>Allow Friend Requests</span>
                <input
                  type="checkbox"
                  checked={privacy.allowFriendRequests !== false}
                  onChange={(e) => onUpdateExtendedPrivacy({ allowFriendRequests: e.target.checked })}
                  className="accent-purple-600 rounded"
                />
              </label>
            </div>
          )}
        </div>

        {/* Chats vs Message Requests Tabs */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setBoxTab('chats')}
            className={`py-2 rounded-lg text-xs font-bold ${boxTab === 'chats' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
          >
            Inbox
          </button>
          <button
            onClick={() => setBoxTab('requests')}
            className={`py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 ${
              boxTab === 'requests' ? 'bg-purple-600 text-white' : 'text-slate-400'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Requests ({requests.length})</span>
          </button>
        </div>

        <div className="space-y-2 overflow-y-auto flex-1">
          {boxTab === 'chats' ? (
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
                    <div className="font-bold text-xs text-white">OrioLiveCall Safety & Support</div>
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
                <p className="text-slate-300 text-[11px] line-clamp-2">{reqMsg.text}</p>
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
      <div className="md:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isPeerOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <div>
              <h3 className="font-bold text-white text-sm">{selectedPeer}</h3>
              <span className="text-[10px] text-slate-400">{isPeerOnline ? 'Online Now' : 'Offline'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenGiftModal(selectedPeer)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1"
            >
              <Gift className="w-3.5 h-3.5" /> Gift
            </button>
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

        <div className="flex-1 overflow-y-auto py-4 space-y-3 max-h-[380px]">
          {activeThreadMessages.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-12">No messages yet. Respect community guidelines.</p>
          ) : (
            activeThreadMessages.map((msg) => {
              const mine = msg.senderId === currentUserId;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`p-3 rounded-2xl text-xs max-w-md space-y-1 ${
                      mine ? 'bg-purple-600 text-white' : 'bg-slate-950 border border-slate-800 text-slate-200'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <div className="text-[9px] opacity-70">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={sendMessage} className="pt-4 border-t border-slate-800 flex gap-3">
          <input
            type="text"
            disabled={isPeerBlocked}
            placeholder={isPeerBlocked ? 'User is blocked. Unblock to message.' : 'Type a respectful private message...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPeerBlocked}
            className="px-5 py-3 rounded-xl bg-purple-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
