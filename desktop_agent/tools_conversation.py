import json
import os
from datetime import datetime
from typing import Any, Dict
from .registry import register, ToolError


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


@register("exportConversation")
def export_conversation(args: Dict[str, Any]) -> Dict[str, Any]:
    text = args.get("text", "")
    filename = args.get("filename", "")
    if not text:
        raise ToolError("No conversation text provided.")
    if not filename:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"conversation_{ts}.txt"
    if not filename.endswith(".txt") and not filename.endswith(".md"):
        filename += ".txt"
    conv_dir = os.path.join(DATA_DIR, "conversations")
    os.makedirs(conv_dir, exist_ok=True)
    filepath = os.path.join(conv_dir, filename)
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(text)
        return {"result": f"Conversation saved to {filepath} ({len(text)} chars).", "path": filepath}
    except Exception as e:
        raise ToolError(f"Failed to save conversation: {e}")


@register("listExports")
def list_exports(args: Dict[str, Any]) -> Dict[str, Any]:
    conv_dir = os.path.join(DATA_DIR, "conversations")
    if not os.path.isdir(conv_dir):
        return {"result": "No exported conversations found.", "files": []}
    files = []
    for f in sorted(os.listdir(conv_dir)):
        fp = os.path.join(conv_dir, f)
        if os.path.isfile(fp):
            size = os.path.getsize(fp)
            mod = datetime.fromtimestamp(os.path.getmtime(fp)).isoformat()
            files.append({"name": f, "size": size, "modified": mod})
    result = f"Found {len(files)} conversation exports."
    return {"result": result, "files": files}
