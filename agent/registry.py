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

        # Sudo command store: command_id -> { command, expires_at }
        self.sudo_commands: Dict[str, Dict[str, Any]] = {}

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
    "desktopBrowserSetMode",
    "browserMediaControl",
    # unified client-side browser tool (mapped to Playwright ops)
    "browserTabAction",
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
    "provideSudoPassword",
    "installPackage",
    "isCommandAllowed",
    # IITM BS (V2)
    "iitmQuickLinks",
    "iitmOpen",
    "iitmOpenCustom",
    # self-close
    "shutdownElysia",
    # weather
    "getWeather",
    # OS input
    "osType",
    "osPress",
    "osClick",
    # Hyprland workspaces
    "switchWorkspace",
    "listWorkspaces",
    "moveToWorkspace",
    # news
    "getNews",
    # conversation export
    "exportConversation",
    "listExports",
    # Google Calendar, Gmail, Tasks
    "getCalendarEvents",
    "createCalendarEvent",
    "sendEmail",
    "getEmails",
    "getTasks",
    "createTask",
]


# --- Eagerly import all tool modules so their @register decorators run. ---
# Each module is imported defensively: a hard import failure here would make
# the whole agent unstartable, which we want to avoid. The modules themselves
# keep optional-dependency imports lazy/try-except.
_MODULE_NAMES = [
    "tools.confirmation",
    "tools.applications",
    "tools.websites",
    "tools.search",
    "tools.files",
    "tools.pc",
    "tools.windows",
    "tools.clipboard",
    "tools.screenshot",
    "tools.browser",
    "tools.coding",
    "tools.system",
    "tools.startup",
    "tools.terminal",
    "tools.iitm",
    "tools.weather",
    "tools.hyprland",
    "tools.news",
    "tools.conversation",
    "tools.os_input",
    "tools.google",
]


def load_all() -> None:
    import agent.tools.confirmation
    import agent.tools.applications
    import agent.tools.websites
    import agent.tools.search
    import agent.tools.files
    import agent.tools.pc
    import agent.tools.windows
    import agent.tools.clipboard
    import agent.tools.screenshot
    import agent.tools.browser
    import agent.tools.coding
    import agent.tools.system
    import agent.tools.startup
    import agent.tools.terminal
    import agent.tools.iitm
    import agent.tools.weather
    import agent.tools.hyprland
    import agent.tools.news
    import agent.tools.conversation
    import agent.tools.os_input
    import agent.tools.google


__all__ = ["TOOLS", "STATE", "DESKTOP_TOOL_NAMES", "ToolError", "register", "load_all"]
