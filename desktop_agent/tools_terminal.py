"""
Terminal control: run shell commands and install packages natively.

Uses the OS backend for platform-independent shell execution. Includes a blacklist
of dangerous commands to prevent accidental system damage.
"""

from __future__ import annotations

import os
import stat
import subprocess
import time
import uuid
from typing import Any, Dict

from .registry import STATE, ToolError, register
from .backends import get_backend

# Destructive command patterns that are always blocked.
# Only genuinely dangerous operations are listed here.
# Destructive command patterns that are always blocked.
DANGEROUS_COMMAND_PATTERNS: list[str] = [
    # Destructive deletion
    "rm -rf /", "rm -rf --no-preserve-root", "rm -rf /*", "rm -rf ~", "rmdir /s",
    "del /s", "del /f /s /q", "del *",
    # Format/destroy storage
    "mkfs.", "dd if=", "dd of=", "format c:", "diskpart",
    # Fork bomb
    ":(){ :|:& };:",
    # Direct disk writes
    "> /dev/sda", "> /dev/sdb", "> /dev/nvme",
    # Wipe
    "wipefs", "blkdiscard",
    # Moving root
    "mv /* ", "mv / ",
    # Crypto miner / malware download patterns
    "| sh", "| bash",  # piping to shell
    "eval ",  # dangerous eval
    # chmod -R on root
    "chmod -R 777 /", "chmod -R 777 /*",
    # System directory modifications on Windows
    "C:\\Windows", "C:\\Program Files", "C:\\ProgramData",
]


def _is_blacklisted(command: str) -> bool:
    """Check if a command contains any dangerous pattern."""
    normalized = command.strip().lower()
    for pattern in DANGEROUS_COMMAND_PATTERNS:
        if pattern in normalized:
            return True
    return False


@register("runTerminalCommand")
def run_terminal_command(args: Dict[str, Any]) -> Dict[str, Any]:
    command = args.get("command")
    if not command:
        raise ToolError("Parameter 'command' is required.")

    # Block dangerous commands even if they have confirmation
    if _is_blacklisted(command):
        raise ToolError(
            f"This command is not allowed for security reasons. "
            f"Dangerous commands like '{command}' are blocked to protect your system. "
            f"Please use a safer alternative or contact the user who has admin access."
        )

    # Interactive sudo flow: if command starts with sudo, ask for password
    stripped = command.strip()
    if stripped.startswith("sudo "):
        cmd_id = str(uuid.uuid4())
        STATE.sudo_commands[cmd_id] = {
            "command": stripped,
            "expires_at": time.time() + 60,
        }
        return {
            "result": "This command requires sudo privileges. Use provideSudoPassword with the command_id to supply the sudo password.",
            "needs_sudo": True,
            "command_id": cmd_id,
        }

    result = get_backend().terminal.run_command(command)
    return {"result": f"Executed command: {command}", "output": result}


@register("provideSudoPassword")
def provide_sudo_password(args: Dict[str, Any]) -> Dict[str, Any]:
    """Provide the sudo password for a command that requires elevation.

    Call this after runTerminalCommand returns needs_sudo=true.
    The password is used once and discarded.
    """
    cmd_id = args.get("command_id")
    password = args.get("password")
    if not cmd_id or not password:
        raise ToolError("Both 'command_id' and 'password' are required.")

    entry = STATE.sudo_commands.pop(cmd_id, None)
    if entry is None:
        raise ToolError("Invalid or expired command_id. Request the command again with runTerminalCommand.")
    if time.time() > entry["expires_at"]:
        raise ToolError("Command expired (60s timeout). Request it again with runTerminalCommand.")

    full_command = entry["command"]
    inner_command = full_command[len("sudo "):].strip()
    try:
        proc = subprocess.run(
            ["sudo", "-S"] + inner_command.split(),
            input=password + "\n",
            capture_output=True,
            text=True,
            timeout=120,
        )
        output = proc.stdout + proc.stderr
        if not output.strip():
            output = f"Command finished with exit code {proc.returncode}"
        return {"result": f"Executed (with sudo): {full_command}", "output": output.strip()}
    except subprocess.TimeoutExpired:
        return {"result": "Command timed out (120s) and was terminated."}
    except FileNotFoundError:
        return {"result": "sudo not found on this system."}


@register("isCommandAllowed")
def is_command_allowed(args: Dict[str, Any]) -> Dict[str, Any]:
    """Check whether a command would be allowed by the terminal blacklist.

    This is useful when asking ELYSIA to help you validate a command before running.
    """
    command = args.get("command")
    if not command:
        raise ToolError("Parameter 'command' is required.")

    if _is_blacklisted(command):
        return {
            "result": f"BLOCKED: Command '{command}' is blacklisted for security",
            "allowed": False,
            "message": (
                f"Your command '{command}' is blocked as a safety precaution. "
                f"Use a safer alternative or ask for admin assistance if you truly need this."
            ),
        }

    return {
        "result": f"ALLOWED: Command '{command}' is not blacklisted",
        "allowed": True,
        "message": f"Command '{command}' appears safe. Use runTerminalCommand with your confirmation token to execute it.",
    }


@register("installPackage")
def install_package(args: Dict[str, Any]) -> Dict[str, Any]:
    package = args.get("package")
    if not package:
        raise ToolError("Parameter 'package' is required.")

    # Check package installation safety
    if _is_blacklisted(f"pacman -S {package}"):
        raise ToolError(
            f"Package installation of '{package}' is blocked for security. "
            f"To prevent system breakage, use 'pacman -S --noconfirm {package}' instead. "
            f"Ask the user to run it manually or request package removal (muon)."
        )

    result = get_backend().terminal.install_package(package)
    return {"result": f"Attempted to install package: {package}", "output": result}


__all__ = ["run_terminal_command", "provide_sudo_password", "is_command_allowed", "install_package", "DANGEROUS_COMMAND_PATTERNS"]
