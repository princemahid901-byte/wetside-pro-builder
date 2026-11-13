import React, { useState } from 'react';
import {
  Star,
  SkipForward,
  CheckCircle2,
  X,
  Flag,
  Signal,
  MessageSquareHeart
} from 'lucide-react';
import { CallFeedbackSession, Language } from '../types/orio';

interface PostCallRatingModalProps {
  lang: Language;
  session: CallFeedbackSession;
  submitting: boolean;
  isFullscreenStage?: boolean;
  onSubmit: (payload: {
    overallRating: number;
    callQualityRating: number;
    tags: string[];
    comment: string;
  }) => void;
  onSkip: () => void;
  onReportIssue?: () => void;
}

const EXPERIENCE_TAGS: Array<{ id: string; en: string; bn: string }> = [
  { id: 'crystal_video', en: 'Crystal Clear Video', bn: 'পরিষ্কার ভিডিও' },
  { id: 'clear_audio', en: 'Clear Audio', bn: 'স্পষ্ট অডিও' },
  { id: 'friendly_partner', en: 'Friendly Conversation', bn: 'চমৎকার কথোপকথন' },
  { id: 'stable_network', en: 'Stable Connection', bn: 'স্থিতিশীল নেটওয়ার্ক' },
  { id: 'video_lag', en: 'Video Lag / Freeze', bn: 'ভিডিও ল্যাগ' },
  { id: 'audio_echo', en: 'Audio Echo / Delay', bn: 'অডিও সমস্যা' },
];

