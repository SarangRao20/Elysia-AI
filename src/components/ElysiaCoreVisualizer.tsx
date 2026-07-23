import React, { useEffect, useRef, useState } from "react";
import { ElysiaAudioSession, LiveState } from "../lib/audio";
import { Sparkles } from "lucide-react";

export type ElysiaEmotion =
  | "idle"
  | "happy"
  | "excited"
  | "curious"
  | "thinking"
  | "proud"
  | "sad"
  | "confused"
  | "surprised"
  | "embarrassed"
  | "playful";

interface ElysiaCoreVisualizerProps {
  session: ElysiaAudioSession | null;
  state: LiveState;
  themeColor: string; // Violet, crimson, emerald, celestial, gold, rose, charcoal
  activeEmotion?: ElysiaEmotion;
  characterState: "idle" | "thinking" | "talking";
  backgroundVideo?: string;
  avatarStyle: "character" | "orb";
}

export const ElysiaCoreVisualizer: React.FC<ElysiaCoreVisualizerProps> = ({
  session,
  state,
  themeColor,
  activeEmotion = "idle",
  characterState,
  backgroundVideo,
  avatarStyle,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Video element refs for character state machine
  const idleVideoRef = useRef<HTMLVideoElement | null>(null);
  const thinkingVideoRef = useRef<HTMLVideoElement | null>(null);
  const talkingVideoRef = useRef<HTMLVideoElement | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);

  const handleVideoError = (videoName: string) => {
    console.warn(`[Elysia Web Video] Failed to load video source for: ${videoName}`);
    setHasError(true);
  };

  // Interaction and tracking references
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.4 });
  const targetMouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.4 });

  // Physics & Animation states
  const speechVolumeRef = useRef<number>(0);
  const glowRingRef = useRef<number>(0);
  const emotionFlashRef = useRef<number>(0);
  const lastEmotionRef = useRef<ElysiaEmotion>(activeEmotion);

  // Floating sci-fi background particle arrays
  const particlesRef = useRef<Array<{
    x: number;
    y: number;
    speed: number;
    size: number;
    opacity: number;
  }>>([]);

  // Synchronized video playback state manager (highly polished and flicker-free)
  useEffect(() => {
    const playVideo = (videoEl: HTMLVideoElement | null) => {
      if (!videoEl) return;
      try {
        videoEl.currentTime = 0;
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.warn("Autoplay block detected, retrying muted play:", error);
          });
        }
      } catch (err) { }
    };

    const pauseVideo = (videoEl: HTMLVideoElement | null) => {
      if (!videoEl) return;
      try {
        videoEl.pause();
      } catch (err) { }
    };

    if (characterState === "idle") {
      playVideo(idleVideoRef.current);
      pauseVideo(thinkingVideoRef.current);
      pauseVideo(talkingVideoRef.current);
    } else if (characterState === "thinking") {
      playVideo(thinkingVideoRef.current);
      pauseVideo(idleVideoRef.current);
      pauseVideo(talkingVideoRef.current);
    } else if (characterState === "talking") {
      playVideo(talkingVideoRef.current);
      pauseVideo(idleVideoRef.current);
      pauseVideo(thinkingVideoRef.current);
    }
  }, [characterState]);

  // Cursor position tracking hook
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      targetMouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  // Theme matching mapping function (extremely beautiful cinematic color tones)
  const getGlowColors = () => {
    switch (themeColor) {
      case "violet":
        return { primary: "rgba(147, 51, 234, 1)", secondary: "rgba(192, 38, 211, 0.8)", glow: "rgba(168, 85, 247, 0.7)" };
      case "crimson":
        return { primary: "rgba(225, 29, 72, 1)", secondary: "rgba(234, 88, 12, 0.8)", glow: "rgba(244, 63, 94, 0.7)" };
      case "emerald":
        return { primary: "rgba(5, 150, 105, 1)", secondary: "rgba(13, 148, 136, 0.8)", glow: "rgba(16, 185, 129, 0.7)" };
      case "celestial":
        return { primary: "rgba(2, 132, 199, 1)", secondary: "rgba(8, 145, 178, 0.8)", glow: "rgba(14, 165, 233, 0.7)" };
      case "gold":
        return { primary: "rgba(202, 138, 4, 1)", secondary: "rgba(217, 119, 6, 0.8)", glow: "rgba(234, 179, 8, 0.7)" };
      case "rose":
        return { primary: "rgba(219, 39, 119, 1)", secondary: "rgba(220, 38, 38, 0.8)", glow: "rgba(236, 72, 153, 0.7)" };
      default:
        return { primary: "rgba(34, 211, 238, 1)", secondary: "rgba(79, 70, 229, 0.8)", glow: "rgba(6, 182, 212, 0.7)" };
    }
  };

  // Main high speed Canvas graphics rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    // Generate responsive background floating stars
    const generateParticles = () => {
      const count = Math.min(60, Math.floor(width / 24));
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height + height * 0.1,
        speed: Math.random() * 0.35 + 0.12,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
      }));
    };

    generateParticles();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
      generateParticles();
    };

    window.addEventListener("resize", handleResize);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const systemTime = performance.now();
      const colors = getGlowColors();

      // Dynamic Audio analysis fetching from real voice session
      let audioLevel = 0;
      let bufferLength = 64;
      const dataArray = new Uint8Array(bufferLength);
      let activeAnalyser = null;

      if (state === "speaking" && session?.outputAnalyser) {
        activeAnalyser = session.outputAnalyser;
      } else if (state === "listening" && session?.inputAnalyser) {
        activeAnalyser = session.inputAnalyser;
      }

      if (activeAnalyser) {
        try {
          activeAnalyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          audioLevel = sum / bufferLength; // 0 to 255
        } catch (e) { }
      }

      // Smooth amplitude tracking for real-time particle excitation
      speechVolumeRef.current += (audioLevel / 255 - speechVolumeRef.current) * 0.2;

      // Emotion change flash (decays from 1 to 0)
      if (lastEmotionRef.current !== activeEmotion) {
        emotionFlashRef.current = 1;
        lastEmotionRef.current = activeEmotion;
      }
      emotionFlashRef.current *= 0.96;

      // Voice-reactive glow ring (smoothed)
      const targetRing = state === "speaking" ? speechVolumeRef.current * 1.2 : 0;
      glowRingRef.current += (targetRing - glowRingRef.current) * 0.15;

      // Cinematic ambient stardust sizing
      const baseScale = height / 440;
      const s = Math.max(0.95, Math.min(1.85, baseScale)); // scale multiplier

      // Smooth cursor mouse tracking lag
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.05;

      const centerX = width / 2;

      // ─── Holographic Canvas Effects ───────────────────────────────
      // Particles
      const pCount = particlesRef.current.length;
      for (let i = 0; i < pCount; i++) {
        const p = particlesRef.current[i];
        // Float upward slowly
        p.y -= p.speed;
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        // Sway gently
        p.x += Math.sin(systemTime * 0.001 + i) * 0.08;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        const alpha = p.opacity * (0.6 + 0.4 * Math.sin(systemTime * 0.002 + i * 0.5));
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }

      // Bottom glow ring (character pedestal light)
      const ringY = height - 40;
      const ringPulse = 1 + 0.02 * Math.sin(systemTime * 0.002);
      const ringAudioBoost = 1 + glowRingRef.current * 0.3;
      const ringRadius = width * 0.2 * ringPulse * ringAudioBoost;
      const gradient = ctx.createRadialGradient(centerX, ringY, 0, centerX, ringY, ringRadius);
      const c = colors;
      gradient.addColorStop(0, c.primary.replace('1)', '0.6)'));
      gradient.addColorStop(0.3, c.secondary.replace('0.8)', '0.25)'));
      gradient.addColorStop(0.7, c.glow.replace('0.7)', '0.08)'));
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, ringY - ringRadius, width, ringRadius + 20);

      // Thin bright ring line
      ctx.beginPath();
      ctx.ellipse(centerX, ringY, ringRadius * 0.9, 8 * ringPulse * ringAudioBoost, 0, 0, Math.PI * 2);
      ctx.strokeStyle = c.primary.replace('1)', `${0.15 + glowRingRef.current * 0.3})`);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Scanline holographic effect (subtle horizontal lines)
      ctx.fillStyle = 'rgba(0, 255, 255, 0.02)';
      const scanOffset = (systemTime * 0.03) % 6;
      for (let y = scanOffset; y < height; y += 6) {
        ctx.fillRect(0, y, width, 1);
      }

      // Vertical holographic faint grid lines
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.015)';
      ctx.lineWidth = 1;
      const vGridSpacing = width / 20;
      for (let x = 0; x < width; x += vGridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Radial light rays from bottom center
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + systemTime * 0.0001;
        const rayLen = ringRadius * (2 + 0.5 * Math.sin(systemTime * 0.001 + i));
        ctx.beginPath();
        ctx.moveTo(centerX, ringY);
        ctx.lineTo(
          centerX + Math.cos(angle) * rayLen,
          ringY + Math.sin(angle) * rayLen * 0.15
        );
        ctx.strokeStyle = `rgba(${i % 2 === 0 ? '150, 100, 255' : '100, 200, 255'}, ${0.03 + glowRingRef.current * 0.06})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [session, state, themeColor, activeEmotion, characterState]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* 1. Deep Immersive Cinematic Background (Z-index 0) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
        {/* Base dark space */}
        <div className={`absolute inset-0 transition-colors duration-1000 ${avatarStyle === 'orb' ? 'bg-[#080008]' : backgroundVideo === 'solid' ? (
            themeColor === 'violet' ? 'bg-[#0f0724]' :
              themeColor === 'crimson' ? 'bg-[#1a0508]' :
                themeColor === 'emerald' ? 'bg-[#04140d]' :
                  themeColor === 'celestial' ? 'bg-[#040f1a]' :
                    themeColor === 'gold' ? 'bg-[#1a1103]' :
                      themeColor === 'rose' ? 'bg-[#1a0611]' :
                        'bg-[#060814]'
          ) : 'bg-[#020205]'
          }`} />

        {/* Dynamic breathing nebula gradient (Hidden if video is solid) */}
        {backgroundVideo !== "solid" && avatarStyle !== "orb" && (
          <div className={`absolute w-[150vw] h-[150vh] rounded-full blur-[140px] opacity-40 bg-gradient-to-tr transition-all duration-1000 ease-in-out ${themeColor === "violet" ? "from-purple-900/50 via-violet-600/20 to-fuchsia-900/10" :
            themeColor === "crimson" ? "from-rose-900/50 via-red-600/20 to-orange-900/10" :
              themeColor === "emerald" ? "from-emerald-900/50 via-teal-600/20 to-emerald-900/10" :
                themeColor === "celestial" ? "from-sky-900/50 via-indigo-600/20 to-cyan-900/10" :
                  themeColor === "gold" ? "from-amber-900/50 via-yellow-600/20 to-orange-900/10" :
                    themeColor === "rose" ? "from-rose-900/50 via-pink-600/20 to-purple-900/10" :
                      "from-indigo-900/50 via-slate-800/20 to-cyan-900/10"
            } ${characterState === "talking" ? "scale-110 animate-pulse" :
              characterState === "thinking" ? "scale-95 opacity-20" : "scale-100"
            }`} />
        )}

        {/* Video Background Layer (Requires user to place bg-<theme>.webm in /assets) */}
        {backgroundVideo && backgroundVideo !== "solid" && avatarStyle !== "orb" && (
          <div className="absolute inset-0 w-full h-full opacity-100 transition-opacity duration-1000">
            <video
              key={`bg-video-${backgroundVideo}`}
              src={`/assets/${backgroundVideo}`}
              loop
              muted
              playsInline
              autoPlay
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide video if it doesn't exist, falling back to CSS gradient
                (e.target as HTMLVideoElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Extra atmospheric vignette overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_100%)] opacity-80" />
      </div>

      {/* Character glow backdrop (separates character from scanlines) */}
      <div className="absolute inset-0 z-[8] pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60vw] h-[60vh] bg-gradient-to-t from-indigo-900/10 via-transparent to-transparent blur-[60px]" />
      </div>

      {/* Canvas holographic effects behind video */}
      <canvas
        id="elysia-hologram-living-canvas"
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-[6]"
      />

      {/* 2. Character Videos state crossfade manager (Z-index 10 — on top of canvas for crispness) */}
      <div
        id="elysia-animated-presence"
        className="absolute inset-0 z-10 w-full h-full flex items-center justify-center pointer-events-auto [transform:translateZ(0)]"
      >
        <div className="absolute inset-0 w-full h-full select-none pointer-events-none">
          {avatarStyle === "character" ? (
            <>
              {/* IDLE VIDEO - prefers .webm, falls back to .mp4 */}
              <video
            ref={idleVideoRef}
            src="/assets/idle.webm"
            loop
            muted
            playsInline
            autoPlay
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-full max-h-[90vh] w-auto object-contain object-bottom transition-all duration-200 ease-out will-change-[opacity,transform] [transform:translateZ(0)] [filter:contrast(1.08)_brightness(1.03)_saturate(1.05)] ${characterState === "idle"
              ? "opacity-100 scale-100 z-10"
              : "opacity-0 scale-[0.97] z-0"
              }`}
            onError={() => handleVideoError("idle")}
          />

          {/* THINKING VIDEO */}
          <video
            ref={thinkingVideoRef}
            src="/assets/thinking.webm"
            loop
            muted
            playsInline
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-full max-h-[90vh] w-auto object-contain object-bottom transition-all duration-200 ease-out will-change-[opacity,transform] [transform:translateZ(0)] [filter:contrast(1.08)_brightness(1.03)_saturate(1.05)] ${characterState === "thinking"
              ? "opacity-100 scale-100 z-10"
              : "opacity-0 scale-[0.97] z-0"
              }`}
            onError={() => handleVideoError("thinking")}
          />

          {/* TALKING VIDEO */}
          <video
            ref={talkingVideoRef}
            src="/assets/talking.webm"
            loop
            muted
            playsInline
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-full max-h-[90vh] w-auto object-contain object-bottom transition-all duration-200 ease-out will-change-[opacity,transform] [transform:translateZ(0)] [filter:contrast(1.08)_brightness(1.03)_saturate(1.05)] ${characterState === "talking"
              ? "opacity-100 scale-100 z-10"
              : "opacity-0 scale-[0.97] z-0"
              }`}
            onError={() => handleVideoError("talking")}
          />

          {/* Faint cybernetic visual edge grid guard */}
          <div className="absolute inset-0 pointer-events-none" />

          {/* Video Placeholder/Fallback Tutorial Overlay if asset files are absent */}
          {hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#05060f]/90 backdrop-blur-md rounded-3xl p-6 text-center z-50 pointer-events-auto border border-white/5 shadow-2xl animate-fade-in">
              <Sparkles className="text-cyan-400 mb-2 animate-pulse" size={32} />
              <h3 className="text-sm font-bold tracking-widest font-mono text-white select-none">AWAITING VIDEOS CORES</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-xs leading-relaxed font-sans">
                Please place your character video assets inside the <code className="text-cyan-300 font-mono">/assets</code> directory of your workspace named exactly:
              </p>
              <div className="mt-3 space-y-1.5 text-left font-mono text-[10px] text-cyan-200 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5">
                <div>• idle.mp4 (State: Idle)</div>
                <div>• thinking.mp4 (State: Thinking)</div>
                <div>• talking.mp4 (State: Talking)</div>
              </div>
            </div>
          )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <img 
                src="/assets/orb2.gif"
                alt="Aegis Core" 
                className={`transition-all duration-700 ease-in-out object-contain w-full h-full ${
                  characterState === "idle" ? "scale-90 opacity-90" :
                  characterState === "thinking" ? "scale-75 opacity-70" :
                  "scale-100 opacity-100"
                }`}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
