import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BellRing,
  Cookie,
  Check,
  X,
  Volume2,
  VolumeX,
  ShieldCheck,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import {
  cancelPendingNotificationChime,
  isNotificationSoundMuted,
  playCookieNotificationChime,
  setNotificationSoundMuted,
} from '../utils/soundEffects';

interface GoogleCookiesNotificationProps {
  open: boolean;
  age18Confirmed: boolean;
  guidelinesAgreed: boolean;
  onToggleAge18: (checked: boolean) => void;
  onToggleGuidelines: (checked: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
  onOpenGuidelines: () => void;
}

export const GoogleCookiesNotification: React.FC<GoogleCookiesNotificationProps> = ({
  open,
  age18Confirmed,
  guidelinesAgreed,
  onToggleAge18,
  onToggleGuidelines,
  onAccept,
  onDecline,
  onOpenGuidelines,
}) => {
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isNotificationSoundMuted());
  const [ringKey, setRingKey] = useState<number>(0);

  useEffect(() => {
    if (!open) {
      cancelPendingNotificationChime();
      return;
    }
    setRingKey((k) => k + 1);
    playCookieNotificationChime({ deferIfBlocked: true });
    return () => {
      cancelPendingNotificationChime();
    };
  }, [open]);

  const handleToggleMute = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    setNotificationSoundMuted(next);
    if (!next) {
      setRingKey((k) => k + 1);
      playCookieNotificationChime({ deferIfBlocked: false });
    }
  };

  const handleReplaySound = () => {
    setRingKey((k) => k + 1);
    playCookieNotificationChime({ deferIfBlocked: false });
  };

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.aside
          key="google-cookies-auth-notification"
          role="dialog"
          aria-live="polite"
          aria-label="Google Cookies and Auth Notification"
          initial={{ opacity: 0, x: 48, y: -24, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          exit={{ opacity: 0, x: 48, y: -16, scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 360, damping: 26, mass: 0.85 }}
          className="fixed top-20 right-4 sm:right-6 z-[60] w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-purple-500/50 shadow-2xl shadow-purple-950/60 overflow-hidden"
        >
          {/* Animated Top Notification Accent Sweep */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="h-1 w-full origin-left bg-gradient-to-r from-emerald-400 via-purple-500 to-pink-500"
          />

          <div className="p-4 space-y-3">
            {/* Header Row */}
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <motion.div
                  key={`bell-${ringKey}`}
                  initial={{ rotate: 0, scale: 0.85 }}
                  animate={{
                    rotate: [0, -18, 18, -14, 14, -7, 7, 0],
                    scale: [0.85, 1.12, 1.05, 1],
                  }}
                  transition={{ duration: 0.75, ease: 'easeInOut', delay: 0.1 }}
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600/35 to-emerald-600/25 border border-purple-400/50 flex items-center justify-center shrink-0 shadow-inner"
                >
                  <BellRing className="w-4 h-4 text-purple-200" />
                </motion.div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                    <Cookie className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                    <span className="truncate">Google Cookies &amp; Auth</span>
                  </div>
                  <p className="text-[10px] font-semibold text-purple-300">
                    18+ Confirmation &amp; Website Guidelines Notice
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleReplaySound}
                  title="Play notification sound"
                  className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-purple-300 hover:text-white transition-colors"
                  aria-label="Replay notification sound"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleToggleMute}
                  title={soundMuted ? 'Unmute notification sound' : 'Mute notification sound'}
                  className={`p-1.5 rounded-lg transition-colors ${
                    soundMuted
                      ? 'bg-rose-950/60 text-rose-300 hover:bg-rose-900/70'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                  aria-label={soundMuted ? 'Unmute notification sound' : 'Mute notification sound'}
                >
                  {soundMuted ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </motion.button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={onDecline}
                  title="Dismiss notification (Decline)"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  aria-label="Close and decline"
                >
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>

            {/* Consent Question */}
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.25 }}
              className="text-[11px] text-slate-300 leading-relaxed"
            >
              Please confirm that you are <strong className="text-white">18+ years old</strong> and agree with our{' '}
              <strong className="text-white">Website Guidelines</strong> &amp; Google Authentication cookies.
            </motion.p>

            {/* Interactive Confirmation Checkboxes */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.28 }}
              className="space-y-2 rounded-xl bg-slate-950/90 border border-slate-800 p-2.5 text-[11px]"
            >
              <label className="flex items-start gap-2 cursor-pointer select-none text-slate-200 hover:text-white">
                <input
                  type="checkbox"
                  checked={age18Confirmed}
                  onChange={(e) => onToggleAge18(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-purple-500"
                />
                <span>I confirm that I am 18+ years old.</span>
              </label>

              <label className="flex items-start gap-2 cursor-pointer select-none text-slate-200 hover:text-white">
                <input
                  type="checkbox"
                  checked={guidelinesAgreed}
                  onChange={(e) => onToggleGuidelines(e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-purple-500"
                />
                <span>I agree to the OrioLiveCall Website Guidelines &amp; Google Cookies.</span>
              </label>
            </motion.div>

            {/* Policy & Guidelines Links */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.18, duration: 0.25 }}
              className="flex items-center justify-between text-[10px] text-slate-400 px-0.5"
            >
              <button
                type="button"
                onClick={onOpenGuidelines}
                className="inline-flex items-center gap-1 font-semibold text-purple-300 hover:text-white transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                <span>Read Guidelines</span>
              </button>
              <a
                href="/privacy-policy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-300 hover:text-white transition-colors"
              >
                <span>Privacy Policy</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>

            {/* Accept & Decline Action Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.25 }}
              className="grid grid-cols-2 gap-2.5 pt-0.5"
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={onAccept}
                className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg whitespace-nowrap transition-opacity"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Accept</span>
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={onDecline}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Decline</span>
              </motion.button>
            </motion.div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
