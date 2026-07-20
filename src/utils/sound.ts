/**
 * Offline-ready Synthesized Audio alert alerts for סידור-נועה
 * Uses the Web Audio API to play responsive, highly polished synthetic chimes.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();
  }
  // Resume context if it was suspended (browser security policy)
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export type SoundType = "success" | "error" | "info" | "sync";

export function playNotificationSound(type: SoundType) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const time = ctx.currentTime;

    if (type === "success") {
      // Pleasant high-pitch arpeggio chime (C5 -> E5 -> G5 -> C6)
      const freqs = [523.25, 659.25, 783.99, 1046.50];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time + idx * 0.08);

        gainNode.gain.setValueAtTime(0, time + idx * 0.08);
        gainNode.gain.linearRampToValueAtTime(0.12, time + idx * 0.08 + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.08 + 0.4);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(time + idx * 0.08);
        osc.stop(time + idx * 0.08 + 0.5);
      });
    } else if (type === "error") {
      // Urgent double-beep or warning chord (low, minor frequency dissonance)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.type = "triangle";
      osc2.type = "sawtooth";

      osc1.frequency.setValueAtTime(150, time);
      osc2.frequency.setValueAtTime(155, time); // Dissonant beating effect

      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(0.15, time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.45);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + 0.5);
      osc2.stop(time + 0.5);
    } else if (type === "info") {
      // A soft, polite tech-chime (A4 -> E5)
      const freqs = [440.00, 659.25];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, time + idx * 0.12);

        gainNode.gain.setValueAtTime(0, time + idx * 0.12);
        gainNode.gain.linearRampToValueAtTime(0.1, time + idx * 0.12 + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + idx * 0.12 + 0.35);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(time + idx * 0.12);
        osc.stop(time + idx * 0.12 + 0.45);
      });
    } else if (type === "sync") {
      // High-tech sweeping upward sound (represents fast data uploading/synchronization)
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(300, time);
      osc.frequency.exponentialRampToValueAtTime(1200, time + 0.5);

      gainNode.gain.setValueAtTime(0, time);
      gainNode.gain.linearRampToValueAtTime(0.15, time + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.6);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.65);
    }
  } catch (err) {
    console.warn("Audio Context could not play sound (e.g. requires user interaction first):", err);
  }
}
