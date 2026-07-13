"""
PC control: system volume and (gated) power actions.

Uses OSBackend for volume control.
"""

from __future__ import annotations

import os
import platform
import subprocess
from typing import Any, Dict, Optional

from .registry import ToolError, register
from .tools_confirmation import ACTION_LABEL, consume_token
from .backends import get_backend

@register("volumeUp")
def volume_up(args: Dict[str, Any]) -> Dict[str, Any]:
    step = float(args.get("amount", 0.10))
    backend = get_backend()
    new = min(1.0, backend.audio.get_volume() + step)
    backend.audio.set_volume(new)
    return {"result": f"Volume increased to {int(new * 100)}%."}


@register("volumeDown")
def volume_down(args: Dict[str, Any]) -> Dict[str, Any]:
    step = float(args.get("amount", 0.10))
    backend = get_backend()
    new = max(0.0, backend.audio.get_volume() - step)
    backend.audio.set_volume(new)
    return {"result": f"Volume decreased to {int(new * 100)}%."}


@register("setVolume")
def set_volume(args: Dict[str, Any]) -> Dict[str, Any]:
    if "percent" in args:
        pct = float(args["percent"])
    elif "level" in args:
        pct = float(args["level"])
    else:
        raise ToolError("Parameter 'percent' (0-100) is required.")
    pct = max(0.0, min(100.0, pct))
    get_backend().audio.set_volume(pct / 100.0)
    return {"result": f"Volume set to {int(pct)}%."}


@register("setBrightness")
def set_brightness(args: Dict[str, Any]) -> Dict[str, Any]:
    if "percent" in args:
        pct = float(args["percent"])
    elif "level" in args:
        pct = float(args["level"])
    else:
        raise ToolError("Parameter 'percent' (0-100) is required.")
    pct = max(0.0, min(100.0, pct))
    try:
        subprocess.run(["brightnessctl", "s", f"{int(pct)}%"], check=False)
        return {"result": f"Brightness set to {int(pct)}%."}
    except Exception as e:
        raise ToolError(f"Failed to set brightness: {e}")


@register("brightnessUp")
def brightness_up(args: Dict[str, Any]) -> Dict[str, Any]:
    step = int(args.get("amount", 10))
    try:
        out = subprocess.check_output(["brightnessctl", "get"], text=True).strip()
        current = int(out)
        mx = int(subprocess.check_output(["brightnessctl", "max"], text=True).strip())
        new_pct = min(100, int(current / mx * 100) + step)
        subprocess.run(["brightnessctl", "s", f"{new_pct}%"], check=False)
        return {"result": f"Brightness increased to {new_pct}%."}
    except Exception as e:
        raise ToolError(f"Failed to increase brightness: {e}")


@register("brightnessDown")
def brightness_down(args: Dict[str, Any]) -> Dict[str, Any]:
    step = int(args.get("amount", 10))
    try:
        out = subprocess.check_output(["brightnessctl", "get"], text=True).strip()
        current = int(out)
        mx = int(subprocess.check_output(["brightnessctl", "max"], text=True).strip())
        new_pct = max(0, int(current / mx * 100) - step)
        subprocess.run(["brightnessctl", "s", f"{new_pct}%"], check=False)
        return {"result": f"Brightness decreased to {new_pct}%."}
    except Exception as e:
        raise ToolError(f"Failed to decrease brightness: {e}")


@register("muteToggle")
def mute_toggle(args: Dict[str, Any]) -> Dict[str, Any]:
    muted = get_backend().audio.toggle_mute()
    return {"result": "Muted." if muted else "Unmuted."}


# --- Gated power actions -----------------------------------------------------


def _run_power(action: str) -> str:
    """Execute the actual OS power command. Caller must have confirmed first."""
    system = platform.system()
    if action == "lock":
        if system == "Windows":
            import ctypes
            ctypes.windll.user32.LockWorkStation()
            return "Computer locked."
        elif system == "Linux":
            subprocess.run(["loginctl", "lock-session"], check=False)
            return "Computer locked."
        return "Lock is only configured for Windows and systemd Linux."
    if action == "sleep":
        if system == "Windows":
            os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")
            return "Computer going to sleep."
        subprocess.run(["systemctl", "suspend"], check=False)
        return "Computer going to sleep."
    if action == "restart":
        if system == "Windows":
            subprocess.run(["shutdown", "/r", "/t", "5"], check=False)
            return "Computer restarting in 5 seconds."
        subprocess.run(["systemctl", "reboot"], check=False)
        return "Computer restarting."
    if action == "shutdown":
        if system == "Windows":
            subprocess.run(["shutdown", "/s", "/t", "10"], check=False)
            return "Computer shutting down in 10 seconds."
        subprocess.run(["systemctl", "poweroff"], check=False)
        return "Computer shutting down."
    raise ToolError(f"Unknown power action '{action}'.")


@register("executePowerAction")
def execute_power_action(args: Dict[str, Any]) -> Dict[str, Any]:
    action = (args.get("action") or "").strip().lower()
    token: Optional[str] = args.get("execute_token")

    from .tools_confirmation import DANGEROUS_ACTIONS

    if action not in DANGEROUS_ACTIONS:
        raise ToolError(
            f"Unknown power action '{action}'. Valid: {', '.join(sorted(DANGEROUS_ACTIONS))}."
        )

    consume_token(action, token)
    msg = _run_power(action)
    return {"result": msg, "action": action}


@register("_cancelPowerTimer")
def _cancel(args: Dict[str, Any]) -> Dict[str, Any]:
    if platform.system() == "Windows":
        subprocess.run(["shutdown", "/a"], check=False)
    else:
        # On systemd, shutdown -c sends SIGTERM to the shutdown process
        subprocess.run(["shutdown", "-c"], check=False)
    return {"result": "Cancelled pending shutdown/restart timer."}


@register("shutdownElysia")
def shutdown_elysia(args: Dict[str, Any]) -> Dict[str, Any]:
    """Gracefully shut down ELYSIA agent and server."""
    import os
    import signal
    import sys
    # Send SIGTERM to parent process (the start script) after a short delay
    def _shutdown():
        import time
        time.sleep(1)
        os.kill(os.getppid(), signal.SIGTERM)
        sys.exit(0)
    import threading
    threading.Thread(target=_shutdown, daemon=True).start()
    return {"result": "ELYSIA is shutting down. Goodbye!"}


__all__ = [
    "volume_up",
    "volume_down",
    "set_volume",
    "set_brightness",
    "mute_toggle",
    "request_power_action",
    "execute_power_action",
    "_cancel_power_timer",
    "shutdown_elysia",
]
