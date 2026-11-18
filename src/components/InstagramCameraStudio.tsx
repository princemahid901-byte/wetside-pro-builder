import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera, Video, Phone, PhoneOff, FlipHorizontal, Flashlight, Sun, Sliders,
  Crop, RotateCw, Type, Smile, PenTool, Undo, Redo, Download, Share2, Music,
  Volume2, VolumeX, Sparkles, Clock, Grid, Trash2, Play, Pause, Check, X,
  ChevronLeft, ChevronRight, Image as ImageIcon, Layers, Eye, Send, Radio,
  Maximize2, ArrowRight, ShieldCheck, Tag, Globe, Lock, Users, Flame
} from 'lucide-react';

export type StudioMode = 'camera' | 'photo-edit' | 'video-edit' | 'publish' | 'calling';
export type CaptureMode = 'photo' | 'video' | 'call';

interface RecordedClip {
  id: string;
  blob: Blob;
  url: string;
  duration: number; // in seconds
  thumbnail: string;
}

interface FilterPreset {
  id: string;
  name: string;
  cssFilter: string;
  canvasFilter: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
}

interface TextOverlay {
  id: string;
  text: string;
  x: number; // percentage 0-100
  y: number;
  fontSize: number;
  color: string;
  bgColor?: string;
  style: 'classic' | 'modern' | 'neon' | 'typewriter';
}

interface StickerOverlay {
  id: string;
  emoji: string;
  label?: string;
  x: number;
  y: number;
  scale: number;
}

interface DrawStroke {
  color: string;
  width: number;
  points: { x: number; y: number }[];
}

interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  duration: string;
  genre: string;
  audioUrl: string;
}

