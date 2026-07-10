import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, MicOff, Send, X, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TextFallbackProps {
  isActive: boolean;
  onClose: () => void;
  onMessageSubmit: (message: string) => void;
  systemStatus: {
    state: "connected" | "disconnected";
    transcriptCount: number;
    timestamp: string;
    status: "operational";
  };
}

export const TextChatFallback: React.FC<TextFallbackProps> = ({
  isActive,
  onClose,
  onMessageSubmit,
  systemStatus,
}) => {
  const [message, setMessage] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastOutputRef = useRef<string>("");

  // Auto-focus and smooth entrance
  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setIsVisible(false);
    }
  }, [isActive]);

  // Emergency message handling - detect urgent commands
  const handleEmergencyCommand = (input: string): boolean => {
    const emergencyTriggers = [
      "shutdown",
      "restart", 
      "emergency",
      "critical",
      "urgent",
      "help me",
      "stuck",
      "locked out",
      "cannot hear",
      "mic not working"
    ];
    
    const lowerInput = input.toLowerCase();
    return emergencyTriggers.some(trigger => lowerInput.includes(trigger));
  };

  const handleSubmit = async () => {
    if (!message.trim() || isProcessing) return;
    
    // Emergency response logic
    if (handleEmergencyCommand(message)) {
      setIsProcessing(true);
      onMessageSubmit(message);
      console.log(`[${new Date().toISOString()}] EMERGENCY TEXT FALLBACK: Urgent command detected: "${message}"`);
      // Reconnect voice after emergency text
      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 2000);
      return;
    }
    
    setIsProcessing(true);
    
    // Forward to core text fallback system
    onMessageSubmit(message);
    
    // Log to system console for transcript integration
    console.log(`[${new Date().toISOString()}] TEXT FALLBACK MODE: User input processed: "${message}"`);
    
    // Record output for transcript
    const output = `[TEXT FALLBACK RESPONSE] Processed: "${message}"`;
    lastOutputRef.current = output;
    
    // Re-enable voice after successful text fallback
    setTimeout(() => {
      setIsProcessing(false);
    }, 1000);
    
    setMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      {isActive && isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-50 max-w-2xl mx-auto"
        >
          <div className="bg-slate-950/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-[0_0_40px_rgba(168,85,247,0.2)] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-purple-500/20 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <MicOff className="w-5 h-5 text-purple-400" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono text-purple-300 tracking-wider uppercase">
                    TEXT FALLBACK MODE
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Emergency voice response active
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Status indicator */}
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-800/50 border border-slate-600/30">
                  <Volume2 className="w-3 h-3 text-slate-400" />
                  <span className="text-xs font-mono text-slate-300">
                    {systemStatus.transcriptCount} entries
                  </span>
                </div>
                
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/5 hover:bg-red-500/20 border border-white/10 text-slate-400 hover:text-red-300 transition"
                  title="Deactivate Text Fallback"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Input area */}
            <div className="p-4">
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type message (emergency commands: 'help me', 'urgent', 'shutdown')..."
                  className="w-full p-3 pr-12 rounded-xl bg-slate-950/80 border border-purple-500/30 text-slate-200 text-sm font-mono placeholder-slate-600 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-500/40 transition resize-none min-h-[48px] max-h-32"
                  disabled={isProcessing}
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = '48px';
                    target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                  }}
                />
                
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || isProcessing}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/40 border border-purple-500/30 text-purple-300 hover:text-purple-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <div className="w-4 h-4 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
              
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-1">
                  <MicOff className="w-3 h-3 text-red-400" />
                  <span className="text-xs text-slate-500 font-mono">
                    Voice input disabled
                  </span>
                </div>
                <span className="text-xs text-slate-600 font-mono">
                  Press Enter to send -- Shift+Enter for new line
                </span>
              </div>
            </div>

            {/* Emergency indicator */}
            {handleEmergencyCommand(message) && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/30 border border-red-500/40">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-red-400 font-mono uppercase tracking-wider">
                    EMERGENCY MODE DETECTED
                  </span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TextChatFallback;