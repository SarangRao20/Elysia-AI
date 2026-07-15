"""
Windows auto-start management for ELYSIA (V2).

Manages a single registry entry under
    HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\Elysia
which points at the silent launcher batch file (start-elysia-silent.bat) located
in the project root. HKCU is used (no admin rights required) and the change is
per-user.

Tools:
  - enableAutoStart   : write the Run key + ensure the .bat exists
  - disableAutoStart  : remove the Run key
  - getAutoStartStatus: report whether the entry exists + its target

Gracefully degrades on non-Windows platforms (returns a clear message instead
of raising).
"""

from __future__ import annotations

import os
import sys
from typing import Any, Dict

from .registry import ToolError, register

RUN_KEY_PATH = r"Software\\Microsoft\\Windows\\CurrentVersion\\Run"
VALUE_NAME = "Elysia"
SILENT_LAUNCHER = "start-elysia-silent.bat"


def _project_root() -> str:
    """Return the project root (parent of the desktop_agent package)."""
    # desktop_agent/tools_startup.py -> .. -> project root
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _launcher_path() -> str:
    return os.path.join(_project_root(), SILENT_LAUNCHER)


def _ensure_launcher_exists() -> str:
    """
    Make sure start-elysia-silent.bat exists in the project root.
    If missing, write a minimal silent launcher so auto-start never breaks.
    """
    path = _launcher_path()
    if os.path.isfile(path):
        return path
    # Best-effort creation of a silent launcher that starts both backends.
    py_candidates = [
        r"C:\\Users\\MSI\\AppData\\Local\\Programs\\Python\\Python311\\python.exe",
        "python",
        "python3",
    ]
    py = next((p for p in py_candidates if _which(p)), "python")
    body = "\n".join(
        [
            "@echo off",
            "chcp 65001 >nul",
            f'set "PROJECT_DIR={_project_root()}"',
            f'set "PYTHON_EXE={py}"',
            "cd /d \"%PROJECT_DIR%\"",
            (
                'start "" /B "%PYTHON_EXE%" -m uvicorn desktop_agent.main:app '
                '--host 127.0.0.1 --port 8765'
            ),
            "timeout /t 3 /nobreak >nul",
            "start \"\" /B npm run dev",
            "timeout /t 6 /nobreak >nul",
            'start "" "http://localhost:3000"',
            "",
        ]
    )
    try:
        with open(path, "w", encoding="utf-8", newline="\\r\\n") as fh:
            fh.write(body)
    except OSError as e:  # pragma: no cover - filesystem error
        raise ToolError(f"Could not create silent launcher: {e}") from e
    return path


def _which(cmd: str) -> bool:
    """True if a command resolves on PATH (very small shim, no shutil import)."""
    from shutil import which

    return which(cmd) is not None


def _is_windows() -> bool:
    return sys.platform.startswith("win") or os.name == "nt"


# --- Registry helpers --------------------------------------------------------

def _open_run_key():
    """Open HKCU Run key for read/write. Returns the handle (caller closes)."""
    if not _is_windows():
        raise ToolError("Auto-start is only supported on Windows.")
    import winreg  # type: ignore[import-not-found]

    return winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, RUN_KEY_PATH, 0, winreg.KEY_SET_VALUE | winreg.KEY_READ)


def _read_run_value() -> str | None:
    if not _is_windows():
        return None
    try:
        import winreg  # type: ignore[import-not-found]

        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, RUN_KEY_PATH, 0, winreg.KEY_READ
        ) as key:
            value, _ = winreg.QueryValueEx(key, VALUE_NAME)
            return str(value)
    except FileNotFoundError:
        return None
    except OSError:
        return None
    except ImportError:
        return None


# --- Tools -------------------------------------------------------------------

@register("enableAutoStart")
def enable_auto_start(args: Dict[str, Any]) -> Dict[str, Any]:
    """Create the Windows startup entry pointing at the silent launcher."""
    if not _is_windows():
        return {"result": "Auto-start is not available on this platform (Linux). Consider using systemd for auto-start.", "enabled": False, "platform": sys.platform}
    launcher = _ensure_launcher_exists()
    import winreg  # type: ignore[import-not-found]

    # Quote the path so spaces in the project dir don't break the command.
    command = f'cmd /c "{launcher}"'
    try:
        with _open_run_key() as key:
            winreg.SetValueEx(key, VALUE_NAME, 0, winreg.REG_SZ, command)
    except OSError as e:
        raise ToolError(f"Could not write startup registry entry: {e}") from e

    return {
        "result": "Auto-start enabled. Elysia will launch silently on next Windows login.",
        "enabled": True,
        "launcher": launcher,
        "registry_key": f"HKCU\\{RUN_KEY_PATH}\\{VALUE_NAME}",
    }


@register("disableAutoStart")
def disable_auto_start(args: Dict[str, Any]) -> Dict[str, Any]:
    """Remove the Windows startup entry."""
    if not _is_windows():
        return {"result": "Auto-start is not available on this platform (Linux). No action needed.", "enabled": False, "platform": sys.platform}
    existing = _read_run_value()
    if existing is None:
        return {"result": "Auto-start was already disabled.", "enabled": False}
    import winreg  # type: ignore[import-not-found]

    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, RUN_KEY_PATH, 0, winreg.KEY_SET_VALUE
        ) as key:
            winreg.DeleteValue(key, VALUE_NAME)
    except FileNotFoundError:
        return {"result": "Auto-start was already disabled.", "enabled": False}
    except OSError as e:
        raise ToolError(f"Could not remove startup registry entry: {e}") from e

    return {
        "result": "Auto-start disabled. Elysia will no longer launch on login.",
        "enabled": False,
    }


@register("getAutoStartStatus")
def get_auto_start_status(args: Dict[str, Any]) -> Dict[str, Any]:
    """Report whether auto-start is currently enabled."""
    if not _is_windows():
        return {"result": "Auto-start is only supported on Windows.", "enabled": False, "platform": sys.platform}
    value = _read_run_value()
    enabled = value is not None
    return {
        "result": (
            "Auto-start is ENABLED. Elysia launches on Windows login."
            if enabled
            else "Auto-start is DISABLED."
        ),
        "enabled": enabled,
        "launcher": value,
        "platform": sys.platform,
    }
