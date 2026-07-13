"""
Coding assistance: create code files, run Python scripts, scaffold projects.

  createPythonFile   -> write a .py file (uses createFile semantics w/ safety)
  writeCodeFile      -> write an arbitrary-language file with proper extension
  createProjectFolder-> make a folder structure (with optional subfolders)
  runPythonScript    -> execute a .py file with the known-good interpreter,
                        capturing stdout/stderr and exit code.

The Python interpreter used for running scripts is auto-detected so it works
even when the bare `python` shim is broken (common on this machine).
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from .registry import ToolError, register
from .tools_files import _ensure_safe


# Extension map for writeCodeFile.
LANG_EXT: Dict[str, str] = {
    "python": "py",
    "py": "py",
    "javascript": "js",
    "js": "js",
    "typescript": "ts",
    "ts": "ts",
    "html": "html",
    "css": "css",
    "json": "json",
    "markdown": "md",
    "md": "md",
    "java": "java",
    "c": "c",
    "cpp": "cpp",
    "csharp": "cs",
    "cs": "cs",
    "go": "go",
    "rust": "rs",
    "rs": "rs",
    "ruby": "rb",
    "rb": "rb",
    "php": "php",
    "shell": "sh",
    "bash": "sh",
    "sh": "sh",
    "sql": "sql",
    "yaml": "yaml",
    "yml": "yaml",
    "xml": "xml",
    "text": "txt",
    "txt": "txt",
}


def _detect_python() -> str:
    """Return a working Python interpreter path.

    Prefers sys.executable (the interpreter running this agent), which is the
    most reliable choice. Falls back to a known Windows location.
    """
    exe = sys.executable
    if exe and Path(exe).exists():
        return exe
    candidates = [
        r"C:\Users\MSI\AppData\Local\Programs\Python\Python311\python.exe",
        r"C:\Python311\python.exe",
        "python",
        "python3",
    ]
    for c in candidates:
        if shutil.which(c):
            return c
    raise ToolError("No usable Python interpreter found on this system.")


@register("createPythonFile")
def create_python_file(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    content = args.get("content", "")
    if not path:
        raise ToolError("Parameter 'path' is required.")
    p = Path(os.path.expandvars(os.path.expanduser(str(path)))).resolve()
    if p.suffix.lower() != ".py":
        p = p.with_suffix(".py")
    _ensure_safe(p)
    if p.exists() and not args.get("overwrite"):
        raise ToolError(f"File already exists: {p}. Pass overwrite=true to replace.")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(str(content) + ("" if str(content).endswith("\n") else "\n"), encoding="utf-8")
    return {"result": f"Created Python file: {p}", "path": str(p)}


@register("writeCodeFile")
def write_code_file(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    content = args.get("content", "")
    language = (args.get("language") or "txt").strip().lower()
    if not path:
        raise ToolError("Parameter 'path' is required.")
    p = Path(os.path.expandvars(os.path.expanduser(str(path)))).resolve()
    # If the caller gave a basename without extension, append the language's.
    ext = LANG_EXT.get(language)
    if ext and p.suffix == "":
        p = p.with_suffix("." + ext)
    _ensure_safe(p)
    if p.exists() and not args.get("overwrite"):
        raise ToolError(f"File already exists: {p}. Pass overwrite=true to replace.")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(str(content), encoding="utf-8")
    return {"result": f"Wrote {language} file: {p}", "path": str(p)}


@register("createProjectFolder")
def create_project_folder(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path") or args.get("name")
    if not path:
        raise ToolError("Parameter 'path' (project root) is required.")
    root = Path(os.path.expandvars(os.path.expanduser(str(path)))).resolve()
    _ensure_safe(root)
    root.mkdir(parents=True, exist_ok=True)

    subfolders: List[str] = args.get("subfolders") or args.get("structure") or []
    created = [str(root)]
    default_scaffold = {
        "src": None,
        "tests": None,
        "docs": None,
    }
    if args.get("scaffold_standard", False):
        for sub in default_scaffold:
            (root / sub).mkdir(exist_ok=True)
            created.append(str(root / sub))
    if subfolders:
        for sub in subfolders:
            sp = (root / str(sub)).resolve()
            _ensure_safe(sp)
            sp.mkdir(parents=True, exist_ok=True)
            created.append(str(sp))

    # Optional starter files.
    files: Dict[str, str] = args.get("files") or {}
    for rel, content in files.items():
        fp = (root / str(rel)).resolve()
        _ensure_safe(fp)
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(str(content), encoding="utf-8")
        created.append(str(fp))

    return {"result": f"Project folder created at {root}.", "path": str(root), "created": created}


@register("runPythonScript")
def run_python_script(args: Dict[str, Any]) -> Dict[str, Any]:
    path = args.get("path")
    if not path:
        raise ToolError("Parameter 'path' (script path) is required.")
    p = Path(os.path.expandvars(os.path.expanduser(str(path)))).resolve()
    _ensure_safe(p)
    if not p.exists():
        raise ToolError(f"Script does not exist: {p}")
    if p.suffix.lower() != ".py":
        p = p.with_suffix(".py")
        if not p.exists():
            raise ToolError(f"Script does not exist: {p}")

    interpreter = _detect_python()
    script_args: List[str] = args.get("args") or []
    if isinstance(script_args, str):
        script_args = [script_args]
    timeout = int(args.get("timeout", 30))

    cmd = [interpreter, str(p)] + [str(a) for a in script_args]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(p.parent),
        )
    except subprocess.TimeoutExpired:
        return {
            "result": f"Script timed out after {timeout}s.",
            "stdout": "",
            "stderr": f"Execution exceeded {timeout}s and was terminated.",
            "exit_code": None,
            "timed_out": True,
        }
    out = (proc.stdout or "")
    err = (proc.stderr or "")
    # Trim large outputs.
    if len(out) > 8000:
        out = out[:8000] + "…[truncated]"
    if len(err) > 4000:
        err = err[:4000] + "…[truncated]"
    status = "completed successfully" if proc.returncode == 0 else f"exited with code {proc.returncode}"
    return {
        "result": f"Ran {p.name}: {status}.",
        "stdout": out,
        "stderr": err,
        "exit_code": proc.returncode,
    }


__all__ = [
    "create_python_file",
    "write_code_file",
    "create_project_folder",
    "run_python_script",
]
