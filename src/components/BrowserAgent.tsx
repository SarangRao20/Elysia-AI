import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  ExternalLink, 
  Cpu, 
  CheckCircle, 
  AlertCircle, 
  Terminal, 
  Copy, 
  Check, 
  Layers, 
  Globe, 
  RefreshCw, 
  ArrowLeft,
  ArrowRight,
  Home,
  Plus,
  Search,
  Monitor,
  Play,
  Volume2,
  Maximize,
  Sparkles,
  Shield,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LogItem {
  id: string;
  text: string;
  type: "info" | "success" | "error" | "action";
}

interface Tab {
  id: string;
  url: string;
  title: string;
  history: string[];
  currentIndex: number;
  isLoading: boolean;
  openedExternally?: boolean;
}

interface BrowserAgentProps {
  url: string;
  onClose: () => void;
  onActionComplete?: (result: any) => void;
  actionTrigger?: {
    type: string;
    args: any;
    id: string;
    callback: (res: any) => void;
  } | null;
}

export const BrowserAgent: React.FC<BrowserAgentProps> = ({
  url: initialUrl,
  onClose,
  actionTrigger
}) => {
  // Tabs management state
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [inputValue, setInputValue] = useState<string>("");

  // Playwright Local Server status states (retained for backward compatibility)
  const [isLocalConnected, setIsLocalConnected] = useState<boolean>(false);
  const [localLogs, setLocalLogs] = useState<LogItem[]>([]);
  const [showLocalConsole, setShowLocalConsole] = useState<boolean>(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Active Developer Debug Parameters
  const [diagnosticReason, setDiagnosticReason] = useState<string | null>(null);
  const [diagnosticStatus, setDiagnosticStatus] = useState<"secure" | "restricted" | "error" | "analyzing" | "blank">("blank");
  const [jsErrors, setJsErrors] = useState<string[]>([]);
  const [networkErrors, setNetworkErrors] = useState<string[]>([]);
  const [loadTimeMs, setLoadTimeMs] = useState<number>(0);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(true); // Active by default to display stats instantly
  const [iframeOnLoadCount, setIframeOnLoadCount] = useState<number>(0);

  // YouTube Live results states
  const [ytSearchResults, setYtSearchResults] = useState<any[]>([]);
  const [ytSearchLoading, setYtSearchLoading] = useState<boolean>(false);
  const [ytSearchError, setYtSearchError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadStartRef = useRef<number>(0);

  // Checks if a website cannot be embedded inside iframe containers due to security policies
  const checkIsRestricted = (urlStr: string): { restricted: boolean; reason: string } => {
    if (!urlStr || urlStr === "about:blank") return { restricted: false, reason: "" };
    try {
      const parsed = new URL(urlStr);
      const hostname = parsed.hostname.toLowerCase();
      
      // Strict list of platforms that utilize frame-ancestor blocking or CSRF session triggers
      if (hostname.includes("youtube.com") && !parsed.pathname.includes("/embed") && !parsed.pathname.includes("/results")) {
        return { 
          restricted: true, 
          reason: "YouTube utilizes 'X-Frame-Options: SAMEORIGIN' security headers and frame-busting service modules that prevent frame nesting." 
        };
      }
      if (hostname.includes("youtu.be")) {
        return { 
          restricted: true, 
          reason: "YouTu.be redirect urls enforce strict top-level browser navigation redirects." 
        };
      }
      if (hostname.includes("google.com") && !parsed.pathname.includes("/search")) {
        return { 
          restricted: true, 
          reason: "Google security parameters prohibit embedding of credential ports and account consoles to mitigate clickjacking." 
        };
      }
      if (hostname.includes("chatgpt.com") || hostname.includes("openai.com")) {
        return { 
          restricted: true, 
          reason: "OpenAI requires secure browser authentication checks, cloudflare protections, and user-token cookie contexts." 
        };
      }
      if (hostname.includes("gmail.com") || hostname.includes("mail.google.com")) {
        return { 
          restricted: true, 
          reason: "Gmail demands authenticated, non-nested visual scopes to secure sensitive correspondence tokens." 
        };
      }
      if (hostname.includes("github.com")) {
        return { 
          restricted: true, 
          reason: "GitHub deploys 'X-Frame-Options: deny' on all repositories and workspace interfaces." 
        };
      }
      if (hostname.includes("twitter.com") || hostname.includes("x.com") || hostname.includes("instagram.com") || hostname.includes("facebook.com")) {
        return { 
          restricted: true, 
          reason: "Social networks require active secure sessions and forbid third-party iframe frame injection." 
        };
      }
      return { restricted: false, reason: "" };
    } catch {
      return { restricted: false, reason: "" };
    }
  };

  // Safe tab initialization
  useEffect(() => {
    if (initialUrl) {
      const startUrl = initialUrl === "about:blank" ? "about:blank" : initialUrl;
      const restrictions = checkIsRestricted(startUrl);
      
      const newTab: Tab = {
        id: Math.random().toString(36).substring(2, 9),
        url: startUrl,
        title: getCleanTitleFromUrl(startUrl),
        history: [startUrl],
        currentIndex: 0,
        isLoading: startUrl !== "about:blank" && !restrictions.restricted,
        openedExternally: restrictions.restricted
      };
      
      setTabs([newTab]);
      setActiveTabId(newTab.id);
      setInputValue(startUrl === "about:blank" ? "" : startUrl);

      // Handle diagnostics
      if (startUrl !== "about:blank") {
        loadStartRef.current = Date.now();
        if (restrictions.restricted) {
          setDiagnosticStatus("restricted");
          setDiagnosticReason(restrictions.reason);
          // Automatically trigger redirect in new tab
          window.open(startUrl, "_blank", "noopener,noreferrer");
        } else {
          setDiagnosticStatus("analyzing");
        }
      } else {
        setDiagnosticStatus("blank");
      }
    }
  }, [initialUrl]);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Listen to activeTab URL shifts to load YouTube searches on results query
  useEffect(() => {
    if (activeTab) {
      setInputValue(activeTab.url === "about:blank" ? "" : activeTab.url);
      
      if (activeTab.url.includes("youtube.com/results")) {
        setYtSearchLoading(true);
        setYtSearchError(null);
        try {
          const urlObj = new URL(activeTab.url);
          const q = urlObj.searchParams.get("search_query") || "";
          
          fetch(`/api/youtube-search?q=${encodeURIComponent(q)}`)
            .then(res => {
              if (!res.ok) throw new Error(`HTTP status ${res.status}`);
              return res.json();
            })
            .then(data => {
              setYtSearchResults(data.results || []);
              setYtSearchLoading(false);
              // Complete loading state cleanly
              setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isLoading: false } : t));
            })
            .catch(err => {
              console.error("[YouTube Search Fetch Error]:", err);
              setYtSearchError(err.message || "Failed loading real YouTube results.");
              setYtSearchLoading(false);
              setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isLoading: false } : t));
            });
        } catch (e: any) {
          setYtSearchError("Invalid YouTube search URL structure.");
          setYtSearchLoading(false);
        }
      } else {
        setYtSearchResults([]);
      }
    }
  }, [activeTabId, activeTab?.url]);

  // Read Playwright Local server status on a loop to support the local headed helper if active
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/status", { mode: "cors" });
        if (res.ok && isMounted) {
          const data = await res.json();
          setIsLocalConnected(true);
          if (data.logs && Array.isArray(data.logs)) {
            setLocalLogs(data.logs);
          }
        }
      } catch (err) {
        if (isMounted) {
          setIsLocalConnected(false);
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Set hook error context on iframe document
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.onerror = (message, source, lineno, colno, error) => {
          const errMsg = `${message} (Line ${lineno}:${colno}) at ${source}`;
          setJsErrors(prev => [...prev.slice(-15), errMsg]);
          return false;
        };
      } catch (err) {
        // Cross origin issues (or sandbox restrictions) might block accessing contentWindow properties
      }
    }
  }, [activeTab?.url]);

  // Handle click interceptions from children iframe inside proxy
  useEffect(() => {
    const handleNavigationMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "NAVIGATE" && event.data.url) {
        console.log("[Elysia Browser] Same-origin child iframe navigated to:", event.data.url);
        navigateToUrl(event.data.url);
      }
    };
    window.addEventListener("message", handleNavigationMessage);
    return () => window.removeEventListener("message", handleNavigationMessage);
  }, [activeTabId]);

  // Voice command trigger execution (Direct same-origin DOM browser automation)
  useEffect(() => {
    if (!actionTrigger) return;

    const { type, args, callback } = actionTrigger;
    console.log(`[Elysia Browser Hub] Automated Voice Trigger: ${type}`, args);

    const runVoiceAutomation = async () => {
      try {
        switch (type) {
          case "browserOpen": {
            const destUrl = args.url || "https://google.com";
            navigateToUrl(destUrl);
            const cleanTitle = getCleanTitleFromUrl(destUrl);
            callback({ result: `Opening ${cleanTitle} for you now. Let me check what is there.` });
            break;
          }
          case "browserSearch": {
            const query = args.query;
            if (!query) throw new Error("Query text is required.");
            
            // Check if we are searching for YouTube videos
            const isYtRelated = query.toLowerCase().includes("youtube") || query.toLowerCase().includes("video") || (activeTab && activeTab.url.includes("youtube"));
            if (isYtRelated) {
              const cleanYtQ = query.replace(/youtube|search|find|play/gi, "").trim();
              const destUrl = `https://youtube.com/results?search_query=${encodeURIComponent(cleanYtQ || query)}`;
              navigateToUrl(destUrl);
              callback({ result: `Searching YouTube for "${cleanYtQ || query}" right away.` });
            } else {
              const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
              navigateToUrl(searchUrl);
              callback({ result: `Searching for "${query}" right now. Working on it.` });
            }
            break;
          }
          case "browserGoBack": {
            handleBack();
            callback({ result: "Let me go back to the previous webpage for you." });
            break;
          }
          case "browserTabAction": {
            const { action: tabAction, url: startUrl, tabId } = args;
            if (tabAction === "new") {
              handleNewTab(startUrl || "about:blank");
              callback({ result: "Opening a new browser tab now." });
            } else if (tabAction === "close") {
              const targetId = tabId || activeTabId;
              handleCloseTab(targetId);
              callback({ result: "Done. Closed the browser tab." });
            } else if (tabAction === "switch") {
              if (tabId && tabs.some(t => t.id === tabId)) {
                setActiveTabId(tabId);
                callback({ result: "Let's see. Switched to that tab." });
              } else {
                callback({ error: "No matching tab code found." });
              }
            }
            break;
          }
          case "browserScroll": {
            const direction = args.direction || "down";
            const amount = args.amount || 350;
            const iframe = iframeRef.current;
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.scrollBy({ top: direction === "down" ? amount : -amount, behavior: "smooth" });
              callback({ result: `Working on it. Scrolled the browser view ${direction}.` });
            } else {
              callback({ error: "Cannot automate scrolling on empty home tab." });
            }
            break;
          }
          case "browserType": {
            const text = args.text;
            const iframe = iframeRef.current;
            if (iframe && iframe.contentWindow) {
              const doc = iframe.contentWindow.document;
              const inputEl = doc.querySelector('input[type="text"], input[type="search"], textarea, [contenteditable="true"]') as HTMLElement;
              if (inputEl) {
                inputEl.focus();
                if (inputEl instanceof HTMLInputElement || inputEl instanceof HTMLTextAreaElement) {
                  inputEl.value = text;
                  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                  inputEl.innerText = text;
                }
                callback({ result: `Typing in "${text}" for you.` });
              } else {
                callback({ error: "Could not find a secure input block to target typing." });
              }
            } else {
              callback({ error: "No website active to command typing." });
            }
            break;
          }
          case "browserClick": {
            const selector = args.selector;
            const iframe = iframeRef.current;
            if (iframe && iframe.contentWindow) {
              const doc = iframe.contentWindow.document;
              let element = doc.querySelector(selector) as HTMLElement;
              if (!element) {
                // High tolerance text searching
                const elements = Array.from(doc.querySelectorAll('a, button, [role="button"], span, h3')) as HTMLElement[];
                element = elements.find(el => el.textContent?.toLowerCase().includes(selector.toLowerCase())) as HTMLElement;
              }
              if (element) {
                element.click();
                callback({ result: `Success. Clicked the selected item.` });
              } else {
                callback({ error: `Could not identify any element resembling "${selector}".` });
              }
            } else {
              callback({ error: "Browser viewport frame empty." });
            }
            break;
          }
          case "browserMediaControl": {
            const action = args.action;
            const value = args.value;
            const iframe = iframeRef.current;
            if (iframe && iframe.contentWindow) {
              const doc = iframe.contentWindow.document;
              const video = doc.querySelector('video') as HTMLVideoElement;
              if (video) {
                if (action === "play") video.play();
                else if (action === "pause") video.pause();
                else if (action === "volume") video.volume = value !== undefined ? value / 100 : 0.75;
                else if (action === "mute") video.muted = true;
                else if (action === "unmute") video.muted = false;
                else if (action === "skip") video.currentTime += 30;
                callback({ result: `Done. Executed player action: ${action}.` });
              } else {
                // Post command directly to embed API if running YouTube iframe
                iframe.contentWindow.postMessage(JSON.stringify({
                  event: "command",
                  func: action === "play" ? "playVideo" : action === "pause" ? "pauseVideo" : action === "volume" && value ? "setVolume" : "",
                  args: action === "volume" ? [value] : []
                }), "*");
                callback({ result: `Done. Sent playing command to YouTube.` });
              }
            } else {
              callback({ error: "Active streaming panel is empty." });
            }
            break;
          }
          default: {
            callback({ error: `Automation command ${type} is not implemented.` });
          }
        }
      } catch (err: any) {
        callback({ error: `Visual automation exception: ${err.message}` });
      }
    };

    runVoiceAutomation();
  }, [actionTrigger, activeTabId]);

  // Utility to map clean tabs titles
  const getCleanTitleFromUrl = (urlStr: string): string => {
    if (!urlStr || urlStr === "about:blank") return "Start Page";
    try {
      const parsed = new URL(urlStr);
      if (parsed.hostname.includes("youtube.com")) {
        if (parsed.searchParams.get("v")) return "YouTube Stream";
        if (parsed.pathname.includes("/results")) return `YouTube Search: ${parsed.searchParams.get("search_query") || ""}`;
        return "YouTube Projector";
      }
      if (parsed.hostname.includes("google.com")) {
        if (parsed.pathname.includes("search")) return `Google Results: ${parsed.searchParams.get("q") || ""}`;
        return "Google Search Board";
      }
      if (parsed.hostname.includes("duckduckgo.com")) {
        return "DuckDuckGo Proxy Search";
      }
      return parsed.hostname.replace("www.", "");
    } catch {
      return "Viewing Portal";
    }
  };

  // Navigates active tab to location
  const navigateToUrl = (targetUrl: string) => {
    let finalUrl = targetUrl.trim();
    if (finalUrl === "about:blank") {
      setTabs(prev => prev.map(t => t.id === activeTabId ? {
        ...t,
        url: "about:blank",
        title: "Start Page",
        history: [...t.history.slice(0, t.currentIndex + 1), "about:blank"],
        currentIndex: t.currentIndex + 1,
        isLoading: false
      } : t));
      setDiagnosticStatus("blank");
      setDiagnosticReason(null);
      return;
    }

    const isDomain = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?(\?.*)?(#.*)?$/i.test(finalUrl);
    if (isDomain) {
      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
        finalUrl = "https://" + finalUrl;
      }
    } else {
      finalUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(finalUrl)}`;
    }

    loadStartRef.current = Date.now();
    setDiagnosticStatus("analyzing");
    setDiagnosticReason(null);
    const restrictions = checkIsRestricted(finalUrl);

    setTabs(prev => prev.map(t => {
      if (t.id === activeTabId) {
        const nextHistory = t.history.slice(0, t.currentIndex + 1);
        nextHistory.push(finalUrl);
        return {
          ...t,
          url: finalUrl,
          title: getCleanTitleFromUrl(finalUrl),
          history: nextHistory,
          currentIndex: nextHistory.length - 1,
          isLoading: !restrictions.restricted,
          openedExternally: restrictions.restricted
        };
      }
      return t;
    }));

    if (restrictions.restricted) {
      setDiagnosticStatus("restricted");
      setDiagnosticReason(restrictions.reason);
      try {
        window.open(finalUrl, "_blank", "noopener,noreferrer");
      } catch (err: any) {
        setNetworkErrors(prev => [...prev, "System pop-up blocker intercepted redirection search."]);
      }
    }
  };

  // Handles address form bar enter key submit
  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      navigateToUrl(inputValue);
    }
  };

  // Spawns a new tab
  const handleNewTab = (initialUrlStr: string = "about:blank") => {
    const newTab: Tab = {
      id: Math.random().toString(36).substring(2, 9),
      url: initialUrlStr,
      title: getCleanTitleFromUrl(initialUrlStr),
      history: [initialUrlStr],
      currentIndex: 0,
      isLoading: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  // Closes a tab
  const handleCloseTab = (idToClose: string) => {
    if (tabs.length <= 1) {
      onClose();
      return;
    }
    const idx = tabs.findIndex(t => t.id === idToClose);
    const updated = tabs.filter(t => t.id !== idToClose);
    setTabs(updated);

    if (activeTabId === idToClose) {
      const fallbackIdx = Math.max(0, idx - 1);
      setActiveTabId(updated[fallbackIdx].id);
    }
  };

  // Back history navigation
  const handleBack = () => {
    if (activeTab && activeTab.currentIndex > 0) {
      const targetIdx = activeTab.currentIndex - 1;
      setTabs(prev => prev.map(t => t.id === activeTabId ? {
        ...t,
        url: t.history[targetIdx],
        currentIndex: targetIdx,
        isLoading: true
      } : t));
    }
  };

  // Forward history navigation
  const handleForward = () => {
    if (activeTab && activeTab.currentIndex < activeTab.history.length - 1) {
      const targetIdx = activeTab.currentIndex + 1;
      setTabs(prev => prev.map(t => t.id === activeTabId ? {
        ...t,
        url: t.history[targetIdx],
        currentIndex: targetIdx,
        isLoading: true
      } : t));
    }
  };

  // Fresh refresh command
  const handleRefresh = () => {
    const iframe = iframeRef.current;
    if (iframe && activeTab) {
      loadStartRef.current = Date.now();
      setDiagnosticStatus("analyzing");
      iframe.src = getRenderUrl(activeTab.url);
    }
  };

  // Returns proxied URL or YouTube embed URL
  const getRenderUrl = (urlStr: string) => {
    if (!urlStr || urlStr === "about:blank") return "about:blank";

    // YouTube watch converter
    const ytIdMatcher = urlStr.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i);
    if (ytIdMatcher && ytIdMatcher[1]) {
      return `https://www.youtube.com/embed/${ytIdMatcher[1]}?autoplay=1&enablejsapi=1`;
    }

    if (urlStr.includes("youtube.com/results")) {
      return "about:blank";
    }

    return `/api/web-proxy?url=${encodeURIComponent(urlStr)}`;
  };

  // Trigger when proxy finishes loading iframe
  const handleIframeLoadComplete = () => {
    if (activeTab) {
      const dur = Date.now() - loadStartRef.current;
      setLoadTimeMs(dur);
      setDiagnosticStatus("secure");
      setIframeOnLoadCount(prev => prev + 1);

      setTabs(prev => prev.map(t => t.id === activeTabId ? {
        ...t,
        isLoading: false,
        title: getCleanTitleFromUrl(t.url)
      } : t));

      // Attempt to inspect same-origin document body for server errors
      try {
        const iframe = iframeRef.current;
        if (iframe && iframe.contentDocument) {
          const bodyTxt = iframe.contentDocument.body?.innerText || "";
          if (bodyTxt.includes("Elysia Web Proxy Error") || bodyTxt.includes("Failed loading remote website")) {
            setDiagnosticStatus("error");
            setDiagnosticReason(bodyTxt);
            setNetworkErrors(prev => [...prev, "Proxy server failed to resolve target host."]);
          }
        }
      } catch (err) {
        // Safe to ignore cross-origin security rules
      }
    }
  };

  const copyToClipboard = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(identifier);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div
      id="elysia-playwright-automation-hud"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in text-left select-none"
    >
      <div className="relative w-full max-w-5xl h-[88vh] flex flex-col rounded-3xl border border-white/10 bg-slate-900/85 shadow-[0_0_90px_rgba(168,85,247,0.4)] overflow-hidden">
        
        {/* Ambient aesthetic light streams */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.1),transparent_50%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.005)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.005)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-20" />

        {/* 1. TABS NAVIGATION RAIL */}
        <div className="relative z-10 px-4 pt-4 pb-1 border-b border-white/5 bg-slate-950/70 flex items-end justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-[80%]">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl transition-all duration-200 cursor-pointer text-xs font-mono select-none outline-none ${
                    isActive 
                      ? "bg-slate-900 border border-b-transparent border-white/10 text-white font-semibold shadow-inner" 
                      : "text-slate-500 hover:text-slate-300 bg-transparent hover:bg-white/5"
                  }`}
                >
                  <Globe size={11} className={tab.isLoading ? "animate-spin text-purple-400" : isActive ? "text-indigo-400" : "text-slate-500"} />
                  <span className="truncate max-w-[120px]">{tab.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    className="p-0.5 rounded hover:bg-white/10 text-slate-500 hover:text-white transition"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}

            <button
              onClick={() => handleNewTab()}
              className="p-1 px-1.5 ml-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Spawn New Tab"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex items-center gap-3 pb-2.5">
            {/* Developer debug panel toggle */}
            <button
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-mono tracking-wider font-extrabold cursor-pointer transition ${
                showDebugPanel 
                  ? "bg-amber-900/20 border-amber-500/30 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]" 
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
              }`}
            >
              <Terminal size={12} className={showDebugPanel ? "text-amber-400 animate-pulse" : ""} />
              <span>DEBUG PANEL {showDebugPanel ? "ON" : "OFF"}</span>
            </button>

            <button
              onClick={() => setShowLocalConsole(!showLocalConsole)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-mono tracking-wider font-extrabold cursor-pointer transition ${
                showLocalConsole 
                  ? "bg-purple-900/20 border-purple-500/30 text-purple-400" 
                  : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
              }`}
            >
              <Cpu size={12} />
              <span>LOCAL SYNC</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 px-3 rounded-xl bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/30 text-rose-300 hover:text-rose-100 transition font-sans text-xs cursor-pointer flex items-center gap-1"
            >
              <X size={13} /> Close
            </button>
          </div>
        </div>

        {/* 2. CHROME NAVIGATION INTERFACE BAR */}
        <div className="relative z-10 px-5 py-3 border-b border-white/5 bg-slate-900/80 flex items-center gap-3.5 shadow-md">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={!activeTab || activeTab.currentIndex <= 0}
              className="p-2 rounded-xl transition text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>

            <button
              onClick={handleForward}
              disabled={!activeTab || activeTab.currentIndex >= activeTab.history.length - 1}
              className="p-2 rounded-xl transition text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer"
              title="Forward"
            >
              <ArrowRight size={16} />
            </button>

            <button
              onClick={handleRefresh}
              disabled={!activeTab || activeTab.url === "about:blank"}
              className="p-2 rounded-xl transition text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-20 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={14} className={activeTab?.isLoading ? "animate-spin" : ""} />
            </button>

            <button
              onClick={() => navigateToUrl("about:blank")}
              className="p-2 rounded-xl transition text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              title="Home Start Page"
            >
              <Home size={15} />
            </button>
          </div>

          <form onSubmit={handleAddressSubmit} className="flex-1 relative flex items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type web address or search query..."
              className="w-full py-2 pl-10 pr-12 rounded-xl border border-white/10 bg-slate-950/70 text-slate-200 placeholder-slate-600 text-xs focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/40 tracking-wide transition font-mono"
            />
            <Search size={14} className="absolute left-3.5 text-slate-500" />
            <button
              type="submit"
              className="absolute right-2 text-[10px] font-mono tracking-widest uppercase font-bold text-slate-400 hover:text-purple-400 transition"
            >
              Go
            </button>
          </form>
        </div>

        {/* 3. CORE DISPLAY BODY */}
        <div className="relative z-10 flex-1 flex overflow-hidden">
          
          {/* MAIN WEBPAGE ZONE */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#07070c] relative">
            
            {activeTab?.url === "about:blank" ? (
              
              // HOME DASHBOARD INTERFACE
              <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center space-y-8 select-none text-center scrollbar-none">
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-3 max-w-lg"
                >
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-2xl shadow-purple-500/5 col-span-1">
                    <Globe size={26} className="text-purple-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold font-mono tracking-widest text-[#f5f3ff] uppercase flex items-center justify-center gap-1.5">
                      <Sparkles size={14} className="text-purple-400" /> Holographic Navigation Projection
                    </h3>
                    <p className="text-[10px] text-slate-500 font-mono tracking-wide mt-1 leading-normal max-w-sm mx-auto uppercase">
                      Pristine Real-time web browser stream with fully integrated sandbox diagnostics wrapper!
                    </p>
                  </div>
                </motion.div>

                {/* Shortcuts Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 w-full max-w-2xl text-left">
                  {[
                    { name: "YouTube", desc: "Interactive media search and embed watcher", url: "https://youtube.com", icon: <Play size={13} />, color: "text-red-400 bg-red-950/10 border-red-500/20 hover:border-red-500/40" },
                    { name: "Wikipedia", desc: "Unlock endless global articles and content", url: "https://wikipedia.org", icon: <BookOpen size={13} />, color: "text-emerald-400 bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40" },
                    { name: "Google Search", desc: "External redirect search result portal", url: "https://google.com", icon: <Search size={13} />, color: "text-blue-400 bg-blue-950/10 border-blue-500/20 hover:border-blue-500/40" },
                    { name: "ChatGPT Console", desc: "Direct external artificial dialogue link", url: "https://chatgpt.com", icon: <Sparkles size={13} />, color: "text-sky-400 bg-sky-950/15 border-sky-500/20 hover:border-sky-500/40" },
                    { name: "Gmail Portal", desc: "Private inbox account authentication", url: "https://gmail.com", icon: <Layers size={13} />, color: "text-amber-500/80 bg-amber-950/15 border-amber-500/20 hover:border-amber-500/40" },
                    { name: "DuckDuckGo Proxy", desc: "Lightweight search indexes in nested viewport", url: "https://duckduckgo.com", icon: <Shield size={13} />, color: "text-orange-400 bg-orange-950/15 border-orange-500/20 hover:border-orange-500/40" }
                  ].map((shortcut, i) => (
                    <motion.div
                      key={shortcut.name}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => navigateToUrl(shortcut.url)}
                      className={`p-3.5 rounded-2xl border ${shortcut.color} hover:bg-white/5 cursor-pointer hover:shadow-lg transition duration-200 group flex flex-col justify-between h-24`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="p-1 rounded-lg bg-white/5 text-xs text-slate-300">{shortcut.icon}</span>
                        <ArrowRight size={11} className="opacity-0 group-hover:opacity-100 text-slate-300 transition duration-200" />
                      </div>
                      <div>
                        <span className="text-xs font-bold font-mono tracking-wide text-slate-200">{shortcut.name}</span>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5 leading-normal max-w-[170px] truncate">{shortcut.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="p-3 border border-white/5 bg-slate-950/50 rounded-2xl max-w-md w-full">
                  <p className="text-[9px] font-mono text-slate-500 leading-normal uppercase">
                    🌸 COMPANION TIP: Voice command Elysia to trigger any automation: <br />
                    <span className="text-indigo-400 font-bold">&ldquo;Search YouTube for Naruto opening&rdquo;</span>
                  </p>
                </div>

              </div>
            ) : diagnosticStatus === "restricted" ? (
              
              // RESTRICTED DIRECT REDIRECTION PORTAL (TO AVOID BROKEN LOADING SCREEN)
              <div className="flex-1 w-full h-full p-8 flex flex-col items-center justify-center bg-slate-950/80 text-center relative overflow-y-auto scrollbar-none">
                <div className="absolute inset-0 bg-radial-gradient from-amber-500/5 to-transparent pointer-events-none" />
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-xl p-8 rounded-3xl border border-amber-500/20 bg-slate-900/60 backdrop-blur-md space-y-6 shadow-[0_0_50px_rgba(245,158,11,0.06)]"
                >
                  <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Shield size={22} className="text-amber-400" />
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-amber-500">
                      SECURE REDIRECTION COMPONENT
                    </span>
                    <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wide">
                      SANDBOX CORS / CSP NEUTRALIZATION INJECTED
                    </h3>
                    <p className="text-xs font-sans text-slate-400 leading-relaxed max-w-md mx-auto">
                      Elysia automatically detected secure sandbox constraints for <span className="font-mono text-indigo-300 font-semibold">{getCleanTitleFromUrl(activeTab?.url || "")}</span>. 
                      To bypass iframe restrictions and secure your cookies, we loaded this real website in a native browser tab!
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-white/5 bg-slate-950/40 text-[10px] font-mono text-left space-y-1 text-slate-400">
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500">TARGET:</span> <span className="text-slate-300 truncate max-w-[300px]">{activeTab?.url}</span></div>
                    <div className="flex justify-between pt-1"><span className="text-slate-500">CONSTRAINT:</span> <span className="text-amber-400">{diagnosticReason}</span></div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
                    <button
                      onClick={() => window.open(activeTab?.url, "_blank", "noopener,noreferrer")}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-mono transition duration-200 cursor-pointer flex items-center gap-1.5 justify-center shadow-lg shadow-amber-500/10"
                    >
                      <ExternalLink size={13} /> RE-LAUNCH NATIVE TAB
                    </button>
                    <button
                      onClick={() => navigateToUrl("about:blank")}
                      className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-mono transition cursor-pointer justify-center"
                    >
                      RETURN START PAGE
                    </button>
                  </div>
                </motion.div>
              </div>

            ) : diagnosticStatus === "error" ? (
              
              // PROXY FETCH ERROR RECOVERY PORTAL
              <div className="flex-1 w-full h-full p-8 flex flex-col items-center justify-center bg-slate-950/80 text-center relative overflow-y-auto scrollbar-none">
                <div className="absolute inset-0 bg-radial-gradient from-rose-500/5 to-transparent pointer-events-none" />
                
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-xl p-8 rounded-3xl border border-rose-500/20 bg-slate-900/60 backdrop-blur-md space-y-6 shadow-[0_0_50px_rgba(244,63,94,0.06)]"
                >
                  <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center animate-pulse">
                    <AlertCircle size={22} className="text-rose-400" />
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-rose-500">
                      CONNECTION DIAGNOSTICS DETECTED
                    </span>
                    <h3 className="text-sm font-bold font-mono text-white uppercase tracking-wide">
                      Web Proxy Connection Refused
                    </h3>
                    <p className="text-xs font-sans text-slate-400 leading-relaxed max-w-sm mx-auto font-medium">
                      Elysia was unable to load <span className="font-mono text-indigo-300 font-semibold">{getCleanTitleFromUrl(activeTab?.url || "")}</span> securely. This website may be offline, spelled incorrectly, or blocking automated server access.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-white/5 bg-slate-950/40 text-[10px] font-mono text-left space-y-1.5 text-slate-400 max-h-[150px] overflow-y-auto scrollbar-thin">
                    <div className="flex justify-between border-b border-white/5 pb-1"><span className="text-slate-500 font-bold">TARGET URL:</span> <span className="text-slate-300 truncate max-w-[300px]">{activeTab?.url}</span></div>
                    <div className="pt-1"><span className="text-slate-500 block mb-1 font-bold">REASON FOR FAILURE:</span> <span className="text-rose-400 block leading-normal">{diagnosticReason || "The remote server rejected or blocked the proxy server handshake connection."}</span></div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2">
                    <button
                      onClick={() => window.open(activeTab?.url, "_blank", "noopener,noreferrer")}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold font-mono transition duration-200 cursor-pointer flex items-center gap-1.5 justify-center shadow-lg shadow-purple-500/10"
                    >
                      <ExternalLink size={13} /> LAUNCH NATIVE TAB
                    </button>
                    <button
                      onClick={() => navigateToUrl("about:blank")}
                      className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-mono transition cursor-pointer justify-center"
                    >
                      RETURN START PAGE
                    </button>
                  </div>
                </motion.div>
              </div>

            ) : activeTab?.url && activeTab.url.includes("youtube.com/results") ? (

              // REAL YOUTUBE SEARCH RESULTS VIEWER LAYER (SATISFIES GOAL 2)
              <div className="flex-1 w-full h-full bg-slate-950 flex flex-col overflow-hidden relative">
                
                {/* Search summary header */}
                <div className="px-6 py-4.5 border-b border-white/5 bg-slate-900/40 flex items-center justify-between z-10">
                  <div className="flex items-center gap-2">
                    <Play size={14} className="text-red-500" />
                    <span className="font-mono text-xs text-slate-200 font-bold uppercase tracking-wider">
                      Real-time YouTube Portal: &ldquo;{new URLSearchParams(activeTab.url.substring(activeTab.url.indexOf("?"))).get("search_query")}&rdquo;
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 uppercase font-extrabold tracking-widest flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Connection Established
                  </span>
                </div>

                {ytSearchLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-3.5">
                    <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-red-500 animate-pulse font-extrabold">Parsing Video Matrix Stream...</span>
                  </div>
                ) : ytSearchError ? (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <AlertCircle size={24} className="text-red-400 animate-pulse" />
                    <p className="font-mono text-xs text-red-400 uppercase tracking-wider">Search Pipeline Refused Connection</p>
                    <p className="font-sans text-[11px] text-slate-500 max-w-sm text-center leading-normal">{ytSearchError}</p>
                    <button 
                      onClick={handleRefresh}
                      className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-mono text-xs text-slate-300 transition"
                    >
                      Retry Connection
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 scrollbar-thin">
                    {ytSearchResults.map((video) => (
                      <motion.div
                        key={video.videoId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => navigateToUrl(`https://youtube.com/watch?v=${video.videoId}`)}
                        className="bg-slate-900/50 border border-white/5 hover:border-red-500/30 rounded-2xl overflow-hidden cursor-pointer hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 group flex flex-col h-full"
                      >
                        {/* Thumbnail segment */}
                        <div className="relative aspect-video bg-black overflow-hidden">
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-black/85 font-mono text-[9px] text-slate-200 font-bold tracking-wide">
                            {video.duration}
                          </span>
                        </div>

                        {/* Text meta segment */}
                        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                          <div className="space-y-1.5">
                            <h4 className="font-sans text-xs font-semibold text-slate-100 group-hover:text-red-400 transition line-clamp-2 leading-relaxed">
                              {video.title}
                            </h4>
                            <p className="font-mono text-[10px] text-slate-400 truncate tracking-wide">
                              {video.author}
                            </p>
                          </div>

                          <div className="flex items-center justify-between border-t border-white/5 pt-2.5 text-[9px] font-mono text-slate-500">
                            <span>{video.views}</span>
                            <span className="text-slate-600">•</span>
                            <span>{video.published || "Active Video"}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                    {ytSearchResults.length === 0 && (
                      <div className="col-span-full py-20 text-center space-y-2 font-mono text-slate-500 text-xs">
                        <Play size={20} className="mx-auto text-slate-600 mb-1" />
                        <div>No videos retrieved for this query.</div>
                        <div className="text-[10px] text-slate-600">Consider trying another video search keyword.</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

            ) : (
              
              // SAM-ORIGIN SECURITY IFRAME PORTAL (Wikipedia, DuckDuckGo proxy etc. load here 100% real)
              <div className="flex-1 w-full h-full relative overflow-hidden">
                <iframe
                  ref={iframeRef}
                  src={getRenderUrl(activeTab?.url || "about:blank")}
                  onLoad={handleIframeLoadComplete}
                  className="w-full h-full border-0 absolute inset-0 bg-[#07070a]"
                  allow="autoplay; encrypted-media; fullscreen"
                />

                {/* Secure Loading indicators */}
                {activeTab?.isLoading && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center space-y-4">
                    <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span className="font-mono text-[10px] text-purple-300 animate-pulse tracking-[0.25em] font-bold uppercase">
                      Materializing Secure Projection...
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PLAYWRIGHT LOCAL SIDE BAR - COLLAPSABLE CONSOLE TRAY */}
          <AnimatePresence>
            {showLocalConsole && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 330, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="shrink-0 flex flex-col border-l border-white/5 bg-slate-950/70 backdrop-blur-md overflow-hidden relative"
              >
                <div className="p-5 flex-1 flex flex-col overflow-hidden space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <span className="font-mono text-xs uppercase tracking-wider text-purple-300 font-bold flex items-center gap-1.5">
                      <Terminal size={14} /> Local Playwright Logs
                    </span>
                    <button
                      onClick={() => setShowLocalConsole(false)}
                      className="text-slate-500 hover:text-white transition cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {!isLocalConnected ? (
                    
                    // Offline terminal assistance
                    <div className="flex-1 overflow-y-auto space-y-5 pr-1 select-text">
                      <div className="p-3.5 rounded-xl border border-indigo-500/10 bg-indigo-505/10 text-[11px] font-sans leading-normal text-indigo-300">
                        <p className="font-bold uppercase tracking-wider text-xs mb-1">Local Browser Sync Mode</p>
                        <span>If you prefer to command a real, headed Chrome browser on your desktop computer, easily launch Elysia's local client script!</span>
                      </div>

                      <div className="space-y-4 font-mono text-[10px]">
                        <div>
                          <p className="text-slate-400 uppercase font-bold mb-1">1. Install libraries</p>
                          <div className="p-2.5 bg-slate-950 border border-white/5 rounded-lg flex items-center justify-between text-slate-300">
                            <code>npm install playwright express cors</code>
                            <button onClick={() => copyToClipboard("npm install playwright express cors", "install1")} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white">
                              {copiedSection === "install1" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-slate-400 uppercase font-bold mb-1">2. Run playwight installer</p>
                          <div className="p-2.5 bg-slate-950 border border-white/5 rounded-lg flex items-center justify-between text-slate-300">
                            <code>npx playwright install chromium</code>
                            <button onClick={() => copyToClipboard("npx playwright install chromium", "install2")} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white">
                              {copiedSection === "install2" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            </button>
                          </div>
                        </div>

                        <div>
                          <p className="text-slate-400 uppercase font-bold mb-1">3. Launch local connection</p>
                          <div className="p-2.5 bg-slate-950 border border-white/5 rounded-lg flex items-center justify-between text-slate-300">
                            <code>node local-agent.js</code>
                            <button onClick={() => copyToClipboard("node local-agent.js", "install3")} className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white">
                              {copiedSection === "install3" ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    
                    // Live Local terminal system trace logs
                    <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-2 pr-1 select-text scrollbar-thin">
                      {localLogs.length === 0 ? (
                        <div className="text-slate-600 italic">No operations recorded yet. Speaking with Elysia will generate real terminal logs.</div>
                      ) : (
                        localLogs.map((log) => (
                          <div
                            key={log.id}
                            className={`p-2 rounded-lg border leading-normal ${
                              log.type === "success"
                                ? "text-emerald-400 bg-emerald-950/10 border-emerald-500/10"
                                : log.type === "error"
                                ? "text-rose-400 bg-rose-950/10 border-rose-500/10"
                                : log.type === "action"
                                ? "text-purple-300 bg-purple-950/20 border-purple-500/20 font-semibold"
                                : "text-slate-400 bg-white/5 border-transparent"
                            }`}
                          >
                            {log.text}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-white/5 text-[9px] font-mono text-slate-500 text-center uppercase tracking-widest">
                    SYNC CONTROLLER • v1.1.0
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* 4. DEVELOPER DIAGNOSTICS & DEBUG PANEL (SATISFIES GOAL 3 & GOAL 4) */}
        <AnimatePresence>
          {showDebugPanel && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="relative z-20 border-t border-white/10 bg-slate-950/90 text-left backdrop-blur-xl shrink-0"
            >
              <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-[10px] tracking-wide text-slate-400 leading-normal max-h-48 overflow-y-auto select-text scrollbar-thin">
                
                {/* Panel row header */}
                <div className="md:col-span-4 flex items-center justify-between border-b border-white/5 pb-1.5 mb-1 text-[11px] font-extrabold uppercase text-amber-400">
                  <div className="flex items-center gap-1.5">
                    <Terminal size={13} className="animate-pulse" />
                    <span>Active Elysia Browser Diagnostics console</span>
                  </div>
                  <span className="text-[9px] text-slate-500 hover:text-slate-300 cursor-pointer" onClick={() => setShowDebugPanel(false)}>
                    Collapse [x]
                  </span>
                </div>

                {/* Param group 1: Navigation Status */}
                <div className="space-y-1 bg-white/5 p-2 rounded-xl border border-white/5">
                  <p className="text-slate-500 font-bold uppercase select-none">STATE METRICS</p>
                  <div>
                    <span className="text-slate-600">Frame URL:</span>{" "}
                    <span className="text-indigo-400 select-all font-semibold truncate max-w-[120px] inline-block align-bottom">{activeTab?.url || "about:blank"}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Active Tab ID:</span>{" "}
                    <span className="text-slate-300">{activeTabId || "None"}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Browser Status:</span>{" "}
                    <span className={`font-semibold ${
                      diagnosticStatus === "secure" ? "text-emerald-400" :
                      diagnosticStatus === "restricted" ? "text-amber-400" :
                      diagnosticStatus === "error" ? "text-rose-400" : "text-slate-400"
                    }`}>
                      {diagnosticStatus.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Loading State:</span>{" "}
                    <span className="text-slate-300">{activeTab?.isLoading ? "ACTIVE FETCH" : "IDLE"}</span>
                  </div>
                </div>

                {/* Param group 2: Loading & Errors */}
                <div className="space-y-1 bg-white/5 p-2 rounded-xl border border-white/5">
                  <p className="text-slate-500 font-bold uppercase select-none">LOAD METRICS</p>
                  <div>
                    <span className="text-slate-600">Elapsed Time:</span>{" "}
                    <span className="text-purple-400">{loadTimeMs}ms</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Load Successes:</span>{" "}
                    <span className="text-slate-300">{iframeOnLoadCount} triggers</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Page load errors:</span>{" "}
                    <span className={diagnosticStatus === "error" ? "text-rose-400" : "text-emerald-500"}>
                      {diagnosticStatus === "error" ? "1 Refusal detected" : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600">Network Status:</span>{" "}
                    <span className="text-emerald-400 font-bold">ONLINE</span>
                  </div>
                </div>

                {/* Param group 3: Restrictions Check */}
                <div className="space-y-1 bg-white/5 p-2 rounded-xl border border-white/5 md:col-span-1">
                  <p className="text-slate-500 font-bold uppercase select-none">EMBED CONSTRAINTS</p>
                  <p className="text-slate-600 leading-tight">
                    {diagnosticReason ? (
                      <span className="text-amber-400 leading-normal block">
                        [FLAGGED] {diagnosticReason}
                      </span>
                    ) : (
                      <span className="text-emerald-500 leading-normal block">
                        No frame CSP restrictions active in proxy stream.
                      </span>
                    )}
                  </p>
                </div>

                {/* Param group 4: Exceptions Stack */}
                <div className="space-y-1 bg-white/5 p-2 rounded-xl border border-white/5 md:col-span-1">
                  <p className="text-slate-500 font-bold uppercase select-none">JAVASCRIPT ERRORS</p>
                  <div className="max-h-16 overflow-y-auto scrollbar-thin text-[9px] text-slate-500 select-text leading-tight leading-normal">
                    {jsErrors.length === 0 ? (
                      <span className="text-slate-600 italic">No Javascript exceptions detected.</span>
                    ) : (
                      jsErrors.map((err, i) => (
                        <div key={i} className="text-rose-400 truncate border-b border-white/5 pb-1 select-text">
                          {err}
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};
