import React from "react";
import { ExternalLink, X, ShieldAlert, Monitor } from "lucide-react";

interface HolographicProjectorProps {
  url: string;
  onClose: () => void;
}

export const HolographicProjector: React.FC<HolographicProjectorProps> = ({
  url,
  onClose,
}) => {
  // Ensure the URL is valid, fallback if simple domain passed
  const formattedUrl = url.startsWith("http://") || url.startsWith("https://") 
    ? url 
    : `https://${url}`;

  return (
    <div
      id="holographic-web-projector"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xl animate-fade-in"
    >
      <div className="relative w-full max-w-4xl h-[80vh] flex flex-col rounded-3xl border border-white/10 bg-slate-900/80 shadow-[0_0_80px_-20px_rgba(99,102,241,0.5)] backdrop-blur-2xl overflow-hidden">
        
        {/* Glowing holographic radar grid decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(18,24,38,0.1)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />

        {/* Header bar */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </div>
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-indigo-400 font-bold">Elysia Holocore Projection Link</h3>
              <p className="text-sm font-semibold text-white truncate max-w-md">{formattedUrl}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={formattedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-indigo-500 hover:border-indigo-400 text-xs font-mono tracking-wider font-semibold text-white hover:text-white transition duration-200"
            >
              <ExternalLink size={14} />
              Open in New Tab
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-rose-500 hover:border-rose-400 text-slate-400 hover:text-white transition duration-200"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Embedded page display */}
        <div className="relative flex-1 w-full bg-slate-950/30 overflow-hidden">
          <iframe
            src={formattedUrl}
            title={`Holographic Projector: ${formattedUrl}`}
            className="w-full h-full border-none bg-slate-950"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />

          {/* Secure sandbox frame disclaimer / fallback instructions overlay */}
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-start gap-3 p-4 rounded-2xl border border-amber-500/10 bg-amber-950/30 backdrop-blur-xl">
            <ShieldAlert className="text-amber-400 shrink-0 mt-0.5" size={18} />
            <div className="text-left">
              <h4 className="text-xs font-semibold text-amber-200 uppercase tracking-wider font-mono">Sandbox Environment Intercept</h4>
              <p className="text-xs text-amber-300">
                Some major websites (like Google, YouTube, GitHub) restrict embedding within sub-iframes for security (clickjacking protection). If the preview above is blank, please tap the link below.
              </p>
              <div className="mt-2.5">
                <a
                  href={formattedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-300 hover:text-indigo-200 underline transition duration-150"
                >
                  Confirm and launch website in standard full tab <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer controls status */}
        <div className="relative z-10 flex items-center justify-between px-6 py-3.5 border-t border-white/5 bg-slate-950/20 text-[10px] font-mono tracking-widest text-slate-500">
          <div className="flex items-center gap-2">
            <Monitor size={12} className="text-indigo-500" />
            <span>EXTERNAL BROWSER INTEGRATION PROTOCOL - ACTIVE</span>
          </div>
          <div>STATUS: COMPLETED</div>
        </div>
        
      </div>
    </div>
  );
};
