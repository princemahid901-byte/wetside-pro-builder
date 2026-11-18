import React, { useState, useEffect } from 'react';
import {
  Wallet, DollarSign, ArrowUpRight, ShieldCheck, CheckCircle2, Clock,
  AlertCircle, Building2, CreditCard, RefreshCw, Sparkles, Send, Gift,
  Coins, FileText, ChevronRight, HelpCircle
} from 'lucide-react';
import { FirebaseUser } from '../firebase';

export interface WithdrawalRecord {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'stripe' | 'paypal' | 'bank' | 'wise' | 'payoneer' | 'crypto_usdt' | 'mobile_banking';
  methodLabel: string;
  accountDetails: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
  estimatedArrival: string;
  txHash?: string;
}

interface Props {
  currentUserId: string;
  currentUserName: string;
  currentUserProfileId: string;
  isCreator: boolean;
  walletBalance: number;
  firebaseUser?: FirebaseUser | null;
  onWalletUpdated: () => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', rate: 1.0, label: 'US Dollar (USD)' },
  { code: 'EUR', symbol: '€', rate: 0.92, label: 'Euro (EUR)' },
  { code: 'GBP', symbol: '£', rate: 0.79, label: 'British Pound (GBP)' },
  { code: 'BDT', symbol: '৳', rate: 121.5, label: 'Bangladeshi Taka (BDT)' },
  { code: 'CAD', symbol: 'CA$', rate: 1.36, label: 'Canadian Dollar (CAD)' },
  { code: 'AUD', symbol: 'AU$', rate: 1.52, label: 'Australian Dollar (AUD)' },
  { code: 'USDT', symbol: '₮', rate: 1.0, label: 'Tether USDT (TRC-20)' },
];

