from .base import WindowManager, AudioController, ClipboardManager, ScreenshotManager, ApplicationLauncher, TerminalManager, OSBackend
from typing import Any, Dict, Optional, Tuple
import subprocess
import os
import io

class LinuxGnomeWindowManager(WindowManager):
    def get_foreground_window(self) -> Any:
        try:
            return subprocess.check_output(["xdotool", "getactivewindow"]).strip().decode()
        except Exception:
            return None

    def get_window_title(self, hwnd: Any) -> str:
        try:
            return subprocess.check_output(["xdotool", "getwindowname", str(hwnd)]).strip().decode()
        except Exception:
            return ""

    def show_window(self, hwnd: Any, cmd: int) -> None:
        pass

    def close_window(self, hwnd: Any) -> None:
        try:
            subprocess.run(["xdotool", "windowclose", str(hwnd)], check=False)
        except Exception:
            pass

    def find_window_by_title(self, query: str) -> Any:
        try:
            out = subprocess.check_output(["xdotool", "search", "--name", query]).strip().decode()
            if out:
                return out.split("\n")[0]
        except Exception:
            pass
        return None

    def focus(self, hwnd: Any) -> None:
        try:
            subprocess.run(["xdotool", "windowactivate", str(hwnd)], check=False)
        except Exception:
            pass


class LinuxGnomeAudioController(AudioController):
    def get_volume(self) -> float:
        try:
            out = subprocess.check_output(["amixer", "-D", "pulse", "get", "Master"], text=True)
            if "[" in out and "%]" in out:
                vol_str = out.split("[")[1].split("%]")[0]
                return float(vol_str) / 100.0
        except Exception:
            pass
        return 0.5

    def set_volume(self, value: float) -> None:
        try:
            pct = int(value * 100)
            subprocess.run(["amixer", "-D", "pulse", "sset", "Master", f"{pct}%"], check=False)
        except Exception:
            pass

    def toggle_mute(self) -> bool:
        try:
            subprocess.run(["amixer", "-D", "pulse", "sset", "Master", "toggle"], check=False)
            out = subprocess.check_output(["amixer", "-D", "pulse", "get", "Master"], text=True)
            return "[off]" in out
        except Exception:
            return False


class LinuxGnomeClipboardManager(ClipboardManager):
    def _is_wayland(self) -> bool:
        return os.environ.get("WAYLAND_DISPLAY") is not None

    def copy(self) -> None:
        try:
            if self._is_wayland():
                subprocess.run(["ydotool", "key", "29:1", "46:1", "46:0", "29:0"], check=False)
            else:
                subprocess.run(["xdotool", "key", "ctrl+c"], check=False)
        except Exception:
            pass

    def paste(self) -> None:
        try:
            if self._is_wayland():
                subprocess.run(["ydotool", "key", "29:1", "47:1", "47:0", "29:0"], check=False)
            else:
                subprocess.run(["xdotool", "key", "ctrl+v"], check=False)
        except Exception:
            pass

    def read(self) -> str:
        try:
            if self._is_wayland():
                return subprocess.check_output(["wl-paste"], text=True)
            else:
                return subprocess.check_output(["xclip", "-selection", "clipboard", "-o"], text=True)
        except Exception:
            return ""

    def write(self, text: str) -> None:
        try:
            if self._is_wayland():
                subprocess.run(["wl-copy"], input=text, text=True, check=False)
            else:
                subprocess.run(["xclip", "-selection", "clipboard", "-i"], input=text, text=True, check=False)
        except Exception:
            pass


class LinuxGnomeScreenshotManager(ScreenshotManager):
    def capture(self) -> Any:
        from PIL import Image
        tmp = "/tmp/gnome_shot.png"
        try:
            subprocess.run(["gnome-screenshot", "-f", tmp], check=True)
            return Image.open(tmp)
        except Exception as e:
            raise Exception(f"Screen capture failed (gnome-screenshot): {e}")

    def capture_region(self, bbox: Tuple[int, int, int, int]) -> Any:
        from PIL import Image
        tmp = "/tmp/gnome_shot.png"
        try:
            subprocess.run(["gnome-screenshot", "-a", "-f", tmp], check=True)
            return Image.open(tmp)
        except Exception as e:
            raise Exception(f"Region capture failed: {e}")

    def active_window_bbox(self) -> Optional[Tuple[int, int, int, int]]:
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
            return out
        except subprocess.CalledProcessError as e:
            return e.output

    def install_package(self, package: str) -> str:
        return self.run_command(f"sudo apt-get install -y {package}")


class LinuxGnomeBackend(OSBackend):
    def __init__(self):
        self.window_manager = LinuxGnomeWindowManager()
        self.audio = LinuxGnomeAudioController()
        self.clipboard = LinuxGnomeClipboardManager()
        self.screenshot = LinuxGnomeScreenshotManager()
        self.launcher = LinuxGnomeApplicationLauncher()
        self.terminal = LinuxGnomeTerminalManager()