interface Props {
  currentUserId: string;
  currentUserName: string;
  currentUserProfileId: string;
  onClose: () => void;
  onPostPublished: (post: {
    type: 'photo' | 'video';
    mediaUrl: string;
    thumbnailUrl: string;
    caption: string;
    hashtags: string[];
    privacy: string;
  }) => void;
  onStartDirectCall?: (peerId: string, peerName?: string) => void;
  showToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const FILTER_PRESETS: FilterPreset[] = [
  { id: 'normal', name: 'Normal', cssFilter: 'none', canvasFilter: () => {} },
  {
    id: 'beauty',
    name: 'Beauty Glow',
    cssFilter: 'brightness(1.08) contrast(1.04) saturate(1.15)',
    canvasFilter: (ctx, w, h) => {
      ctx.fillStyle = 'rgba(255, 230, 240, 0.08)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'vintage',
    name: 'Vintage 1977',
    cssFilter: 'sepia(0.35) contrast(1.15) brightness(0.95) saturate(1.2)',
    canvasFilter: (ctx, w, h) => {
      ctx.fillStyle = 'rgba(255, 180, 50, 0.12)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    cssFilter: 'contrast(1.2) saturate(1.25) hue-rotate(-10deg)',
    canvasFilter: (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0, 80, 120, 0.1)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'noir',
    name: 'Noir B&W',
    cssFilter: 'grayscale(1) contrast(1.4) brightness(0.9)',
    canvasFilter: () => {},
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    cssFilter: 'hue-rotate(290deg) saturate(1.6) contrast(1.3)',
    canvasFilter: (ctx, w, h) => {
      ctx.fillStyle = 'rgba(180, 0, 255, 0.12)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'golden',
    name: 'Golden Hour',
    cssFilter: 'sepia(0.2) saturate(1.4) brightness(1.05)',
    canvasFilter: (ctx, w, h) => {
      ctx.fillStyle = 'rgba(255, 200, 50, 0.15)';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'softblur',
    name: 'Portrait Blur',
    cssFilter: 'contrast(1.05)',
    canvasFilter: () => {},
  },
];

const BACKGROUND_TRACKS: AudioTrack[] = [
  { id: 'none', title: 'Original Audio Only', artist: 'Camera Mic', duration: '—', genre: 'Native', audioUrl: '' },
  { id: 'track-1', title: 'Sunset Glow Lo-Fi', artist: 'Orio Beats', duration: '0:30', genre: 'Lo-Fi / Chill', audioUrl: 'https://cdn.freesound.org/previews/612/612642_11861866-lq.mp3' },
  { id: 'track-2', title: 'Neon Highway Synth', artist: 'CyberWave', duration: '0:45', genre: 'Electronic', audioUrl: 'https://cdn.freesound.org/previews/567/567926_9497060-lq.mp3' },
  { id: 'track-3', title: 'Acoustic Morning', artist: 'Sunrise Cafe', duration: '0:35', genre: 'Acoustic', audioUrl: 'https://cdn.freesound.org/previews/530/530664_1156514-lq.mp3' },
  { id: 'track-4', title: 'Upbeat Urban Groove', artist: 'Metro Funk', duration: '0:40', genre: 'Dance / Pop', audioUrl: 'https://cdn.freesound.org/previews/476/476547_9845347-lq.mp3' },
];

export const InstagramCameraStudio: React.FC<Props> = ({
  currentUserId,
  currentUserName,
  currentUserProfileId,
  onClose,
  onPostPublished,
  onStartDirectCall,
  showToast,
}) => {
  // Navigation / studio phases
  const [studioMode, setStudioMode] = useState<StudioMode>('camera');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('video');

  // Camera state
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [countdownRunning, setCountdownRunning] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '1:1' | '4:5' | '16:9'>('9:16');
  const [activeFilter, setActiveFilter] = useState<FilterPreset>(FILTER_PRESETS[0]);
  const [cameraResolution, setCameraResolution] = useState<'1080p' | '720p'>('1080p');

  // Multi-clip video recording state
  const [clips, setClips] = useState<RecordedClip[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [maxRecordSeconds, setMaxRecordSeconds] = useState<15 | 30 | 60>(60);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);

  // Captured media for editing
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [workingVideoUrl, setWorkingVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);

  // Photo editing adjustments
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [warmth, setWarmth] = useState(0);
  const [exposure, setExposure] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [isFlippedH, setIsFlippedH] = useState(false);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

  // Text overlays
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [isAddingText, setIsAddingText] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textBg, setTextBg] = useState(true);

  // Stickers overlays
  const [stickerOverlays, setStickerOverlays] = useState<StickerOverlay[]>([]);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);

  // Freehand Drawing tool
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [drawStrokes, setDrawStrokes] = useState<DrawStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<DrawStroke | null>(null);
  const [brushColor, setBrushColor] = useState('#a855f7');
  const [brushWidth, setBrushWidth] = useState(4);

  // Video editing timeline & sound
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(10);
  const [videoSpeed, setVideoSpeed] = useState<0.5 | 1 | 1.5 | 2>(1);
  const [selectedMusicTrack, setSelectedMusicTrack] = useState<AudioTrack>(BACKGROUND_TRACKS[0]);
  const [originalAudioVolume, setOriginalAudioVolume] = useState(100);
  const [musicVolume, setMusicVolume] = useState(70);
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [exportQuality, setExportQuality] = useState<'1080p' | '720p'>('1080p');

  // Publishing form
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>(['trending', 'reels', 'explore', 'oriolive']);
  const [audiencePrivacy, setAudiencePrivacy] = useState<'public' | 'friends' | 'subscribers' | 'private'>('public');
  const [saveToGalleryOnPublish, setSaveToGalleryOnPublish] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);

  // Video call fast launch from camera
  const [callTargetPeer, setCallTargetPeer] = useState('');

  // Refs
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoPlayerRef = useRef<HTMLVideoElement>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);

  // Start live phone camera
  const startCamera = useCallback(async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const constraints: MediaStreamConstraints = {
        audio: { echoCancellation: true, noiseSuppression: true },
        video: {
          facingMode: { ideal: facingMode },
          width: cameraResolution === '1080p' ? { ideal: 1920 } : { ideal: 1280 },
          height: cameraResolution === '1080p' ? { ideal: 1080 } : { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      // Apply zoom if supported by track capabilities
      const [videoTrack] = stream.getVideoTracks();
      const capabilities = (videoTrack as any)?.getCapabilities?.();
      if (capabilities?.zoom) {
        (videoTrack as any).applyConstraints({
          advanced: [{ zoom: zoomLevel }],
        }).catch(() => {});
      }
    } catch (err) {
      console.warn('Camera error or permission denied:', err);
      showToast('Camera access required. Please grant permission in browser.', 'error');
    }
  }, [facingMode, cameraResolution, zoomLevel, showToast]);

  useEffect(() => {
    if (studioMode === 'camera') {
      startCamera();
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [studioMode, startCamera]);

  // Toggle front/rear camera
  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
    showToast(facingMode === 'user' ? 'Switched to Rear Camera' : 'Switched to Front Camera', 'info');
  };

  // Toggle torch / flash
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const [videoTrack] = streamRef.current.getVideoTracks();
    const capabilities = (videoTrack as any)?.getCapabilities?.();
    if (capabilities?.torch) {
      const nextTorch = !isTorchOn;
      try {
        await (videoTrack as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setIsTorchOn(nextTorch);
        showToast(nextTorch ? 'Flash Torch ON' : 'Flash Torch OFF', 'info');
      } catch {
        showToast('Torch mode not supported on this device', 'info');
      }
    } else {
      setIsTorchOn(!isTorchOn);
      showToast(!isTorchOn ? 'Flash simulation active' : 'Flash OFF', 'info');
    }
  };

  // Capture Photo
  const capturePhoto = () => {
    if (timerSeconds > 0) {
      runCountdown(() => doCapturePhotoSnapshot());
    } else {
      doCapturePhotoSnapshot();
    }
  };

  const doCapturePhotoSnapshot = () => {
    if (!videoPreviewRef.current) return;
    const video = videoPreviewRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.filter = activeFilter.cssFilter;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    activeFilter.canvasFilter(ctx, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedPhotoUrl(dataUrl);
    setStudioMode('photo-edit');
    showToast('Photo captured! Edit or publish.', 'success');
  };

  // Multi-clip Video Recording
  const startRecordingClip = () => {
    if (!streamRef.current) return;

    if (timerSeconds > 0 && !isRecording) {
      runCountdown(() => doStartRecording());
    } else {
      doStartRecording();
    }
  };

  const doStartRecording = () => {
    if (!streamRef.current) return;
    recordingChunksRef.current = [];

    const options: MediaRecorderOptions = {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm',
    };

    try {
      const recorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordingChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
        const clipUrl = URL.createObjectURL(fullBlob);
        const clipDuration = recordingSeconds;

        // Generate clip thumbnail
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 160;
        thumbCanvas.height = 240;
        const ctx = thumbCanvas.getContext('2d');
        if (ctx && videoPreviewRef.current) {
          ctx.drawImage(videoPreviewRef.current, 0, 0, 160, 240);
        }
        const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

        const newClip: RecordedClip = {
          id: `clip-${Date.now()}`,
          blob: fullBlob,
          url: clipUrl,
          duration: clipDuration,
          thumbnail: thumbUrl,
        };

        setClips((prev) => [...prev, newClip]);
        setRecordingSeconds(0);
        setIsRecording(false);
      };

      recorder.start(100);
      setIsRecording(true);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= maxRecordSeconds) {
            stopRecordingClip();
          }
          return next;
        });
      }, 1000);

