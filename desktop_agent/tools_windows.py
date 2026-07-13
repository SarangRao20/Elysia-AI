"""
Window management: minimize / maximize / close the active window or switch apps.

Uses the backend abstraction to handle OS-specific window management.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from .registry import ToolError, register
from .backends import get_backend

SW_MINIMIZE = 6
SW_MAXIMIZE = 3
SW_RESTORE = 9
SW_HIDE = 0

def _resolve_target(args: Dict[str, Any]):
    """Pick the hwnd to operate on: explicit title, or the foreground window."""
    wm = get_backend().window_manager
    title: Optional[str] = args.get("title") or args.get("application")
    if title:
        hwnd = wm.find_window_by_title(str(title))
        if not hwnd:
            raise ToolError(f"No visible window with title containing '{title}'.")
        return hwnd, str(title)
    hwnd = wm.get_foreground_window()
    if not hwnd:
        raise ToolError("No active window found.")
    return hwnd, wm.get_window_title(hwnd)


@register("minimizeWindow")
def minimize_window(args: Dict[str, Any]) -> Dict[str, Any]:
    hwnd, title = _resolve_target(args)
    get_backend().window_manager.show_window(hwnd, SW_MINIMIZE)
    return {"result": f"Minimized window: {title or 'active window'}."}


@register("maximizeWindow")
def maximize_window(args: Dict[str, Any]) -> Dict[str, Any]:
    hwnd, title = _resolve_target(args)
    get_backend().window_manager.show_window(hwnd, SW_MAXIMIZE)
    return {"result": f"Maximized window: {title or 'active window'}."}


@register("closeWindow")
def close_window(args: Dict[str, Any]) -> Dict[str, Any]:
    hwnd, title = _resolve_target(args)
    get_backend().window_manager.close_window(hwnd)
    return {"result": f"Closed window: {title or 'active window'}."}


@register("switchApplication")
def switch_application(args: Dict[str, Any]) -> Dict[str, Any]:
    """Focus a window by title."""
    wm = get_backend().window_manager
    title = args.get("title") or args.get("application")
    if title:
        hwnd = wm.find_window_by_title(str(title))
        if not hwnd:
            raise ToolError(f"No visible window matching '{title}'.")
        wm.show_window(hwnd, SW_RESTORE)
        wm.focus(hwnd)
        return {"result": f"Switched to: {str(title)}."}

    # Alt+Tab cycle could be implemented via backend.clipboard / keys
    # or just enumerating windows, but for simplicity we require title.
    raise ToolError("Please specify an application title to switch to.")


__all__ = [
    "minimize_window",
    "maximize_window",
    "close_window",
    "switch_application",
]
