"""
Two-step confirmation flow for dangerous power actions.

Step 1: requestPowerAction(action) -> mints a single-use, short-lived token
        and tells ELYSIA (via the result string) to ask the user to confirm.
Step 2: executePowerAction(action, execute_token) -> validates the token and,
        only if it matches & is unexpired, performs the gated action.

A token is bound to a single action name and can be consumed exactly once.
"""

from __future__ import annotations

import secrets
import time
from typing import Any, Dict

from .registry import STATE, ToolError, register

# Actions that can ONLY run after explicit confirmation.
DANGEROUS_ACTIONS = {"shutdown", "restart", "sleep", "lock"}

# Friendly human labels so ELYSIA's prompt-to-confirm reads naturally.
ACTION_LABEL = {
    "shutdown": "shut down the computer",
    "restart": "restart the computer",
    "sleep": "put the computer to sleep",
    "lock": "lock the computer",
    "terminal": "execute a terminal command",
}

TOKEN_TTL_SECONDS = 60.0


def _purge_expired() -> None:
    now = time.time()
    expired = [t for t, v in STATE.confirmations.items() if v["expires"] < now]
    for t in expired:
        STATE.confirmations.pop(t, None)


@register("requestPowerAction")
def request_power_action(args: Dict[str, Any]) -> Dict[str, Any]:
    """Mint a confirmation token for a dangerous action.

    ELYSIA calls this first; the returned message instructs her to ask the
    user out loud to confirm before the action runs.
    """
    action = (args.get("action") or "").strip().lower()
    if action not in DANGEROUS_ACTIONS:
        raise ToolError(
            f"Unknown power action '{action}'. Valid actions: "
            f"{', '.join(sorted(DANGEROUS_ACTIONS))}."
        )

    _purge_expired()
    token = secrets.token_urlsafe(6)
    STATE.confirmations[token] = {
        "action": action,
        "expires": time.time() + TOKEN_TTL_SECONDS,
    }

    label = ACTION_LABEL[action]
    return {
        "requires_confirmation": True,
        "token": token,
        "expires_in_seconds": int(TOKEN_TTL_SECONDS),
        "result": (
            f"Dangerous action requested: {label}. A confirmation is required. "
            f"Ask the user out loud to confirm they want to {label}, then call "
            f"executePowerAction with action='{action}' and execute_token='{token}'. "
            f"Token expires in {int(TOKEN_TTL_SECONDS)} seconds."
        ),
    }


@register("requestTerminalAction")
def request_terminal_action(args: Dict[str, Any]) -> Dict[str, Any]:
    """Mint a confirmation token for a terminal command.

    ELYSIA calls this first; the returned message instructs her to ask the
    user out loud to confirm the command.

    Blacklisted commands are rejected immediately without asking the user.
    """
    command = args.get("command") or args.get("package")
    if not command:
        raise ToolError("You must specify the 'command' or 'package' to request confirmation.")

    # Reject blacklisted commands immediately — never ask user for confirmation
    # on something we will block anyway
    from .tools_terminal import _is_blacklisted
    if _is_blacklisted(command):
        handler_name = "runTerminalCommand" if "command" in args else "installPackage"
        raise ToolError(
            f"Command `{command}` is blocked by the security blacklist. "
            f"Do NOT ask the user for confirmation. "
            f"Tell them this command is not allowed for safety reasons and "
            f"suggest an alternative. Do NOT call {handler_name}."
        )

    _purge_expired()
    token = secrets.token_urlsafe(6)
    STATE.confirmations[token] = {
        "action": "terminal",
        "command": command,
        "expires": time.time() + TOKEN_TTL_SECONDS,
    }

    return {
        "requires_confirmation": True,
        "token": token,
        "expires_in_seconds": int(TOKEN_TTL_SECONDS),
        "result": (
            f"Dangerous terminal action requested for: `{command}`. A confirmation is required. "
            f"Ask the user out loud to confirm they want to run this command, then call "
            f"the original execution tool (runTerminalCommand or installPackage) with execute_token='{token}'. "
            f"Token expires in {int(TOKEN_TTL_SECONDS)} seconds."
        )
    }



def consume_token(action: str, token: str | None) -> None:
    """Validate & consume a confirmation token for the given action.

    Raises ToolError if missing/expired/mismatched. Called by tools_pc.
    """
    _purge_expired()
    if not token:
        raise ToolError(
            f"No confirmation token supplied for {ACTION_LABEL.get(action, action)}. "
            "Call requestPowerAction first and ask the user to confirm."
        )
    entry = STATE.confirmations.get(token)
    if entry is None:
        raise ToolError(
            f"Confirmation token is invalid or expired for "
            f"{ACTION_LABEL.get(action, action)}. Ask the user again and restart "
            f"the request."
        )
    if entry["action"] != action:
        raise ToolError(
            "Confirmation token does not match the requested action. "
            "Re-request confirmation for the correct action."
        )
    # Single-use: consume now.
    STATE.confirmations.pop(token, None)


__all__ = [
    "DANGEROUS_ACTIONS",
    "ACTION_LABEL",
    "request_power_action",
    "request_terminal_action",
    "consume_token",
]
