/**
 * ELYSIA Settings Store — persistent user preferences (V2).
 *
 * Establishes the persistence pattern for ELYSIA: settings are mirrored to
 * localStorage (instant local read) AND synced to the backend (settings.json)
 * so auto-start / wake-word preferences survive across browsers and the
 * Python desktop agent can read them too.
 *
 * Pattern follows the existing codebase conventions: plain state + ref mirrors.
 * No Context/Zustand — this is deliberately lightweight to match audio.ts/memoryTypes.ts.
 */

export interface ElysiaSettings {
  /** Launch ELYSIA (backends + browser tab) silently on Windows login. */
  autoStart: boolean;
  /** Enable the always-listening wake-word detector. */
  wakeWordEnabled: boolean;
  /** Phrase that activates ELYSIA (case-insensitive substring match). */
  wakePhrase: string;
  /** Preferred microphone device id ("" = system default). */
  micDeviceId: string;
  /** Wake-word sensitivity: 0 (strict) .. 100 (loose). Affects debounce window. */
  sensitivity: number;
  /** Master toggle for UI animations. */
  animations: boolean;
  /** Selected Gemini Live voice name. */
  voice: string;
}

export const GEMINI_VOICES = [
  { id: "Aoede", label: "Aoede (Default)", desc: "Warm and natural" },
  { id: "Charon", label: "Charon", desc: "Deep and authoritative" },
  { id: "Fenrir", label: "Fenrir", desc: "Bold and confident" },
  { id: "Kore", label: "Kore", desc: "Soft and gentle" },
  { id: "Leda", label: "Leda", desc: "Calm and composed" },
  { id: "Puck", label: "Puck", desc: "Energetic and playful" },
  { id: "Zephyr", label: "Zephyr", desc: "Light and breezy" },
] as const;

export const DEFAULT_SETTINGS: ElysiaSettings = {
  autoStart: false,
  wakeWordEnabled: false,
  wakePhrase: "hey elysia",
  micDeviceId: "",
  sensitivity: 60,
  animations: true,
  voice: "Aoede",
};

const STORAGE_KEY = "elysia.settings.v2";

/** Settings keys that the browser should never persist (security). */
const NEVER_PERSIST: ReadonlySet<keyof ElysiaSettings> = new Set([]);

/**
 * Load settings from localStorage, merged over defaults so new keys always
 * have a sane value even when an older payload is present.
 */
export function loadSettings(): ElysiaSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ElysiaSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Persist a full or partial settings update to localStorage.
 * Returns the fully merged settings object.
 */
export function saveSettings(patch: Partial<ElysiaSettings>): ElysiaSettings {
  const current = loadSettings();
  const next: ElysiaSettings = { ...current, ...patch };
  if (typeof window !== "undefined") {
    try {
      // Strip any sensitive keys before writing to localStorage.
      const safe: Record<string, unknown> = {};
      (Object.keys(next) as (keyof ElysiaSettings)[]).forEach((k) => {
        if (!NEVER_PERSIST.has(k)) safe[k] = next[k];
      });
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    } catch {
      /* localStorage may be unavailable (private mode) — fail silently. */
    }
  }
  // Best-effort sync to backend so the Python agent can read auto-start state.
  void syncSettingsToBackend(next).catch(() => {});
  return next;
}

/** Push settings to the backend (server.ts persists to settings.json). */
async function syncSettingsToBackend(settings: ElysiaSettings): Promise<void> {
  try {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
  } catch {
    /* Backend may be briefly unavailable during boot — non-fatal. */
  }
}
