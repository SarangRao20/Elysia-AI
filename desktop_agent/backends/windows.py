from .base import WindowManager, AudioController, ClipboardManager, ScreenshotManager, ApplicationLauncher, TerminalManager, OSBackend
from typing import Any, Dict, Optional, Tuple
import os
import io
import time
import subprocess
import shutil

class WindowsWindowManager(WindowManager):
    def get_foreground_window(self) -> Any:
        try:
            import win32gui
            hwnd = win32gui.GetForegroundWindow()
            return hwnd if hwnd else None
        except Exception:
            return None

    def get_window_title(self, hwnd: Any) -> str:
        try:
            import win32gui
            return win32gui.GetWindowText(hwnd)
        except Exception:
            return ""

    def show_window(self, hwnd: Any, cmd: int) -> None:
        try:
            import win32gui
            win32gui.ShowWindow(hwnd, cmd)
        except Exception:
            pass

    def close_window(self, hwnd: Any) -> None:
        try:
            import win32con
            import win32gui
            win32gui.PostMessage(hwnd, win32con.WM_CLOSE, 0, 0)
        except Exception:
            pass

    def find_window_by_title(self, query: str) -> Any:
        try:
            import win32gui
            matches = []
            def cb(h, _):
                if win32gui.IsWindowVisible(h):
                    t = win32gui.GetWindowText(h)
                    if t and query.lower() in t.lower():
                        matches.append(h)
                return True
            win32gui.EnumWindows(cb, None)
            return matches[0] if matches else None
        except Exception:
            return None

    def focus(self, hwnd: Any) -> None:
        try:
            import win32gui
            win32gui.SetForegroundWindow(hwnd)
        except Exception:
            self.show_window(hwnd, 9) # SW_RESTORE
            time.sleep(0.1)
            try:
                import win32gui
                win32gui.SetForegroundWindow(hwnd)
            except Exception:
                pass


class WindowsAudioController(AudioController):
    def _init_pycaw(self):
        try:
            from ctypes import cast, POINTER
            import comtypes
            from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, comtypes.CLSCTX_ALL, None)
            return cast(interface, POINTER(IAudioEndpointVolume))
        except Exception:
            return None

    def get_volume(self) -> float:
        iface = self._init_pycaw()
        if iface:
            try:
                return float(iface.GetMasterVolumeLevelScalar())
            except Exception:
                pass
        return 0.5

    def set_volume(self, value: float) -> None:
        iface = self._init_pycaw()
        if iface:
            try:
                iface.SetMasterVolumeLevelScalar(value, None)
            except Exception:
                pass

    def toggle_mute(self) -> bool:
        iface = self._init_pycaw()
        if iface:
            try:
                current = bool(iface.GetMute())
                iface.SetMute(1 if not current else 0, None)
                return not current
            except Exception:
                pass
        return False


class WindowsClipboardManager(ClipboardManager):
    def copy(self) -> None:
        try:
            import pyautogui
            pyautogui.hotkey("ctrl", "c")
        except Exception:
            pass

    def paste(self) -> None:
        try:
            import pyautogui
            pyautogui.hotkey("ctrl", "v")
        except Exception:
            pass

    def read(self) -> str:
        try:
            import pyperclip
            return pyperclip.paste() or ""
        except Exception:
            return ""

    def write(self, text: str) -> None:
        try:
            import pyperclip
            pyperclip.copy(text)
        except Exception:
            pass


class WindowsScreenshotManager(ScreenshotManager):
    def capture(self) -> Any:
        try:
            from PIL import ImageGrab
            return ImageGrab.grab(all_screens=True)
        except Exception:
            raise Exception("Screen capture failed")

    def capture_region(self, bbox: Tuple[int, int, int, int]) -> Any:
        try:
            from PIL import ImageGrab
            return ImageGrab.grab(bbox=bbox, all_screens=False)
        except Exception:
            raise Exception("Region capture failed")

    def active_window_bbox(self) -> Optional[Tuple[int, int, int, int]]:
        try:
            import win32gui
            hwnd = win32gui.GetForegroundWindow()
            if not hwnd: return None
            return win32gui.GetWindowRect(hwnd)
        except Exception:
            return None


class WindowsApplicationLauncher(ApplicationLauncher):
    def launch(self, spec: Dict[str, str]) -> None:
        if "exe" in spec:
            exe = spec["exe"]
            if shutil.which(exe) or exe.lower().endswith(".exe"):
                subprocess.Popen(
                    [exe], shell=False, close_fds=True,
                    creationflags=getattr(subprocess, "DETACHED_PROCESS", 0) | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
                )
            else:
                subprocess.Popen(f'start "" "{exe}"', shell=True, close_fds=True)
        elif "shell" in spec:
            subprocess.Popen(f'start "" {spec["shell"]}', shell=True, close_fds=True)
        elif "uwp" in spec:
            subprocess.Popen(f'start "" {spec["uwp"]}', shell=True, close_fds=True)

    def close(self, spec: Dict[str, str], force: bool) -> None:
        image = spec["image"]
        graceful_flag = "" if force else ""
        force_flag = " /F" if force else ""
        subprocess.run(f'taskkill /IM "{image}"{graceful_flag}{force_flag}', shell=True, capture_output=True, timeout=10)
        time.sleep(0.2)

class WindowsTerminalManager(TerminalManager):
    def run_command(self, command: str) -> str:
        res = subprocess.run(command, shell=True, capture_output=True, text=True)
        return res.stdout + res.stderr

    def install_package(self, package: str) -> str:
        return "Package installation not supported on Windows terminal manager."

class WindowsBackend(OSBackend):
    def __init__(self):
        self.window_manager = WindowsWindowManager()
        self.audio = WindowsAudioController()
        self.clipboard = WindowsClipboardManager()
        self.screenshot = WindowsScreenshotManager()
        self.launcher = WindowsApplicationLauncher()
        self.terminal = WindowsTerminalManager()
