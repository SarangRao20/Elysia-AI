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
}

export const ElysiaCoreVisualizer: React.FC<ElysiaCoreVisualizerProps> = ({
  session,
  state,
  themeColor,
  activeEmotion = "idle",
  characterState
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
      } catch (err) {}
    };

    const pauseVideo = (videoEl: HTMLVideoElement | null) => {
      if (!videoEl) return;
      try {
        videoEl.pause();
      } catch (err) {}
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
        } catch (e) {}
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

      // ==========================================
      // 1. DRAW GRAND STAGE VOLUMETRIC PROJECTOR BEAM (Cinematic Glow Backlight)
      // ==========================================
      ctx.save();
      const projectorCenterY = height + 40;
      const baseDiameterX = 280 * s;

      // Volumetric light beams shooting up from projector base
      const conicalBeamGrad = ctx.createLinearGradient(centerX, height * 0.25, centerX, height);
      conicalBeamGrad.addColorStop(0, "rgba(0,0,0,0)");
      conicalBeamGrad.addColorStop(0.4, colors.primary.replace("1)", "0.03)"));
      conicalBeamGrad.addColorStop(0.75, colors.primary.replace("1)", "0.08)"));
      conicalBeamGrad.addColorStop(1, colors.secondary.replace("0.8)", "0.18)"));

      ctx.fillStyle = conicalBeamGrad;
      ctx.beginPath();
      ctx.moveTo(centerX - baseDiameterX * 0.35, projectorCenterY - 145);
      ctx.lineTo(centerX + baseDiameterX * 0.35, projectorCenterY - 145);
      ctx.lineTo(centerX + baseDiameterX * 1.5, height);
      ctx.lineTo(centerX - baseDiameterX * 1.5, height);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ==========================================
      // 2. MINIMALIST ATMOSPHERE NEURAL FIELDS (SUBTLE GLITCH)
      // ==========================================
      const applyGlitch = (state === "connecting" && Math.random() < 0.1) || (Math.random() < 0.005);
      if (applyGlitch) {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 2);
        ctx.fillStyle = Math.random() < 0.5 ? "rgba(236,72,153,0.03)" : "rgba(34,211,238,0.03)";
        ctx.fillRect(0, 0, width, height);
      }

      // ==========================================
      // 3. UPDATE AND DRAW HOLOGRAM NEURAL PARTICLES RISING (Cinematic Stardust)
      // ==========================================
      particlesRef.current.forEach((p) => {
        const riseSpeed = p.speed * (1 + speechVolumeRef.current * 1.8);
        p.y -= riseSpeed;
        
        // Horizontal drift sway
        p.x += Math.sin(p.y * 0.015 + p.size) * 0.4;
        
        // Transparency matches base lift height
        const currentOpacity = p.opacity * Math.max(0, p.y / height);

        // Recirculate particle if it reaches up too high near her crown
        if (p.y < height * 0.12) {
          p.y = height + Math.random() * 30;
          p.x = Math.random() * width;
        }

        ctx.fillStyle = colors.primary.replace("1)", `${currentOpacity * 0.45})`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * s, 0, Math.PI * 2);
        ctx.fill();
      });

      if (applyGlitch) {
        ctx.restore();
      }

      // ==========================================
      // 4. VOICE-REACTIVE GLOW RING (pulses with speaking amplitude)
      // ==========================================
      if (glowRingRef.current > 0.01) {
        ctx.save();
        const ringRadius = 140 * s;
        const ringAlpha = glowRingRef.current * 0.6;
        const lineWidth = 2 + glowRingRef.current * 8;

        // Outer glow
        ctx.beginPath();
        ctx.arc(centerX, height * 0.52, ringRadius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = colors.glow.replace("0.7)", `${ringAlpha * 0.3})`);
        ctx.lineWidth = lineWidth + 12;
        ctx.filter = "blur(8px)";
        ctx.stroke();
        ctx.filter = "none";

        // Main ring
        ctx.beginPath();
        ctx.arc(centerX, height * 0.52, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = colors.primary.replace("1)", `${ringAlpha})`);
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // Inner highlight
        ctx.beginPath();
        ctx.arc(centerX, height * 0.52, ringRadius - 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${ringAlpha * 0.2})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }

      // ==========================================
      // 5. EMOTION FLASH OVERLAY (brief color pulse on emotion change)
      // ==========================================
      if (emotionFlashRef.current > 0.02) {
        ctx.save();
        const flashAlpha = emotionFlashRef.current * 0.12;
        const emotionColors: Record<string, string> = {
          happy: "rgba(234,179,8,",
          excited: "rgba(249,115,22,",
          curious: "rgba(34,211,238,",
          sad: "rgba(59,130,246,",
          surprised: "rgba(168,85,247,",
          confused: "rgba(244,63,94,",
          embarrassed: "rgba(236,72,153,",
          playful: "rgba(16,185,129,",
          proud: "rgba(251,191,36,",
          idle: colors.primary.replace("1)", ""),
        };
        const base = emotionColors[activeEmotion] || emotionColors.idle;
        const flashGrad = ctx.createRadialGradient(centerX, height * 0.5, 0, centerX, height * 0.5, 260 * s);
        flashGrad.addColorStop(0, `${base}${flashAlpha})`);
        flashGrad.addColorStop(1, `${base}0)`);
        ctx.fillStyle = flashGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
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
      {/* 1. Behind Overlay / Atmospheric Backlight Glow (Z-index 0) */}
      <div className="absolute inset-0 bg-transparent flex items-center justify-center pointer-events-none z-0">
        <div className={`w-[500px] h-[500px] rounded-full blur-[140px] opacity-25 bg-gradient-to-tr transition-all duration-1000 ${
          themeColor === "violet" ? "from-purple-600/30 to-fuchsia-600/5" :
          themeColor === "crimson" ? "from-rose-600/30 to-orange-600/5" :
          themeColor === "emerald" ? "from-emerald-600/30 to-teal-600/5" :
          themeColor === "celestial" ? "from-sky-600/30 to-cyan-600/5" :
          themeColor === "gold" ? "from-amber-600/30 to-yellow-600/5" :
          themeColor === "rose" ? "from-rose-600/30 to-pink-600/5" :
          "from-indigo-600/30 to-cyan-600/5"
        }`} />
      </div>

      {/* 2. Character Videos state crossfade manager (Z-index 10) */}
      <div 
        id="elysia-animated-presence"
        className="absolute inset-0 z-10 w-full h-full flex items-center justify-center pointer-events-auto transition-all duration-700"
      >
        <div className="absolute inset-0 w-full h-full select-none pointer-events-none">

          {/* IDLE VIDEO */}
          <video
            ref={idleVideoRef}
            src="/assets/idle.mp4"
            loop
            muted
            playsInline
            autoPlay
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out ${
              characterState === "idle" 
                ? "opacity-100 z-10" 
                : "opacity-0 z-0"
            }`}
            onError={() => handleVideoError("idle")}
          />

          {/* THINKING VIDEO */}
          <video
            ref={thinkingVideoRef}
            src="/assets/thinking.mp4"
            loop
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out ${
              characterState === "thinking" 
                ? "opacity-100 z-10" 
                : "opacity-0 z-0"
            }`}
            onError={() => handleVideoError("thinking")}
          />

          {/* TALKING VIDEO */}
          <video
            ref={talkingVideoRef}
            src="/assets/talking.mp4"
            loop
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-out ${
              characterState === "talking" 
                ? "opacity-100 z-10" 
                : "opacity-0 z-0"
            }`}
            onError={() => handleVideoError("talking")}
          />

          {/* Faint cybernetic visual edge grid guard */}
          <div className="absolute inset-0 border border-white/5 pointer-events-none bg-radial-gradient from-transparent to-black/35" />

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
        </div>
      </div>

      {/* 3. Foreground Hover-Responsive Canvas for glowing particles (Holographic Overlay Z-index 20) */}
      <canvas
        id="elysia-hologram-living-canvas"
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
      />
    </div>
  );
};
