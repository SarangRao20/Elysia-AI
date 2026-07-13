from .base import WindowManager, AudioController, ClipboardManager, ScreenshotManager, ApplicationLauncher, TerminalManager, OSBackend
from typing import Any, Dict, Optional, Tuple
import subprocess
import json
import io
import time

class LinuxWaylandWindowManager(WindowManager):
    def get_foreground_window(self) -> Any:
        try:
            out = subprocess.check_output(["hyprctl", "activewindow", "-j"], text=True)
            data = json.loads(out)
            return data.get("address") if data else None
        except Exception:
            return None

    def get_window_title(self, hwnd: Any) -> str:
        try:
            out = subprocess.check_output(["hyprctl", "clients", "-j"], text=True)
            for c in json.loads(out):
                if c.get("address") == hwnd:
                    return c.get("title", "")
        except Exception:
            pass
        return ""

    def show_window(self, hwnd: Any, cmd: int) -> None:
        pass # Not natively supported in the same way via hyprctl cmds

    def close_window(self, hwnd: Any) -> None:
        try:
            subprocess.run(["hyprctl", "dispatch", "closewindow", f"address:{hwnd}"], check=False)
        except Exception:
            pass

    def find_window_by_title(self, query: str) -> Any:
        try:
            out = subprocess.check_output(["hyprctl", "clients", "-j"], text=True)
            for c in json.loads(out):
                title = c.get("title", "")
                if query.lower() in title.lower():
                    return c.get("address")
        except Exception:
            pass
        return None

    def focus(self, hwnd: Any) -> None:
        try:
            subprocess.run(["hyprctl", "dispatch", "focuswindow", f"address:{hwnd}"], check=False)
        except Exception:
            pass


class LinuxWaylandAudioController(AudioController):
    def get_volume(self) -> float:
        try:
            out = subprocess.check_output(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"], text=True)
            for word in out.split():
                try:
                    return float(word)
                except ValueError:
                    pass
        except Exception:
            pass
        return 0.5

    def set_volume(self, value: float) -> None:
        try:
            subprocess.run(["wpctl", "set-volume", "@DEFAULT_AUDIO_SINK@", f"{value:.2f}"], check=False)
        except Exception:
            pass

    def toggle_mute(self) -> bool:
        try:
            subprocess.run(["wpctl", "set-mute", "@DEFAULT_AUDIO_SINK@", "toggle"], check=False)
            out = subprocess.check_output(["wpctl", "get-volume", "@DEFAULT_AUDIO_SINK@"], text=True)
            return "[MUTED]" in out
        except Exception:
            return False


class LinuxWaylandClipboardManager(ClipboardManager):
    def copy(self) -> None:
        try:
            subprocess.run(["wtype", "-M", "ctrl", "c", "-m", "ctrl"], check=False)
        except Exception:
            pass

    def paste(self) -> None:
        try:
            subprocess.run(["wtype", "-M", "ctrl", "v", "-m", "ctrl"], check=False)
        except Exception:
            pass

    def read(self) -> str:
        try:
            return subprocess.check_output(["wl-paste"], text=True)
        except Exception:
            return ""

    def write(self, text: str) -> None:
        try:
            subprocess.run(["wl-copy"], input=text, text=True, check=False)
        except Exception:
            pass


class LinuxWaylandScreenshotManager(ScreenshotManager):
    def capture(self) -> Any:
        try:
            from PIL import Image
            out = subprocess.check_output(["grim", "-"])
            return Image.open(io.BytesIO(out))
        except Exception as e:
            raise Exception(f"Screen capture failed (grim): {e}")

    def capture_region(self, bbox: Tuple[int, int, int, int]) -> Any:
        try:
            from PIL import Image
            l, t, r, b = bbox
            w, h = r - l, b - t
            geom = f"{l},{t} {w}x{h}"
            out = subprocess.check_output(["grim", "-g", geom, "-"])
            return Image.open(io.BytesIO(out))
        except Exception as e:
            raise Exception(f"Region capture failed: {e}")

    def active_window_bbox(self) -> Optional[Tuple[int, int, int, int]]:
        try:
            out = subprocess.check_output(["hyprctl", "activewindow", "-j"], text=True)
            data = json.loads(out)
            if data and "at" in data and "size" in data:
                l, t = data["at"]
                w, h = data["size"]
                return (int(l), int(t), int(l+w), int(t+h))
        except Exception:
            return None
        return None


class LinuxWaylandApplicationLauncher(ApplicationLauncher):
    def launch(self, spec: Dict[str, str]) -> None:
        if "linux_cmd" in spec:
            subprocess.Popen([spec["linux_cmd"]], shell=False, close_fds=True, start_new_session=True)

    def close(self, spec: Dict[str, str], force: bool) -> None:
        image = spec.get("linux_image") or spec.get("linux_cmd")
        if not image:
            return
        sig = "-9" if force else "-15"
        subprocess.run(["pkill", sig, image], check=False)
        time.sleep(0.2)


class LinuxWaylandTerminalManager(TerminalManager):
    def run_command(self, command: str) -> str:
        try:
            subprocess.Popen(command, shell=True, close_fds=True, start_new_session=True)
            return "Command started in background."
        except Exception as e:
            return str(e)

    def install_package(self, package: str) -> str:
        try:
            subprocess.Popen(f"kitty -e sudo pacman -S --noconfirm {package}", shell=True, close_fds=True, start_new_session=True)
            return "Package installation started in a new terminal window."
        except Exception as e:
            return str(e)


class LinuxWaylandBackend(OSBackend):
    def __init__(self):
        self.window_manager = LinuxWaylandWindowManager()
        self.audio = LinuxWaylandAudioController()
        self.clipboard = LinuxWaylandClipboardManager()
        self.screenshot = LinuxWaylandScreenshotManager()
        self.launcher = LinuxWaylandApplicationLauncher()
        self.terminal = LinuxWaylandTerminalManager()
