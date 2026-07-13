"""
Application control: launch and close common applications.

Uses the OS backend for platform-independent app launching and closing.
"""

from __future__ import annotations

from typing import Any, Dict

from .registry import ToolError, register
from .backends import get_backend

APP_COMMANDS: Dict[str, Dict[str, str]] = {
    "notepad": {"exe": "notepad.exe", "image": "notepad.exe", "label": "Notepad", "linux_cmd": "gedit", "linux_image": "gedit"},
    "chrome": {"exe": "chrome.exe", "image": "chrome.exe", "label": "Google Chrome", "linux_cmd": "google-chrome-stable", "linux_image": "chrome"},
    "edge": {"exe": "msedge.exe", "image": "msedge.exe", "label": "Microsoft Edge", "linux_cmd": "microsoft-edge-stable", "linux_image": "msedge"},
    "vscode": {"exe": "code.cmd", "image": "Code.exe", "label": "Visual Studio Code", "linux_cmd": "code", "linux_image": "code"},
    "calculator": {"shell": "calc", "image": "CalculatorApp.exe", "label": "Calculator", "linux_cmd": "gnome-calculator", "linux_image": "gnome-calculator"},
    "calc": {"shell": "calc", "image": "CalculatorApp.exe", "label": "Calculator", "linux_cmd": "gnome-calculator", "linux_image": "gnome-calculator"},
    "file explorer": {"shell": "explorer", "image": "explorer.exe", "label": "File Explorer", "linux_cmd": "nautilus", "linux_image": "nautilus"},
    "explorer": {"shell": "explorer", "image": "explorer.exe", "label": "File Explorer", "linux_cmd": "nautilus", "linux_image": "nautilus"},
    "task manager": {"shell": "taskmgr", "image": "Taskmgr.exe", "label": "Task Manager", "linux_cmd": "gnome-system-monitor", "linux_image": "gnome-system-monitor"},
    "taskmanager": {"shell": "taskmgr", "image": "Taskmgr.exe", "label": "Task Manager", "linux_cmd": "gnome-system-monitor", "linux_image": "gnome-system-monitor"},
    "settings": {"uwp": "ms-settings:", "image": "SystemSettings.exe", "label": "Settings", "linux_cmd": "gnome-control-center", "linux_image": "gnome-control-center"},
    "command prompt": {"exe": "cmd.exe", "image": "cmd.exe", "label": "Command Prompt", "linux_cmd": "gnome-terminal", "linux_image": "gnome-terminal-server"},
    "cmd": {"exe": "cmd.exe", "image": "cmd.exe", "label": "Command Prompt", "linux_cmd": "gnome-terminal", "linux_image": "gnome-terminal-server"},
    "powershell": {"exe": "powershell.exe", "image": "powershell.exe", "label": "PowerShell", "linux_cmd": "pwsh", "linux_image": "pwsh"},
    "wordpad": {"shell": "write", "image": "wordpad.exe", "label": "WordPad", "linux_cmd": "abiword", "linux_image": "abiword"},
    "paint": {"shell": "mspaint", "image": "mspaint.exe", "label": "Paint", "linux_cmd": "gimp", "linux_image": "gimp"},
    "snipping tool": {"uwp": "ms-screenclip:", "image": "ScreenClippingHost.exe", "label": "Snipping Tool", "linux_cmd": "gnome-screenshot", "linux_image": "gnome-screenshot"},
}


def _resolve_app(key: str) -> Dict[str, str]:
    norm = (key or "").strip().lower()
    if norm in APP_COMMANDS:
        return APP_COMMANDS[norm]
    # Allow loose aliases
    aliases = {
        "code": "vscode",
        "visual studio code": "vscode",
        "vs code": "vscode",
        "google chrome": "chrome",
        "microsoft edge": "edge",
        "calc": "calculator",
        "settings app": "settings",
        "file explorer": "file explorer",
        "windows explorer": "file explorer",
    }
    if norm in aliases and aliases[norm] in APP_COMMANDS:
        return APP_COMMANDS[aliases[norm]]
    raise ToolError(
        f"Unrecognized application '{key}'. Supported: "
        f"{', '.join(sorted({v['label'] for v in APP_COMMANDS.values()}))}."
    )


@register("openApplication")
def open_application(args: Dict[str, Any]) -> Dict[str, Any]:
    name = args.get("name") or args.get("application")
    if not name:
        raise ToolError("Parameter 'name' (application name) is required.")
    spec = _resolve_app(str(name))
    get_backend().launcher.launch(spec)
    return {"result": f"{spec['label']} opened."}


@register("closeApplication")
def close_application(args: Dict[str, Any]) -> Dict[str, Any]:
    name = args.get("name") or args.get("application")
    force = bool(args.get("force", False))
    if not name:
        raise ToolError("Parameter 'name' (application name) is required.")
    spec = _resolve_app(str(name))
    get_backend().launcher.close(spec, force)
    return {"result": f"Closed {spec['label']}."}


__all__ = ["open_application", "close_application", "APP_COMMANDS"]
