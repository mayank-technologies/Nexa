/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Global settings state for sound effects system
export const soundManager = {
  enabled: true, // Controlled by user setting (default ON)
  volume: 0.25,  // Low default volume (25%) as requested
  audioCtx: null as AudioContext | null,

  // Lazy-initialize AudioContext on first user interaction to bypass browser autoplay policy
  init() {
    if (this.audioCtx) return;
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    } catch (e) {
      console.warn("Web Audio API is not supported in this environment.", e);
    }
  },

  // Check if reduced motion / user preference disables autoplay / audio
  shouldPlay(): boolean {
    if (!this.enabled) return false;
    
    // Check if user prefers reduced motion (which can sometimes correlate with sensory overload)
    try {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mediaQuery.matches) {
        // We can still play sounds but keep them extra quiet or respect it
      }
    } catch (_) {}

    return true;
  }
};

export type SoundEffectType =
  | "message_sent"
  | "ai_response_start"
  | "success"
  | "error"
  | "file_uploaded"
  | "image_uploaded"
  | "image_generated"
  | "download_completed"
  | "notification_received"
  | "premium_modal_open"
  | "waitlist_joined"
  | "feedback_submitted"
  | "login_success"
  | "logout";

/**
 * Synthesizes a high-quality minimal, premium UI sound using native Web Audio API
 */
export function playUiSound(type: SoundEffectType) {
  // Respect User Settings toggle
  if (!soundManager.shouldPlay()) return;

  // Initialize AudioContext if not already done
  soundManager.init();
  const ctx = soundManager.audioCtx;
  if (!ctx) return;

  // Resume context if suspended (browser behavior)
  if (ctx.state === "suspended") {
    ctx.resume();
  }

  const destination: AudioNode = ctx.destination;
  const now = ctx.currentTime;

  // Main master gain node for consistent volume controls
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(soundManager.volume, now);
  masterGain.connect(destination);

  switch (type) {
    case "message_sent": {
      // 💬 Message sent: A subtle, soft upward chirp (two rapid sliding notes)
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      // Starts soft at 420Hz, rises to 560Hz
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(560, now + 0.08);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.35, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }

    case "ai_response_start": {
      // ✨ AI response begins: A delicate, warm sparkling chime
      // Play two soft high-pitched sine notes that decay slowly for a shimmer effect
      const playChimeNote = (freq: number, delay: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + delay);

        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(0.18, now + delay + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + dur + 0.05);
      };

      // Play a beautiful minor/major 7th sparkling interval (E6 and G#6)
      playChimeNote(1318.51, 0, 0.4); // E6
      playChimeNote(1661.22, 0.04, 0.5); // G#6
      break;
    }

    case "success": {
      // ✅ Success actions: A warm, harmonious perfect fifth chord
      const playNote = (freq: number, delay: number, volumeFactor: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + delay);

        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(0.22 * volumeFactor, now + delay + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.35);
      };

      // Harmony of C5 (523Hz) and G5 (784Hz)
      playNote(523.25, 0, 1.0);
      playNote(783.99, 0.06, 0.85);
      break;
    }

    case "error": {
      // ❌ Error actions: Two soft, low-pitched gentle alert pulses
      const playPulse = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        // Triangle wave is softer and warmer than sawtooth/square, perfect for errors without being harsh
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, startTime);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.01);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      playPulse(145, now, 0.12);
      playPulse(125, now + 0.09, 0.15);
      break;
    }

    case "file_uploaded": {
      // 📄 File uploaded: A clean, gentle bubbly "pop" chime
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(510, now + 0.06);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }

    case "image_uploaded": {
      // 🖼 Image uploaded: Bubbly chime with a sweet secondary higher harmonic
      const playTone = (freqStart: number, freqEnd: number, delay: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freqStart, now + delay);
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + 0.08);

        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(vol, now + delay + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.1);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.12);
      };

      playTone(380, 620, 0, 0.25);
      playTone(760, 1240, 0.015, 0.12); // subtle double octave harmonic
      break;
    }

    case "image_generated": {
      // 🎨 Image generated: A premium, progressive sparkling triad arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (C Major)
      notes.forEach((freq, idx) => {
        const delay = idx * 0.06;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + delay);

        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(0.18, now + delay + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.4);
      });
      break;
    }

    case "download_completed": {
      // 📥 Download completed: A clean octave-jump ascent
      const playNote = (freq: number, startTime: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(vol, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.25);
      };

      playNote(392.0, now, 0.2); // G4
      playNote(783.99, now + 0.08, 0.22); // G5 (octave jump)
      break;
    }

    case "notification_received": {
      // 🔔 Notification received: A warm, ambient dual-tone major-third "ping"
      const playTone = (freq: number, delay: number, vol: number) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + delay);

        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(vol, now + delay + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.45);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.5);
      };

      // Harmony of C5 (523Hz) and E5 (659Hz)
      playTone(523.25, 0, 0.2);
      playTone(659.25, 0.02, 0.15);
      break;
    }

    case "premium_modal_open": {
      // ⭐ Premium modal opens: A majestic, shimmering ambient chord (Major 7th feel)
      const freqs = [329.63, 493.88, 659.25, 987.77]; // E4, B4, E5, B5
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        // Slow attack for luxury, soft swelling feel
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.12, now + 0.12);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now);
        osc.stop(now + 1.1);
      });
      break;
    }

    case "waitlist_joined": {
      // 🎉 Waitlist joined: A mini celebratory ascending ripple
      const notes = [523.25, 587.33, 659.25, 783.99, 1046.5]; // C5, D5, E5, G5, C6 (C Major pentatonic pentad)
      notes.forEach((freq, idx) => {
        const delay = idx * 0.045;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + delay);

        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(0.15, now + delay + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.3);
      });
      break;
    }

    case "feedback_submitted": {
      // 💬 Feedback submitted: A bright, cheerful ascending swoosh
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.15);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gainNode);
      gainNode.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.22);
      break;
    }

    case "login_success": {
      // 👤 Login successful: A warm, welcoming major chord swell
      const freqs = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 (C Major)
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.08); // brief swell
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.65);
      });
      break;
    }

    case "logout": {
      // 🚪 Logout: A warm, descending warm chime
      const freqs = [392.00, 329.63, 261.63]; // G4, E4, C4
      freqs.forEach((freq, idx) => {
        const delay = idx * 0.07;
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + delay);

        gainNode.gain.setValueAtTime(0, now + delay);
        gainNode.gain.linearRampToValueAtTime(0.18, now + delay + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.35);
      });
      break;
    }
  }
}
