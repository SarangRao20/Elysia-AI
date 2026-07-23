from .base import WindowManager, AudioController, ClipboardManager, ScreenshotManager, ApplicationLauncher, TerminalManager, OSBackend
from typing import Any, Dict, Optional, Tuple
import subprocess
import os


def _osascript(script: str) -> Optional[str]:
    try:
        return subprocess.check_output(["osascript", "-e", script], text=True).strip()
    except Exception:
        return None


class MacWindowManager(WindowManager):
    def get_foreground_window(self) -> Any:
        pid = _osascript('tell application "System Events" to get unix id of first process whose frontmost is true')
        return pid

    def get_window_title(self, hwnd: Any) -> str:
        title = _osascript(f'tell application "System Events" to get name of first process whose unix id is {hwnd}')
        return title or ""

    def show_window(self, hwnd: Any, cmd: int) -> None:
        pass

    def close_window(self, hwnd: Any) -> None:
        _osascript(f'tell application "System Events" to tell process whose unix id is {hwnd} to click button 1 of window 1')

    def find_window_by_title(self, query: str) -> Any:
        result = _osascript(f'tell application "System Events" to get unix id of first process whose name contains "{query}"')
        return result

    def focus(self, hwnd: Any) -> None:
        _osascript(f'tell application "System Events" to set frontmost of first process whose unix id is {hwnd} to true')


class MacAudioController(AudioController):
    def get_volume(self) -> float:
        out = _osascript("get volume settings")
        if out and "output volume:" in out:
            vol = int(out.split("output volume:")[1].split(",")[0].strip())
            return vol / 100.0
        return 0.5

    def set_volume(self, value: float) -> None:
        pct = int(value * 100)
        _osascript(f"set volume output volume {pct}")

    def toggle_mute(self) -> bool:
        out = _osascript("get volume settings")
        if out and "output muted:" in out:
            muted = "true" in out.split("output muted:")[1].split(",")[0].strip()
            if muted:
                _osascript("set volume without output muted")
            else:
                _osascript("set volume with output muted")
            return not muted
        return False


class MacClipboardManager(ClipboardManager):
    def copy(self) -> None:
        _osascript('tell application "System Events" to keystroke "c" using command down')

    def paste(self) -> None:
        _osascript('tell application "System Events" to keystroke "v" using command down')

    def read(self) -> str:
        try:
            return subprocess.check_output(["pbpaste"], text=True)
        except Exception:
            return ""

    def write(self, text: str) -> None:
        try:
            subprocess.run(["pbcopy"], input=text, text=True, check=False)
        except Exception:
            pass


class MacScreenshotManager(ScreenshotManager):
    def capture(self) -> Any:
        from PIL import Image
        tmp = "/tmp/mac_shot.png"
        try:
            subprocess.run(["screencapture", "-x", tmp], check=True)
            return Image.open(tmp)
        except Exception as e:
            raise Exception(f"Screen capture failed: {e}")

    def capture_region(self, bbox: Tuple[int, int, int, int]) -> Any:
        from PIL import Image
        try:
            full = self.capture()
            return full.crop(bbox)
        except Exception as e:
            raise Exception(f"Region capture failed: {e}")

    def active_window_bbox(self) -> Optional[Tuple[int, int, int, int]]:
        return None


class MacApplicationLauncher(ApplicationLauncher):
    def launch(self, spec: Dict[str, str]) -> None:
        cmd = spec.get("mac_cmd") or spec.get("linux_cmd")
        if cmd:
            subprocess.Popen(["open", "-a", cmd], close_fds=True, start_new_session=True)

    def close(self, spec: Dict[str, str], force: bool) -> None:
        cmd = spec.get("mac_cmd") or spec.get("linux_cmd")
        if cmd:
            subprocess.run(["pkill", cmd], check=False)


class MacTerminalManager(TerminalManager):
    def run_command(self, command: str) -> str:
        try:
            out = subprocess.check_output(command, shell=True, stderr=subprocess.STDOUT, text=True)
            return out.strip()
        except subprocess.CalledProcessError as e:
            return e.output.strip() if e.output else ""

    def install_package(self, package: str) -> str:
        return self.run_command(f"brew install {package}")


class MacBackend(OSBackend):
    def __init__(self):
        self.window_manager = MacWindowManager()
        self.audio = MacAudioController()
        self.clipboard = MacClipboardManager()
        self.screenshot = MacScreenshotManager()
        self.launcher = MacApplicationLauncher()
        self.terminal = MacTerminalManager()
