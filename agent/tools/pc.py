from __future__ import annotations

import os
import platform
import subprocess
from typing import Any, Dict, Optional

from ..registry import ToolError, register
from .confirmation import ACTION_LABEL, consume_token
from ..backends import get_backend


def _has_cmd(cmd: str) -> bool:
    return subprocess.run(["which", cmd], capture_output=True).returncode == 0


def _linux_powerctl(action: str) -> Optional[str]:
    if _has_cmd("systemctl"):
        cmds = {"lock": "loginctl lock-session", "sleep": "systemctl suspend",
                "restart": "systemctl reboot", "shutdown": "systemctl poweroff"}
        if action in cmds:
            subprocess.run(cmds[action].split(), check=False)
            return f"Computer {action}ing."
    if _has_cmd("shutdown") and action in ("restart", "shutdown"):
        flag = "-r" if action == "restart" else "-h"
        subprocess.run(["shutdown", flag, "now"], check=False)
        return f"Computer {action}ing."
    if action == "lock" and _has_cmd("loginctl"):
        subprocess.run(["loginctl", "lock-session"], check=False)
        return "Computer locked."
    return None


def _linux_brightness(pct: int) -> bool:
    if _has_cmd("brightnessctl"):
        subprocess.run(["brightnessctl", "s", f"{pct}%"], check=False)
        return True
    if _has_cmd("xrandr"):
        out = subprocess.check_output(["xrandr", "--current"], text=True)
        for line in out.splitlines():
            if " connected" in line:
                name = line.split()[0]
                subprocess.run(["xrandr", "--output", name, "--brightness", f"{pct/100:.2f}"], check=False)
                return True
    return False


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
        if platform.system() == "Windows":
            subprocess.run(["powershell", "-Command",
                f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {int(pct)})"], check=False)
        elif platform.system() == "Darwin":
            subprocess.run(["brightness", f"{pct/100}"], check=False)
        else:
            if not _linux_brightness(int(pct)):
                raise ToolError("No brightness control tool found. Install brightnessctl or xrandr.")
        return {"result": f"Brightness set to {int(pct)}%."}
    except Exception as e:
        raise ToolError(f"Failed to set brightness: {e}")


def _get_current_brightness() -> int:
    if platform.system() == "Windows":
        out = subprocess.check_output(["powershell", "-Command",
            "Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightness | Select-Object -ExpandProperty CurrentBrightness"], text=True).strip()
        return int(out) if out.isdigit() else 50
    elif platform.system() == "Darwin":
        out = subprocess.check_output(["brightness"], text=True).strip()
        return int(float(out) * 100)
    else:
        if _has_cmd("brightnessctl"):
            out = subprocess.check_output(["brightnessctl", "get"], text=True).strip()
            current = int(out)
            mx = int(subprocess.check_output(["brightnessctl", "max"], text=True).strip())
            return int(current / mx * 100)
        return 50


@register("brightnessUp")
def brightness_up(args: Dict[str, Any]) -> Dict[str, Any]:
    step = int(args.get("amount", 10))
    try:
        current = _get_current_brightness()
        new_pct = min(100, current + step)
        if platform.system() == "Windows":
            subprocess.run(["powershell", "-Command",
                f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {new_pct})"], check=False)
        elif platform.system() == "Darwin":
            subprocess.run(["brightness", f"{new_pct/100}"], check=False)
        else:
            _linux_brightness(new_pct)
        return {"result": f"Brightness increased to {new_pct}%."}
    except Exception as e:
        raise ToolError(f"Failed to increase brightness: {e}")


@register("brightnessDown")
def brightness_down(args: Dict[str, Any]) -> Dict[str, Any]:
    step = int(args.get("amount", 10))
    try:
        current = _get_current_brightness()
        new_pct = max(0, current - step)
        if platform.system() == "Windows":
            subprocess.run(["powershell", "-Command",
                f"(Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods).WmiSetBrightness(1, {new_pct})"], check=False)
        elif platform.system() == "Darwin":
            subprocess.run(["brightness", f"{new_pct/100}"], check=False)
        else:
            _linux_brightness(new_pct)
        return {"result": f"Brightness decreased to {new_pct}%."}
    except Exception as e:
        raise ToolError(f"Failed to decrease brightness: {e}")


@register("muteToggle")
def mute_toggle(args: Dict[str, Any]) -> Dict[str, Any]:
    muted = get_backend().audio.toggle_mute()
    return {"result": "Muted." if muted else "Unmuted."}


# --- Gated power actions -----------------------------------------------------

def _run_power(action: str) -> str:
    system = platform.system()
    if action == "lock":
        if system == "Windows":
            import ctypes
            ctypes.windll.user32.LockWorkStation()
            return "Computer locked."
        elif system == "Darwin":
            subprocess.run(["pmset", "displaysleepnow"], check=False)
            return "Computer locked."
        else:
            result = _linux_powerctl("lock")
            if result:
                return result
            return "Lock not supported on this Linux setup."
    if action == "sleep":
        if system == "Windows":
            os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")
            return "Computer going to sleep."
        elif system == "Darwin":
            subprocess.run(["pmset", "sleepnow"], check=False)
            return "Computer going to sleep."
        else:
            result = _linux_powerctl("sleep")
            if result:
                return result
            return "Sleep not supported on this Linux setup."
    if action == "restart":
        if system == "Windows":
            subprocess.run(["shutdown", "/r", "/t", "5"], check=False)
            return "Computer restarting in 5 seconds."
        elif system == "Darwin":
            subprocess.run(["shutdown", "-r", "now"], check=False)
            return "Computer restarting."
        else:
            result = _linux_powerctl("restart")
            if result:
                return result
            return "Restart not supported on this Linux setup."
    if action == "shutdown":
        if system == "Windows":
            subprocess.run(["shutdown", "/s", "/t", "10"], check=False)
            return "Computer shutting down in 10 seconds."
        elif system == "Darwin":
            subprocess.run(["shutdown", "-h", "now"], check=False)
            return "Computer shutting down."
        else:
            result = _linux_powerctl("shutdown")
            if result:
                return result
            return "Shutdown not supported on this Linux setup."
    raise ToolError(f"Unknown power action '{action}'.")


@register("executePowerAction")
def execute_power_action(args: Dict[str, Any]) -> Dict[str, Any]:
    action = (args.get("action") or "").strip().lower()
    token: Optional[str] = args.get("execute_token")

    from .confirmation import DANGEROUS_ACTIONS

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
        subprocess.run(["shutdown", "-c"], check=False)
    return {"result": "Cancelled pending shutdown/restart timer."}


@register("shutdownElysia")
def shutdown_elysia(args: Dict[str, Any]) -> Dict[str, Any]:
    import os
    import signal
    import sys
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
