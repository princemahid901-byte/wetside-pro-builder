import React, { useState, useEffect } from 'react';
import {
  LayoutTemplate,
  Megaphone,
  Images,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Save,
  CheckCircle2
} from 'lucide-react';
import {
  PromotionsConfig,
  PromotionTargetTab,
  HomepagePreviewConfig,
  PromoBannerConfig,
  AdCarouselSlide
} from '../types/orio';

interface AdminPromoManagerProps {
  promotions: PromotionsConfig;
  onPromotionsUpdated: (next: PromotionsConfig) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const TARGET_TAB_OPTIONS: Array<{ value: PromotionTargetTab; label: string }> = [
  { value: 'chat', label: 'Random Video Chat' },
  { value: 'videos', label: 'Videos & Search' },
  { value: 'live', label: 'Free & Premium Live' },
  { value: 'creators', label: 'Discover Creators' },
  { value: 'subscriptions', label: 'Subscription Center' },
  { value: 'payment-methods', label: 'Payment Methods Center' },
  { value: 'shorts', label: 'Hot Shorts' },
  { value: 'gifts', label: 'Gift Shop' },
];

const MEDIA_PRESETS = [
  {
    label: 'OrioLiveCall 16:9 Preview Video (MP4)',
    url: '/assets/aistudio/Global_video_call_platform_features_4219cb14_b0135f23.mp4',
  },
  {
    label: 'Creators Spotlight 16:9 Frame (JPG)',
    url: '/assets/aistudio/preview_creators_16x9.jpg',
  },
  {
    label: 'Live Calling Stage 16:9 Frame (JPG)',
    url: '/assets/aistudio/preview_livecall_16x9.jpg',
  },
  {
    label: 'OrioLiveCall Brand 16:9 Frame (JPG)',
    url: '/assets/aistudio/preview_brand_16x9.jpg',
  },
];

export const AdminPromoManager: React.FC<AdminPromoManagerProps> = ({
  promotions,
  onPromotionsUpdated,
  showToast,
}) => {
  const [previewDraft, setPreviewDraft] = useState<HomepagePreviewConfig>(promotions.preview);
  const [bannerDraft, setBannerDraft] = useState<PromoBannerConfig>(promotions.banner);
  const [savingPreview, setSavingPreview] = useState(false);
  const [savingBanner, setSavingBanner] = useState(false);

  const [newSlide, setNewSlide] = useState({
    title: '',
    subtitle: '',
    sponsor: 'Featured Partner',
    category: 'Campaign',
    imageUrl: '/assets/aistudio/preview_creators_16x9.jpg',
    ctaLabel: 'Explore Now',
    ctaTab: 'creators' as PromotionTargetTab,
  });
  const [savingSlide, setSavingSlide] = useState(false);

  useEffect(() => {
    setPreviewDraft(promotions.preview);
    setBannerDraft(promotions.banner);
  }, [promotions]);

  const handleSavePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPreview(true);
    try {
      const res = await fetch('/api/promotions/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not update preview settings', 'error');
        return;
      }
      onPromotionsUpdated(data.promotions);
      showToast('Homepage 16:9 Website Preview updated!', 'success');
    } catch {
      showToast('Network error updating website preview.', 'error');
    } finally {
      setSavingPreview(false);
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBanner(true);
    try {
      const res = await fetch('/api/promotions/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bannerDraft),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Could not update advertisement banner', 'error');
        return;
      }
      onPromotionsUpdated(data.promotions);
      showToast('Homepage Advertisement Banner updated!', 'success');
    } catch {
      showToast('Network error updating advertisement banner.', 'error');
    } finally {
      setSavingBanner(false);
    }
  };

  const handleAddCarouselSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlide.title.trim()) {
      showToast('Please enter a slide title.', 'error');
      return;
    }
    setSavingSlide(true);
    try {
      const res = await fetch('/api/promotions/carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', slide: newSlide }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to add carousel ad', 'error');
        return;
      }
      onPromotionsUpdated(data.promotions);
      setNewSlide({
        title: '',
        subtitle: '',
        sponsor: 'Featured Partner',
        category: 'Campaign',
        imageUrl: '/assets/aistudio/preview_creators_16x9.jpg',
        ctaLabel: 'Explore Now',
        ctaTab: 'creators',
      });
      showToast('Added slide to rotating ad carousel!', 'success');
    } catch {
      showToast('Failed to save carousel slide.', 'error');
    } finally {
      setSavingSlide(false);
    }
  };

  const handleToggleSlide = async (slide: AdCarouselSlide) => {
    try {
      const res = await fetch('/api/promotions/carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', slideId: slide.id }),
      });
      const data = await res.json();
      if (res.ok) {
        onPromotionsUpdated(data.promotions);
        showToast(slide.active ? 'Slide hidden from carousel.' : 'Slide enabled in carousel.', 'info');
      }
    } catch {}
  };

  const handleDeleteSlide = async (slideId: string) => {
    try {
      const res = await fetch('/api/promotions/carousel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', slideId }),
      });
      const data = await res.json();
      if (res.ok) {
        onPromotionsUpdated(data.promotions);
        showToast('Carousel slide removed.', 'success');
      }
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-purple-400" />
            <span>Homepage Preview, Banners & Ad Carousel Manager</span>
          </h2>
          <p className="text-xs text-slate-400">
            Update the permanent 16:9 website preview, advertisement banner, and automatic rotating carousel in real time.
          </p>
        </div>
        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          <span>Synced to Homepage</span>
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. PERMANENT 16:9 WEBSITE PREVIEW EDITOR */}
        <form
          onSubmit={handleSavePreview}
          className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-purple-400" />
              <span>Permanent 16:9 Website Preview</span>
            </h3>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={previewDraft.autoplay}
                onChange={(e) => setPreviewDraft({ ...previewDraft, autoplay: e.target.checked })}
                className="accent-purple-600"
              />
              <span>Autoplay Loop</span>
            </label>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Preview Headline</label>
              <input
                type="text"
                value={previewDraft.headline}
                onChange={(e) => setPreviewDraft({ ...previewDraft, headline: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Caption</label>
              <textarea
                rows={2}
                value={previewDraft.caption}
                onChange={(e) => setPreviewDraft({ ...previewDraft, caption: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Media URL (16:9 MP4 Video or JPG Image)</label>
              <input
                type="text"
                value={previewDraft.mediaUrl}
                onChange={(e) => setPreviewDraft({ ...previewDraft, mediaUrl: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px]"
              />
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {MEDIA_PRESETS.map((preset) => (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => setPreviewDraft({ ...previewDraft, mediaUrl: preset.url })}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] text-purple-300"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">CTA Label</label>
                <input
                  type="text"
                  value={previewDraft.ctaLabel}
                  onChange={(e) => setPreviewDraft({ ...previewDraft, ctaLabel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Target Page</label>
                <select
                  value={previewDraft.ctaTab}
                  onChange={(e) =>
                    setPreviewDraft({ ...previewDraft, ctaTab: e.target.value as PromotionTargetTab })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {TARGET_TAB_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingPreview}
            className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingPreview ? 'Saving Preview...' : 'Update 16:9 Website Preview'}</span>
          </button>
        </form>

        {/* 2. SEPARATE ADVERTISEMENT BANNER EDITOR */}
        <form
          onSubmit={handleSaveBanner}
          className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-amber-400" />
              <span>Separate Advertisement Banner</span>
            </h3>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={bannerDraft.enabled}
                onChange={(e) => setBannerDraft({ ...bannerDraft, enabled: e.target.checked })}
                className="accent-purple-600"
              />
              <span>Visible on Homepage</span>
            </label>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Sponsor Label</label>
                <input
                  type="text"
                  value={bannerDraft.sponsorLabel}
                  onChange={(e) => setBannerDraft({ ...bannerDraft, sponsorLabel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Theme Accent</label>
                <select
                  value={bannerDraft.accentTheme}
                  onChange={(e) =>
                    setBannerDraft({
                      ...bannerDraft,
                      accentTheme: e.target.value as PromoBannerConfig['accentTheme'],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  <option value="purple">Purple</option>
                  <option value="emerald">Emerald</option>
                  <option value="amber">Amber</option>
                  <option value="rose">Rose</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Banner Headline</label>
              <input
                type="text"
                value={bannerDraft.title}
                onChange={(e) => setBannerDraft({ ...bannerDraft, title: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Banner Description</label>
              <textarea
                rows={2}
                value={bannerDraft.subtitle}
                onChange={(e) => setBannerDraft({ ...bannerDraft, subtitle: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Banner Image URL</label>
              <input
                type="text"
                value={bannerDraft.imageUrl}
                onChange={(e) => setBannerDraft({ ...bannerDraft, imageUrl: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Button Text</label>
                <input
                  type="text"
                  value={bannerDraft.ctaLabel}
                  onChange={(e) => setBannerDraft({ ...bannerDraft, ctaLabel: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Target Page</label>
                <select
                  value={bannerDraft.ctaTab}
                  onChange={(e) =>
                    setBannerDraft({ ...bannerDraft, ctaTab: e.target.value as PromotionTargetTab })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
                >
                  {TARGET_TAB_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={savingBanner}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{savingBanner ? 'Saving Banner...' : 'Update Advertisement Banner'}</span>
          </button>
        </form>
      </div>

      {/* 3. AUTOMATIC ROTATING CAROUSEL AD MANAGER */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Images className="w-4 h-4 text-blue-400" />
            <span>Rotating Advertisement Carousel Slides ({promotions.carousel.length})</span>
          </h3>
        </div>

        {/* Add New Carousel Slide */}
        <form
          onSubmit={handleAddCarouselSlide}
          className="p-4 rounded-2xl bg-slate-950 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-end text-xs"
        >
          <div className="md:col-span-3">
            <label className="block text-slate-400 mb-1">Slide Title *</label>
            <input
              type="text"
              placeholder="e.g., Weekend Live Concert Pass"
              value={newSlide.title}
              onChange={(e) => setNewSlide({ ...newSlide, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
              required
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-slate-400 mb-1">Subtitle</label>
            <input
              type="text"
              placeholder="Short promotional copy"
              value={newSlide.subtitle}
              onChange={(e) => setNewSlide({ ...newSlide, subtitle: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-slate-400 mb-1">Sponsor / Brand</label>
            <input
              type="text"
              value={newSlide.sponsor}
              onChange={(e) => setNewSlide({ ...newSlide, sponsor: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-slate-400 mb-1">Target Page</label>
            <select
              value={newSlide.ctaTab}
              onChange={(e) =>
                setNewSlide({ ...newSlide, ctaTab: e.target.value as PromotionTargetTab })
              }
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white"
            >
              {TARGET_TAB_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={savingSlide}
              className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{savingSlide ? 'Adding...' : 'Add Slide'}</span>
            </button>
          </div>
        </form>

        {/* Existing Carousel Slides List */}
        <div className="space-y-3">
          {promotions.carousel.map((slide) => (
            <div
              key={slide.id}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={slide.imageUrl || '/assets/aistudio/preview_brand_16x9.jpg'}
                  alt={slide.title}
                  loading="lazy"
                  decoding="async"
                  className="w-20 h-12 rounded-lg object-cover border border-slate-800 shrink-0"
                />
                <div className="min-w-0 space-y-0.5">
                  <div className="font-bold text-white truncate">
                    {slide.title}
                    <span className={`ml-2 text-[10px] font-semibold ${slide.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {slide.active ? '· Active' : '· Paused'}
                    </span>
                  </div>
                  <div className="text-slate-400 truncate">
                    {slide.sponsor} · {slide.category} · CTA: {slide.ctaLabel} ({slide.ctaTab})
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggleSlide(slide)}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 hover:border-purple-500 flex items-center gap-1.5"
                >
                  {slide.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{slide.active ? 'Hide' : 'Enable'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSlide(slide.id)}
                  className="px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 hover:bg-rose-900/60 flex items-center gap-1.5"
                  aria-label={`Delete slide ${slide.title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
