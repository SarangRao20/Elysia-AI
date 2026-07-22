from typing import Any, Dict
import sys
from .registry import ToolError, register

@register("osType")
def os_type(args: Dict[str, Any]) -> Dict[str, Any]:
    """Type text globally at the OS level using pyautogui (or wtype on Linux)."""
    text = args.get("text")
    interval = float(args.get("interval", 0.01))
    if not text:
        raise ToolError("Parameter 'text' is required.")
    
    try:
        if sys.platform == "win32":
            import pyautogui
            pyautogui.write(str(text), interval=interval)
        else:
            import subprocess
            subprocess.run(["wtype", str(text)], check=False)
        return {"result": f"Typed {len(str(text))} characters at OS level."}
    except Exception as e:
        raise ToolError(f"osType failed: {e}")

@register("osPress")
def os_press(args: Dict[str, Any]) -> Dict[str, Any]:
    """Press a single key or a hotkey combination (e.g. 'ctrl+c') globally."""
    key = args.get("key")
    if not key:
        raise ToolError("Parameter 'key' is required.")
    try:
        if sys.platform == "win32":
            import pyautogui
            keys = [k.strip() for k in str(key).split('+')]
            if len(keys) > 1:
                pyautogui.hotkey(*keys)
            else:
                pyautogui.press(keys[0])
        else:
            import subprocess
            # Simplified fallback for wayland
            subprocess.run(["wtype", "-k", str(key)], check=False)
        return {"result": f"Pressed key '{key}' at OS level."}
    except Exception as e:
        raise ToolError(f"osPress failed: {e}")

@register("osClick")
def os_click(args: Dict[str, Any]) -> Dict[str, Any]:
    """Click at current mouse position, or at (x, y) if provided."""
    x = args.get("x")
    y = args.get("y")
    button = args.get("button", "left")
    try:
        if sys.platform == "win32":
            import pyautogui
            if x is not None and y is not None:
                pyautogui.click(x=int(x), y=int(y), button=button)
            else:
                pyautogui.click(button=button)
        return {"result": f"Clicked {button} at OS level."}
    except Exception as e:
        raise ToolError(f"osClick failed: {e}")
