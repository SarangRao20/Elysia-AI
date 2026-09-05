import React, { useState } from "react";
import { Memory, MemoryCategory } from "../lib/memoryTypes";
import { Brain, X, Trash2, Plus, Database, Sparkles, TerminalSquare } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MemoryDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  onAddMemory: (category: MemoryCategory, text: string) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  themeColor: string;
}

export function MemoryDashboard({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
  themeColor,
}: MemoryDashboardProps) {
  // ---------- State ----------
  const [activeTab, setActiveTab] = useState<MemoryCategory | "all">("all");
  const [newText, setNewText] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("identity");
  const [isAdding, setIsAdding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ---------- Config ----------
  const categoryConfig: Record<MemoryCategory, { label: string; icon: any; color: string; bg: string }> = {
    identity: { label: "Identity Core", icon: Database, color: "text-amber-400 border-amber-500/30", bg: "bg-amber-950/20 hover:bg-amber-900/30" },
    preference: { label: "Preferences", icon: Sparkles, color: "text-pink-400 border-pink-500/30", bg: "bg-pink-950/20 hover:bg-pink-900/30" },
    goal: { label: "Life Goals", icon: TerminalSquare, color: "text-emerald-400 border-emerald-500/30", bg: "bg-emerald-950/20 hover:bg-emerald-900/30" },
    project: { label: "Active Projects", icon: Brain, color: "text-cyan-400 border-cyan-500/30", bg: "bg-cyan-950/20 hover:bg-cyan-900/30" },
    relationship: { label: "Relationships", icon: Sparkles, color: "text-purple-400 border-purple-500/30", bg: "bg-purple-950/20 hover:bg-purple-900/30" },
    emotional: { label: "Milestones", icon: Sparkles, color: "text-red-400 border-red-500/30", bg: "bg-red-950/20 hover:bg-red-900/30" },
    behavior: { label: "Behaviors & Habits", icon: Brain, color: "text-indigo-400 border-indigo-500/30", bg: "bg-indigo-950/20 hover:bg-indigo-900/30" },
  };

  const filteredMemories = activeTab === "all" ? memories : memories.filter(m => m.category === activeTab);

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setSubmitting(true);
    try {
      await onAddMemory(newCategory, newText.trim());
      setNewText("");
      setIsAdding(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Durable Record";
    }
  };

  // ---------- Render ----------
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Full‑screen backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 z-40 backdrop-blur-md bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_4px] pointer-events-auto"
          />

          {/* Central holographic terminal (full‑screen) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute inset-0 m-4 max-w-[1400px] mx-auto bg-black/90 backdrop-blur-3xl z-50 flex flex-col shadow-[0_0_100px_rgba(6,182,212,0.15)] overflow-hidden"
            style={{ clipPath: "polygon(0 0, calc(100% - 30px) 0, 100% 30px, 100% 100%, 30px 100%, 0 calc(100% - 30px))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-cyan-500/20 bg-black/40 relative z-10">
              <div className="flex items-center gap-3">
                <Database size={24} className="text-cyan-400" />
                <h2 className="text-xl font-mono tracking-widest text-white uppercase">
                  MEMORY CORE
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 hover:bg-rose-500/20 hover:text-rose-400 hover:border-rose-500/50 transition-all cursor-pointer"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Action bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-cyan-950/10 border-b border-cyan-500/20">
              <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-600 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />
                Live Sync Active
              </div>
              {!isAdding && (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-cyan-400/50 bg-cyan-500/10 hover:bg-cyan-400 hover:text-black text-[10px] font-mono font-bold tracking-widest text-cyan-300 transition-all uppercase cursor-pointer"
                  style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
                >
                  <Plus size={14} /> MANUAL INJECTION
                </button>
              )}
            </div>

            {/* Manual entry form */}
            <AnimatePresence>
              {isAdding && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b border-cyan-500/20 bg-black/80 backdrop-blur-xl"
                >
                  <form onSubmit={handleManualAdd} className="p-6 space-y-4 max-w-3xl mx-auto">
                    <label className="block text-[11px] font-mono tracking-widest text-cyan-600 uppercase mb-2">
                      Select Partition
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                      {(Object.keys(categoryConfig) as MemoryCategory[]).map((cat) => {
                        const Icon = categoryConfig[cat].icon;
                        const active = newCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setNewCategory(cat)}
                            className={`flex items-center gap-2 p-2 border text-[10px] font-mono uppercase transition-all cursor-pointer ${
                              active ? "border-cyan-400 bg-cyan-500/20 text-cyan-300" : "border-cyan-900/50 bg-black/40 text-cyan-700 hover:border-cyan-500/40"
                            }`}
                            style={{ clipPath: "polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px)" }}
                          >
                            <Icon size={14} />
                            <span>{categoryConfig[cat].label.split(' ')[0]}</span>
                          </button>
                        );
                      })}
                    </div>
                    <label className="block text-[11px] font-mono tracking-widest text-cyan-600 uppercase mb-2">
                      Data Payload
                    </label>
                    <textarea
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      required
                      placeholder="Inject knowledge (e.g. USER_PREFERS_DARK_MODE)..."
                      className="w-full h-24 p-4 text-sm bg-black/60 border border-cyan-500/30 text-cyan-50 placeholder-cyan-900/50 focus:outline-none focus:border-cyan-400 resize-none font-mono"
                      style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
                    />
                    <div className="flex justify-end gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => setIsAdding(false)}
                        className="px-5 py-2 border border-cyan-900 bg-black/40 text-[10px] font-mono tracking-widest text-cyan-600 hover:text-cyan-400 hover:border-cyan-700 transition cursor-pointer uppercase"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)" }}
                      >
                        Abort
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[10px] uppercase font-mono tracking-widest transition disabled:opacity-50 cursor-pointer"
                        style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
                      >
                        {submitting ? "UPLOADING..." : "INJECT"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Memory grid */}
            <div className="flex-1 overflow-y-auto p-6 relative z-10 no-scrollbar">
              <AnimatePresence initial={false}>
                {filteredMemories.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full text-center text-cyan-600"
                  >
                    <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
                      <div className="absolute inset-0 border-2 border-cyan-500/20 animate-[spin_20s_linear_infinite]" style={{ clipPath: "polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)" }} />
                      <Brain size={48} className="opacity-40 text-cyan-500/50 animate-pulse" />
                    </div>
                    <h4 className="text-lg font-mono tracking-widest text-cyan-400 uppercase">Databank Empty</h4>
                    <p className="text-xs max-w-sm mt-3 font-mono uppercase text-cyan-700">
                      {activeTab === "all" ? "Awaiting conversational input to populate nodes." : `No records in ${categoryConfig[activeTab as MemoryCategory]?.label}.`}
                    </p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredMemories.map((m) => {
                      const cfg = categoryConfig[m.category];
                      const Icon = cfg.icon;
                      const isDeleting = deleteId === m.id;
                      return (
                        <motion.div
                          key={m.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -20 }}
                          className={`group relative p-[1px] ${cfg.bg} transition-all duration-300 hover:-translate-y-1`}
                          style={{ clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)" }}
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="relative bg-black/80 backdrop-blur-xl p-5 border border-white/5 flex flex-col min-h-[150px]" style={{ clipPath: "polygon(20px 0, 100% 0, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0 100%, 0 20px)" }}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className={`p-2 bg-black/60 border ${cfg.color} relative overflow-hidden`} style={{ clipPath: "polygon(25% 0%,100% 0%,75% 100%,0% 100%)" }}>
                                  <Icon size={14} />
                                </div>
                                <span className={`text-[10px] font-mono uppercase tracking-widest ${cfg.color.split(' ')[0]}`}>{cfg.label}</span>
                              </div>
                              {isDeleting ? (
                                <button
                                  onClick={() => onDeleteMemory(m.id)}
                                  className="px-2 py-1 bg-rose-500/20 border border-rose-500 text-[9px] font-mono tracking-widest text-rose-300 uppercase animate-pulse"
                                  style={{ clipPath: "polygon(5px 0,100% 0,100% calc(100% -5px),calc(100% -5px) 100%,0 100%,0 5px)" }}
                                >
                                  PURGE
                                </button>
                              ) : (
                                <button
                                  onClick={() => setDeleteId(m.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1.5 border border-rose-500/30 bg-rose-950/40 text-rose-500 hover:bg-rose-500 hover:text-black transition-all"
                                  style={{ clipPath: "polygon(0 0,100% 0,100% calc(100% -5px),calc(100% -5px) 100%,0 100%)" }}
                                  title="Purge"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-cyan-50 font-mono break-words mb-3">{m.text}</p>
                            <div className="flex items-center justify-between border-t border-cyan-900/40 pt-2 mt-auto text-[9px] font-mono text-cyan-800 uppercase">
                              <span>ID:{m.id.substring(0, 6).toUpperCase()}</span>
                              <span>{formatDate(m.createdAt)}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-cyan-500/20 bg-black/60 flex items-center justify-between text-[9px] font-mono text-cyan-700 tracking-widest uppercase">
              <span className="flex items-center gap-2">
                <span className="flex gap-0.5">
                  {[1, 2, 3].map(i => (
                    <span key={i} className="w-1 h-2 bg-cyan-500 animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
                TERMINAL_LINK_ACTIVE
              </span>
              <span>VOLATILE_CACHE: MOUNTED</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
