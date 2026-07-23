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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-2xl animate-fade-in text-left select-none"
    >
      <div className="relative w-full max-w-5xl h-[88vh] flex flex-col rounded-2xl border border-white/[0.06] bg-black/50 backdrop-blur-3xl shadow-[0_0_120px_rgba(13,148,136,0.12)] overflow-hidden">
        
        {/* Ambient teal/cyan glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(13,148,136,0.08),transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.05),transparent_50%)] pointer-events-none" />

        {/* ===== MINIMAL TAB BAR ===== */}
        <div className="relative z-10 flex items-center justify-between px-3 pt-1">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  className={`group/tab relative flex items-center gap-2 px-3 py-2.5 cursor-pointer text-xs font-sans select-none transition-colors duration-150 ${
                    isActive ? "text-white" : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {isActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-cyan-400 rounded-full" />
                  )}
                  {tab.isLoading && (
                    <span className="w-3 h-3 rounded-full border-[1.5px] border-white/20 border-t-cyan-400 animate-spin shrink-0" />
                  )}
                  <span className="truncate max-w-[100px]">{tab.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                    className="p-0.5 rounded opacity-0 group-hover/tab:opacity-100 text-white/30 hover:text-white/60 transition"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => handleNewTab()}
              className="p-1.5 ml-0.5 text-white/30 hover:text-white/60 transition cursor-pointer shrink-0"
            >
              <Plus size={15} />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-white/30 hover:text-white/60 transition cursor-pointer shrink-0"
            title="Close"
          >
            <X size={17} />
          </button>
        </div>

        {/* ===== MAIN CONTENT ===== */}
        <div className="relative z-10 flex-1 flex overflow-hidden mt-0.5">
          <div className="flex-1 flex flex-col overflow-hidden relative group">

            {/* HOME DASHBOARD */}
            {activeTab?.url === "about:blank" ? (
              <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-black via-teal-950/20 to-cyan-950/20 pointer-events-none" />
                <motion.div
                  className="absolute inset-0 bg-[radial-gradient(800px_circle_at_50%_30%,rgba(13,148,136,0.06),transparent_60%)] pointer-events-none"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div
                  className="absolute inset-0 bg-[radial-gradient(600px_circle_at_80%_70%,rgba(6,182,212,0.05),transparent_60%)] pointer-events-none"
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                />
                
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative z-10 w-full max-w-lg px-6"
                >
                  {/* Centered minimal search */}
                  <form onSubmit={handleAddressSubmit} className="relative mb-10">
                    <div className="flex items-center bg-black/40 backdrop-blur-xl border border-white/[0.08] rounded-full pl-5 pr-2 py-2.5 focus-within:border-cyan-500/30 focus-within:shadow-[0_0_40px_rgba(13,148,136,0.06)] transition-all duration-300">
                      <Search size={16} className="text-white/30 shrink-0" />
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Search or enter address..."
                        className="flex-1 bg-transparent px-3.5 py-1 text-sm text-white/80 placeholder-white/30 outline-none font-sans"
                      />
                      <button
                        type="submit"
                        className="px-5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white/50 hover:text-white/80 text-xs font-sans transition cursor-pointer"
                      >
                        Go
                      </button>
                    </div>
                  </form>

                  {/* Quick links as floating pills */}
                  <div className="flex flex-wrap justify-center gap-2.5">
                    {[
                      { name: "YouTube", url: "https://youtube.com", icon: <Play size={12} /> },
                      { name: "Wikipedia", url: "https://wikipedia.org", icon: <BookOpen size={12} /> },
                      { name: "Google", url: "https://google.com", icon: <Search size={12} /> },
                      { name: "ChatGPT", url: "https://chatgpt.com", icon: <Sparkles size={12} /> },
                      { name: "Gmail", url: "https://gmail.com", icon: <Layers size={12} /> },
                      { name: "DuckDuckGo", url: "https://duckduckgo.com", icon: <Shield size={12} /> },
                    ].map((link) => (
                      <motion.button
                        key={link.name}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigateToUrl(link.url)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] hover:border-cyan-500/20 text-xs text-white/50 hover:text-white/80 transition-all duration-200 cursor-pointer font-sans"
                      >
                        {link.icon}
                        {link.name}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </div>
            ) : diagnosticStatus === "restricted" ? (
              /* RESTRICTED - minimal single card */
              <div className="flex-1 flex items-center justify-center p-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-sm w-full p-6 rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-xl text-center space-y-4"
                >
                  <div className="mx-auto w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <Shield size={18} className="text-cyan-400" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-sans text-white/80">Site can't be embedded</p>
                    <p className="text-xs text-white/40 font-sans leading-relaxed max-w-xs mx-auto">
                      {getCleanTitleFromUrl(activeTab?.url || "")} blocks embedding due to security policies. Open it in your browser instead.
                    </p>
                  </div>
                  <button
                    onClick={() => window.open(activeTab?.url, "_blank", "noopener,noreferrer")}
                    className="px-5 py-2 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 text-xs font-sans transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <ExternalLink size={13} /> Open in browser
                  </button>
                </motion.div>
              </div>
            ) : diagnosticStatus === "error" ? (
              /* ERROR - minimal single card */
              <div className="flex-1 flex items-center justify-center p-8">
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-sm w-full p-6 rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-xl text-center space-y-4"
                >
                  <div className="mx-auto w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                    <AlertCircle size={18} className="text-rose-400" />
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-sans text-white/80">Connection failed</p>
                    <p className="text-xs text-white/40 font-sans leading-relaxed max-w-xs mx-auto">
                      Unable to load {getCleanTitleFromUrl(activeTab?.url || "")}. The site may be offline or blocking access.
                    </p>
                  </div>
                  <button
                    onClick={() => window.open(activeTab?.url, "_blank", "noopener,noreferrer")}
                    className="px-5 py-2 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-sans transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <ExternalLink size={13} /> Open in browser
                  </button>
                </motion.div>
              </div>
            ) : activeTab?.url && activeTab.url.includes("youtube.com/results") ? (
              /* YOUTUBE SEARCH RESULTS */
              <div className="flex-1 w-full h-full flex flex-col overflow-hidden relative">
                <div className="px-6 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Play size={13} className="text-red-500" />
                    <span className="text-xs text-white/60 font-sans">
                      YouTube results for &ldquo;{new URLSearchParams(activeTab.url.substring(activeTab.url.indexOf("?"))).get("search_query")}&rdquo;
                    </span>
                  </div>
                </div>

                {ytSearchLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-white/30 font-sans">Loading results...</span>
                  </div>
                ) : ytSearchError ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4">
                    <AlertCircle size={20} className="text-rose-400" />
                    <p className="text-xs text-white/50 font-sans max-w-sm text-center">{ytSearchError}</p>
                    <button 
                      onClick={handleRefresh}
                      className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-xs text-white/60 transition cursor-pointer font-sans"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 scrollbar-none">
                    {ytSearchResults.map((video) => (
                      <motion.div
                        key={video.videoId}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => navigateToUrl(`https://youtube.com/watch?v=${video.videoId}`)}
                        className="bg-white/[0.03] border border-white/[0.06] hover:border-red-500/20 rounded-xl overflow-hidden cursor-pointer hover:bg-white/[0.06] transition-all duration-200 group/card flex flex-col"
                      >
                        <div className="relative aspect-video bg-black overflow-hidden">
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover/card:scale-105 transition duration-300"
                          />
                          {video.duration && (
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white/70 font-sans">
                              {video.duration}
                            </span>
                          )}
                        </div>
                        <div className="p-3 flex flex-col gap-1.5">
                          <h4 className="text-xs font-sans text-white/80 group-hover/card:text-red-400 transition line-clamp-2 leading-relaxed">
                            {video.title}
                          </h4>
                          <p className="text-[11px] text-white/40 font-sans truncate">
                            {video.author}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-white/30 font-sans pt-1.5 border-t border-white/[0.04]">
                            <span>{video.views}</span>
                            <span>·</span>
                            <span>{video.published || ""}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                    
                    {ytSearchResults.length === 0 && (
                      <div className="col-span-full py-16 text-center space-y-2">
                        <Play size={18} className="mx-auto text-white/20" />
                        <p className="text-sm text-white/30 font-sans">No results found</p>
                        <p className="text-xs text-white/20 font-sans">Try a different search term</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* IFRAME PORTAL */
              <div className="flex-1 w-full h-full relative overflow-hidden">
                <iframe
                  ref={iframeRef}
                  src={getRenderUrl(activeTab?.url || "about:blank")}
                  onLoad={handleIframeLoadComplete}
                  className="w-full h-full border-0 absolute inset-0 bg-black"
                  allow="autoplay; encrypted-media; fullscreen"
                />
                {activeTab?.isLoading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-white/30 font-sans">Loading...</span>
                  </div>
                )}
              </div>
            )}

            {/* ===== FLOATING NAV BAR ===== */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="pointer-events-auto opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/50 backdrop-blur-2xl border border-white/[0.08] shadow-xl">
                <button
                  onClick={handleBack}
                  disabled={!activeTab || activeTab.currentIndex <= 0}
                  className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition cursor-pointer"
                  title="Back"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  onClick={handleForward}
                  disabled={!activeTab || activeTab.currentIndex >= activeTab.history.length - 1}
                  className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition cursor-pointer"
                  title="Forward"
                >
                  <ArrowRight size={14} />
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={!activeTab || activeTab.url === "about:blank"}
                  className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-20 transition cursor-pointer"
                  title="Refresh"
                >
                  <RefreshCw size={13} className={activeTab?.isLoading ? "animate-spin" : ""} />
                </button>
                <button
                  onClick={() => navigateToUrl("about:blank")}
                  className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Home"
                >
                  <Home size={14} />
                </button>
                <div className="w-px h-4 bg-white/[0.06]" />
                <form onSubmit={handleAddressSubmit} className="flex items-center">
                  <div className="flex items-center bg-black/30 rounded-full pl-3 pr-1">
                    <Search size={12} className="text-white/30 shrink-0" />
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Search or enter address..."
                      className="w-36 bg-transparent px-2 py-1 text-xs text-white/70 placeholder-white/30 outline-none font-sans"
                    />
                  </div>
                  <button
                    type="submit"
                    className="ml-1 px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white/50 hover:text-white/80 text-[10px] font-sans transition cursor-pointer"
                  >
                    Go
                  </button>
                </form>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
