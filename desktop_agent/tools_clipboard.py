"""
Clipboard control: copy / paste / read / clear.

Uses the OS backend for cross-platform clipboard operations.
"""

from __future__ import annotations

import time
from typing import Any, Dict

from .registry import ToolError, register
from .backends import get_backend


@register("copySelected")
def copy_selected(args: Dict[str, Any]) -> Dict[str, Any]:
    get_backend().clipboard.copy()
    # Clipboard is asynchronous; give it a beat.
    time.sleep(float(args.get("wait", 0.35)))
    text = get_backend().clipboard.read()
    if not text:
        return {"result": "Sent copy, but the clipboard is empty."}
    preview = text if len(text) <= 200 else text[:200] + "…"
    return {"result": f"Copied {len(text)} characters.", "text": preview, "full_length": len(text)}


@register("pasteClipboard")
def paste_clipboard(args: Dict[str, Any]) -> Dict[str, Any]:
    text = args.get("text")
    if text is None:
        # Paste whatever is already on the clipboard.
        get_backend().clipboard.paste()
        return {"result": "Pasted the current clipboard contents."}
    get_backend().clipboard.write(str(text))
    time.sleep(0.1)
    get_backend().clipboard.paste()
    preview = str(text) if len(str(text)) <= 200 else str(text)[:200] + "…"
    return {"result": f"Pasted text ({len(str(text))} chars).", "text": preview}


@register("getClipboard")
def get_clipboard(args: Dict[str, Any]) -> Dict[str, Any]:
    text = get_backend().clipboard.read()
    max_chars = int(args.get("max_chars", 1000))
    if len(text) > max_chars:
        text = text[:max_chars] + "…"
    return {"result": "Clipboard read.", "text": text, "length": len(text)}


@register("clearClipboard")
def clear_clipboard(args: Dict[str, Any]) -> Dict[str, Any]:
    get_backend().clipboard.write("")
    return {"result": "Clipboard cleared."}


__all__ = ["copy_selected", "paste_clipboard", "get_clipboard", "clear_clipboard"]
