import platform
import os as _os
from .base import OSBackend

_backend_instance = None

def get_backend() -> OSBackend:
    global _backend_instance
    if _backend_instance is not None:
        return _backend_instance

    sys = platform.system()
    if sys == "Linux":
        desktop = _os.environ.get("XDG_CURRENT_DESKTOP", "").lower()
        if "gnome" in desktop:
            from .linux_gnome import LinuxGnomeBackend
            _backend_instance = LinuxGnomeBackend()
        elif "kde" in desktop or "plasma" in desktop:
            from .linux_gnome import LinuxGnomeBackend
            _backend_instance = LinuxGnomeBackend()
        else:
            from .linux_wayland import LinuxWaylandBackend
            _backend_instance = LinuxWaylandBackend()
    elif sys == "Windows":
        from .windows import WindowsBackend
        _backend_instance = WindowsBackend()
    elif sys == "Darwin":
        from .macos import MacBackend
        _backend_instance = MacBackend()
    else:
        from .linux_gnome import LinuxGnomeBackend
        _backend_instance = LinuxGnomeBackend()

    return _backend_instance
