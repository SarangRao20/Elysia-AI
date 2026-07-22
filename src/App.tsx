import { useState, useRef, useEffect } from "react";
import { LiveState, ElysiaAudioSession } from "./lib/audio";
import { ElysiaCoreVisualizer, type ElysiaEmotion } from "./components/ElysiaCoreVisualizer";
import { type ElysiaSettings, saveSettings, loadSettings } from "./lib/settingsStore";
import type { Memory, MemoryCategory } from "./lib/memoryTypes";
import { ElysiaWakeWordDetector } from "./lib/wakeWord";
import { BrowserAgent } from "./components/BrowserAgent";
import { MemoryDashboard } from "./components/MemoryDashboard";
import { TranscriptPanel } from "./components/TranscriptPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { useToast, ToastContainer } from "./components/Toast";
import { SudoPopup } from "./components/SudoPopup";
import { TextChatFallback } from "./components/TextChatFallback";
import { motion, AnimatePresence } from "motion/react";
import {
  Compass,
  Brain,
  Monitor,
  Settings as SettingsIcon,
  Globe,
  Maximize2,
  X,
  CircleAlert,
  Power,
  Mic,
  Volume2,
  Play,
  Pause,
  RefreshCw,
  Square,
} from "lucide-react";

export default function App() {
  const [settings, setSettings] = useState<ElysiaSettings>(loadSettings());
  const [state, setState] = useState<LiveState>("disconnected");

  // Real-time Screen Sharing states
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isScreenSharingPaused, setIsScreenSharingPaused] = useState<boolean>(false);
  const [screenVisionMode, setScreenVisionMode] = useState<boolean>(true);

  // Terminal output logs (tool execution results shown in UI)
  const [terminalLogs, setTerminalLogs] = useState<{ tool: string; args: any; output: string; time: number }[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const MAX_TERMINAL_LOGS = 50;

  // References to preserve state across intervals
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenIntervalRef = useRef<any>(null);

  const isPausedRef = useRef<boolean>(false);
  const screenVisionRef = useRef<boolean>(true);
  const stateRef = useRef<LiveState>("disconnected");

  // Sync state changes with refs to totally prevent stale closures in callbacks
  useEffect(() => {
    isPausedRef.current = isScreenSharingPaused;
  }, [isScreenSharingPaused]);

  useEffect(() => {
    screenVisionRef.current = screenVisionMode;
  }, [screenVisionMode]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Clean up streaming intervals on unmount
  useEffect(() => {
    return () => {
      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
    };
  }, []);

  const captureFrameAndSend = () => {
    const video = screenVideoRef.current;
    if (!video || isPausedRef.current || !screenVisionRef.current) {
      return;
    }

    if (stateRef.current === "disconnected") {
      return;
    }

    try {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;

      if (!screenCanvasRef.current) {
        screenCanvasRef.current = document.createElement("canvas");
      }
      const canvas = screenCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Restrict maximum resolution size to keep payload light for Gemini Live
      const maxDim = 960;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(video, 0, 0, width, height);

      // Highly compressed JPEG standard is optimized and preserves details perfectly
      const dataUrl = canvas.toDataURL("image/jpeg", 0.55);
      const base64 = dataUrl.split(",")[1];

      if (sessionRef.current && stateRef.current !== "disconnected") {
        sessionRef.current.sendVideoFrame(base64);
      }
    } catch (err) {
      console.error("[Screen Capture] Failed drawing frame to canvas:", err);
    }
  };

  const startScreenSharing = async () => {
    setErrorText(null);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 5 }
        },
        audio: false
      });

      screenStreamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(e => console.error("Video play warning:", e));
      screenVideoRef.current = video;

      setIsScreenSharing(true);
      setIsScreenSharingPaused(false);

      // Stop handling when native stop sharing bar button ends
      stream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };

      // Set up frame capture interval (one frame every 2 seconds is highly robust, preventing overload)
      if (screenIntervalRef.current) {
        clearInterval(screenIntervalRef.current);
      }
      screenIntervalRef.current = setInterval(() => {
        captureFrameAndSend();
      }, 2000);

      // Promptly capture first frame immediately
      setTimeout(() => {
        captureFrameAndSend();
      }, 500);

    } catch (e: any) {
      console.error("Screen sharing permission declined or missing API:", e);
      if (e.name !== "NotAllowedError") {
        setErrorText(`Could not capture screen: ${e.message || e}`);
      }
    }
  };

  const stopScreenSharing = () => {
    if (screenIntervalRef.current) {
      clearInterval(screenIntervalRef.current);
      screenIntervalRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      screenStreamRef.current = null;
    }

    if (screenVideoRef.current) {
      screenVideoRef.current.pause();
      screenVideoRef.current = null;
    }

    setIsScreenSharing(false);
    setIsScreenSharingPaused(false);
  };

  const pauseScreenSharing = () => {
    setIsScreenSharingPaused(true);
  };

  const resumeScreenSharing = () => {
    setIsScreenSharingPaused(false);
    // Refresh first frame immediately
    setTimeout(() => {
      captureFrameAndSend();
    }, 100);
  };

  const switchScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
    }
    await startScreenSharing();
  };

  const [activeEmotion, setActiveEmotion] = useState<ElysiaEmotion>("idle");
  const [themeColor, setThemeColor] = useState<string>("charcoal");
  const [userCaption, setUserCaption] = useState<string>("");
  const [characterState, setCharacterState] = useState<"idle" | "thinking" | "talking">("idle");

  const detectEmotionFromText = (text: string): ElysiaEmotion => {
    const lower = text.toLowerCase();
    if (lower.includes("haha") || lower.includes("lol") || lower.includes("funny") || lower.includes("joke") || lower.includes("hehe") || lower.includes("wink")) return "playful";
    if (lower.includes("happy") || lower.includes("harmony") || lower.includes("glad") || lower.includes("joy") || lower.includes("wonderful") || lower.includes("love") || lower.includes("smile")) return "happy";
    if (lower.includes("wow") || lower.includes("awesome") || lower.includes("excited") || lower.includes("amazing") || lower.includes("yay") || lower.includes("incredible") || lower.includes("hype")) return "excited";
    if (lower.includes("really?") || lower.includes("curious") || lower.includes("interest") || lower.includes("tell me more") || lower.includes("why") || lower.includes("how") || lower.includes("wonder")) return "curious";
    if (lower.includes("think") || lower.includes("calculat") || lower.includes("analyz") || lower.includes("hmmm") || lower.includes("process") || lower.includes("let me see") || lower.includes("conclude")) return "thinking";
    if (lower.includes("proud") || lower.includes("achieved") || lower.includes("expert") || lower.includes("skill") || lower.includes("confidence") || lower.includes("succeed")) return "proud";
    if (lower.includes("sad") || lower.includes("sorry") || lower.includes("unfortunate") || lower.includes("grief") || lower.includes("bad") || lower.includes("regret") || lower.includes("alas") || lower.includes("cry")) return "sad";
    if (lower.includes("shock") || lower.includes("surprise") || lower.includes("gasp") || lower.includes("unexpected") || lower.includes("seriously") || lower.includes("oh my")) return "surprised";
    if (lower.includes("blush") || lower.includes("shy") || lower.includes("embarrass") || lower.includes("nervous") || lower.includes("oops") || lower.includes("sorry about")) return "embarrassed";
    if (lower.includes("what?") || lower.includes("confus") || lower.includes("puzzled") || lower.includes("dont know") || lower.includes("not sure") || lower.includes("wait")) return "confused";
    return "idle";
  };
  const [modelCaption, setModelCaption] = useState<string>("");
  const [activeProjectorUrl, setActiveProjectorUrl] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Elysia Autopilot system controller state
  const [browserTrigger, setBrowserTrigger] = useState<{
    type: string;
    args: any;
    id: string;
    callback: (res: any) => void;
  } | null>(null);

  // Elysia recollections database core state
  const [memories, setMemories] = useState<Memory[]>([]);
  const [showMemoryDashboard, setShowMemoryDashboard] = useState<boolean>(false);

  // Transcript panel state
  const [showTranscriptPanel, setShowTranscriptPanel] = useState<boolean>(false);
  const [transcriptEntries, setTranscriptEntries] = useState<
    Array<{ id: string; timestamp: string; role: "user" | "model"; content: string; emotion?: string }>[]>();

  // Toast notifications
  const { toasts, addToast, dismiss } = useToast();
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const showSettingsRef = useRef<boolean>(false);
  useEffect(() => { showSettingsRef.current = showSettings; }, [showSettings]);

  // V2: Wake word detector instance (Web Speech API, lives for the app lifetime)
  const wakeDetectorRef = useRef<ElysiaWakeWordDetector | null>(null);
  // Ref indirection so the wake-word callback always calls the latest connect
  // handler, regardless of where it's declared in the component body.
  const connectHandlerRef = useRef<() => void>(() => {});

  // Initialize wake detector once on mount.
  useEffect(() => {
    const det = new ElysiaWakeWordDetector();
    wakeDetectorRef.current = det;
    return () => {
      det.stop();
    };
  }, []);

  // Start / stop wake word detection when the setting changes.
  useEffect(() => {
    const det = wakeDetectorRef.current;
    if (!det) return;
    if (settings.wakeWordEnabled && state === "disconnected") {
      det.start({
        phrase: settings.wakePhrase,
        sensitivity: settings.sensitivity,
        onTriggered: () => {
          // When wake word fires, stop detector and connect ELYSIA.
          det.stop();
          connectHandlerRef.current();
        },
      });
    } else {
      det.stop();
    }
  }, [settings.wakeWordEnabled, settings.wakePhrase, settings.sensitivity, state]);

  // Handle settings changes: persist to localStorage + update state.
  const handleSettingsChange = (patch: Partial<ElysiaSettings>) => {
    const next = saveSettings(patch);
    setSettings(next);
  };

  const sessionRef = useRef<ElysiaAudioSession | null>(null);

  // Fetch initial recollections from backend database
  useEffect(() => {
    fetch("/api/memories")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMemories(data);
        }
      })
      .catch(err => console.error("Initial persistent recollections load failure:", err));
  }, []);

  const handleAddManualMemory = async (category: MemoryCategory, text: string) => {
    try {
      const resp = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, text })
      });
      const saved = await resp.json();
      if (saved && saved.id) {
        setMemories((prev) => [...prev, saved]);
      }
    } catch (err) {
      console.error("Manual database recollect upload error:", err);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      const resp = await fetch(`/api/memories/${id}`, {
        method: "DELETE"
      });
      const resObj = await resp.json();
      if (resObj && resObj.success) {
        setMemories((prev) => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error("Manual memory delete execution failed:", err);
    }
  };

  // Initialize the audio session handlers once on mount
  useEffect(() => {
    sessionRef.current = new ElysiaAudioSession({
      onStateChange: (newState) => {
        setState(newState);
        if (newState === "disconnected") {
          // Reset captions on disconnect
          setUserCaption("");
          setModelCaption("");
          setActiveEmotion("idle");
          setCharacterState("idle");
        } else if (newState === "listening") {
          // Return to receptive resting state
          setActiveEmotion("idle");
          setCharacterState("idle");
        } else if (newState === "speaking") {
          setCharacterState("talking");
        }
      },
      onTranscription: (role, text) => {
        if (role === "user") {
          setUserCaption(text);
          // Auto-clear the other caption when user starts talking
          setModelCaption("");
          setCharacterState("thinking");
        } else if (role === "model") {
          setModelCaption((prev) => {
            const next = prev + text;
            const newEmotion = detectEmotionFromText(next);
            setActiveEmotion(newEmotion);
            return next;
          });
          // Clear user caption when model replies
          setUserCaption("");
        }
      },
      onToolCall: (name, args, callback) => {
        console.log(`[App] Tool call triggered: ${name}`, args);
        
        const browserTools = [
          "browserOpen",
          "browserSearch",
          "browserClick",
          "browserMediaControl",
          "browserScroll",
          "browserType",
          "browserGoBack",
          "browserTabAction",
          "openWebsite"
        ];

        if (browserTools.includes(name)) {
          // Bring up the Holographic Browser Controller if it is not active
          if (!activeProjectorUrl) {
            let startingUrl = "https://youtube.com";
            if ((name === "browserOpen" || name === "openWebsite") && args.url) {
              startingUrl = args.url;
            }
            setActiveProjectorUrl(startingUrl);
          }

          // Map instructions directly onto Browser Agent
          setBrowserTrigger({
            type: name === "openWebsite" ? "browserOpen" : name,
            args,
            id: Math.random().toString(),
            callback: (res) => {
              callback(res);
              setBrowserTrigger(null);
            }
          });
        } else if (name === "changeBackground") {
          const colorName = args.color?.toLowerCase();
          const validColors = ["violet", "crimson", "emerald", "celestial", "gold", "rose", "charcoal"];
          
          if (colorName && validColors.includes(colorName)) {
            setThemeColor(colorName);
            callback({ result: `Successfully shifted aesthetic atmosphere to ${colorName}.` });
          } else {
            callback({ error: `Unsupported color '${colorName}'. Supported themes are: ${validColors.join(", ")}` });
          }
        } else {
          callback({ error: `Tool ${name} is not implemented.` });
        }
      },
      onError: (err) => {
        setErrorText(err);
      },
      onMemorySync: (updatedMemories) => {
        console.log("[App] WebSocket memories sync triggered:", updatedMemories);
        if (Array.isArray(updatedMemories)) {
          setMemories(updatedMemories);
        }
      },
      onReminder: (text, id) => {
        console.log("[App] Reminder fired:", text);
        addToast(text, "reminder");
      },
      onTerminalOutput: (tool, args, output) => {
        setTerminalLogs(prev => {
          const next = [...prev, { tool, args, output, time: Date.now() }];
          return next.slice(-MAX_TERMINAL_LOGS);
        });
      }
    });

    return () => {
      if (sessionRef.current) {
        sessionRef.current.disconnect();
      }
    };
  }, []);

  const handleToggleConnection = async () => {
    setErrorText(null);
    if (!sessionRef.current) return;

    if (state === "disconnected") {
      await sessionRef.current.connect(settings.voice);
    } else {
      sessionRef.current.disconnect();
    }
  };
  // V2: keep the ref in sync so the wake-word callback calls this exact handler.
  connectHandlerRef.current = handleToggleConnection;

  // Minimal dark ambient styles for App container (letting Visualizer shine through)
  const getAmbientStyles = () => {
    return "from-black/40 via-transparent to-black/60";
  };

  const getThemeTextGlow = () => {
    switch (themeColor) {
      case "violet": return "text-purple-400 drop-shadow-[0_0_12px_rgba(168,85,247,0.5)]";
      case "crimson": return "text-rose-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]";
      case "emerald": return "text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]";
      case "celestial": return "text-sky-400 drop-shadow-[0_0_12px_rgba(14,165,233,0.5)]";
      case "gold": return "text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.5)]";
      case "rose": return "text-pink-400 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]";
      case "charcoal":
      default:
        return "text-indigo-400 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]";
    }
  };

  const getOrbRingColor = () => {
    switch (state) {
      case "listening": return "border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.3)] bg-indigo-500/10";
      case "speaking": return "border-purple-500/70 shadow-[0_0_40px_rgba(168,85,247,0.4)] bg-purple-500/10";
      case "connecting": return "border-amber-500/50 animate-pulse bg-amber-500/10";
      case "disconnected":
      default:
        return "border-white/10 hover:border-indigo-500/30 bg-white/5";
    }
  };

  return (
    <div
      id="elysia-holographic-desktop"
      className={`relative w-full h-screen overflow-hidden bg-[#020205] text-white bg-gradient-to-br ${getAmbientStyles()} theme-transition flex flex-col justify-between p-6 sm:p-10 select-none`}
    >
      {/* Decorative cinematic dust/stars (subtle) */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] z-0 mix-blend-screen" />

      {/* FULL VIEWPORT HOLOGRAPHIC STAGE: Elysia materializes across the entire screen */}
      <div className="absolute inset-0 z-0 pointer-events-none select-none">
        <ElysiaCoreVisualizer
          session={sessionRef.current}
          state={state}
          themeColor={themeColor}
          activeEmotion={activeEmotion}
          characterState={characterState}
          backgroundVideo={settings.backgroundVideo}
        />
      </div>

      {/* Cinematic Auras Removed for White Background Compatibility */}
      {/* HEADER SECTION - Removed. Controls moved to floating dock. */}

      {/* CORE AVATAR AND VISUALS */}
      <main className="relative z-10 flex-1 w-full max-w-4xl mx-auto flex flex-col items-center justify-between py-6">
        
        {/* Holographic Projection Screen Widget (if website opened) */}
        <AnimatePresence>
          {activeProjectorUrl && (
            <div className="absolute inset-x-0 top-0 z-30 flex justify-center p-2">
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="flex items-center justify-between gap-4 p-3.5 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-3xl shadow-2xl w-full max-w-md"
              >
                <div className="flex items-center gap-3 overflow-hidden text-left">
                  <div className="p-2 ml-1 rounded-xl bg-white/10 text-white">
                    <Globe size={18} />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="text-xs font-bold font-sans tracking-wide text-white uppercase">Holographic Projection Broadcast</h4>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{activeProjectorUrl}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveProjectorUrl(activeProjectorUrl)}
                    className="p-2 rounded-xl bg-white/20 text-white hover:bg-white/30 transition shadow-sm border border-white/10"
                    title="View Frame"
                  >
                    <Maximize2 size={14} />
                  </button>
                  <button
                    onClick={() => setActiveProjectorUrl(null)}
                    className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Space Spacer to avoid head area */}
        <div className="h-10 sm:h-20" />

        {/* Cinematic dialogue layer overlay - Smooth, delicate text transitions with soft focus blur */}
        <div id="cinematic-subtitles" className="w-full max-w-3xl flex flex-col items-center justify-center text-center px-6 relative z-25 mt-auto mb-6 pointer-events-none min-h-[6rem]">
          <AnimatePresence mode="wait">
            {(() => {
              const textType = modelCaption 
                ? "model" 
                : userCaption 
                  ? "user" 
                  : "status";

              const activeText = modelCaption 
                ? modelCaption 
                : userCaption 
                  ? userCaption 
                  : state === "listening" 
                    ? "I am listening. Speak freely..." 
                    : state === "connecting" 
                      ? "Materializing presence links..." 
                      : "Connect memory core to awaken my voice.";

              return (
                <motion.div
                  key={textType}
                  initial={{ opacity: 0, y: 15, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -15, filter: "blur(6px)" }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center justify-center w-full py-4 px-8"
                >
                  {textType === "model" && (
                    <h2 className="text-xl sm:text-2xl font-light text-white leading-relaxed tracking-wide font-display max-w-2xl drop-shadow-[0_2px_20px_rgba(0,0,0,0.9)]">
                      {activeText}
                    </h2>
                  )}

                  {textType === "user" && (
                    <p className="text-cyan-300 font-mono text-sm sm:text-base tracking-wider flex items-center justify-center gap-2 drop-shadow-[0_1px_10px_rgba(0,0,0,0.85)] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_cyan]" />
                      <span>&ldquo;{activeText}&rdquo;</span>
                    </p>
                  )}

                  {textType === "status" && (
                    <span className="text-[10px] sm:text-xs uppercase tracking-[0.4em] font-medium text-slate-400 font-mono drop-shadow-md">
                      {activeText}
                    </span>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>

        {/* Interactive suggestions prompt guide */}
        <AnimatePresence>
          {showGuide && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="mt-6 p-5 rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-3xl max-w-md text-left w-full absolute z-40 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-center justify-between mb-3 text-white">
                <div className="flex items-center gap-1.5 font-display text-sm font-bold tracking-wide">
                  <Compass size={16} className="text-cyan-400" />
                  <span>PLAYFUL CORE SUGGESTIONS</span>
                </div>
                <button 
                  onClick={() => setShowGuide(false)}
                  className="text-slate-400 hover:text-white transition"
                >
                  <X size={14} />
                </button>
              </div>
              <p className="text-xs text-slate-300 mb-4 font-mono leading-relaxed">
                Elysia is equipped with dynamic visual modules and browser projectors. Here are clever triggers to try speaking aloud:
              </p>
              <div className="space-y-2 text-xs font-serif italic text-cyan-300">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer font-sans normal-case text-slate-200">
                  ⚡ &quot;Elysia, change atmosphere of your core to crimson&quot; <span className="text-[10px] font-mono text-cyan-500 block mt-0.5 font-bold">Shifts theme color background</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer font-sans normal-case text-slate-200">
                  ⚡ &quot;Open youtube.com on my screen please&quot; <span className="text-[10px] font-mono text-cyan-500 block mt-0.5 font-bold">Invokes browser projector panel</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition cursor-pointer font-sans normal-case text-slate-200">
                  ⚡ &quot;Tell me a witty joke and change background to gold&quot; <span className="text-[10px] font-mono text-cyan-500 block mt-0.5 font-bold">Combines tools & voice</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Error Banner */}
        <AnimatePresence>
          {errorText && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="mt-6 flex items-start gap-3 p-4 rounded-2xl border border-rose-300 bg-rose-50/80 backdrop-blur-xl max-w-md w-full text-left shadow-lg"
            >
              <CircleAlert className="text-rose-600 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-rose-700 font-mono">Core Error Protocol</h4>
                <p className="text-xs text-rose-600 mt-1 leading-relaxed font-bold">{errorText}</p>
                <button
                  onClick={() => setErrorText(null)}
                  className="mt-2 text-[10px] font-bold text-rose-500 underline font-mono uppercase hover:text-rose-700"
                >
                  Dismiss Code
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Dynamic Minimalist Waveform Visualizer */}
      <div className="relative z-20 flex items-center justify-center gap-1.5 h-12 w-44 mx-auto mb-4">
        {[12, 28, 16, 32, 20, 8].map((baseHeight, idx) => {
          let heightFactor = 0.35;
          if (state === "speaking") {
            heightFactor = 0.35 + Math.sin(Date.now() * 0.02 + idx * 0.9) * 0.65;
          } else if (state === "listening") {
            heightFactor = 0.2 + Math.sin(Date.now() * 0.01 + idx * 0.5) * 0.4;
          } else {
            heightFactor = idx % 2 === 0 ? 0.25 : 0.12;
          }
          const calculatedHeight = Math.max(4, baseHeight * heightFactor);

          return (
            <div
              key={idx}
              className={`w-1 rounded-full transition-all duration-300 ${
                state === "speaking" ? "bg-purple-500" : state === "listening" ? "bg-cyan-500" : "bg-slate-300"
              }`}
              style={{ height: `${calculatedHeight}px` }}
            />
          );
        })}
      </div>

      {/* INVISIBLE EDGE UI */}
      {/* Top Right Controls - Sleek Glass Pill */}
      <div className="absolute top-6 right-6 z-40">
        <div className="flex items-center p-1.5 gap-1 rounded-full border border-white/10 bg-black/40 backdrop-blur-3xl shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`p-2.5 rounded-full transition-all duration-300 ${
              showGuide ? "bg-white/15 text-white" : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Topics"
          >
            <Compass size={18} />
          </button>
          
          <div className="w-[1px] h-4 bg-white/10 mx-1" /> {/* Divider */}

          <button
            onClick={() => setShowMemoryDashboard(!showMemoryDashboard)}
            className={`p-2.5 rounded-full transition-all duration-300 ${
              showMemoryDashboard ? "bg-white/15 text-white" : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Recalls"
          >
            <Brain size={18} />
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" /> {/* Divider */}

          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className={`p-2.5 rounded-full transition-all duration-300 ${
              showTerminal ? "text-emerald-400 bg-emerald-500/20 shadow-[0_0_15px_rgba(52,211,153,0.4)]" : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Terminal Logs"
          >
            <Square size={14} />
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" /> {/* Divider */}

          <button 
            onClick={isScreenSharing ? stopScreenSharing : startScreenSharing}
            className={`p-2.5 rounded-full transition-all duration-300 ${
              isScreenSharing 
                ? "text-cyan-400 bg-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.4)]" 
                : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Screen Share"
          >
            <Monitor size={18} />
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" /> {/* Divider */}

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-full transition-all duration-300 ${
              showSettings
                ? "text-indigo-400 bg-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Settings"
          >
            <SettingsIcon size={18} className={showSettings ? "animate-spin [animation-duration:6s]" : ""} />
          </button>
        </div>
      </div>

      {/* Bottom Center Core Connection Orb */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-4">
        <button 
          onClick={handleToggleConnection}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-700 cursor-pointer backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.8)] ${
            state === "disconnected"
              ? "border border-white/20 text-slate-300 hover:text-white hover:scale-105 bg-black/40 hover:bg-white/10 hover:border-white/40"
              : state === "listening"
              ? "border border-cyan-400/50 text-cyan-300 hover:scale-105 bg-cyan-950/40 shadow-[0_0_30px_rgba(34,211,238,0.3)]"
              : state === "speaking"
              ? "border border-purple-400/50 text-purple-300 hover:scale-105 bg-purple-950/40 shadow-[0_0_30px_rgba(168,85,247,0.3)]"
              : "border border-amber-400/50 text-amber-400 animate-spin bg-black/40"
          }`}
          title={state === "disconnected" ? "Awake Elysia" : "Sleep core"}
        >
          {state === "disconnected" ? (
            <Power size={22} className="opacity-80" />
          ) : state === "connecting" ? (
            <div className="w-6 h-6 border-[2px] border-slate-300 border-t-transparent rounded-full animate-spin" />
          ) : state === "listening" ? (
            <Mic size={22} />
          ) : (
            <Volume2 size={22} />
          )}
        </button>
        
        {/* Quiet Reset Projection Anchor */}
        {(activeProjectorUrl || errorText) && (
          <button 
            onClick={() => {
              if (activeProjectorUrl) setActiveProjectorUrl(null);
              setErrorText(null);
            }}
            className="absolute right-[-50px] top-1/2 -translate-y-1/2 p-2 rounded-full text-slate-300 hover:text-slate-600 transition"
            title="Reset Screen Broadcasts"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Holographic Website frame projections */}
      <AnimatePresence>
        {activeProjectorUrl && (
          <BrowserAgent
            url={activeProjectorUrl}
            onClose={() => {
              setActiveProjectorUrl(null);
              setBrowserTrigger(null);
            }}
            actionTrigger={browserTrigger}
          />
        )}
      </AnimatePresence>

      {/* Dynamic Floating Glassmorphic Screen Sharing Control Hub */}
      <AnimatePresence>
        {isScreenSharing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 50 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.85, x: 50 }}
            className={`absolute bottom-6 md:bottom-10 right-6 md:right-10 z-50 w-72 p-4 rounded-3xl border ${
              isScreenSharingPaused 
                ? "border-amber-500/30 bg-black/50" 
                : "border-white/10 bg-black/50"
            } backdrop-blur-3xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden`}
          >
            {/* Header / Indicator */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isScreenSharingPaused ? "bg-amber-400" : "bg-cyan-400 animate-pulse shadow-[0_0_8px_cyan]"}`} />
                <span className="text-[10px] font-bold font-mono tracking-widest text-slate-200">
                  {isScreenSharingPaused ? "VISION PAUSED" : "VISION ACTIVE"}
                </span>
              </div>
              <button 
                onClick={stopScreenSharing}
                className="text-slate-400 hover:text-white transition-colors duration-150 p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                title="Stop Sharing"
              >
                <X size={14} />
              </button>
            </div>

            {/* Smart Video PIP Preview Holder */}
            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-900 border border-white/5 mb-3 flex items-center justify-center group select-none">
              <video
                ref={(el) => {
                  if (el && screenStreamRef.current && el.srcObject !== screenStreamRef.current) {
                    el.srcObject = screenStreamRef.current;
                    el.muted = true;
                    el.play().catch(err => console.log("Mini preview stream play issue:", err));
                  }
                }}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isScreenSharingPaused ? "opacity-30 blur-sm" : "opacity-90"
                }`}
                autoPlay
                playsInline
                muted
              />

              {isScreenSharingPaused && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[10px] uppercase tracking-widest font-mono text-amber-400 font-bold px-2 py-1 bg-amber-950/40 border border-amber-500/20 rounded-md">
                    Transmission Paused
                  </span>
                </div>
              )}
              
              {!isScreenSharingPaused && screenVisionMode && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-400/20 text-[9px] font-mono text-cyan-300">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                  <span>Streaming FPS: 0.5</span>
                </div>
              )}
            </div>

            {/* Quick Action Control Strip */}
            <div className="flex items-center justify-between gap-1.5 mb-2.5">
              {isScreenSharingPaused ? (
                <button
                  onClick={resumeScreenSharing}
                  className="flex-1 py-1.5 px-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 rounded-lg text-xs font-mono font-medium text-cyan-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Resume Streaming Feed"
                >
                  <Play size={10} />
                  <span>Resume</span>
                </button>
              ) : (
                <button
                  onClick={pauseScreenSharing}
                  className="flex-1 py-1.5 px-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg text-xs font-mono font-medium text-amber-300 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Pause Streaming Feed"
                >
                  <Pause size={10} />
                  <span>Pause</span>
                </button>
              )}

              <button
                onClick={switchScreenShare}
                className="py-1.5 px-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-mono text-slate-300 hover:text-white flex items-center justify-center gap-1 transition-all cursor-pointer"
                title="Choose Another Screen or Window"
              >
                <RefreshCw size={11} />
                <span>Switch</span>
              </button>

              <button
                onClick={stopScreenSharing}
                className="py-1.5 px-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg text-xs font-mono text-rose-400 flex items-center justify-center gap-1 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                title="Terminate Stream"
              >
                <Square size={9} />
                <span>Stop</span>
              </button>
            </div>

            {/* Core Mode Configuration Toggle */}
            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-left">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold font-mono text-slate-200">SCREEN VISION MODE</span>
                <span className="text-[8px] text-slate-400 uppercase font-mono max-w-[150px]">Gemini Auto-Analysis</span>
              </div>
              <button
                onClick={() => setScreenVisionMode(!screenVisionMode)}
                className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  screenVisionMode ? "bg-cyan-500" : "bg-white/10"
                }`}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${
                    screenVisionMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recollections sliding core panel */}
      <MemoryDashboard
        isOpen={showMemoryDashboard}
        onClose={() => setShowMemoryDashboard(false)}
        memories={memories}
        onAddMemory={handleAddManualMemory}
        onDeleteMemory={handleDeleteMemory}
        themeColor={themeColor}
      />

  {/* V2: Add transcription panel for contextual awareness */}
      <TranscriptPanel
        entries={transcriptEntries || []}
        isOpen={showTranscriptPanel}
        onClose={() => setShowTranscriptPanel(false)}
        onEntriesChange={setTranscriptEntries}
        onSelectionChange={() => {}}
      />

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <SettingsPanel
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            settings={settings}
            onChange={handleSettingsChange}
            themeColor={themeColor}
          />
        )}
      </AnimatePresence>

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      {/* Sudo Confirmation Popup */}
      <SudoPopup />

      {/* Text Chat Fallback — placeholder for future offline text input */}
      <TextChatFallback
        isActive={false}
        onClose={() => {}}
        onMessageSubmit={() => {}}
        systemStatus={{
          state: state === "disconnected" ? "disconnected" : "connected",
          transcriptCount: transcriptEntries?.length || 0,
          timestamp: new Date().toISOString(),
        }}
      />

      {/* Terminal Output Panel */}
      <AnimatePresence>
        {showTerminal && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-2xl h-64 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
              <span className="text-[10px] font-mono font-bold text-emerald-400 tracking-widest">TERMINAL OUTPUT</span>
              <button onClick={() => setShowTerminal(false)} className="text-slate-500 hover:text-white p-1">
                <X size={12} />
              </button>
            </div>
            <div ref={terminalRef} className="h-[calc(100%-36px)] overflow-y-auto p-3 font-mono text-[11px] space-y-1.5">
              {terminalLogs.length === 0 && (
                <div className="text-slate-600 italic text-center pt-8">Waiting for tool executions...</div>
              )}
              {terminalLogs.map((log, i) => (
                <div key={i} className="border-l-2 border-emerald-500/30 pl-2 py-0.5">
                  <span className="text-emerald-400">$ </span>
                  <span className="text-slate-300">{log.tool}</span>
                  <span className="text-slate-500 ml-1">{JSON.stringify(log.args)}</span>
                  <div className="text-slate-400 whitespace-pre-wrap break-all mt-0.5 text-[10px] opacity-80">
                    {log.output.length > 300 ? log.output.slice(0, 300) + '...' : log.output}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
