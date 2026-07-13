import abc
from typing import Any, Dict, Optional, Tuple

class WindowManager(abc.ABC):
    @abc.abstractmethod
    def get_foreground_window(self) -> Any: pass
    
    @abc.abstractmethod
    def get_window_title(self, hwnd: Any) -> str: pass
    
    @abc.abstractmethod
    def show_window(self, hwnd: Any, cmd: int) -> None: pass
    
    @abc.abstractmethod
    def close_window(self, hwnd: Any) -> None: pass
    
    @abc.abstractmethod
    def find_window_by_title(self, query: str) -> Any: pass
    
    @abc.abstractmethod
    def focus(self, hwnd: Any) -> None: pass

class AudioController(abc.ABC):
    @abc.abstractmethod
    def get_volume(self) -> float: pass
    
    @abc.abstractmethod
    def set_volume(self, value: float) -> None: pass
    
    @abc.abstractmethod
    def toggle_mute(self) -> bool: pass

class ClipboardManager(abc.ABC):
    @abc.abstractmethod
    def copy(self) -> None: pass
    
    @abc.abstractmethod
    def paste(self) -> None: pass
    
    @abc.abstractmethod
    def read(self) -> str: pass
    
    @abc.abstractmethod
    def write(self, text: str) -> None: pass

class ScreenshotManager(abc.ABC):
    @abc.abstractmethod
    def capture(self) -> Any: pass
    
    @abc.abstractmethod
    def capture_region(self, bbox: Tuple[int, int, int, int]) -> Any: pass
    
    @abc.abstractmethod
    def active_window_bbox(self) -> Optional[Tuple[int, int, int, int]]: pass

class ApplicationLauncher(abc.ABC):
    @abc.abstractmethod
    def launch(self, spec: Dict[str, str]) -> None: pass
    
    @abc.abstractmethod
    def close(self, spec: Dict[str, str], force: bool) -> None: pass

class TerminalManager(abc.ABC):
    @abc.abstractmethod
    def run_command(self, command: str) -> str: pass
    
    @abc.abstractmethod
    def install_package(self, package: str) -> str: pass

class OSBackend:
    window_manager: WindowManager
    audio: AudioController
    clipboard: ClipboardManager
    screenshot: ScreenshotManager
    launcher: ApplicationLauncher
    terminal: TerminalManager
