import React, { useEffect, useState } from "react";
import {
  Settings,
  X,
  Power,
  Mic,
  Cpu,
  Info,
  Check,
  AlertTriangle,
  Volume2,
  Sparkles,
  Monitor,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  ElysiaSettings,
  DEFAULT_SETTINGS,
  GEMINI_VOICES,
  loadSettings,
  saveSettings,
} from "../lib/settingsStore";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current settings (owned by App so wake-word state stays in sync). */
  settings: ElysiaSettings;
  /** Persist a settings patch (also notifies App of changes). */
  onChange: (patch: Partial<ElysiaSettings>) => void;
  themeColor: string;
  /** Called when voice changes — triggers reconnect with new voice. */
  onVoiceChange?: (voice: string) => void;
}

type SettingsTab = "general" | "voice" | "system" | "about";

// Extracted Toggle Component for consistent styling
function ToggleRow({ 
  label, 
  description, 
  checked, 
  onChange 
}: { 
  label: string; 
  description?: string; 
  checked: boolean; 
  onChange: (v: boolean) => void 
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition">
      <div>
        <div className="text-sm font-display text-white">{label}</div>
        {description && (
          <div className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-wider">
            {description}
          </div>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? 'bg-cyan-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsPanel({ isOpen, onClose, settings, onChange, themeColor, onVoiceChange }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [agentHealth, setAgentHealth] = useState<{
    online: boolean;
    toolCount?: number;
    cpu?: string;
    ram?: string;
  }>({ online: false });

  // Enumerate microphones (mirrors how audio.ts grabs getUserMedia).
  useEffect(() => {
    if (!isOpen) return;
    const enumerate = async () => {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMics(devices.filter((d) => d.kind === "audioinput"));
      } catch {
        /* permission may be needed first */
      }
    };
    enumerate();
  }, [isOpen]);

  // Probe desktop agent health (port 8765) via the server-side logs/health proxy.
  useEffect(() => {
    if (!isOpen) return;
    const probe = async () => {
      try {
        // Re-use the local agent directly (same machine, same browser).
        const res = await fetch("http://127.0.0.1:8765/health", { cache: "no-store" });
        if (!res.ok) {
          setAgentHealth({ online: false });
          return;
        }
        const data = await res.json();
        setAgentHealth({ online: true, toolCount: data.tool_count });
      } catch {
        // Cross-origin may fail; try the server proxy as a fallback.
        try {
          const res2 = await fetch("/api/agent-health", { cache: "no-store" });
          if (res2.ok) {
            const d = await res2.json();
            setAgentHealth({ online: !!d.online, toolCount: d.tool_count });
            return;
          }
        } catch {
          /* ignore */
        }
        setAgentHealth({ online: false });
      }
    };
    probe();
    const id = setInterval(probe, 5000);
    return () => clearInterval(id);
  }, [isOpen]);

  const getThemeBadgeGlow = () => {
    return "border-white/10 text-white bg-white/5";
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: "general", label: "GENERAL", icon: Power },
    { id: "voice", label: "VOICE", icon: Mic },
    { id: "system", label: "SYSTEM", icon: Cpu },
    { id: "about", label: "ABOUT", icon: Info },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay — identical to MemoryDashboard */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 z-40 backdrop-blur-sm"
          />

          {/* Slide-over Container */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-y-0 right-0 w-full max-w-md bg-white/[0.05] border-l border-white/15 backdrop-blur-3xl z-50 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${getThemeBadgeGlow()}`}>
                  <Settings size={22} className={activeTab === "system" ? "animate-spin" : ""} style={{ animationDuration: '4s' }} />
                </div>
                <div>
                  <h3 className="font-display font-medium text-lg tracking-tight text-white flex items-center gap-2">
                    Elysia Core Config
                    <Sparkles size={14} className="text-cyan-400" />
                  </h3>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400 mt-0.5">
                    System Parameters
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/15 bg-black/10">
              <button
                onClick={() => setActiveTab("general")}
                className={`flex-1 py-4 text-[10px] font-mono tracking-wider uppercase transition cursor-pointer ${
                  activeTab === "general"
                    ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab("voice")}
                className={`flex-1 py-4 text-[10px] font-mono tracking-wider uppercase transition cursor-pointer ${
                  activeTab === "voice"
                    ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                Voice
              </button>
              <button
                onClick={() => setActiveTab("system")}
                className={`flex-1 py-4 text-[10px] font-mono tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === "system"
                    ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Monitor size={12} />
                Agent
                {!agentHealth.online && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse ml-1" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("about")}
                className={`flex-1 py-4 text-[10px] font-mono tracking-wider uppercase transition cursor-pointer ${
                  activeTab === "about"
                    ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                About
              </button>
            </div>

            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* ---------------- GENERAL ---------------- */}
              {activeTab === "general" && (
                <div className="space-y-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    Startup &amp; Appearance
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase">
                      Cinematic Background
                    </label>
                    <select
                      value={settings.backgroundVideo}
                      onChange={(e) => onChange({ backgroundVideo: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white font-mono focus:outline-none focus:border-cyan-400/50 transition cursor-pointer appearance-none"
                    >
                      <option className="bg-slate-900 text-white" value="">Dynamic CSS Mesh (Default)</option>
                      <option className="bg-slate-900 text-white" value="solid">Solid Theme Color</option>
                      <option className="bg-slate-900 text-white" value="bg-6.mp4">Cinematic Scene (1)</option>
                      <option className="bg-slate-900 text-white" value="bg-7.mp4">Cinematic Scene (2)</option>
                    </select>
                    <span className="text-[8px] text-slate-500 uppercase font-mono">
                      Select a premium looping background video
                    </span>
                  </div>

                  <ToggleRow
                    label="LAUNCH AT STARTUP"
                    description="Start Elysia silently when Windows logs in"
                    checked={settings.autoStart}
                    onChange={(v) => {
                      onChange({ autoStart: v });
                      void fetch("/api/settings", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ autoStart: v }),
                      }).catch(() => {});
                    }}
                  />

                  <ToggleRow
                    label="UI ANIMATIONS"
                    description="Enable motion and orb transitions"
                    checked={settings.animations}
                    onChange={(v) => onChange({ animations: v })}
                  />

                  {settings.autoStart && (
                    <div className="mt-2 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-2">
                      <Check size={14} className="text-emerald-400 shrink-0" />
                      <span className="text-[10px] font-mono text-emerald-300/80">
                        Elysia will auto-launch on next Windows login.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* ---------------- VOICE ---------------- */}
              {activeTab === "voice" && (
                <div className="space-y-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    Voice &amp; Microphone
                  </div>

                  {/* Voice Character Selector */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase">
                      Voice Character
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {GEMINI_VOICES.map((v) => {
                        const active = settings.voice === v.id;
                        return (
                          <button
                            key={v.id}
                            onClick={() => {
                              onChange({ voice: v.id });
                              onVoiceChange?.(v.id);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              active
                                ? "border-cyan-400 bg-cyan-400/10"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <div className={`text-[10px] font-mono font-bold ${active ? "text-cyan-300" : "text-slate-300"}`}>
                              {v.label}
                            </div>
                            <div className="text-[8px] font-mono text-slate-500 mt-0.5">
                              {v.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[8px] text-slate-500 uppercase font-mono">
                      Changes require reconnecting the voice session
                    </span>
                  </div>

                  <ToggleRow
                    label="WAKE WORD"
                    description="Always-listen for the activation phrase"
                    checked={settings.wakeWordEnabled}
                    onChange={(v) => onChange({ wakeWordEnabled: v })}
                  />

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase">
                      Wake Phrase
                    </label>
                    <input
                      type="text"
                      value={settings.wakePhrase}
                      onChange={(e) => onChange({ wakePhrase: e.target.value })}
                      placeholder="hey elysia"
                      className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white font-mono focus:outline-none focus:border-cyan-400/50 transition"
                    />
                    <span className="text-[8px] text-slate-500 uppercase font-mono">
                      Say this phrase to activate Elysia
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase">
                      Microphone
                    </label>
                    <select
                      value={settings.micDeviceId}
                      onChange={(e) => onChange({ micDeviceId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white font-mono focus:outline-none focus:border-cyan-400/50 transition cursor-pointer"
                    >
                      <option value="">System Default</option>
                      {mics.map((m, i) => (
                        <option key={m.deviceId || i} value={m.deviceId}>
                          {m.label || `Microphone ${i + 1}`}
                        </option>
                      ))}
                    </select>
                    <span className="text-[8px] text-slate-500 uppercase font-mono">
                      {mics.length === 0
                        ? "Grant mic permission to list devices"
                        : `${mics.length} device(s) detected`}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-mono tracking-wider text-slate-300 uppercase">
                        Sensitivity
                      </label>
                      <span className="text-[10px] font-mono text-cyan-300">
                        {settings.sensitivity}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={settings.sensitivity}
                      onChange={(e) => onChange({ sensitivity: Number(e.target.value) })}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                    <span className="text-[8px] text-slate-500 uppercase font-mono">
                      Higher = faster re-arm &amp; more matches
                    </span>
                  </div>
                </div>
              )}

              {/* ---------------- SYSTEM ---------------- */}
              {activeTab === "system" && (
                <div className="space-y-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    Desktop Control Agent
                  </div>

                  <div
                    className={`p-4 rounded-xl border flex items-center gap-3 ${
                      agentHealth.online
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-rose-500/20 bg-rose-500/5"
                    }`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        agentHealth.online ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                      }`}
                    />
                    <div className="flex-1">
                      <div className="text-xs font-mono text-white">
                        {agentHealth.online ? "Agent Online" : "Agent Offline"}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {agentHealth.online
                          ? `${agentHealth.toolCount ?? 0} tools registered`
                          : "Start the Python agent on port 8765"}
                      </div>
                    </div>
                    <Cpu size={16} className="text-slate-500" />
                  </div>

                  <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03] space-y-2 shadow-inner">
                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                      <Volume2 size={12} /> Capabilities
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-300">
                      <span>✓ App control</span>
                      <span>✓ Browser</span>
                      <span>✓ Volume</span>
                      <span>✓ Brightness</span>
                      <span>✓ Power</span>
                      <span>✓ Files</span>
                      <span>✓ Screenshot</span>
                      <span>✓ Clipboard</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- ABOUT ---------------- */}
              {activeTab === "about" && (
                <div className="space-y-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                    About Elysia
                  </div>

                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3 shadow-inner">
                    <div className="flex items-center gap-2">
                      <Info size={14} className="text-cyan-400" />
                      <span className="text-sm font-display text-white">ELYSIA AI Assistant</span>
                    </div>
                    <div className="space-y-1.5 text-[10px] font-mono text-slate-400">
                      <div className="flex justify-between">
                        <span>VERSION</span>
                        <span className="text-slate-300">V2.0.0</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ENGINE</span>
                        <span className="text-slate-300">Gemini Live</span>
                      </div>
                      <div className="flex justify-between">
                        <span>DESKTOP</span>
                        <span className="text-slate-300">FastAPI Agent</span>
                      </div>
                      <div className="flex justify-between">
                        <span>WAKE WORD</span>
                        <span className="text-slate-300">Web Speech API</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-amber-500/15 bg-amber-500/5 flex items-start gap-2">
                    <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-[10px] font-mono text-amber-300/70 leading-relaxed">
                      Keep this tab active for wake-word detection. Microphone access
                      is required for voice activation.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer status bar */}
            <div className="px-6 py-4 border-t border-gray-100 bg-zinc-50 flex items-center justify-between">
              <span className="text-[11px] font-sans text-zinc-500">
                Preferences auto-save
              </span>
              <span className="text-[11px] font-sans font-medium text-zinc-400">
                Elysia V2
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
