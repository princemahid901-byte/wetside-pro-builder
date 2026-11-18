const SOUND_MUTED_KEY = 'oriolivecall_sound_muted';

let sharedAudioCtx: AudioContext | null = null;
let pendingChimeCleanup: (() => void) | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

export function isNotificationSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SOUND_MUTED_KEY) === 'true';
}

export function setNotificationSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_MUTED_KEY, muted ? 'true' : 'false');
}

function playToneSequence(
  notes: Array<{ freq: number; delay: number; duration: number; type?: OscillatorType; gain?: number }>
): boolean {
  if (isNotificationSoundMuted()) return false;
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (ctx.state === 'suspended') {
    return false;
  }

  const now = ctx.currentTime;
  for (const note of notes) {
    try {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = note.type || 'sine';
      osc.frequency.setValueAtTime(note.freq, now + note.delay);

      const peak = note.gain ?? 0.14;
      gainNode.gain.setValueAtTime(0.0001, now + note.delay);
      gainNode.gain.exponentialRampToValueAtTime(peak, now + note.delay + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + note.delay + note.duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + note.delay);
      osc.stop(now + note.delay + note.duration + 0.02);
    } catch {
      return false;
    }
  }
  return true;
}

export function cancelPendingNotificationChime(): void {
  if (pendingChimeCleanup) {
    pendingChimeCleanup();
    pendingChimeCleanup = null;
  }
}

/**
 * Plays a pleasant notification ding for Google Cookies & Auth consent.
 * If browser autoplay suspends AudioContext before user gesture, arms a one-time
 * listener on pointerdown/keydown so the chime plays on first interaction.
 */
export function playCookieNotificationChime(options?: { deferIfBlocked?: boolean }): boolean {
  cancelPendingNotificationChime();
  if (isNotificationSoundMuted()) return false;

  const chimeNotes = [
    { freq: 783.99, delay: 0, duration: 0.16, type: 'sine' as OscillatorType, gain: 0.12 },     // G5
    { freq: 1046.5, delay: 0.11, duration: 0.28, type: 'triangle' as OscillatorType, gain: 0.14 }, // C6
  ];

  const played = playToneSequence(chimeNotes);
  if (played || options?.deferIfBlocked === false || typeof window === 'undefined') {
    return played;
  }

  const unlockAndPlay = () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    ctx
      .resume()
      .then(() => {
        playToneSequence(chimeNotes);
      })
      .catch(() => {});
    cancelPendingNotificationChime();
  };

  window.addEventListener('pointerdown', unlockAndPlay, { once: true });
  window.addEventListener('keydown', unlockAndPlay, { once: true });
  pendingChimeCleanup = () => {
    window.removeEventListener('pointerdown', unlockAndPlay);
    window.removeEventListener('keydown', unlockAndPlay);
  };
  return false;
}

/**
 * Plays an uplifting confirmation sound when the user clicks Accept.
 */
export function playCookieAcceptSound(): void {
  cancelPendingNotificationChime();
  playToneSequence([
    { freq: 523.25, delay: 0, duration: 0.14, type: 'sine', gain: 0.12 },    // C5
    { freq: 659.25, delay: 0.08, duration: 0.16, type: 'sine', gain: 0.13 }, // E5
    { freq: 783.99, delay: 0.16, duration: 0.26, type: 'triangle', gain: 0.15 }, // G5
  ]);
}

/**
 * Plays a gentle soft tone when the user clicks Decline.
 */
export function playCookieDeclineSound(): void {
  cancelPendingNotificationChime();
  playToneSequence([
    { freq: 440, delay: 0, duration: 0.14, type: 'sine', gain: 0.11 },     // A4
    { freq: 349.23, delay: 0.11, duration: 0.22, type: 'sine', gain: 0.1 }, // F4
  ]);
}