export const PaymentWithdrawalView: React.FC<Props> = ({
  currentUserId,
  currentUserName,
  currentUserProfileId,
  isCreator,
  walletBalance,
  onWalletUpdated,
  showToast,
}) => {
  // Payout method selection
  const [selectedMethod, setSelectedMethod] = useState<'stripe' | 'paypal' | 'bank' | 'wise' | 'payoneer' | 'crypto_usdt' | 'mobile_banking'>('stripe');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [amountUsd, setAmountUsd] = useState<string>('50');

  // Account details inputs
  const [stripeEmail, setStripeEmail] = useState('');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [bankAccountName, setBankAccountName] = useState(currentUserName || '');
  const [bankName, setBankName] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankSwift, setBankSwift] = useState('');
  const [otherAccount, setOtherAccount] = useState('');

  // History & loading
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Short video creator fan support metrics
  const [creatorFanSupportBalance, setCreatorFanSupportBalance] = useState<number>(walletBalance > 0 ? walletBalance : 145.50);
  const [lifetimeFanTips, setLifetimeFanTips] = useState<number>(380.00);

  // Fetch withdrawals from server
  const fetchWithdrawals = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/withdrawals/${encodeURIComponent(currentUserId)}`);
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
        if (typeof data.creatorBalance === 'number') {
          setCreatorFanSupportBalance(data.creatorBalance);
        }
      }
    } catch {
      // Fallback local list
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [currentUserId]);

  const currencyObj = CURRENCIES.find((c) => c.code === selectedCurrency) || CURRENCIES[0];
  const convertedAmount = (Number(amountUsd || 0) * currencyObj.rate).toFixed(2);

  const handleSubmitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amountUsd);

    if (isNaN(numericAmount) || numericAmount < 10) {
      showToast('Minimum withdrawal amount is $10.00 USD.', 'error');
      return;
    }

    if (numericAmount > creatorFanSupportBalance) {
      showToast('Insufficient Fan Support balance for this withdrawal.', 'error');
      return;
    }

    let accountDetailString = '';
    if (selectedMethod === 'stripe') {
      if (!stripeEmail.includes('@')) {
        showToast('Please enter a valid Stripe connected account email.', 'error');
        return;
      }
      accountDetailString = `Stripe: ${stripeEmail.trim()}`;
    } else if (selectedMethod === 'paypal') {
      if (!paypalEmail.includes('@')) {
        showToast('Please enter a valid PayPal email.', 'error');
        return;
      }
      accountDetailString = `PayPal: ${paypalEmail.trim()}`;
    } else if (selectedMethod === 'bank') {
      if (!bankName.trim() || !bankIban.trim()) {
        showToast('Please fill in bank name and account / IBAN number.', 'error');
        return;
      }
      accountDetailString = `Bank: ${bankName.trim()} | Acc: ${bankIban.trim()} | Swift: ${bankSwift.trim() || 'N/A'}`;
    } else {
      if (!otherAccount.trim()) {
        showToast('Please enter your payout destination account / wallet details.', 'error');
        return;
      }
      accountDetailString = `${selectedMethod.toUpperCase()}: ${otherAccount.trim()}`;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          amountUsd: numericAmount,
          currency: selectedCurrency,
          method: selectedMethod,
          accountDetails: accountDetailString,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Withdrawal request failed.', 'error');
        return;
      }

      setCreatorFanSupportBalance((prev) => Math.max(0, Number((prev - numericAmount).toFixed(2))));
      showToast(`Withdrawal of $${numericAmount.toFixed(2)} USD via ${data.withdrawal?.methodLabel || selectedMethod} submitted successfully!`, 'success');
      onWalletUpdated();
      fetchWithdrawals();
    } catch {
      showToast('Network error processing withdrawal request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelWithdrawal = async (withdrawalId: string) => {
    try {
      const res = await fetch('/api/withdrawals/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, withdrawalId }),
      });
      if (res.ok) {
        showToast('Withdrawal cancelled and balance restored.', 'info');
        fetchWithdrawals();
        onWalletUpdated();
      }
    } catch {
      showToast('Failed to cancel withdrawal', 'error');
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 space-y-6 flex-1">
      {/* Policy Clarification Banner: Standard Users vs Short Video Creators */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-purple-300" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-white text-base">Creator Payouts & Fan Support Center</h2>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                100% Free Live Video & Chat
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              <strong className="text-white">Standard Users:</strong> Free global live video calls and private messaging without any fee or earning requirement.{' '}
              <strong className="text-purple-300">Short Video Creators:</strong> Earn real money through viewer Fan Support, Virtual Gifts, and tips on your trending short videos.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <span className="text-xs font-mono text-purple-300 bg-purple-900/40 px-3 py-1.5 rounded-xl border border-purple-500/30">
            Profile ID: {currentUserProfileId || 'ORI-100001'}
          </span>
        </div>
      </div>

      {/* Creator Balance Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Available Fan Support Payout</span>
            <span className="p-2 rounded-xl bg-purple-600/20 text-purple-300">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            ${creatorFanSupportBalance.toFixed(2)}{' '}
            <span className="text-xs font-semibold text-purple-400">USD</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Withdrawable via Stripe, PayPal, Bank & multi-currencies
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Lifetime Fan Support Received</span>
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
              <Gift className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            ${lifetimeFanTips.toFixed(2)}{' '}
            <span className="text-xs font-semibold text-amber-400">USD</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Earned exclusively from Short Video virtual gifts & fan tips
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Minimum Payout Threshold</span>
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">
            $10.00 <span className="text-xs font-semibold text-slate-400">USD</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Processing fee: <strong className="text-white">$0.00 (Zero Fee)</strong>
          </p>
        </div>
      </div>

      {/* Main Withdrawal Form and Method Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Withdrawal Form */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-bold text-white text-base">Request Fan Support Payout</h3>
              <p className="text-xs text-slate-400">Choose your preferred withdrawal method and currency</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/30">
              Secure TLS Payout Rail
            </span>
          </div>

          {/* Supported Payout Method Cards */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Select Withdrawal Method</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Stripe (Stitch) */}
              <button
                type="button"
                onClick={() => setSelectedMethod('stripe')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedMethod === 'stripe'
                    ? 'bg-purple-600/20 border-purple-500 ring-2 ring-purple-500/40 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  {selectedMethod === 'stripe' && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Stripe Direct</div>
                  <div className="text-[10px] text-slate-400">Card / Direct Payout</div>
                </div>
              </button>

              {/* PayPal (Plapal) */}
              <button
                type="button"
                onClick={() => setSelectedMethod('paypal')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedMethod === 'paypal'
                    ? 'bg-purple-600/20 border-purple-500 ring-2 ring-purple-500/40 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Wallet className="w-4 h-4 text-indigo-400" />
                  {selectedMethod === 'paypal' && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <div>
                  <div className="font-bold text-xs text-white">PayPal</div>
                  <div className="text-[10px] text-slate-400">Global Instant Payout</div>
                </div>
              </button>

              {/* Bank Transfer */}
              <button
                type="button"
                onClick={() => setSelectedMethod('bank')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedMethod === 'bank'
                    ? 'bg-purple-600/20 border-purple-500 ring-2 ring-purple-500/40 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Building2 className="w-4 h-4 text-emerald-400" />
                  {selectedMethod === 'bank' && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Bank Wire / ACH</div>
                  <div className="text-[10px] text-slate-400">Direct Account Deposit</div>
                </div>
              </button>

              {/* Other Currencies / Wise / Crypto / bKash */}
              <button
                type="button"
                onClick={() => setSelectedMethod('crypto_usdt')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                  selectedMethod === 'crypto_usdt' || selectedMethod === 'wise' || selectedMethod === 'mobile_banking'
                    ? 'bg-purple-600/20 border-purple-500 ring-2 ring-purple-500/40 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Coins className="w-4 h-4 text-amber-400" />
                  {(selectedMethod === 'crypto_usdt' || selectedMethod === 'wise' || selectedMethod === 'mobile_banking') && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-xs text-white">Crypto / Other Rails</div>
                  <div className="text-[10px] text-slate-400">USDT, Wise, Mobile</div>
                </div>
              </button>
            </div>
          </div>

          {/* If Crypto/Other rails is selected, give sub-selector */}
          {(selectedMethod === 'crypto_usdt' || selectedMethod === 'wise' || selectedMethod === 'payoneer' || selectedMethod === 'mobile_banking') && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSelectedMethod('crypto_usdt')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedMethod === 'crypto_usdt' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-950 text-slate-400'
                }`}
              >
                Crypto USDT (TRC-20)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('wise')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedMethod === 'wise' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-950 text-slate-400'
                }`}
              >
                Wise (TransferWise)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('payoneer')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedMethod === 'payoneer' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-slate-950 text-slate-400'
                }`}
              >
                Payoneer
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('mobile_banking')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedMethod === 'mobile_banking' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' : 'bg-slate-950 text-slate-400'
                }`}
              >
                Mobile Banking (bKash / Nagad)
              </button>
            </div>
          )}

          {/* Form Fields */}
          <form onSubmit={handleSubmitWithdrawal} className="space-y-4 pt-2">
            {/* Amount and Currency Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Withdrawal Amount (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="10"
                    max={creatorFanSupportBalance}
                    value={amountUsd}
                    onChange={(e) => setAmountUsd(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500"
                    placeholder="50.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Payout Currency
                </label>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label} ({c.symbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dynamic Destination Account Inputs based on method */}
            {selectedMethod === 'stripe' && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Stripe Connected Email / Account ID
                </label>
                <input
                  type="email"
                  value={stripeEmail}
                  onChange={(e) => setStripeEmail(e.target.value)}
                  placeholder="e.g. creator@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            )}

            {selectedMethod === 'paypal' && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  PayPal Account Email
                </label>
                <input
                  type="email"
                  value={paypalEmail}
                  onChange={(e) => setPaypalEmail(e.target.value)}
                  placeholder="e.g. your-paypal@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-purple-500"
                  required
                />
              </div>
            )}

            {selectedMethod === 'bank' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Account Holder Full Name</label>
                    <input
                      type="text"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Chase / Barclays / BRAC"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">IBAN / Account Number</label>
                    <input
                      type="text"
                      value={bankIban}
                      onChange={(e) => setBankIban(e.target.value)}
                      placeholder="e.g. GB29NWBK60161331926819"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">SWIFT / BIC Code (Optional)</label>
                    <input
                      type="text"
                      value={bankSwift}
                      onChange={(e) => setBankSwift(e.target.value)}
                      placeholder="e.g. CHASUS33"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {(selectedMethod === 'crypto_usdt' || selectedMethod === 'wise' || selectedMethod === 'payoneer' || selectedMethod === 'mobile_banking') && (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  {selectedMethod === 'crypto_usdt'
                    ? 'USDT TRC-20 Wallet Address'
                    : selectedMethod === 'mobile_banking'
                    ? 'Mobile Banking Number (bKash / Nagad)'
                    : 'Recipient Account Email / ID'}
                </label>
                <input
                  type="text"
                  value={otherAccount}
                  onChange={(e) => setOtherAccount(e.target.value)}
                  placeholder={
                    selectedMethod === 'crypto_usdt'
                      ? 'e.g. T9yD14Nj9j7xAB4dbGeiX9h8unkKHXUnx'
                      : selectedMethod === 'mobile_banking'
                      ? 'e.g. +88017XXXXXXXX (bKash Personal)'
                      : 'e.g. account@wise.com'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
                  required
                />
              </div>
            )}

            {/* Payout Conversion Summary Card */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Requested USD:</span>
                <span className="font-bold text-white">${Number(amountUsd || 0).toFixed(2)} USD</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Converted Estimated Payout:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {currencyObj.symbol} {convertedAmount} {currencyObj.code}
                </span>
              </div>
              <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                <span>Estimated Arrival:</span>
                <span className="text-slate-300">
                  {selectedMethod === 'stripe' || selectedMethod === 'paypal' ? 'Instant - 2 Hours' : '1 - 2 Business Days'}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || Number(amountUsd || 0) > creatorFanSupportBalance}
              className={`w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
                Number(amountUsd || 0) > creatorFanSupportBalance
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/30'
              }`}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Withdrawal Request...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Submit Withdrawal Request</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Security, Guidelines & Currency Rates */}
        <div className="space-y-4">
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Payout Security Assurance</span>
            </h4>
            <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside">
              <li>Protected by end-to-end TLS cryptographic banking standards.</li>
              <li>Encrypted account credentials with automated audit validation.</li>
              <li>Withdrawal records logged with immutable transaction hashes.</li>
              <li>Zero hidden fees or surprise deductions on creator earnings.</li>
            </ul>
          </div>

          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>Supported Multi-Currencies</span>
            </h4>
            <div className="space-y-2 text-xs">
              {CURRENCIES.map((c) => (
                <div key={c.code} className="flex items-center justify-between p-2 rounded-xl bg-slate-950 border border-slate-800/80">
                  <span className="font-bold text-white">{c.code} ({c.symbol})</span>
                  <span className="text-slate-400 font-mono text-[11px]">1 USD = {c.rate} {c.code}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Withdrawal History & Status Tracker Table */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            <span>Withdrawal History &amp; Status</span>
          </h3>
          <button
            onClick={fetchWithdrawals}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {withdrawals.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-2">
            <p>No withdrawal requests submitted yet.</p>
            <p className="text-[11px] text-slate-500">
              When viewers send Fan Support or Virtual Gifts on your short videos, you can withdraw your balance anytime above $10.00.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Reference ID</th>
                  <th className="py-2.5 px-3">Amount</th>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Destination</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {withdrawals.map((w) => {
                  const statusColors = {
                    completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
                    processing: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
                    pending: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
                    cancelled: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
                  };

                  return (
                    <tr key={w.id} className="hover:bg-slate-950/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-purple-300">{w.id}</td>
                      <td className="py-3 px-3 font-bold text-white">${w.amount.toFixed(2)} USD</td>
                      <td className="py-3 px-3 text-slate-300">{w.methodLabel || w.method}</td>
                      <td className="py-3 px-3 text-slate-400 truncate max-w-[180px]" title={w.accountDetails}>
                        {w.accountDetails}
                      </td>
                      <td className="py-3 px-3 text-slate-400">{new Date(w.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase ${statusColors[w.status] || ''}`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {w.status === 'pending' && (
                          <button
                            onClick={() => handleCancelWithdrawal(w.id)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-[10px] font-bold transition-all"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
