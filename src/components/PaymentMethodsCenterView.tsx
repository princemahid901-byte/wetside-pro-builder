import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Building2,
  Smartphone,
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  Star,
  ArrowUpRight,
  Crown,
  Receipt,
  Lock,
} from 'lucide-react';
import { PaymentMethodRecord, PaymentMethodType } from '../types/orio';
import {
  FirebaseUser,
  savePaymentMethodToFirestore,
  deletePaymentMethodFromFirestore,
} from '../firebase';

interface PaymentMethodsCenterViewProps {
  currentUserId: string;
  walletBalance: number;
  firebaseUser?: FirebaseUser | null;
  onWalletUpdated: () => void;
  onNavigateTab: (tab: string) => void;
  showToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

const PROVIDER_PRESETS: Record<PaymentMethodType, string[]> = {
  bank_transfer: ['Dutch-Bangla Bank', 'BRAC Bank', 'Islami Bank Bangladesh', 'Chase / Wire Transfer', 'HSBC Global'],
  debit_card: ['Visa Debit', 'Mastercard Debit', 'UnionPay Debit'],
  credit_card: ['Visa Credit', 'Mastercard Credit', 'American Express'],
  mobile_banking: ['bKash', 'Nagad', 'Rocket', 'Upay'],
};

export const PaymentMethodsCenterView: React.FC<PaymentMethodsCenterViewProps> = ({
  currentUserId,
  walletBalance,
  firebaseUser,
  onWalletUpdated,
  onNavigateTab,
  showToast,
}) => {
  const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodType, setMethodType] = useState<PaymentMethodType>('mobile_banking');
  const [provider, setProvider] = useState('bKash');
  const [holderName, setHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [label, setLabel] = useState('');
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Top-up wallet state
  const [topupAmount, setTopupAmount] = useState('50');
  const [selectedTopupMethodId, setSelectedTopupMethodId] = useState('');
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    txId: string;
    amount: number;
    provider: string;
    timestamp: string;
  } | null>(null);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/payment-methods/${encodeURIComponent(currentUserId)}`);
      if (res.ok) {
        const data: PaymentMethodRecord[] = await res.json();
        setMethods(data);
        const def = data.find((m) => m.isDefault) || data[0];
        if (def) setSelectedTopupMethodId(def.id);
      }
    } catch {
      // handled gracefully
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const handleSelectMethodType = (nextType: PaymentMethodType) => {
    setMethodType(nextType);
    setProvider(PROVIDER_PRESETS[nextType][0]);
    setAccountNumber('');
    setExpiry('');
  };

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber.trim() || !holderName.trim()) {
      showToast('Please enter account holder name and account/card identifier.', 'error');
      return;
    }
    if ((methodType === 'debit_card' || methodType === 'credit_card') && accountNumber.replace(/\D/g, '').length < 8) {
      showToast('Please enter a valid card number.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/payment-methods/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          methodType,
          provider,
          label: label.trim() || `${provider} (${methodType.replace('_', ' ')})`,
          accountNumber: accountNumber.trim(),
          holderName: holderName.trim(),
          expiry: expiry.trim() || undefined,
          setDefault: setAsDefault,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not add payment method', 'error');
        return;
      }

      setMethods(data.methods || []);
      if (data.method?.id) {
        setSelectedTopupMethodId(data.method.id);
        if (firebaseUser) {
          savePaymentMethodToFirestore(firebaseUser, data.method).catch(() => {});
        }
      }
      setAccountNumber('');
      setHolderName('');
      setExpiry('');
      setLabel('');
      showToast(`Verified payment method added: ${data.method.provider} (${data.method.maskedNumber})`, 'success');
    } catch {
      showToast('Failed to save payment method', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      const res = await fetch('/api/payment-methods/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, methodId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMethods(data.methods || []);
        setSelectedTopupMethodId(methodId);
        showToast('Default payment method updated.', 'success');
      }
    } catch {}
  };

  const handleDeleteMethod = async (methodId: string) => {
    try {
      const res = await fetch(`/api/payment-methods/${encodeURIComponent(currentUserId)}/${encodeURIComponent(methodId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setMethods(data.methods || []);
        if (firebaseUser) {
          deletePaymentMethodFromFirestore(firebaseUser, methodId).catch(() => {});
        }
        showToast('Payment method removed.', 'info');
      }
    } catch {}
  };

  const handleWalletTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(topupAmount);
    if (!numeric || numeric <= 0) {
      showToast('Enter a valid deposit amount.', 'error');
      return;
    }
    if (methods.length === 0) {
      showToast('Add a payment method first before topping up.', 'error');
      return;
    }

    setTopupSubmitting(true);
    try {
      const res = await fetch('/api/payment-methods/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          methodId: selectedTopupMethodId || methods[0]?.id,
          amount: numeric,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Top-up failed', 'error');
        return;
      }
      const usedMethod = methods.find((m) => m.id === (selectedTopupMethodId || methods[0]?.id));
      setLastReceipt({
        txId: data.txId,
        amount: numeric,
        provider: usedMethod ? `${usedMethod.provider} (${usedMethod.maskedNumber})` : 'Verified Method',
        timestamp: new Date().toISOString(),
      });
      onWalletUpdated();
      showToast(`Wallet topped up +$${numeric.toFixed(2)}! TX: ${data.txId}`, 'success');
    } catch {
      showToast('Top-up request failed', 'error');
    } finally {
      setTopupSubmitting(false);
    }
  };

  const getTypeIcon = (t: PaymentMethodType) => {
    if (t === 'bank_transfer') return Building2;
    if (t === 'mobile_banking') return Smartphone;
    return CreditCard;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-8 w-full flex-1">
      {/* Header Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#150c28] to-slate-900 border border-purple-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Masked Storage • Bank, Card & Mobile Banking</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Payment Methods Center
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Securely manage Bank Transfers, Debit Cards, Credit Cards, and Mobile Banking (bKash, Nagad, Rocket). Card CVVs and raw full numbers are never stored in the database.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="px-5 py-3 rounded-2xl bg-slate-950/90 border border-slate-800 text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Wallet Balance</div>
            <div className="text-xl font-black text-emerald-400">${walletBalance.toFixed(2)} USD</div>
          </div>
          <button
            onClick={() => onNavigateTab('subscriptions')}
            className="px-4 py-3 rounded-2xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-500 transition-colors flex items-center justify-center gap-2"
          >
            <Crown className="w-4 h-4" />
            <span>Subscription Center</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Add Payment Method Form */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-purple-400" />
              <span>Add Supported Payment Method</span>
            </h2>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Encrypted Masking
            </span>
          </div>

          {/* 4 Supported Payment Category Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'mobile_banking', label: 'Mobile Banking', icon: Smartphone },
              { id: 'debit_card', label: 'Debit Card', icon: CreditCard },
              { id: 'credit_card', label: 'Credit Card', icon: CreditCard },
              { id: 'bank_transfer', label: 'Bank Transfer', icon: Building2 },
            ].map((item) => {
              const IconComp = item.icon;
              const active = methodType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectMethodType(item.id as PaymentMethodType)}
                  className={`p-3 rounded-2xl border text-left transition-all space-y-1.5 ${
                    active
                      ? 'bg-purple-600/25 border-purple-500 text-white shadow-lg shadow-purple-900/30'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <IconComp className={`w-4 h-4 ${active ? 'text-purple-300' : 'text-slate-500'}`} />
                  <div className="text-xs font-bold leading-tight">{item.label}</div>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleAddMethod} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                >
                  {PROVIDER_PRESETS[methodType].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Account / Cardholder Name</label>
                <input
                  type="text"
                  required
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  placeholder="Full legal name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {methodType === 'mobile_banking'
                    ? 'Mobile Wallet Number'
                    : methodType === 'bank_transfer'
                    ? 'Bank Account / IBAN Number'
                    : 'Card Number (Stored Masked Only)'}
                </label>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder={
                    methodType === 'mobile_banking'
                      ? 'e.g. 01712345678'
                      : methodType === 'bank_transfer'
                      ? 'e.g. AC-1092384756'
                      : '•••• •••• •••• 4242'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              {(methodType === 'debit_card' || methodType === 'credit_card') ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Expiry Date (MM/YY)</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    placeholder="08/29"
                    maxLength={7}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Custom Nickname (Optional)</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Primary Personal Account"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-purple-600 focus:ring-purple-500"
              />
              <span>Set as default payment method for Subscriptions & Wallet Top-ups</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold shadow-lg hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? 'Verifying & Saving...' : 'Verify & Save Payment Method'}
            </button>
          </form>
        </div>

        {/* Instant Wallet Top-Up & Saved Methods */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleWalletTopup} className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
              <span>Wallet Top-Up</span>
            </h2>
            <p className="text-xs text-slate-400">
              Add funds securely using your verified payment method to purchase memberships, gifts, or live passes.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Select Verified Payment Method</label>
              <select
                value={selectedTopupMethodId}
                onChange={(e) => setSelectedTopupMethodId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                {methods.length === 0 && <option value="">No payment method added yet</option>}
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.provider} ({m.maskedNumber}) {m.isDefault ? '★ Default' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300">Deposit Amount (USD)</label>
              <div className="flex gap-2">
                {['25', '50', '100', '250'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTopupAmount(preset)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border ${
                      topupAmount === preset
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="10000"
                step="0.01"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              />
            </div>
            <button
              type="submit"
              disabled={topupSubmitting || methods.length === 0}
              className="w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 disabled:opacity-40"
            >
              {topupSubmitting ? 'Processing Top-Up...' : `Deposit $${Number(topupAmount || 0).toFixed(2)} USD`}
            </button>

            {lastReceipt && (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs space-y-1">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4" />
                  <span>Deposit Receipt Confirmed</span>
                </div>
                <div className="text-slate-200 font-mono">{lastReceipt.txId}</div>
                <div className="text-slate-400">
                  +${lastReceipt.amount.toFixed(2)} USD via {lastReceipt.provider}
                </div>
              </div>
            )}
          </form>

          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-2 text-xs text-slate-300">
            <div className="font-bold text-white">Need help with a payment or dispute?</div>
            <p className="text-slate-400">
              Review all receipts or file a transaction dispute in Transaction History, or ask Orio AI Help Center in English or বাংলা.
            </p>
            <button
              onClick={() => onNavigateTab('history')}
              className="text-purple-400 font-bold hover:underline"
            >
              Open Transaction History →
            </button>
          </div>
        </div>
      </div>

      {/* Saved Payment Methods List */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Saved Payment Methods ({methods.length})</h2>
          <span className="text-xs text-slate-400">Protected by server-side masking</span>
        </div>

        {loading ? (
          <p className="text-xs text-slate-400">Loading saved payment methods...</p>
        ) : methods.length === 0 ? (
          <p className="text-xs text-slate-400">No saved payment methods yet. Add a Bank Transfer, Card, or Mobile Banking method above.</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {methods.map((m) => {
              const IconComp = getTypeIcon(m.methodType);
              return (
                <div
                  key={m.id}
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                    m.isDefault
                      ? 'bg-purple-950/25 border-purple-500/50'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      <IconComp className="w-5 h-5 text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white flex items-center gap-2 truncate">
                        <span>{m.provider}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Verified
                        </span>
                        {m.isDefault && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-mono text-purple-200 mt-0.5">{m.maskedNumber}</div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {m.holderName} {m.expiry ? `• Exp ${m.expiry}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!m.isDefault && (
                      <button
                        onClick={() => handleSetDefault(m.id)}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-300"
                        title="Set as Default"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteMethod(m.id)}
                      className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400"
                      title="Remove Payment Method"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
