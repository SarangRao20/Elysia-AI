"""Webcam control: list / open / close camera devices.

Opens the camera in a FLOATING window (Hyprland) so it never disturbs the
tiling layout of other windows. Closing frees the device for other apps.
"""

from __future__ import annotations

import os
import platform
import subprocess
from typing import Any, Dict, List

from ..registry import ToolError, register

_CAM_VIEWER_PROC: Dict[str, subprocess.Popen] = {}


def _is_hyprland() -> bool:
    return os.environ.get("XDG_CURRENT_DESKTOP", "").lower() == "hyprland"


def _list_v4l2_devices() -> List[str]:
    try:
        out = subprocess.check_output(["v4l2-ctl", "--list-devices"], text=True, stderr=subprocess.STDOUT)
    except FileNotFoundError:
        return [d for d in os.listdir("/dev") if d.startswith("video")]
    except Exception:
        return []
    devices: List[str] = []
    for line in out.splitlines():
        line = line.strip()
        if line.startswith("/dev/video"):
            devices.append(line)
    return devices


def _list_mac_cameras() -> List[str]:
    try:
        out = subprocess.check_output(["system_profiler", "SPCameraDataType"], text=True)
    except Exception:
        return ["FaceTime HD Camera"]
    names: List[str] = []
    for line in out.splitlines():
        if ":" in line and "Camera" in line:
            names.append(line.split(":")[0].strip())
    return names or ["FaceTime HD Camera"]


@register("cameraList")
def camera_list(args: Dict[str, Any]) -> Dict[str, Any]:
    """List available camera devices."""
    if platform.system() == "Darwin":
        cams = _list_mac_cameras()
    else:
        cams = _list_v4l2_devices()
    if not cams:
        raise ToolError("No camera devices found.")
    return {"result": f"Found {len(cams)} camera(s): {', '.join(cams)}", "cameras": cams}


def _launch_hyprland_float(cmd: List[str]) -> subprocess.Popen:
    # Prefix the launch with hyprctl so the window opens floating + sized,
    # leaving the existing tiled layout untouched.
    floating_cmd = "hyprctl dispatch exec -- [float size 60% 60% center] " + " ".join(
        f'"{c}"' if " " in c else c for c in cmd
    )
    subprocess.run(floating_cmd, shell=True, check=False)
    return subprocess.Popen(cmd, close_fds=True, start_new_session=True)


@register("cameraOn")
def camera_on(args: Dict[str, Any]) -> Dict[str, Any]:
    """Open the webcam in a floating viewer window (mpv). Does not disturb tiled layout."""
    device = args.get("device")
    if not device:
        if platform.system() == "Darwin":
            device = "FaceTime HD Camera"
        else:
            cams = _list_v4l2_devices()
            if not cams:
                raise ToolError("No camera device found. Pass 'device' explicitly.")
            device = cams[0]

    try:
        if platform.system() == "Darwin":
            subprocess.run(["open", "-a", "Photo Booth"], check=False)
            _CAM_VIEWER_PROC["camera"] = subprocess.Popen(["open", "-a", "Photo Booth"])
            return {"result": f"Camera '{device}' opened (Photo Booth).", "device": device}
        if not os.path.exists(device):
            raise ToolError(f"Device '{device}' does not exist.")
        proc = _launch_hyprland_float(["mpv", f"--input-ipc-server=/tmp/elysia_cam.sock", device])
        _CAM_VIEWER_PROC["camera"] = proc
        return {"result": f"Camera '{device}' turned ON in a floating viewer.", "device": device}
    except Exception as e:
        raise ToolError(f"Failed to open camera: {e}")


@register("cameraOff")
def camera_off(args: Dict[str, Any]) -> Dict[str, Any]:
    """Close the camera viewer and free the device for other applications."""
    proc = _CAM_VIEWER_PROC.pop("camera", None)
    freed = False
    if proc is not None:
        try:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except Exception:
                proc.kill()
            freed = True
        except Exception:
            pass
    # Fallback: kill any stray mpv / Photo Booth we started.
    try:
        subprocess.run(["pkill", "-f", "--", "/tmp/elysia_cam.sock"], check=False)
    except Exception:
        pass
    if platform.system() == "Darwin":
        try:
            subprocess.run(["osascript", "-e", 'tell application "Photo Booth" to quit'], check=False)
            freed = True
        except Exception:
            pass
    return {"result": "Camera turned OFF, device released." if freed else "No camera viewer was open."}