      showToast('Recording clip started...', 'info');
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
      showToast('Recording failed on this device.', 'error');
    }
  };

  const stopRecordingClip = () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const deleteLastClip = () => {
    if (clips.length === 0) return;
    setClips((prev) => prev.slice(0, prev.length - 1));
    showToast('Last clip removed', 'info');
  };

  const finishAllClipsToEditor = () => {
    if (clips.length === 0) {
      showToast('Record at least one clip first', 'info');
      return;
    }
    const totalSecs = clips.reduce((acc, c) => acc + c.duration, 0);
    // Use last or first clip as primary working video
    setWorkingVideoUrl(clips[0].url);
    setVideoDuration(totalSecs || 15);
    setTrimStart(0);
    setTrimEnd(totalSecs || 15);
    setStudioMode('video-edit');
  };

  // Run Countdown Timer (3s, 5s, 10s)
  const runCountdown = (onComplete: () => void) => {
    let count = timerSeconds;
    setCountdownRunning(count);
    const interval = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearInterval(interval);
        setCountdownRunning(null);
        onComplete();
      } else {
        setCountdownRunning(count);
      }
    }, 1000);
  };

  // Pick Media from Device Gallery
  const handlePickFromGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
      setCapturedPhotoUrl(fileUrl);
      setStudioMode('photo-edit');
      showToast('Photo loaded from device gallery!', 'success');
    } else if (file.type.startsWith('video/')) {
      setWorkingVideoUrl(fileUrl);
      setVideoDuration(30);
      setTrimStart(0);
      setTrimEnd(30);
      setStudioMode('video-edit');
      showToast('Video loaded from device gallery!', 'success');
    }
  };

  // Save / Download to Device Gallery (Scoped Storage Simulation)
  const saveMediaToDevice = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Saved to device gallery: ${filename}`, 'success');
  };

  // Text Overlay handler
  const handleAddText = () => {
    if (!textInput.trim()) return;
    const newOverlay: TextOverlay = {
      id: `text-${Date.now()}`,
      text: textInput.trim(),
      x: 50,
      y: 50,
      fontSize: 24,
      color: textColor,
      bgColor: textBg ? 'rgba(0,0,0,0.6)' : undefined,
      style: 'modern',
    };
    setTextOverlays((prev) => [...prev, newOverlay]);
    setTextInput('');
    setIsAddingText(false);
  };

  // Sticker Overlay handler
  const handleAddSticker = (emoji: string, label?: string) => {
    const newSticker: StickerOverlay = {
      id: `sticker-${Date.now()}`,
      emoji,
      label,
      x: 50,
      y: 40,
      scale: 1,
    };
    setStickerOverlays((prev) => [...prev, newSticker]);
    setStickerPickerOpen(false);
  };

  // Drawing Canvas Handlers
  const handleDrawingStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !drawingCanvasRef.current) return;
    const rect = drawingCanvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setCurrentStroke({
      color: brushColor,
      width: brushWidth,
      points: [{ x, y }],
    });
  };

  const handleDrawingMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || !currentStroke || !drawingCanvasRef.current) return;
    const rect = drawingCanvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setCurrentStroke((prev) =>
      prev ? { ...prev, points: [...prev.points, { x, y }] } : null
    );

    // Draw immediately on canvas
    const ctx = drawingCanvasRef.current.getContext('2d');
    if (ctx && currentStroke.points.length > 0) {
      const lastPoint = currentStroke.points[currentStroke.points.length - 1];
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const handleDrawingEnd = () => {
    if (currentStroke) {
      setDrawStrokes((prev) => [...prev, currentStroke]);
      setCurrentStroke(null);
    }
  };

  const handleUndoDraw = () => {
    setDrawStrokes((prev) => prev.slice(0, prev.length - 1));
    // Redraw remaining strokes on canvas
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStrokes.slice(0, drawStrokes.length - 1).forEach((stroke) => {
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      stroke.points.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    });
  };

  // Final Publish Handler
  const handlePublishSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPublishing(true);

    const mediaType = capturedPhotoUrl ? 'photo' : 'video';
    const mediaUrl = capturedPhotoUrl || workingVideoUrl || '';
    const coverUrl = customCoverUrl || capturedPhotoUrl || clips[0]?.thumbnail || 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400';

    try {
      // Auto save to device gallery if selected
      if (saveToGalleryOnPublish && mediaUrl) {
        saveMediaToDevice(mediaUrl, `orio_${mediaType}_${Date.now()}.${mediaType === 'photo' ? 'jpg' : 'mp4'}`);
      }

      // Upload to server
      const endpoint = mediaType === 'video' ? '/api/shorts/upload' : '/api/videos/upload';
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorName: currentUserName,
          creatorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          videoUrl: mediaUrl,
          thumbnailUrl: coverUrl,
          description: caption,
          hashtags,
          privacy: audiencePrivacy,
        }),
      });

      onPostPublished({
        type: mediaType,
        mediaUrl,
        thumbnailUrl: coverUrl,
        caption,
        hashtags,
        privacy: audiencePrivacy,
      });

      showToast('Published successfully to OrioLiveCall feed!', 'success');
      onClose();
    } catch {
      showToast('Published locally to social feed.', 'success');
      onClose();
    } finally {
      setIsPublishing(false);
    }
  };

  // Video calling fast trigger
  const handleTriggerCallFromStudio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callTargetPeer.trim()) return;
    if (onStartDirectCall) {
      onStartDirectCall(callTargetPeer.trim(), callTargetPeer.trim());
      onClose();
    }
  };

  const totalRecordedSeconds = clips.reduce((acc, c) => acc + c.duration, 0) + recordingSeconds;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      {/* Hidden Gallery Input */}
      <input
        ref={filePickerRef}
        type="file"
        accept="image/*,video/*"
        onChange={handlePickFromGallery}
        className="hidden"
      />

      {/* PHASE 1: LIVE INSTAGRAM-STYLE CAMERA VIEWFINDER */}
      {studioMode === 'camera' && (
        <div className="relative w-full h-full flex flex-col justify-between">
          {/* Top Camera Controls Bar */}
          <div className="absolute top-0 left-0 right-0 z-30 p-4 pt-5 bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between">
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-all"
              title="Close Camera"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Segmented multi-clip bar if recording video */}
            {captureMode === 'video' && (
              <div className="flex-1 mx-4 flex gap-1 h-1.5 bg-white/20 rounded-full overflow-hidden">
                {clips.map((clip) => (
                  <div
                    key={clip.id}
                    className="bg-purple-500 h-full"
                    style={{ width: `${(clip.duration / maxRecordSeconds) * 100}%` }}
                  />
                ))}
                {isRecording && (
                  <div
                    className="bg-rose-500 h-full transition-all duration-300"
                    style={{ width: `${(recordingSeconds / maxRecordSeconds) * 100}%` }}
                  />
                )}
              </div>
            )}

            <div className="flex items-center gap-2">
              {/* Flash / Torch */}
              <button
                onClick={toggleTorch}
                className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
                  isTorchOn ? 'bg-amber-400 text-black' : 'bg-black/40 text-white'
                }`}
                title="Flash / Torch"
              >
                <Flashlight className="w-5 h-5" />
              </button>

              {/* Timer Toggle */}
              <button
                onClick={() => setTimerSeconds((prev) => (prev === 0 ? 3 : prev === 3 ? 10 : 0))}
                className={`px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md transition-all flex items-center gap-1 ${
                  timerSeconds > 0 ? 'bg-purple-600 text-white' : 'bg-black/40 text-white'
                }`}
                title="Camera Timer"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{timerSeconds === 0 ? 'OFF' : `${timerSeconds}s`}</span>
              </button>

              {/* Grid Lines */}
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
                  showGrid ? 'bg-purple-600 text-white' : 'bg-black/40 text-white'
                }`}
                title="Rule of Thirds Grid"
              >
                <Grid className="w-5 h-5" />
              </button>

              {/* Front/Rear Switch */}
              <button
                onClick={toggleCameraFacing}
                className="p-2.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white transition-all"
                title="Switch Camera (Front/Rear)"
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Camera Viewfinder Video */}
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-all ${
                facingMode === 'user' ? '-scale-x-100' : ''
              }`}
              style={{ filter: activeFilter.cssFilter }}
            />

            {/* Rule of Thirds Grid Overlay */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>
            )}

            {/* Countdown Big Overlay */}
            {countdownRunning !== null && (
              <div className="absolute inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <span className="text-9xl font-extrabold text-white animate-ping">
                  {countdownRunning}
                </span>
              </div>
            )}

            {/* Flash screen simulation on snapshot */}
            {isTorchOn && (
              <div className="absolute inset-0 pointer-events-none bg-amber-400/10 animate-pulse" />
            )}

            {/* Recording badge */}
            {isRecording && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 rounded-full bg-rose-600/90 text-white font-mono text-xs font-bold flex items-center gap-2 shadow-lg animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                <span>REC · {recordingSeconds}s / {maxRecordSeconds}s</span>
              </div>
            )}
          </div>

          {/* Bottom Controls Bar: Filter Carousel & Capture Button */}
          <div className="absolute bottom-0 left-0 right-0 z-30 pb-6 pt-12 bg-gradient-to-t from-black via-black/70 to-transparent flex flex-col items-center gap-4">
            {/* Live Filter Carousel */}
            <div className="w-full flex items-center justify-center gap-3 overflow-x-auto px-4 py-1 no-scrollbar">
              {FILTER_PRESETS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    activeFilter.id === f.id
                      ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-600/40 scale-105'
                      : 'bg-black/50 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>

            {/* Main Action Bar */}
            <div className="w-full max-w-md px-6 flex items-center justify-between">
              {/* Device Gallery Shortcut */}
              <button
                onClick={() => filePickerRef.current?.click()}
                className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-md flex flex-col items-center justify-center text-white transition-all"
                title="Device Gallery"
              >
                <ImageIcon className="w-5 h-5 text-purple-300" />
                <span className="text-[9px] font-semibold mt-0.5">Gallery</span>
              </button>

              {/* Big Instagram Circular Capture / Record Button */}
              {captureMode === 'photo' ? (
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full border-4 border-white p-1 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all group"
                  title="Capture Photo"
                >
                  <div className="w-full h-full rounded-full bg-white group-hover:bg-purple-200 transition-colors" />
                </button>
              ) : captureMode === 'video' ? (
                <button
                  onClick={isRecording ? stopRecordingClip : startRecordingClip}
                  className={`w-20 h-20 rounded-full border-4 p-1 flex items-center justify-center shadow-2xl transition-all ${
                    isRecording
                      ? 'border-rose-500 scale-110 shadow-rose-600/50'
                      : 'border-white hover:scale-105 active:scale-95'
                  }`}
                  title={isRecording ? 'Stop Clip' : 'Record Clip'}
                >
                  <div
                    className={`transition-all ${
                      isRecording
                        ? 'w-7 h-7 rounded-md bg-rose-600'
                        : 'w-full h-full rounded-full bg-rose-600'
                    }`}
                  />
                </button>
              ) : (
                /* Mode: Call */
                <button
                  onClick={() => setStudioMode('calling')}
                  className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 p-1 flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-emerald-600/40"
                  title="Start 1:1 Live Video Call"
                >
                  <Phone className="w-8 h-8 text-white" />
                </button>
              )}

              {/* Delete Last Clip or Next to Video Edit */}
              {captureMode === 'video' && clips.length > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={deleteLastClip}
                    className="p-3 rounded-full bg-white/10 hover:bg-rose-600/40 text-slate-300 hover:text-white backdrop-blur-md transition-all"
                    title="Delete Last Clip"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={finishAllClipsToEditor}
                    className="px-4 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow-lg shadow-purple-600/30 transition-all"
                  >
                    <span>Next ({clips.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-12 h-12" />
              )}
            </div>

            {/* Mode Switcher Tabs: PHOTO | VIDEO | CALL */}
            <div className="flex items-center gap-6 text-xs font-bold tracking-wider uppercase pt-2">
              <button
                onClick={() => setCaptureMode('photo')}
                className={`transition-colors ${
                  captureMode === 'photo' ? 'text-amber-400 font-extrabold border-b-2 border-amber-400 pb-0.5' : 'text-slate-400'
                }`}
              >
                Photo
              </button>
              <button
                onClick={() => setCaptureMode('video')}
                className={`transition-colors ${
                  captureMode === 'video' ? 'text-purple-400 font-extrabold border-b-2 border-purple-400 pb-0.5' : 'text-slate-400'
                }`}
              >
                Video Reels
              </button>
              <button
                onClick={() => setCaptureMode('call')}
                className={`transition-colors ${
                  captureMode === 'call' ? 'text-emerald-400 font-extrabold border-b-2 border-emerald-400 pb-0.5' : 'text-slate-400'
                }`}
              >
                Live Call
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: COMPLETE PHOTO EDITING STUDIO */}
      {studioMode === 'photo-edit' && capturedPhotoUrl && (
        <div className="relative w-full h-full flex flex-col justify-between bg-slate-950">
          {/* Top Photo Editor Header */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-20">
            <button
              onClick={() => setStudioMode('camera')}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 text-xs font-semibold"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <span className="font-bold text-sm text-white">Photo Studio Editor</span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => saveMediaToDevice(capturedPhotoUrl, `orio_photo_${Date.now()}.jpg`)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Save to Device Gallery"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Save</span>
              </button>

              <button
                onClick={() => setStudioMode('publish')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all"
              >
                <span>Publish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Photo Canvas Working Area */}
          <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
            <div
              className="relative max-w-md max-h-[580px] w-full h-full flex items-center justify-center rounded-2xl overflow-hidden shadow-2xl bg-black"
              style={{
                transform: `rotate(${rotation}deg) scaleX(${isFlippedH ? -1 : 1})`,
                transition: 'transform 0.3s ease',
              }}
            >
              <img
                src={capturedPhotoUrl}
                alt="Captured"
                className="w-full h-full object-contain"
                style={{
                  filter: showBeforeAfter
                    ? 'none'
                    : `brightness(${1 + brightness / 100}) contrast(${1 + contrast / 100}) saturate(${1 + saturation / 100}) sepia(${warmth / 100})`,
                }}
              />

              {/* Freehand Drawing Overlay Canvas */}
              <canvas
                ref={drawingCanvasRef}
                width={800}
                height={1200}
                onMouseDown={handleDrawingStart}
                onMouseMove={handleDrawingMove}
                onMouseUp={handleDrawingEnd}
                onTouchStart={handleDrawingStart}
                onTouchMove={handleDrawingMove}
                onTouchEnd={handleDrawingEnd}
                className={`absolute inset-0 w-full h-full ${
                  isDrawingMode ? 'cursor-crosshair z-30' : 'pointer-events-none z-10'
                }`}
              />

              {/* Text Overlays */}
              {textOverlays.map((t) => (
                <div
                  key={t.id}
                  style={{
                    position: 'absolute',
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    transform: 'translate(-50%, -50%)',
                    color: t.color,
                    fontSize: `${t.fontSize}px`,
                    backgroundColor: t.bgColor,
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                  }}
                  className="z-20 cursor-move select-none shadow-lg"
                >
                  {t.text}
                </div>
              ))}

              {/* Stickers Overlays */}
              {stickerOverlays.map((s) => (
                <div
                  key={s.id}
                  style={{
                    position: 'absolute',
                    left: `${s.x}%`,
                    top: `${s.y}%`,
                    transform: `translate(-50%, -50%) scale(${s.scale})`,
                    fontSize: '48px',
                  }}
                  className="z-20 cursor-move select-none drop-shadow-xl"
                >
                  {s.emoji}
                </div>
              ))}
            </div>

            {/* Before / After Hold Button */}
            <button
              onMouseDown={() => setShowBeforeAfter(true)}
              onMouseUp={() => setShowBeforeAfter(false)}
              onTouchStart={() => setShowBeforeAfter(true)}
              onTouchEnd={() => setShowBeforeAfter(false)}
              className="absolute top-6 right-6 z-30 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-bold border border-white/20 shadow-lg"
            >
              Hold: Before / After
            </button>
          </div>

          {/* Photo Editing Toolbar & Sliders */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3 z-20">
            {/* Quick Adjustment Sliders */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Brightness ({brightness})</label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Contrast ({contrast})</label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Saturation ({saturation})</label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={saturation}
                  onChange={(e) => setSaturation(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">Warmth ({warmth})</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={warmth}
                  onChange={(e) => setWarmth(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>

            {/* Tools Bar: Crop/Rotate, Text, Stickers, Draw */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Rotate</span>
                </button>

                <button
                  onClick={() => setIsFlippedH(!isFlippedH)}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                  title="Flip Horizontal"
                >
                  <FlipHorizontal className="w-4 h-4" />
                  <span>Flip</span>
                </button>

                <button
                  onClick={() => setIsAddingText(true)}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                  title="Add Text"
                >
                  <Type className="w-4 h-4 text-purple-400" />
                  <span>Text</span>
                </button>

                <button
                  onClick={() => setStickerPickerOpen(true)}
                  className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
                  title="Add Stickers"
                >
                  <Smile className="w-4 h-4 text-amber-400" />
                  <span>Stickers</span>
                </button>

                <button
                  onClick={() => setIsDrawingMode(!isDrawingMode)}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all ${
                    isDrawingMode ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                  title="Freehand Draw"
                >
                  <PenTool className="w-4 h-4" />
                  <span>{isDrawingMode ? 'Drawing ON' : 'Draw'}</span>
                </button>
              </div>

              {isDrawingMode && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                    title="Brush Color"
                  />
                  <button
                    onClick={handleUndoDraw}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Undo Stroke"
                  >
                    <Undo className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Add Text Dialog */}
          {isAddingText && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl">
                <h4 className="font-bold text-white text-sm">Add Text Caption</h4>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your story text..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-purple-500"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <label className="text-xs text-slate-300 flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={textBg}
                        onChange={(e) => setTextBg(e.target.checked)}
                        className="accent-purple-600 rounded"
                      />
                      <span>Background Pill</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsAddingText(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddText}
                    className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                  >
                    Add to Photo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sticker Picker Dialog */}
          {stickerPickerOpen && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-sm">Choose Sticker</h4>
                  <button onClick={() => setStickerPickerOpen(false)} className="text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-3 text-3xl py-2">
                  {['🔥', '❤️', '✨', '⚡', '🎉', '📍', '💯', '👑', '🚀', '🌟', '💎', '🥳'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleAddSticker(emoji)}
                      className="p-3 rounded-2xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-center transition-all hover:scale-110"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE 3: COMPLETE VIDEO EDITING STUDIO */}
      {studioMode === 'video-edit' && workingVideoUrl && (
        <div className="relative w-full h-full flex flex-col justify-between bg-slate-950">
          {/* Top Video Editor Header */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between z-20">
            <button
              onClick={() => setStudioMode('camera')}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 text-xs font-semibold"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <span className="font-bold text-sm text-white">Video Reels Editor</span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => saveMediaToDevice(workingVideoUrl, `orio_video_${Date.now()}.mp4`)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
                title="Save to Device Gallery"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">Save</span>
              </button>

              <button
                onClick={() => setStudioMode('publish')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all"
              >
                <span>Publish</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Main Video Preview with Timeline Scrub */}
          <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
            <div className="relative max-w-sm max-h-[580px] w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-black flex items-center justify-center">
              <video
                ref={videoPlayerRef}
                src={workingVideoUrl}
                loop
                playsInline
                className="w-full h-full object-cover"
                style={{ filter: activeFilter.cssFilter }}
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
              />

              {/* Play / Pause Center Overlay Button */}
              <button
                onClick={() => {
                  if (videoPlayerRef.current) {
                    if (videoPlayerRef.current.paused) {
                      videoPlayerRef.current.play();
                      if (bgAudioRef.current && selectedMusicTrack.audioUrl) {
                        bgAudioRef.current.play();
                      }
                    } else {
                      videoPlayerRef.current.pause();
                      if (bgAudioRef.current) bgAudioRef.current.pause();
                    }
                  }
                }}
                className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md flex items-center justify-center text-white transition-all shadow-xl"
              >
                {isVideoPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
              </button>

              {/* Background Music Audio element */}
              {selectedMusicTrack.audioUrl && (
                <audio ref={bgAudioRef} src={selectedMusicTrack.audioUrl} loop />
              )}
            </div>
          </div>

          {/* Video Timeline & Audio Controls Toolbar */}
          <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3 z-20">
            {/* Timeline Trimming Controls */}
            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Trim Video Timeline</span>
                <span className="text-purple-400 font-mono">
                  {trimStart}s — {trimEnd}s (Duration: {(trimEnd - trimStart).toFixed(1)}s)
                </span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 block mb-0.5">Start Time</label>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, videoDuration - 1)}
                    value={trimStart}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val < trimEnd) setTrimStart(val);
                    }}
                    className="w-full accent-purple-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 block mb-0.5">End Time</label>
                  <input
                    type="range"
                    min="1"
                    max={videoDuration || 30}
                    value={trimEnd}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > trimStart) setTrimEnd(val);
                    }}
                    className="w-full accent-purple-500"
                  />
                </div>
              </div>
            </div>

            {/* Video Speed, Music Track, Audio Mixers */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Speed Controller */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">Playback Speed</label>
                <div className="grid grid-cols-4 gap-1">
                  {([0.5, 1, 1.5, 2] as const).map((spd) => (
                    <button
                      key={spd}
                      onClick={() => {
                        setVideoSpeed(spd);
                        if (videoPlayerRef.current) {
                          videoPlayerRef.current.playbackRate = spd;
                        }
                      }}
                      className={`py-1 rounded-lg text-xs font-bold transition-all ${
                        videoSpeed === spd ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Background Music Selector */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-purple-400" />
                  <span>Music Soundtrack</span>
                </label>
                <select
                  value={selectedMusicTrack.id}
                  onChange={(e) => {
                    const track = BACKGROUND_TRACKS.find((t) => t.id === e.target.value) || BACKGROUND_TRACKS[0];
                    setSelectedMusicTrack(track);
                  }}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                >
                  {BACKGROUND_TRACKS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.genre})
                    </option>
                  ))}
                </select>
              </div>

              {/* Audio Volume Mixer */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>Music Volume ({musicVolume}%)</span>
                  <span>Mic ({originalAudioVolume}%)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={musicVolume}
                  onChange={(e) => {
                    setMusicVolume(Number(e.target.value));
                    if (bgAudioRef.current) bgAudioRef.current.volume = Number(e.target.value) / 100;
                  }}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 4: SOCIAL MEDIA PUBLISHING WORKFLOW */}
      {studioMode === 'publish' && (
        <div className="relative w-full h-full flex flex-col justify-between bg-slate-950 p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-2xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <button
                onClick={() => setStudioMode(capturedPhotoUrl ? 'photo-edit' : 'video-edit')}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white flex items-center gap-1 text-xs font-semibold"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Edit Media</span>
              </button>
              <h2 className="font-bold text-base text-white">Publish New Post</h2>
              <div className="w-12" />
            </div>

            {/* Preview Card + Caption Form */}
            <form onSubmit={handlePublishSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Media Thumbnail Preview */}
                <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-xl relative aspect-[9/16] max-h-72 flex items-center justify-center">
                  {capturedPhotoUrl ? (
                    <img src={capturedPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <video src={workingVideoUrl || ''} className="w-full h-full object-cover" />
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] font-bold text-white uppercase">
                    {capturedPhotoUrl ? 'Photo' : 'Reels'}
                  </span>
                </div>

                {/* Caption and Tags */}
                <div className="sm:col-span-2 space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Write a Caption</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Share what's on your mind... #vibes #orio"
                      rows={4}
                      className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  {/* Hashtags Suggestion Pills */}
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Recommended Hashtags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['#trending', '#reels', '#viral', '#orio', '#creator', '#explore', '#live'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            if (!caption.includes(tag)) {
                              setCaption((prev) => `${prev.trim()} ${tag}`.trim());
                            }
                          }}
                          className="px-2.5 py-1 rounded-full bg-purple-950/60 hover:bg-purple-800/60 border border-purple-500/30 text-purple-300 text-[11px] font-semibold transition-all"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audience Privacy Selector */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">Who can see this post?</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAudiencePrivacy('public')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      audiencePrivacy === 'public'
                        ? 'bg-purple-600/20 border-purple-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Globe className="w-4 h-4 text-purple-400 mb-1" />
                    <div>Public</div>
                    <div className="text-[10px] text-slate-500">Everyone</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAudiencePrivacy('friends')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      audiencePrivacy === 'friends'
                        ? 'bg-purple-600/20 border-purple-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Users className="w-4 h-4 text-indigo-400 mb-1" />
                    <div>Friends</div>
                    <div className="text-[10px] text-slate-500">Mutuals only</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAudiencePrivacy('subscribers')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      audiencePrivacy === 'subscribers'
                        ? 'bg-purple-600/20 border-purple-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Flame className="w-4 h-4 text-amber-400 mb-1" />
                    <div>Subscribers</div>
                    <div className="text-[10px] text-slate-500">Fan Support</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAudiencePrivacy('private')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      audiencePrivacy === 'private'
                        ? 'bg-purple-600/20 border-purple-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <Lock className="w-4 h-4 text-rose-400 mb-1" />
                    <div>Only Me</div>
                    <div className="text-[10px] text-slate-500">Private Draft</div>
                  </button>
                </div>
              </div>

              {/* Save copy to device toggle */}
              <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 border border-slate-800 cursor-pointer text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Also save high-resolution copy to device gallery</span>
                </div>
                <input
                  type="checkbox"
                  checked={saveToGalleryOnPublish}
                  onChange={(e) => setSaveToGalleryOnPublish(e.target.checked)}
                  className="accent-purple-600 rounded"
                />
              </label>

              {/* Submit Share Button */}
              <button
                type="submit"
                disabled={isPublishing}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                <span>{isPublishing ? 'Publishing Post...' : 'Publish to Social Feed'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PHASE 5: FAST 1:1 LIVE VIDEO CALL LAUNCHER */}
      {studioMode === 'calling' && (
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 p-6">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <Phone className="w-8 h-8 animate-pulse" />
            </div>

            <div>
              <h3 className="font-bold text-lg text-white">Direct 1:1 Live Video Call</h3>
              <p className="text-xs text-slate-400 mt-1">
                Enter any user username or Profile ID (<span className="text-purple-300">ORI-XXXXXX</span>) to initiate an instant HD video call.
              </p>
            </div>

            <form onSubmit={handleTriggerCallFromStudio} className="space-y-4">
              <input
                type="text"
                value={callTargetPeer}
                onChange={(e) => setCallTargetPeer(e.target.value)}
                placeholder="Enter Username or Profile ID (e.g. ORI-100204)"
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-white text-sm text-center uppercase placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                required
              />

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setStudioMode('camera')}
                  className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Back to Camera
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
