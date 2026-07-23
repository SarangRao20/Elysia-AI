from .base import WindowManager, AudioController, ClipboardManager, ScreenshotManager, ApplicationLauncher, TerminalManager, OSBackend
from typing import Any, Dict, Optional, Tuple
import subprocess
import os
import io

def _detect_package_manager() -> str:
    for mgr, cmd in [("apt-get", "apt-get"), ("dnf", "dnf"), ("pacman", "pacman"), ("zypper", "zypper")]:
        if subprocess.run(["which", mgr], capture_output=True).returncode == 0:
            return cmd
    return "apt-get"

_PKG_MGR = _detect_package_manager()

def _is_wayland() -> bool:
    return os.environ.get("WAYLAND_DISPLAY") is not None

class LinuxGnomeWindowManager(WindowManager):
    def get_foreground_window(self) -> Any:
        try:
            if _is_wayland():
                return None
            return subprocess.check_output(["xdotool", "getactivewindow"]).strip().decode()
        except Exception:
            return None

    def get_window_title(self, hwnd: Any) -> str:
        try:
            out = subprocess.check_output(["xdotool", "getwindowname", str(hwnd)], text=True)
            return out.strip()
        except Exception:
            return ""

    def show_window(self, hwnd: Any, cmd: int) -> None:
        if _is_wayland():
            return
        try:
            if cmd == 6:
                subprocess.run(["xdotool", "windowminimize", str(hwnd)], check=False)
            elif cmd == 3:
                subprocess.run(["xdotool", "windowactivate", str(hwnd)], check=False)
        except Exception:
            pass

    def close_window(self, hwnd: Any) -> None:
        if _is_wayland():
            return
        try:
            subprocess.run(["xdotool", "windowclose", str(hwnd)], check=False)
        except Exception:
            pass

    def find_window_by_title(self, query: str) -> Any:
        if _is_wayland():
            return None
        try:
            out = subprocess.check_output(["xdotool", "search", "--name", query], text=True).strip()
            if out:
                return out.split("\n")[0]
        except Exception:
            pass
        return None

    def focus(self, hwnd: Any) -> None:
        if _is_wayland():
            return
        try:
            subprocess.run(["xdotool", "windowactivate", str(hwnd)], check=False)
        except Exception:
            pass


class LinuxGnomeAudioController(AudioController):
    def _exec(self, *args: str) -> Optional[str]:
        try:
            return subprocess.check_output(["amixer", "-D", "pulse", *args], text=True)
        except Exception:
            return None

    def get_volume(self) -> float:
        out = self._exec("get", "Master")
        if out and "[" in out and "%]" in out:
            vol_str = out.split("[")[1].split("%]")[0]
            return float(vol_str) / 100.0
        return 0.5

    def set_volume(self, value: float) -> None:
        pct = int(value * 100)
        self._exec("sset", "Master", f"{pct}%")

    def toggle_mute(self) -> bool:
        self._exec("sset", "Master", "toggle")
        out = self._exec("get", "Master")
        return out is not None and "[off]" in out


class LinuxGnomeClipboardManager(ClipboardManager):
    def copy(self) -> None:
        try:
            if _is_wayland():
                subprocess.run(["ydotool", "key", "29:1", "46:1", "46:0", "29:0"], check=False)
            else:
                subprocess.run(["xdotool", "key", "ctrl+c"], check=False)
        except Exception:
            pass

    def paste(self) -> None:
        try:
            if _is_wayland():
                subprocess.run(["ydotool", "key", "29:1", "47:1", "47:0", "29:0"], check=False)
            else:
                subprocess.run(["xdotool", "key", "ctrl+v"], check=False)
        except Exception:
            pass

    def read(self) -> str:
        try:
            if _is_wayland():
                return subprocess.check_output(["wl-paste"], text=True)
            return subprocess.check_output(["xclip", "-selection", "clipboard", "-o"], text=True)
        except Exception:
            return ""

    def write(self, text: str) -> None:
        try:
            if _is_wayland():
                subprocess.run(["wl-copy"], input=text, text=True, check=False)
            else:
                subprocess.run(["xclip", "-selection", "clipboard", "-i"], input=text, text=True, check=False)
        except Exception:
            pass


class LinuxGnomeScreenshotManager(ScreenshotManager):
    def capture(self) -> Any:
        from PIL import Image
        tmp = "/tmp/gnome_shot.png"
        if _is_wayland():
            try:
                subprocess.run(["grim", tmp], check=True)
                return Image.open(tmp)
            except Exception as e:
                raise Exception(f"Screen capture failed (grim): {e}")
        try:
            subprocess.run(["gnome-screenshot", "-f", tmp], check=True)
            return Image.open(tmp)
        except Exception as e:
            raise Exception(f"Screen capture failed (gnome-screenshot): {e}")

    def capture_region(self, bbox: Tuple[int, int, int, int]) -> Any:
        from PIL import Image
        if _is_wayland():
            tmp = "/tmp/gnome_region.png"
            try:
                subprocess.run(["grim", "-g", f"{bbox[0]},{bbox[1]},{bbox[2]-bbox[0]}x{bbox[3]-bbox[1]}", tmp], check=True)
                return Image.open(tmp)
            except Exception as e:
                raise Exception(f"Region capture failed (grim): {e}")
        try:
            full = self.capture()
            return full.crop(bbox)
        except Exception as e:
            raise Exception(f"Region capture failed: {e}")

    def active_window_bbox(self) -> Optional[Tuple[int, int, int, int]]:
        if _is_wayland():
            return None
        try:
            out = subprocess.check_output(["xdotool", "getactivewindow", "getwindowgeometry"], text=True)
            x = y = w = h = 0
            for line in out.splitlines():
                if "Position:" in line:
                    parts = line.split(":")[1].strip().split(",")
                    x, y = int(parts[0].strip()), int(parts[1].strip())
                elif "Geometry:" in line:
                    parts = line.split(":")[1].strip().split("x")
                    w, h = int(parts[0].strip()), int(parts[1].strip())
            return (x, y, x + w, y + h)
        except Exception:
            return None


class LinuxGnomeApplicationLauncher(ApplicationLauncher):
    def launch(self, spec: Dict[str, str]) -> None:
        if "linux_cmd" in spec:
            subprocess.Popen([spec["linux_cmd"]], shell=False, close_fds=True, start_new_session=True)

    def close(self, spec: Dict[str, str], force: bool) -> None:
        image = spec.get("linux_image") or spec.get("linux_cmd")
        if not image:
            return
        sig = "-9" if force else "-15"
        subprocess.run(["killall", sig, image], check=False)


class LinuxGnomeTerminalManager(TerminalManager):
    def run_command(self, command: str) -> str:
        try:
            out = subprocess.check_output(command, shell=True, stderr=subprocess.STDOUT, text=True)
            return out.strip()
        except subprocess.CalledProcessError as e:
            return e.output.strip() if e.output else ""

    def install_package(self, package: str) -> str:
        return self.run_command(f"sudo {_PKG_MGR} install -y {package}")


class LinuxGnomeBackend(OSBackend):
    def __init__(self):
        self.window_manager = LinuxGnomeWindowManager()
        self.audio = LinuxGnomeAudioController()
        self.clipboard = LinuxGnomeClipboardManager()
        self.screenshot = LinuxGnomeScreenshotManager()
        self.launcher = LinuxGnomeApplicationLauncher()
        self.terminal = LinuxGnomeTerminalManager()
