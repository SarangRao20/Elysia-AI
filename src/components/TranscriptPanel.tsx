import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Search,
  Trash2,
  X,
  Minimize2,
  Maximize2,
  Clock,
  Copy,
  Filter,
  Palette,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TranscriptEntry {
  id: string;
  timestamp: string;
  role: "user" | "model";
  content: string;
  isError?: boolean;
  emotion?: string;
  isSelected?: boolean;
}

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  isOpen: boolean;
  onClose: () => void;
  onEntriesChange?: (entries: TranscriptEntry[]) => void;
  onSelectionChange?: (selectedIds: Set<string>) => void;
  selectedIds?: Set<string>;
}

export const TranscriptPanel: React.FC<TranscriptPanelProps> = ({
  entries: initialEntries,
  isOpen,
  onClose,
  onEntriesChange,
  onSelectionChange,
  selectedIds = new Set(),
}) => {
  const [entries, setEntries] = useState<TranscriptEntry[]>(initialEntries);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "user" | "model">("all");
  const [isMinimized, setIsMinimized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [panelWidth, setPanelWidth] = useState(520);
  const [panelHeight, setPanelHeight] = useState(600);

  const containerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);

  // Sync local entries with parent
  useEffect(() => setEntries(initialEntries), [initialEntries]);
  useEffect(() => {
    if (onEntriesChange) onEntriesChange(entries);
  }, [entries]);
  useEffect(() => {
    if (onSelectionChange) onSelectionChange(selectedIds);
  }, [selectedIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") onClose();
      if (e.key === "F4") onClose();
      if (e.ctrlKey && e.key === "k") {
        e.preventDefault();
        (document.querySelector("[data-transcript-search] input") as HTMLInputElement)?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Smooth scroll to new entry
  useEffect(() => {
    const container = containerRef.current;
    if (container && initialEntries.length > entries.length) {
      container.scrollTop = container.scrollHeight;
    }
  }, [entries, initialEntries.length]);

  // Resize handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      if (e.clientX <= 200) return; // Minimum width constraint
      const newWidth = Math.max(380, Math.min(800, e.clientX));
      setPanelWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Filter entries based on search and filter
  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === "all" || entry.role === activeFilter;
    return matchesSearch && matchesFilter;
  });

  // Format timestamp
  const formatTimestamp = (entry: TranscriptEntry) => {
    const date = new Date(entry.timestamp);
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Highlight matching text
  const highlightMatch = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term})`, "gi");
    return text.replace(regex, "<mark class=\"bg-yellow-500/30 text-yellow-200\">$1</mark>");
  };

  // Copy entry to clipboard
  const copyEntry = async (entry: TranscriptEntry) => {
    const text = `[${formatTimestamp(entry)}] ${entry.role.toUpperCase()}: ${entry.content}`;
    await navigator.clipboard.writeText(text);
  };

  // Clear all entries with confirmation
  const clearAll = () => {
    if (entries.length === 0) return;
    const confirmed = window.confirm(
      "Permanently clear full conversation history? This cannot be undone."
    );
    if (confirmed) setEntries([]);
  };

  // Toggle entry selection
  const toggleEntrySelection = (entryId: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(entryId)) newSet.delete(entryId);
    else newSet.add(entryId);
    // For now, parent component manages this; we can expose a callback if needed.
  };

  // Emit ambient emotion lighting if enabled (legacy)
  useEffect(() => {
    if (entries.length > 0) {
      const latest = entries[entries.length - 1];
      if (latest.role === "model" && latest.emotion && latest.emotion !== "idle") {
        console.log(
          `[${new Date().toISOString()}] EMOTION AMBIANCE: Legacy Emotion 1.0 Ambient lighting triggered for emotion: ${latest.emotion}`
        );
      }
    }
  }, [entries]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, x: 32 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 32 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed top-20 bottom-20 right-4 z-40 flex flex-col bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-3xl shadow-[0_0_80px_rgba(168,85,247,0.15)] overflow-hidden select-none"
        style={{
          width: isMinimized ? "auto" : `${panelWidth}px`,
          height: isMinimized ? "auto" : `${panelHeight}px`,
        }}
      >
        {/* Resizer handle */}
        {!isMinimized && (
          <div
            ref={resizeRef}
            className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-transparent via-purple-500/30 to-transparent cursor-col-resize z-50 hover:bg-purple-500/50 transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          />
        )}

        {/* Header bar */}
        <div className="relative z-10 p-5 border-b border-white/5 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-5 h-5 text-purple-400" />
            <h3 className="text-base font-bold font-mono text-slate-200 tracking-wider uppercase">
              Conversation Transcript
              <span className="ml-2 text-xs font-sans font-normal text-slate-500">
                ({entries.length} entries)
              </span>
            </h3>
            {activeFilter !== "all" && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/30">
                {activeFilter}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Controls */}
            <button
              onClick={() =>
                setActiveFilter(
                  activeFilter === "all" ? "user" : activeFilter === "user" ? "model" : "all"
                )
              }
              className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 border border-white/5 text-slate-400 hover:text-indigo-300 transition"
              title="Toggle filter"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={clearAll}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/5 text-slate-400 hover:text-rose-300 transition"
              title="Clear transcript"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-2 rounded-xl bg-white/5 hover:bg-slate-600/20 border border-white/5 text-slate-400 hover:text-slate-200 transition"
              title="Minimize"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/5 text-slate-400 hover:text-rose-300 transition"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {!isMinimized && (
          <div className="p-4 border-b border-white/5 bg-slate-950/40">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                data-transcript-search
                type="text"
                placeholder="Search transcript..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-slate-200 text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/40 transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3.5 top-1/2 transform -translate-y-1/2 text-slate-500 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content area */}
        {!isMinimized && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-700/50 hover:scrollbar-thumb-slate-600/70">
            {filteredEntries.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12 space-y-4"
              >
                <MessageSquare className="w-10 h-10 text-slate-600 mx-auto" />
                <div className="text-slate-400 font-mono text-sm">
                  No conversation history available
                </div>
                <div className="text-slate-600 font-mono text-xs">
                  Start a new session to begin recording dialogue
                </div>
              </motion.div>
            ) : (
              filteredEntries.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -32 }}
                  transition={{ duration: 0.2 }}
                  className={`relative group p-3.5 rounded-2xl border transition-all ${entry.isSelected ? "bg-purple-500/20 border-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)]" : entry.role === "user" ? "bg-gradient-to-r from-cyan-900/20 to-transparent border-cyan-500/20 hover:border-cyan-500/40" : "bg-gradient-to-r from-purple-900/20 to-transparent border-purple-500/20 hover:border-purple-500/40"} ${entry.isError ? "border-rose-500/40" : ""}`}
                  onClick={() => toggleEntrySelection(entry.id)}
                >
                  {/* Entry header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${entry.role === "user" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-purple-500/20 text-purple-300 border border-purple-500/30"}`}>
                        {entry.role}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                        <Clock className="w-3 h-3" /> {formatTimestamp(entry)}
                      </span>
                      {entry.emotion && entry.emotion !== "idle" && (
                        <span className="flex items-center gap-1 text-[10px] text-orange-400">
                          <Palette className="w-3 h-3" /> {entry.emotion}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyEntry(entry);
                      }}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-slate-200 transition opacity-0 group-hover:opacity-100"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Entry content */}
                  <div
                    className="text-xs text-slate-200 font-mono leading-relaxed whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{ __html: highlightMatch(entry.content, searchTerm) }}
                  />

                  {/* Ambient emotion lighting hint */}
                  {entry.emotion && entry.emotion !== "idle" && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <Palette className="w-3 h-3 text-orange-400" />
                        <span className="text-[10px] text-orange-300 font-mono">
                          Emotion: {entry.emotion}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Selection indicator */}
                  {entry.isSelected && (
                    <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-cyan-400 via-purple-400 to-cyan-400" />
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Minimized view */}
        {isMinimized && (
          <div className="p-3.5 text-center">
            <div className="text-xs text-slate-400 font-mono uppercase tracking-wider mb-2">
              Transcript
            </div>
            <div className="text-slate-300 font-bold text-sm">
              {entries.length} entries
            </div>
            <div className="text-[10px] text-slate-600 mt-1">
              Press F4 to expand
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default TranscriptPanel;
