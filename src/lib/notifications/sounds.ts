/**
 * Sound engine for ARKON notifications.
 *
 * Uses the Web Audio API to synthesize short professional tones —
 * no audio files needed, works offline, and is lightweight.
 *
 * A single AudioContext is reused across all sounds (performance).
 * Sounds are generated programmatically with oscillators + envelopes.
 *
 * On mobile (React Native), this layer will be replaced with
 * native sound playback (e.g. react-native-sound). The interface
 * stays the same: playSound(soundId).
 */

const SOUND_TONES: Record<string, { freq: number; duration: number; type: OscillatorType; sweep?: number }> = {
  new_visit:        { freq: 880,  duration: 0.25, type: 'sine',     sweep: 1320 },
  visit_updated:    { freq: 660,  duration: 0.15, type: 'sine',     sweep: 880 },
  visit_cancelled:  { freq: 440,  duration: 0.30, type: 'triangle', sweep: 220 },
  visit_started:    { freq: 740,  duration: 0.20, type: 'sine',     sweep: 990 },
  visit_completed:  { freq: 990,  duration: 0.30, type: 'sine',     sweep: 1480 },
  new_lead:         { freq: 784,  duration: 0.20, type: 'sine',     sweep: 1047 },
  contract:         { freq: 587,  duration: 0.15, type: 'triangle' },
  schedule:         { freq: 698,  duration: 0.15, type: 'sine' },
  general:          { freq: 523,  duration: 0.12, type: 'sine' },
};

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

export function playSound(soundId: string): void {
  const ctx = getContext();
  if (!ctx) return;

  const tone = SOUND_TONES[soundId];
  if (!tone) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = tone.type;
  osc.frequency.setValueAtTime(tone.freq, now);

  if (tone.sweep) {
    osc.frequency.exponentialRampToValueAtTime(tone.sweep, now + tone.duration);
  }

  // Envelope: quick attack, smooth decay
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + tone.duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + tone.duration + 0.05);
}

/** Pre-warm the audio context on first user interaction (browser autoplay policy) */
export function warmAudioContext(): void {
  getContext();
}
