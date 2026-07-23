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
    <div className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-gradient-to-r from-white/[0.02] to-transparent hover:border-cyan-500/30 hover:bg-cyan-950/20 transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
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
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none shadow-inner ${
          checked ? 'bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-slate-800'
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

  // Enumerate microphones
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

  // Probe desktop agent health
  useEffect(() => {
    if (!isOpen) return;
    const probe = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8765/health", { cache: "no-store" });
        if (!res.ok) {
          setAgentHealth({ online: false });
          return;
        }
        const data = await res.json();
        setAgentHealth({ online: true, toolCount: data.tool_count });
      } catch {
        try {
          const res2 = await fetch("/api/agent-health", { cache: "no-store" });
          if (res2.ok) {
            const d = await res2.json();
            setAgentHealth({ online: !!d.online, toolCount: d.tool_count });
            return;
          }
        } catch { }
        setAgentHealth({ online: false });
      }
    };
    probe();
    const id = setInterval(probe, 5000);
    return () => clearInterval(id);
  }, [isOpen]);

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: "general", label: "General", icon: Power },
    { id: "voice", label: "Voice & Audio", icon: Mic },
    { id: "system", label: "System Agent", icon: Cpu },
    { id: "about", label: "About Elysia", icon: Info },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 z-40 backdrop-blur-md"
          />

          {/* Centered macOS-style Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-5xl h-[80vh] max-h-[800px] bg-slate-950/70 border border-white/10 backdrop-blur-[60px] z-50 flex shadow-[0_0_150px_rgba(0,0,0,0.8)] overflow-hidden rounded-3xl ring-1 ring-white/10"
          >
            {/* LEFT SIDEBAR */}
            <div className="w-64 border-r border-white/10 bg-black/20 flex flex-col">
              {/* Sidebar Header */}
              <div className="p-6 pb-8 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl border border-white/10 bg-white/5">
                    <Settings size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-display font-medium text-lg tracking-tight text-white flex items-center gap-2">
                      Settings
                    </h3>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400 mt-0.5 flex items-center gap-1">
                      <Sparkles size={10} /> {settings.avatarStyle === "orb" ? "Aegis Core" : "Elysia Core"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sidebar Tabs */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        isActive
                          ? "bg-cyan-500/10 text-cyan-400 shadow-[inset_0_0_20px_rgba(6,182,212,0.1)] border border-cyan-500/20"
                          : "text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent"
                      }`}
                    >
                      <Icon size={16} className={isActive ? "text-cyan-400" : "text-slate-500"} />
                      {tab.label}
                      {tab.id === "system" && !agentHealth.online && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* RIGHT CONTENT PANE */}
            <div className="flex-1 flex flex-col bg-gradient-to-br from-white/[0.01] to-transparent">
              {/* Content Header */}
              <div className="px-10 py-8 flex items-center justify-between border-b border-white/5">
                <h2 className="text-2xl font-display text-white">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2.5 rounded-xl border border-white/5 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/30 text-slate-400 transition-all cursor-pointer group"
                >
                  <X size={20} className="group-hover:scale-110 transition-transform" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-10">
                <div className="max-w-2xl mx-auto space-y-10">
                  
                  {/* ---------------- GENERAL ---------------- */}
                  {activeTab === "general" && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      
                      <div className="space-y-3">
                        <label className="block text-xs font-mono tracking-widest text-cyan-400 uppercase">
                          Cinematic Background
                        </label>
                        <select
                          value={settings.backgroundVideo}
                          onChange={(e) => onChange({ backgroundVideo: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/50 transition cursor-pointer appearance-none shadow-inner"
                        >
                          <option className="bg-slate-900 text-white" value="">Dynamic CSS Mesh (Default)</option>
                          <option className="bg-slate-900 text-white" value="solid">Solid Theme Color</option>
                          <option className="bg-slate-900 text-white" value="bg-6.mp4">Cinematic Scene (1)</option>
                          <option className="bg-slate-900 text-white" value="bg-7.mp4">Cinematic Scene (2)</option>
                        </select>
                        <span className="text-[10px] text-slate-500 uppercase font-mono">
                          Select a premium looping background video
                        </span>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-xs font-mono tracking-widest text-cyan-400 uppercase">
                          System Integration
                        </label>
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
                        {settings.autoStart && (
                          <div className="mt-2 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
                            <Check size={16} className="text-emerald-400 shrink-0" />
                            <span className="text-xs font-mono text-emerald-300/80">
                              Elysia will auto-launch on next Windows login.
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <label className="block text-xs font-mono tracking-widest text-cyan-400 uppercase">
                          Interface
                        </label>
                        <ToggleRow
                          label="UI ANIMATIONS"
                          description="Enable fluid motion and orb transitions"
                          checked={settings.animations}
                          onChange={(v) => onChange({ animations: v })}
                        />
                      </div>
                    </div>
                  )}

                  {/* ---------------- VOICE ---------------- */}
                  {activeTab === "voice" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      
                      <div className="space-y-4">
                        <label className="block text-xs font-mono tracking-widest text-cyan-400 uppercase">
                          Avatar Presentation
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() => {
                              onChange({ avatarStyle: "character", voice: "Aoede" });
                              if (settings.voice !== "Aoede") onVoiceChange?.("Aoede");
                            }}
                            className={`p-4 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer ${
                              settings.avatarStyle === "character"
                                ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 text-slate-400"
                            }`}
                          >
                            <div className={`text-sm font-bold uppercase mb-1 ${settings.avatarStyle === "character" ? "text-cyan-300" : ""}`}>
                              Anime Character
                            </div>
                            <div className="text-[10px] font-mono opacity-60">Requires video assets</div>
                          </button>

                          <button
                            onClick={() => {
                              onChange({ avatarStyle: "orb", voice: "Charon" });
                              if (settings.voice !== "Charon") onVoiceChange?.("Charon");
                            }}
                            className={`p-4 rounded-xl border-2 text-center transition-all duration-300 cursor-pointer ${
                              settings.avatarStyle === "orb"
                                ? "border-cyan-500 bg-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 text-slate-400"
                            }`}
                          >
                            <div className={`text-sm font-bold uppercase mb-1 ${settings.avatarStyle === "orb" ? "text-cyan-300" : ""}`}>
                              Dynamic Fluid Orb
                            </div>
                            <div className="text-[10px] font-mono opacity-60">Gemini Live Style</div>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-xs font-mono tracking-widest text-cyan-400 uppercase">
                          Voice Synthesizer
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {GEMINI_VOICES.map((v) => {
                            const active = settings.voice === v.id;
                            return (
                              <button
                                key={v.id}
                                onClick={() => {
                                  onChange({ voice: v.id });
                                  onVoiceChange?.(v.id);
                                }}
                                className={`p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer ${
                                  active
                                    ? "border-cyan-500/50 bg-cyan-500/10 shadow-inner"
                                    : "border-white/10 bg-white/5 hover:bg-white/10"
                                }`}
                              >
                                <div className={`text-sm font-bold ${active ? "text-cyan-300" : "text-slate-200"}`}>
                                  {v.label}
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 mt-1">
                                  {v.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <span className="text-[10px] text-slate-500 uppercase font-mono">
                          Note: Changing voice requires reconnecting the session
                        </span>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-xs font-mono tracking-widest text-cyan-400 uppercase">
                          Audio Input
                        </label>
                        <ToggleRow
                          label="ALWAYS-LISTENING WAKE WORD"
                          description="Activate the agent by saying the wake phrase"
                          checked={settings.wakeWordEnabled}
                          onChange={(v) => onChange({ wakeWordEnabled: v })}
                        />

                        {settings.wakeWordEnabled && (
                          <div className="space-y-3 pt-2">
                            <label className="block text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                              Activation Phrase
                            </label>
                            <input
                              type="text"
                              value={settings.wakePhrase}
                              onChange={(e) => onChange({ wakePhrase: e.target.value })}
                              placeholder="hey elysia"
                              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white font-mono focus:outline-none focus:border-cyan-400/50 transition shadow-inner"
                            />
                          </div>
                        )}

                        <div className="space-y-3 pt-2">
                          <label className="block text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                            Hardware Source
                          </label>
                          <select
                            value={settings.micDeviceId}
                            onChange={(e) => onChange({ micDeviceId: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-white focus:outline-none focus:border-cyan-400/50 transition cursor-pointer appearance-none shadow-inner"
                          >
                            <option value="">System Default</option>
                            {mics.map((m, i) => (
                              <option key={m.deviceId || i} value={m.deviceId}>
                                {m.label || `Microphone ${i + 1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---------------- SYSTEM ---------------- */}
                  {activeTab === "system" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      
                      <div className="space-y-4">
                        <label className="block text-xs font-mono tracking-widest text-cyan-400 uppercase">
                          Desktop Control Agent
                        </label>
                        
                        <div
                          className={`p-6 rounded-2xl border-2 flex items-center gap-5 ${
                            agentHealth.online
                              ? "border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.1)]"
                              : "border-rose-500/30 bg-rose-500/10 shadow-[0_0_30px_rgba(244,63,94,0.1)]"
                          }`}
                        >
                          <div className="relative">
                            <div className={`w-4 h-4 rounded-full ${agentHealth.online ? "bg-emerald-400" : "bg-rose-400"}`} />
                            {agentHealth.online && (
                              <div className="absolute inset-0 w-4 h-4 rounded-full bg-emerald-400 animate-ping" />
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className={`text-lg font-bold ${agentHealth.online ? "text-emerald-300" : "text-rose-300"}`}>
                              {agentHealth.online ? "Backend Online & Connected" : "Backend Offline"}
                            </div>
                            <div className="text-sm font-mono text-slate-400 mt-1">
                              {agentHealth.online
                                ? `Active on port 8765. ${agentHealth.toolCount ?? 0} modules loaded.`
                                : "Please start the Python agent (uvicorn agent.server:app --port 8765)"}
                            </div>
                          </div>
                          <Cpu size={32} className={agentHealth.online ? "text-emerald-400/50" : "text-rose-400/50"} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="block text-xs font-mono tracking-widest text-cyan-400 uppercase">
                          Authorized Capabilities
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            "App Automation", "Chrome CDP", "System Volume", "Brightness Control",
                            "Power Actions", "File System", "Screen Vision", "Clipboard Access"
                          ].map((cap, i) => (
                            <div key={i} className="p-3 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-center text-center gap-2 text-[10px] font-mono text-slate-300">
                              <Check size={12} className="text-cyan-500" />
                              {cap}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---------------- ABOUT ---------------- */}
                  {activeTab === "about" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      
                      <div className="flex flex-col items-center justify-center p-10 text-center">
                        <div className="w-24 h-24 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                          <Sparkles size={40} className="text-cyan-400" />
                        </div>
                        <h1 className="text-3xl font-display text-white mb-2">
                          {settings.avatarStyle === "orb" ? "Aegis Core" : "Elysia Core"}
                        </h1>
                        <p className="text-sm font-mono text-slate-400 max-w-md">
                          Next-generation multimodal AI assistant engineered for deep desktop integration and organic conversation.
                        </p>
                      </div>

                      <div className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] shadow-inner">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                          <div className="flex justify-between items-center border-b border-white/5 pb-4">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Version</span>
                            <span className="text-sm font-bold text-slate-200">2.0.0 (Premium)</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-white/5 pb-4">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Core Engine</span>
                            <span className="text-sm font-bold text-cyan-300">Gemini Live API</span>
                          </div>
                          <div className="flex justify-between items-center border-b border-white/5 pb-4 md:border-0 md:pb-0">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Backend</span>
                            <span className="text-sm font-bold text-slate-200">FastAPI</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Frontend</span>
                            <span className="text-sm font-bold text-slate-200">React + Vite + Tailwind</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 flex items-start gap-4">
                        <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-amber-300">Microphone Required</h4>
                          <p className="text-xs font-mono text-amber-300/70 leading-relaxed">
                            Keep this application tab active for continuous wake-word detection. Hardware microphone access must be granted in your browser.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
