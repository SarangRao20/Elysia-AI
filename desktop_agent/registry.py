"""
ELYSIA Desktop Control Agent — Central tool registry.

Each tool module registers handlers into a flat dict `TOOLS` mapping
tool_name -> callable(args: dict) -> dict.

Handlers return a plain dict, typically {"result": "<status string>"}.
Errors should raise ToolError(message) so main.py can map them to {error}.
Shared singletons (Playwright browser/page, confirmation store, etc.) live
on the `State` object so handlers stay stateless and easy to test.
"""

from __future__ import annotations

import importlib
import threading
from typing import Any, Callable, Dict


class ToolError(Exception):
    """Raised by a tool handler to signal a clean, user-facing failure."""

    def __init__(self, message: str, *, fatal: bool = False):
        super().__init__(message)
        self.message = message
        self.fatal = fatal


class State:
    """Process-wide shared state for tool handlers."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        # Confirmation tokens for dangerous (power) actions.
        # token -> {"action": <tool_name>, "expires": <epoch>}
        self.confirmations: Dict[str, Dict[str, Any]] = {}
        # Playwright singletons — lazily initialized on first browser tool use.
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None

    def reset_playwright(self) -> None:
        """Tear down any cached Playwright resources (used on errors)."""
        try:
            if self.page is not None:
                self.page = None
            if self.context is not None:
                self.context = None
            if self.browser is not None:
                self.browser = None
            if self.playwright is not None:
                self.playwright = None
        except Exception:
            pass


STATE = State()

# tool_name -> handler(args: dict) -> dict
TOOLS: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {}


def register(name: str):
    """Decorator to register a handler under a tool name."""

    def deco(fn: Callable[[Dict[str, Any]], Dict[str, Any]]):
        TOOLS[name] = fn
        return fn

    return deco


# The set of all tool names ELYSIA may route to this agent.
# Kept in sync with the functionDeclarations added in server.ts.
DESKTOP_TOOL_NAMES = [
    # applications / websites / search
    "openApplication",
    "closeApplication",
    "openWebsite",
    "searchWeb",
    "searchYouTube",
    "searchGoogle",
    "searchGitHub",
    # files
    "createFile",
    "readFile",
    "renameFile",
    "deleteFile",
    "moveFile",
    "openFolder",
    "listFiles",
    "searchFiles",
    # pc control (volume + gated power)
    "volumeUp",
    "volumeDown",
    "muteToggle",
    "setVolume",
    "requestPowerAction",  # first step: issues a confirmation token
    "executePowerAction",  # second step: runs the gated action
    # windows
    "minimizeWindow",
    "maximizeWindow",
    "closeWindow",
    "switchApplication",
    # clipboard
    "copySelected",
    "pasteClipboard",
    "getClipboard",
    "clearClipboard",
    # screenshot / screen reading
    "takeScreenshot",
    "saveScreenshot",
    "analyzeScreenshot",
    "readScreen",
    # browser automation (Playwright — desktop-owned, separate from holographic UI)
    "desktopBrowserOpen",
    "desktopBrowserNavigate",
    "desktopBrowserOpenTab",
    "desktopBrowserCloseTab",
    "desktopBrowserSearch",
    "desktopBrowserClick",
    "desktopBrowserType",
    "desktopBrowserFillForm",
    "desktopBrowserGoBack",
    "desktopBrowserGoForward",
    "desktopBrowserScroll",
    "desktopBrowserReadText",
    "desktopBrowserGetLinks",
    # coding assistance
    "createPythonFile",
    "runPythonScript",
    "createProjectFolder",
    "writeCodeFile",
    # system information
    "systemInfo",
    "gpuInfo",
    "temperatureInfo",
    # brightness control (V2)
    "brightnessUp",
    "brightnessDown",
    "setBrightness",
    # Windows auto-start management (V2)
    "enableAutoStart",
    "disableAutoStart",
    "getAutoStartStatus",
    # terminal
    "requestTerminalAction",
    "runTerminalCommand",
    "installPackage",
    "isCommandAllowed",
    # IITM BS (V2)
    "iitmQuickLinks",
    "iitmOpen",
    "iitmOpenCustom",
    # self-close
    "shutdownElysia",
]


# --- Eagerly import all tool modules so their @register decorators run. ---
# Each module is imported defensively: a hard import failure here would make
# the whole agent unstartable, which we want to avoid. The modules themselves
# keep optional-dependency imports lazy/try-except.
_MODULE_NAMES = [
    "tools_confirmation",
    "tools_applications",
    "tools_websites",
    "tools_search",
    "tools_files",
    "tools_pc",
    "tools_windows",
    "tools_clipboard",
    "tools_screenshot",
    "tools_browser",
    "tools_coding",
    "tools_system",
    "tools_startup",
    "tools_terminal",
    "tools_iitm",
]


def load_all() -> None:
    import desktop_agent.tools_confirmation
    import desktop_agent.tools_applications
    import desktop_agent.tools_websites
    import desktop_agent.tools_search
    import desktop_agent.tools_files
    import desktop_agent.tools_pc
    import desktop_agent.tools_windows
    import desktop_agent.tools_clipboard
    import desktop_agent.tools_screenshot
    import desktop_agent.tools_browser
    import desktop_agent.tools_coding
    import desktop_agent.tools_system
    import desktop_agent.tools_startup
    import desktop_agent.tools_terminal
    import desktop_agent.tools_iitm


__all__ = ["TOOLS", "STATE", "DESKTOP_TOOL_NAMES", "ToolError", "register", "load_all"]
