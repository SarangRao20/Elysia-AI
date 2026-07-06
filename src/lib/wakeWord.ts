/**
 * ELYSIA Wake Word Detector (V2).
 *
 * Uses the browser-native Web Speech API (webkitSpeechRecognition) for
 * continuous, always-listening keyword detection. Zero dependencies, runs
 * entirely in the ELYSIA browser tab.
 *
 * Design goals (per V2 spec):
 *   - Very low CPU: relies on the browser's native speech engine (no FFT loop).
 *   - Ignore random conversation: only the configured phrase triggers.
 *   - Prevent duplicate triggers: configurable debounce window.
 *   - Recover automatically after errors: auto-restart on onend/onerror.
 *   - Activation sound + state callback on detection.
 *
 * Public API:
 *   const det = new ElysiaWakeWordDetector();
 *   det.start({ phrase, sensitivity, onTriggered, onState });
 *   det.setPhrase("hey elysia");
 *   det.setSensitivity(60);
 *   det.stop();
 */

// --- Minimal typed shim for the unprefixed SpeechRecognition API -------------
// The browser types are not in the default lib, so we declare what we use.
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
    | SpeechRecognitionCtor
    | null;
}

export type WakeWordState = "stopped" | "listening" | "triggered" | "error";

export interface WakeWordOptions {
  /** Phrase to match (case-insensitive substring). */
  phrase: string;
  /** 0 (strict) .. 100 (loose). Higher = shorter debounce, more matches. */
  sensitivity?: number;
  /** Fired once when the phrase is detected. */
  onTriggered?: () => void;
  /** Fired whenever the detector state changes. */
  onState?: (state: WakeWordState) => void;
}

export class ElysiaWakeWordDetector {
  private recognition: SpeechRecognitionLike | null = null;
  private ctor: SpeechRecognitionCtor | null;
  private phrase = "hey elysia";
  private sensitivity = 60;
  private onTriggered: (() => void) | null = null;
  private onState: ((s: WakeWordState) => void) | null = null;

  /** True when the user intends the detector to be running. */
  private intended = false;
  /** True while the underlying recognition is actively listening. */
  private active = false;
  /** Guards against rapid double-fires of the same utterance. */
  private lastTrigger = 0;
  /** Debounce window (ms) — derived from sensitivity. */
  private debounceMs = 4000;
  /** Backoff for restart after repeated errors. */
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveErrors = 0;

  constructor() {
    this.ctor = getSpeechRecognitionCtor();
  }

  /** Whether this browser supports wake-word detection at all. */
  static isSupported(): boolean {
    return getSpeechRecognitionCtor() !== null;
  }

  /** Begin continuously listening. Safe to call repeatedly. */
  start(opts: WakeWordOptions): boolean {
    if (!this.ctor) {
      this.setState("error");
      return false;
    }
    this.phrase = (opts.phrase || "hey elysia").toLowerCase().trim();
    this.sensitivity = opts.sensitivity ?? this.sensitivity;
    this.onTriggered = opts.onTriggered ?? null;
    this.onState = opts.onState ?? null;
    // sensitivity 0..100 -> debounce 7000ms..1500ms (higher sens = faster re-arm)
    this.debounceMs = Math.round(7000 - (this.sensitivity / 100) * 5500);
    this.intended = true;
    this.consecutiveErrors = 0;
    this.launch();
    return true;
  }

  /** Fully stop listening and clear timers. */
  stop(): void {
    this.intended = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.teardown();
    this.setState("stopped");
  }

  /** Change the wake phrase live without a full restart. */
  setPhrase(phrase: string): void {
    this.phrase = (phrase || "hey elysia").toLowerCase().trim();
  }

  /** Change sensitivity live. */
  setSensitivity(value: number): void {
    this.sensitivity = Math.max(0, Math.min(100, value));
    this.debounceMs = Math.round(7000 - (this.sensitivity / 100) * 5500);
  }

  // --- internals --------------------------------------------------------

  private launch(): void {
    if (!this.ctor || !this.intended) return;
    this.teardown();
    try {
      const rec = new this.ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.maxAlternatives = 3;

      rec.onstart = () => {
        this.consecutiveErrors = 0;
        this.active = true;
        this.setState("listening");
      };

      rec.onresult = (e: any) => {
        // Inspect every alternative of every result since last fire.
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (!res) continue;
          for (let j = 0; j < res.length; j++) {
            const transcript = (res[j]?.transcript || "").toString().toLowerCase();
            if (transcript.includes(this.phrase)) {
              this.fire();
              return;
            }
          }
        }
      };

      rec.onerror = (e: any) => {
        const err = e?.error || "unknown";
        // "no-speech" / "aborted" are benign — just let onend restart.
        if (err === "no-speech" || err === "aborted") return;
        this.consecutiveErrors++;
        this.setState("error");
      };

      rec.onend = () => {
        this.active = false;
        if (!this.intended) return;
        // Auto-recover with exponential-ish backoff to avoid hammering on perm errors.
        const delay = Math.min(1000 * this.consecutiveErrors * 2, 15000);
        this.restartTimer = setTimeout(() => this.launch(), Math.max(150, delay));
      };

      this.recognition = rec;
      rec.start();
    } catch {
      this.setState("error");
      // Retry once shortly.
      this.restartTimer = setTimeout(() => this.launch(), 1000);
    }
  }

  private teardown(): void {
    if (this.recognition) {
      try {
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.onstart = null;
        this.recognition.abort();
      } catch {
        /* ignore */
      }
      this.recognition = null;
    }
    this.active = false;
  }

  private fire(): void {
    const now = Date.now();
    if (now - this.lastTrigger < this.debounceMs) return; // duplicate suppression
    this.lastTrigger = now;
    this.playActivationSound();
    this.setState("triggered");
    try {
      this.onTriggered?.();
    } catch {
      /* never let a handler error kill the detector */
    }
    // After triggering, the session may consume the mic; the browser usually
    // ends recognition. We re-arm on onend automatically while intended.
  }

  /** Soft two-tone chime synthesized via Web Audio (no asset needed). */
  private playActivationSound(): void {
    try {
      const Ctx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx: AudioContext = new Ctx();
      const now = ctx.currentTime;
      const notes = [
        { f: 660, t: 0 },
        { f: 880, t: 0.12 },
      ];
      notes.forEach(({ f, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, now + t);
        gain.gain.exponentialRampToValueAtTime(0.18, now + t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.2);
      });
      // Close the transient context after the notes finish.
      setTimeout(() => ctx.close().catch(() => {}), 600);
    } catch {
      /* audio is best-effort */
    }
  }

  private setState(s: WakeWordState): void {
    try {
      this.onState?.(s);
    } catch {
      /* ignore */
    }
  }

  /** Whether the underlying recognition is currently active. */
  get isActive(): boolean {
    return this.active;
  }
}
