import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown,
  CheckCircle2,
  RefreshCcw,
  CreditCard,
  Receipt,
  Search,
  ShieldCheck,
  X,
  Calendar,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  PaymentMethodRecord,
  SubscriptionItem,
  VideoFeedItem,
} from '../types/orio';
import { FirebaseUser, syncSubscriptionToFirestore } from '../firebase';

interface CreatorLike {
  id: string;
  profileId?: string;
  name: string;
  username: string;
  country: string;
  avatar: string;
  bio: string;
  subscribersCount: number;
  monthlyPrice: number;
  yearlyPrice: number;
}

interface SubscriptionCenterViewProps {
  currentUserId: string;
  walletBalance: number;
  creators: CreatorLike[];
  follows: string[];
  subscriptions: SubscriptionItem[];
  followerCounts: Record<string, number>;
  subscriberCounts: Record<string, number>;
  recentCreatorUploads: VideoFeedItem[];
  firebaseUser?: FirebaseUser | null;
  onToggleFollow: (creatorId: string) => void;
  onRefreshAll: () => void;
  onNavigateTab: (tab: string) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

interface CheckoutTarget {
  creatorId: string;
  creatorName: string;
  planScope: 'platform' | 'creator';
  monthlyPrice: number;
  yearlyPrice: number;
  selectedPlan: 'monthly' | 'yearly';
}

export const SubscriptionCenterView: React.FC<SubscriptionCenterViewProps> = ({
  currentUserId,
  walletBalance,
  creators,
  follows,
  subscriptions,
  followerCounts,
  subscriberCounts,
  recentCreatorUploads,
  firebaseUser,
  onToggleFollow,
  onRefreshAll,
  onNavigateTab,
  showToast,
}) => {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget | null>(null);
  const [selectedPaymentSource, setSelectedPaymentSource] = useState<string>('wallet');
  const [autoRenew, setAutoRenew] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [receiptModalSub, setReceiptModalSub] = useState<SubscriptionItem | null>(null);

  const loadPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch(`/api/payment-methods/${encodeURIComponent(currentUserId)}`);
      if (res.ok) {
        const list: PaymentMethodRecord[] = await res.json();
        setPaymentMethods(list);
      }
    } catch {}
  }, [currentUserId]);

  useEffect(() => {
    loadPaymentMethods();
  }, [loadPaymentMethods]);

  const filteredCreators = creators.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.username.toLowerCase().includes(q) ||
      (c.profileId || '').toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q)
    );
  });

  const handleConfirmPurchase = async () => {
    if (!checkoutTarget) return;
    const price =
      checkoutTarget.selectedPlan === 'monthly'
        ? checkoutTarget.monthlyPrice
        : checkoutTarget.yearlyPrice;

    setPurchasing(true);
    try {
      const res = await fetch('/api/subscriptions/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          creatorId: checkoutTarget.creatorId,
          creatorName: checkoutTarget.creatorName,
          plan: checkoutTarget.selectedPlan,
          planScope: checkoutTarget.planScope,
          price,
          autoRenew,
          paymentMethodId: selectedPaymentSource === 'wallet' ? undefined : selectedPaymentSource,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Subscription checkout failed', 'error');
        return;
      }

      if (firebaseUser && data.subscription) {
        syncSubscriptionToFirestore(firebaseUser, {
          creatorId: checkoutTarget.creatorId,
          creatorName: checkoutTarget.creatorName,
          plan: checkoutTarget.selectedPlan,
          price,
          status: 'active',
          autoRenew,
          renewalDate: data.subscription.renewalDate,
          expiresAt: data.subscription.expiresAt,
        }).catch(() => {});
      }

      setCheckoutTarget(null);
      setReceiptModalSub(data.subscription);
      onRefreshAll();
      showToast(`Subscription activated! Receipt TX: ${data.txId}`, 'success');
    } catch {
      showToast('Failed to complete subscription checkout', 'error');
    } finally {
      setPurchasing(false);
    }
  };

  const handleToggleAutoRenew = async (sub: SubscriptionItem) => {
    try {
      const res = await fetch('/api/subscriptions/toggle-renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          subscriptionId: sub.id,
          autoRenew: !sub.autoRenew,
        }),
      });
      if (res.ok) {
        onRefreshAll();
        showToast(
          !sub.autoRenew ? 'Auto-renewal enabled.' : 'Auto-renewal turned off.',
          'info'
        );
      }
    } catch {}
  };

  const handleCancelSubscription = async (subscriptionId: string, requestRefund: boolean) => {
    try {
      const res = await fetch('/api/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, subscriptionId, requestRefund }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          data.refunded
            ? `Cancelled & 24h refund credited (${data.refundTxId}).`
            : 'Subscription cancelled cleanly.',
          'success'
        );
        onRefreshAll();
      }
    } catch {}
  };

  const previewExpiry = checkoutTarget
    ? new Date(
        Date.now() + (checkoutTarget.selectedPlan === 'yearly' ? 365 : 30) * 86400000
      ).toLocaleDateString()
    : '';

  return (
    <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8 w-full flex-1">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Crown className="w-8 h-8 text-purple-400" />
            <span>Subscription Purchase Center</span>
          </h1>
          <p className="text-xs text-slate-400">
            Transparent pricing, renewal dates, cancellation, 24h refund policy, and instant receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigateTab('payment-methods')}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-purple-500/40 text-xs font-bold text-purple-200 hover:bg-purple-600/20 flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4 text-purple-400" />
            <span>Payment Methods</span>
          </button>
          <button
            onClick={() => {
              onRefreshAll();
              loadPaymentMethods();
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Platform All-Access Pass Plans */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-[#150c29] to-slate-900 border border-purple-500/40 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-purple-600/30 border border-purple-400/40 text-purple-200 text-[11px] font-bold">
              MONTHLY PLATFORM PASS
            </span>
            <span className="text-2xl font-black text-white">
              $29.99 <span className="text-xs font-normal text-slate-400">/ 30 days</span>
            </span>
          </div>
          <h3 className="text-lg font-bold text-white">OrioLiveCall All-Access Monthly</h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Full access to Premium Videos across creators</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Entry to Premium Creator Livestreams included</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Subscriber priority text messaging & 24h refund guarantee</li>
          </ul>
          <p className="text-[10px] text-slate-400">
            Disclosure: Covers premium video/live access and text messaging; does not include unlimited paid video calling. Cancel anytime.
          </p>
          <button
            onClick={() =>
              setCheckoutTarget({
                creatorId: 'platform-pass',
                creatorName: 'OrioLiveCall All-Access Pass',
                planScope: 'platform',
                monthlyPrice: 29.99,
                yearlyPrice: 249.99,
                selectedPlan: 'monthly',
              })
            }
            className="w-full py-3 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-colors"
          >
            Select Monthly Pass ($29.99)
          </button>
        </div>

        <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0d192b] to-slate-900 border border-blue-500/40 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[11px] font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> YEARLY BEST VALUE (SAVE 30%)
            </span>
            <span className="text-2xl font-black text-white">
              $249.99 <span className="text-xs font-normal text-slate-400">/ 365 days</span>
            </span>
          </div>
          <h3 className="text-lg font-bold text-white">OrioLiveCall All-Access Yearly</h3>
          <ul className="space-y-1.5 text-xs text-slate-300">
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> 365 days of Premium Videos & Premium Livestreams</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Unlimited subscriber text messaging & verified supporter badge</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> Transparent renewal reminder & 24h refund guarantee</li>
          </ul>
          <p className="text-[10px] text-slate-400">
            Disclosure: Covers premium video/live access and text messaging; does not include unlimited paid video calling. Cancel anytime.
          </p>
          <button
            onClick={() =>
              setCheckoutTarget({
                creatorId: 'platform-pass',
                creatorName: 'OrioLiveCall All-Access Pass',
                planScope: 'platform',
                monthlyPrice: 29.99,
                yearlyPrice: 249.99,
                selectedPlan: 'yearly',
              })
            }
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold hover:opacity-95 transition-opacity"
          >
            Select Yearly Pass ($249.99)
          </button>
        </div>
      </div>

      {/* Subscription History & Active Plans */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <h2 className="text-lg font-bold text-white">
          Your Active Plans & Subscription History ({subscriptions.length})
        </h2>
        {subscriptions.length === 0 ? (
          <p className="text-xs text-slate-400">
            No paid subscriptions yet. Free following is always available, or choose a Platform Pass or Creator Membership below.
          </p>
        ) : (
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1.5">
                  <div className="font-bold text-white flex flex-wrap items-center gap-2">
                    <span>{sub.creatorName}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        sub.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {sub.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-300 text-[10px] font-bold uppercase">
                      {sub.plan}
                    </span>
                  </div>
                  <div className="text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                    <span>Price: <strong className="text-white">${sub.price.toFixed(2)} USD</strong></span>
                    <span>Started: {new Date(sub.createdAt).toLocaleDateString()}</span>
                    <span>Renewal/Expiry: {new Date(sub.renewalDate || sub.expiresAt).toLocaleDateString()}</span>
                    <span>Method: {sub.paymentMethodLabel || 'Wallet Balance'}</span>
                    <span className="font-mono text-purple-300">TX: {sub.txId}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    onClick={() => setReceiptModalSub(sub)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 font-semibold hover:text-white flex items-center gap-1"
                  >
                    <Receipt className="w-3.5 h-3.5 text-purple-400" />
                    <span>Receipt</span>
                  </button>
                  {sub.status === 'active' && (
                    <>
                      <button
                        onClick={() => handleToggleAutoRenew(sub)}
                        className={`px-3 py-1.5 rounded-xl border font-semibold ${
                          sub.autoRenew
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-900 border-slate-700 text-slate-300'
                        }`}
                      >
                        Auto-Renew: {sub.autoRenew ? 'ON' : 'OFF'}
                      </button>
                      <button
                        onClick={() => handleCancelSubscription(sub.id, false)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 font-semibold hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleCancelSubscription(sub.id, true)}
                        className="px-3 py-1.5 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-200 font-semibold hover:bg-rose-600/30"
                      >
                        24h Refund
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Uploads from Followed Creators */}
      {recentCreatorUploads.length > 0 && (
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-lg font-bold text-white">New Uploads from Followed Creators</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {recentCreatorUploads.map((v) => (
              <div
                key={v.id}
                onClick={() => onNavigateTab('videos')}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-purple-500 cursor-pointer space-y-1.5"
              >
                <div className="font-bold text-white text-xs">{v.title}</div>
                <div className="text-[11px] text-purple-300">{v.creatorName} • {v.category}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Creator Memberships Directory with Profile ID Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-white">Creator Memberships</h2>
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search creator name, @username or ORI-100001..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {filteredCreators.map((c) => {
            const isFollowing = follows.includes(c.id);
            return (
              <div key={c.id} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center gap-3">
                  <img src={c.avatar} alt={c.name} className="w-14 h-14 rounded-2xl object-cover border border-purple-500/40" />
                  <div className="min-w-0">
                    <h3 className="font-bold text-white truncate">{c.name}</h3>
                    <div className="text-[11px] font-mono text-purple-300">
                      {c.profileId || c.username}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {followerCounts[c.id] ?? 0} Followers • {subscriberCounts[c.id] ?? 0} Members
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2">{c.bio}</p>
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs flex justify-between text-purple-200">
                  <span>Monthly: <strong>${c.monthlyPrice}</strong></span>
                  <span>Yearly: <strong>${c.yearlyPrice}</strong></span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onToggleFollow(c.id)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${
                      isFollowing
                        ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {isFollowing ? 'Following Free' : 'Follow Free'}
                  </button>
                  <button
                    onClick={() =>
                      setCheckoutTarget({
                        creatorId: c.id,
                        creatorName: c.name,
                        planScope: 'creator',
                        monthlyPrice: c.monthlyPrice,
                        yearlyPrice: c.yearlyPrice,
                        selectedPlan: 'monthly',
                      })
                    }
                    className="flex-1 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500"
                  >
                    Choose Plan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pre-Purchase Confirmation Modal */}
      {checkoutTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-lg p-6 md:p-7 rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple-400" />
                <span>Confirm Subscription: {checkoutTarget.creatorName}</span>
              </h3>
              <button onClick={() => setCheckoutTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setCheckoutTarget({ ...checkoutTarget, selectedPlan: 'monthly' })}
                className={`p-4 rounded-2xl border text-left ${
                  checkoutTarget.selectedPlan === 'monthly'
                    ? 'bg-purple-600/25 border-purple-500'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="text-xs font-bold text-white">Monthly Plan (30 Days)</div>
                <div className="text-base font-extrabold text-purple-300 mt-1">
                  ${checkoutTarget.monthlyPrice.toFixed(2)} USD
                </div>
              </button>
              <button
                onClick={() => setCheckoutTarget({ ...checkoutTarget, selectedPlan: 'yearly' })}
                className={`p-4 rounded-2xl border text-left ${
                  checkoutTarget.selectedPlan === 'yearly'
                    ? 'bg-purple-600/25 border-purple-500'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                <div className="text-xs font-bold text-white">Yearly Plan (365 Days)</div>
                <div className="text-base font-extrabold text-purple-300 mt-1">
                  ${checkoutTarget.yearlyPrice.toFixed(2)} USD
                </div>
              </button>
            </div>

            {/* Pre-purchase Disclosure Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2 text-slate-300">
              <div className="font-bold text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>Plan Summary & Renewal Conditions</span>
              </div>
              <div className="flex justify-between">
                <span>Duration:</span>
                <span className="text-white font-semibold">
                  {checkoutTarget.selectedPlan === 'yearly' ? '1 Year (365 days)' : '1 Month (30 days)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Renewal / Expiry Date:</span>
                <span className="text-white font-semibold">{previewExpiry}</span>
              </div>
              <div className="flex justify-between">
                <span>Refund Policy:</span>
                <span className="text-emerald-300 font-semibold">24-hour full guarantee</span>
              </div>
              <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                Unlocks Premium Videos, Premium Livestreams, and unlimited text messaging during active period (does not include unlimited video calling). Cancel anytime.
              </p>
            </div>

            {/* Payment Source Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Payment Method</span>
                <button
                  type="button"
                  onClick={() => {
                    setCheckoutTarget(null);
                    onNavigateTab('payment-methods');
                  }}
                  className="text-purple-400 font-bold hover:underline"
                >
                  + Add Card / Bank / Mobile Banking
                </button>
              </div>
              <select
                value={selectedPaymentSource}
                onChange={(e) => setSelectedPaymentSource(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="wallet">OrioLiveCall Wallet Balance (${walletBalance.toFixed(2)} USD)</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.provider} ({m.maskedNumber}) {m.isDefault ? '★ Default' : ''}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRenew}
                onChange={(e) => setAutoRenew(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-purple-600"
              />
              <span>Enable Auto-Renew on expiry date (toggle off anytime)</span>
            </label>

            {selectedPaymentSource === 'wallet' &&
              walletBalance <
                (checkoutTarget.selectedPlan === 'monthly'
                  ? checkoutTarget.monthlyPrice
                  : checkoutTarget.yearlyPrice) && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Insufficient wallet balance. Select a saved Payment Method or top up first.</span>
                </div>
              )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCheckoutTarget(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={purchasing}
                onClick={handleConfirmPurchase}
                className="flex-1 py-3 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 disabled:opacity-50"
              >
                {purchasing
                  ? 'Activating...'
                  : `Confirm & Pay $${(checkoutTarget.selectedPlan === 'monthly'
                      ? checkoutTarget.monthlyPrice
                      : checkoutTarget.yearlyPrice
                    ).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Receipt Modal */}
      {receiptModalSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span>OrioLiveCall Payment Receipt</span>
              </h3>
              <button onClick={() => setReceiptModalSub(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Receipt TX ID</span>
                <span className="font-mono font-bold text-purple-300">{receiptModalSub.txId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Plan</span>
                <span className="text-white font-bold">{receiptModalSub.creatorName} ({receiptModalSub.plan.toUpperCase()})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount Paid</span>
                <span className="text-emerald-400 font-bold">${receiptModalSub.price.toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Method</span>
                <span className="text-white">{receiptModalSub.paymentMethodLabel || 'Wallet Balance'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Started</span>
                <span className="text-slate-200">{new Date(receiptModalSub.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Renewal / Expiry</span>
                <span className="text-slate-200">{new Date(receiptModalSub.renewalDate || receiptModalSub.expiresAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className="uppercase font-bold text-emerald-300">{receiptModalSub.status}</span>
              </div>
            </div>
            <button
              onClick={() => setReceiptModalSub(null)}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
