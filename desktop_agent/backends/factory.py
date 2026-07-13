import platform
from .base import OSBackend

_backend_instance = None

def get_backend() -> OSBackend:
    global _backend_instance
    if _backend_instance is not None:
        return _backend_instance

    sys = platform.system()
    if sys == "Linux":
        from .linux_wayland import LinuxWaylandBackend
        _backend_instance = LinuxWaylandBackend()
    elif sys == "Windows":
        from .windows import WindowsBackend
        _backend_instance = WindowsBackend()
    else:
        # Fallback to a dummy or error throwing backend for unsupported OS,
        # but for now, we'll try to use WindowsBackend and let things fail gracefully.
        from .windows import WindowsBackend
        _backend_instance = WindowsBackend()

    return _backend_instance
