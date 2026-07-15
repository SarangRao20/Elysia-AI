"""
Terminal control: run shell commands and install packages natively.

Uses the OS backend for platform-independent shell execution. Includes a blacklist
of dangerous commands to prevent accidental system damage.
"""

from __future__ import annotations

from typing import Any, Dict

from .registry import ToolError, register
from .backends import get_backend

# Blacklist of dangerous terminal commands that should be blocked.
# Dangerous patterns are matched via substring in the command.
# This list is designed for Arch Linux with Hyprland, including commonly
# misused system commands. Add any additional patterns as needed.

DANGEROUS_COMMAND_PATTERNS: list[str] = [
    "sudo ",  # Escalates privileges - bypasses confirmation
    "su ",     # Escalates privileges
    "reboot", "shutdown", "halt", "poweroff", "suspend",  # Powers down the system
    "pacman -R", "pacman --remove",  # Removes packages - use with caution
    "rm -rf /", "mkfs", "dd ",  # Dangerous file system operations
    "chmod -R 777", "chown -R",  # Dangerous file permissions
    "mount ", "umount ",  # Mount/unmount filesystems
    "iptables ", "firewall-cmd ", "ufw ",  # Network firewalls
    "ip route ", "ip link ", "ip addr ",  # Network manipulation
    "mdadm ", "lvcreate",  # Storage operations
    "systemctl stop", "systemctl disable",  # Systemd controls
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

    result = get_backend().terminal.run_command(command)
    return {"result": f"Executed command: {command}", "output": result}


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


__all__ = ["run_terminal_command", "is_command_allowed", "install_package", "DANGEROUS_COMMAND_PATTERNS"]
