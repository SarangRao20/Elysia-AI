"""
Screenshot & screen-reading: capture, save, OCR, and read on-screen text.

Uses OS backend for capturing the screen or active window regions.
"""

from __future__ import annotations

import base64
import io
import os
import platform
import time
from pathlib import Path
from typing import Any, Dict, Optional

from .registry import ToolError, register
from .backends import get_backend

SCREENSHOTS_DIR = Path(os.path.expanduser("~")) / "Pictures" / "ElysiaScreenshots"


def _image_to_b64(img, fmt="PNG", quality=70) -> str:
    buf = io.BytesIO()
    if fmt.upper() == "JPEG":
        img.convert("RGB").save(buf, format="JPEG", quality=quality)
    else:
        img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _image_size_kb(img) -> int:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return len(buf.getvalue()) // 1024


def _run_ocr(img) -> str:
    try:
        import pytesseract
    except ImportError:
        raise ToolError(
            "OCR unavailable: the 'pytesseract' package is not installed."
        )
    # Ensure the Tesseract binary is discoverable.
    exe = os.environ.get("TESSERACT_PATH") or _find_tesseract_exe()
    if exe:
        pytesseract.pytesseract.tesseract_cmd = exe
    try:
        return pytesseract.image_to_string(img)
    except Exception as e:
        # Graceful fallback if OCR completely fails
        return f"[OCR Error: The Tesseract engine failed to read this image. Detail: {e}]"


def _find_tesseract_exe() -> Optional[str]:
    import shutil
    if t := shutil.which("tesseract"):
        return t
    if platform.system() == "Linux" and os.path.exists("/usr/bin/tesseract"):
        return "/usr/bin/tesseract"
    if platform.system() == "Windows":
        prog_files = os.environ.get("PROGRAMFILES", r"C:\Program Files")
        prog_files_x86 = os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")
        candidates = [
            os.path.join(prog_files, "Tesseract-OCR", "tesseract.exe"),
            os.path.join(prog_files_x86, "Tesseract-OCR", "tesseract.exe"),
        ]
        for c in candidates:
            if os.path.exists(c):
                return c
    return None


def _trim_ocr(text: str, max_chars: int = 1500) -> str:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    out = "\n".join(lines)
    if len(out) > max_chars:
        out = out[:max_chars] + "…"
    return out


@register("takeScreenshot")
def take_screenshot(args: Dict[str, Any]) -> Dict[str, Any]:
    try:
        img = get_backend().screenshot.capture()
    except Exception as e:
        raise ToolError(str(e))
        
    include_image = bool(args.get("include_image", False))
    result: Dict[str, Any] = {
        "result": f"Captured screen ({img.width}x{img.height}).",
        "width": img.width,
        "height": img.height,
    }
    if include_image:
        max_dim = int(args.get("max_dim", 1280))
        if max(img.size) > max_dim:
            ratio = max_dim / max(img.size)
            img_small = img.resize(
                (max(1, int(img.width * ratio)), max(1, int(img.height * ratio)))
            )
        else:
            img_small = img
        result["image_base64"] = _image_to_b64(img_small, fmt="JPEG", quality=60)
        result["image_mime"] = "image/jpeg"
    return result


@register("saveScreenshot")
def save_screenshot(args: Dict[str, Any]) -> Dict[str, Any]:
    try:
        img = get_backend().screenshot.capture()
    except Exception as e:
        raise ToolError(str(e))
        
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    name = args.get("name")
    fname = f"{name}-{stamp}.png" if name else f"screenshot-{stamp}.png"
    out_path = SCREENSHOTS_DIR / fname
    img.save(out_path, format="PNG")
    return {"result": f"Saved screenshot to {out_path}.", "path": str(out_path)}


@register("analyzeScreenshot")
def analyze_screenshot(args: Dict[str, Any]) -> Dict[str, Any]:
    try:
        img = get_backend().screenshot.capture()
    except Exception as e:
        raise ToolError(str(e))
        
    try:
        text = _run_ocr(img)
    except ToolError as e:
        return {"result": f"Screenshot captured, but OCR unavailable: {e.message}"}
    return {
        "result": "Screenshot analyzed via OCR.",
        "text": _trim_ocr(text, int(args.get("max_chars", 1500))),
    }


@register("readScreen")
def read_screen(args: Dict[str, Any]) -> Dict[str, Any]:
    """OCR the active window and report its title + visible text."""
    backend = get_backend()
    hwnd = backend.window_manager.get_foreground_window()
    title = backend.window_manager.get_window_title(hwnd) if hwnd else ""
    bbox = backend.screenshot.active_window_bbox()
    
    try:
        if bbox:
            img = backend.screenshot.capture_region(bbox)
        else:
            img = backend.screenshot.capture()
    except Exception as e:
        raise ToolError(str(e))
        
    try:
        text = _run_ocr(img)
        visible = _trim_ocr(text, int(args.get("max_chars", 1500))) or "(no readable text)"
    except ToolError as e:
        return {
            "result": f"Active window: {title or 'unknown'}. OCR unavailable: {e.message}",
            "active_window": title,
        }
    return {
        "result": f"Active window '{title or 'unknown'}' contains readable text.",
        "active_window": title,
        "text": visible,
    }


__all__ = [
    "take_screenshot",
    "save_screenshot",
    "analyze_screenshot",
    "read_screen",
]