const STAR_LABELS_EN = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
const STAR_LABELS_BN = ['', 'খুব খারাপ', 'মোটামুটি', 'ভালো', 'দারুণ', 'অসাধারণ'];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const PostCallRatingModal: React.FC<PostCallRatingModalProps> = ({
  lang,
  session,
  submitting,
  isFullscreenStage = false,
  onSubmit,
  onSkip,
  onReportIssue,
}) => {
  const [overallRating, setOverallRating] = useState<number>(5);
  const [overallHover, setOverallHover] = useState<number>(0);
  const [callQualityRating, setCallQualityRating] = useState<number>(5);
  const [qualityHover, setQualityHover] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState<string>('');

  const activeOverall = overallHover || overallRating;
  const activeQuality = qualityHover || callQualityRating;
  const isNextAction = session.actionTrigger === 'next_person';

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId].slice(0, 6)
    );
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      overallRating,
      callQualityRating,
      tags: selectedTags,
      comment: comment.trim(),
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-call-rating-title"
      className={`${isFullscreenStage ? 'absolute' : 'fixed'} inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto`}
    >
      <form
        onSubmit={handleFormSubmit}
        className="w-full max-w-md rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl shadow-purple-950/50 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-purple-400 text-xs font-bold uppercase tracking-wider">
              <MessageSquareHeart className="w-4 h-4" />
              <span>
                {lang === 'bn' ? 'কল পরবর্তী মতামত' : 'Post-Call Feedback'}
              </span>
            </div>
            <h2 id="post-call-rating-title" className="text-lg font-extrabold text-white tracking-tight">
              {lang === 'bn'
                ? 'আপনার ভিডিও কল অভিজ্ঞতা কেমন ছিল?'
                : 'How was your call quality & experience?'}
            </h2>
            <p className="text-[11px] text-slate-400">
              {session.partnerName} · {session.partnerCountry} · {formatDuration(session.durationSec)} ·{' '}
              <span className="text-purple-300 font-semibold">{session.videoQuality}</span>
              {session.rttMs !== null ? ` · ${session.rttMs}ms` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip feedback"
            className="p-1.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Overall Conversation Experience Stars */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200">
              {lang === 'bn' ? 'সামগ্রিক অভিজ্ঞতা' : 'Overall Experience'}
            </span>
            <span className="font-semibold text-amber-300">
              {lang === 'bn' ? STAR_LABELS_BN[activeOverall] : STAR_LABELS_EN[activeOverall]}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= activeOverall;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setOverallHover(star)}
                  onMouseLeave={() => setOverallHover(0)}
                  onClick={() => setOverallRating(star)}
                  aria-label={`Rate overall experience ${star} out of 5 stars`}
                  className={`flex-1 py-2.5 rounded-xl border flex items-center justify-center transition-all ${
                    filled
                      ? 'bg-amber-500/15 border-amber-400/60 text-amber-400 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <Star className={`w-5 h-5 ${filled ? 'fill-amber-400 text-amber-400' : ''}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Audio / Video Call Quality Rating */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-200 flex items-center gap-1.5">
              <Signal className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'bn' ? 'ভিডিও ও অডিও মান' : 'Audio & Video Call Quality'}</span>
            </span>
            <span className="font-semibold text-emerald-300">
              {activeQuality}/5 · {lang === 'bn' ? STAR_LABELS_BN[activeQuality] : STAR_LABELS_EN[activeQuality]}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= activeQuality;
              return (
                <button
                  key={star}
                  type="button"
                  onMouseEnter={() => setQualityHover(star)}
                  onMouseLeave={() => setQualityHover(0)}
                  onClick={() => setCallQualityRating(star)}
                  aria-label={`Rate call quality ${star} out of 5 stars`}
                  className={`flex-1 py-2 rounded-xl border flex items-center justify-center transition-all ${
                    filled
                      ? 'bg-emerald-500/15 border-emerald-400/60 text-emerald-400'
                      : 'bg-slate-900 border-slate-800 text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <Star className={`w-4 h-4 ${filled ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Quick Highlights / Issue Checkpoints */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-slate-400">
            {lang === 'bn' ? 'কী ভালো ছিল বা সমস্যা হয়েছে?' : 'Highlights or technical notes (optional)'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {EXPERIENCE_TAGS.map((tag) => {
              const selected = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-2 rounded-xl border text-[11px] font-semibold text-left transition-all ${
                    selected
                      ? 'bg-purple-600/25 border-purple-400 text-purple-100'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  {lang === 'bn' ? tag.bn : tag.en}
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Optional Written Feedback */}
        <div className="space-y-1">
          <textarea
            rows={2}
            maxLength={400}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              lang === 'bn'
                ? 'আরো কোনো মন্তব্য থাকলে লিখুন (ঐচ্ছিক)...'
                : 'Share brief feedback about video, audio, or connection...'
            }
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            {onReportIssue ? (
              <button
                type="button"
                onClick={onReportIssue}
                className="text-rose-400 hover:text-rose-300 inline-flex items-center gap-1 font-semibold"
              >
                <Flag className="w-3 h-3" />
                <span>{lang === 'bn' ? 'অনুপযুক্ত আচরণ রিপোর্ট করুন' : 'Report Partner Issue'}</span>
              </button>
            ) : (
              <span />
            )}
            <span>{comment.length}/400</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold text-xs shadow-lg shadow-purple-600/25 hover:opacity-95 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isNextAction ? <SkipForward className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>
              {submitting
                ? lang === 'bn'
                  ? 'জমা হচ্ছে...'
                  : 'Submitting...'
                : isNextAction
                  ? lang === 'bn'
                    ? 'জমা দিন ও পরবর্তী কল'
                    : 'Submit & Next Person'
                  : lang === 'bn'
                    ? 'মতামত জমা দিন'
                    : 'Submit Feedback'}
            </span>
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={onSkip}
            className="px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors whitespace-nowrap"
          >
            {isNextAction
              ? lang === 'bn'
                ? 'এড়িয়ে পরবর্তী'
                : 'Skip & Next'
              : lang === 'bn'
                ? 'বন্ধ করুন'
                : 'Dismiss'}
          </button>
        </div>
      </form>
    </div>
  );
};
