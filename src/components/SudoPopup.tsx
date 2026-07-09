import React, { useState, useEffect } from "react";
import { Shield, Check, X, Terminal, Clock, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SudoRequest {
  id: string;
  command: string;
  package?: string;
  requestedBy: string;
  timestamp: Date;
  expiresAt: Date;
  status: "pending" | "approved" | "rejected" | "expired";
}

interface SudoPopupProps {
  onApprove?: (token: string) => void;
  onReject?: (token: string) => void;
  pendingRequests?: SudoRequest[];
}

export const SudoPopup: React.FC<SudoPopupProps> = ({
  onApprove,
  onReject,
  pendingRequests = [],
}) => {
  const [selectedRequest, setSelectedRequest] = useState<SudoRequest | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [dots, setDots] = useState<string>(".");

  const hasPending = pendingRequests.length > 0;
  const showDialog = selectedRequest !== null;

  useEffect(() => {
    if (!selectedRequest) return;
    const updateTimer = () => {
      const now = new Date();
      const diff = Math.max(0, selectedRequest.expiresAt.getTime() - now.getTime());
      setTimeLeft(Math.floor(diff / 1000));
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [selectedRequest]);

  useEffect(() => {
    if (hasPending && !selectedRequest) {
      setSelectedRequest(pendingRequests[0]);
    } else if (!hasPending && selectedRequest) {
      setSelectedRequest(null);
    }
  }, [hasPending, pendingRequests, selectedRequest]);

  useEffect(() => {
    if (!showDialog) return;
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);
    return () => {
      clearInterval(interval);
      setDots(".");
    };
  }, [showDialog]);

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const handleApprove = () => {
    if (selectedRequest && onApprove) {
      const token = Math.random().toString(36).substring(2, 10);
      onApprove(token);
    }
    setSelectedRequest(null);
  };

  const handleReject = () => {
    if (selectedRequest && onReject) {
      const token = Math.random().toString(36).substring(2, 10);
      onReject(token);
    }
    setSelectedRequest(null);
  };

  return (
    <>
      {/* Sudo Status Dot Indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed top-4 left-4 z-50 flex items-center gap-2"
      >
        <div className={`relative flex h-3 w-3 ${hasPending ? "animate-pulse" : ""}`}>
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${
              hasPending ? "bg-yellow-500" : "bg-green-500"
            } opacity-75`}
          />
          <span
            className={`relative inline-flex rounded-full h-3 w-3 ${
              hasPending ? "bg-yellow-500" : "bg-green-500"
            }`}
          />
        </div>
        <span className="text-xs font-mono text-slate-300">
          Sudo {hasPending ? "PENDING" : "SECURE"}
        </span>
        {hasPending && (
          <span className="text-xs font-mono text-yellow-400 animate-pulse">
            {dots}
          </span>
        )}
      </motion.div>

      {/* Sudo Confirmation Dialog */}
      <AnimatePresence>
        {showDialog && selectedRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="bg-slate-950 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-[0_0_50px_rgba(99,102,241,0.3)]"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-red-500/20 border border-red-500/30">
                  <Shield className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-mono text-white">
                    SUDO CONFIRMATION REQUIRED
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Command execution needs your approval
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/30 mb-4">
                <div className="text-xs text-slate-500 font-mono mb-1">COMMAND:</div>
                <div className="font-mono text-sm text-slate-200 break-all">
                  {selectedRequest.command}
                </div>
                {selectedRequest.package && (
                  <>
                    <div className="text-xs text-slate-500 font-mono mt-2 mb-1">PACKAGE:</div>
                    <div className="font-mono text-sm text-cyan-300">
                      {selectedRequest.package}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-mono text-amber-300">
                  Expires in: <span className="font-bold">{formatTimeLeft(timeLeft)}</span>
                </span>
              </div>

              <div className="flex items-start gap-2 mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5" />
                <div className="text-xs text-red-300 font-mono">
                  <div className="font-bold mb-1">SECURITY WARNING</div>
                  <div>
                    This command will execute with elevated privileges. Only approve if you trust
                    the source.
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 font-mono transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  REJECT
                </button>
                <button
                  onClick={handleApprove}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-mono transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  APPROVE
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
