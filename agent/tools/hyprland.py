import subprocess
import re
from typing import Any, Dict
from ..registry import register, ToolError


@register("switchWorkspace")
def switch_workspace(args: Dict[str, Any]) -> Dict[str, Any]:
    ws = args.get("workspace", "")
    if not ws:
        raise ToolError("Parameter 'workspace' is required.")
    try:
        subprocess.run(["hyprctl", "dispatch", "workspace", str(ws)], check=True)
        return {"result": f"Switched to workspace {ws}."}
    except subprocess.CalledProcessError as e:
        raise ToolError(f"Failed to switch workspace: {e}")
    except FileNotFoundError:
        raise ToolError("hyprctl not found — not running Hyprland?")


@register("listWorkspaces")
def list_workspaces(args: Dict[str, Any]) -> Dict[str, Any]:
    try:
        out = subprocess.check_output(["hyprctl", "workspaces"], text=True)
        workspaces = []
        for line in out.splitlines():
            m = re.match(r"workspace ID (\d+)", line)
            if m:
                wid = int(m.group(1))
                workspaces.append(wid)
        return {
            "result": f"Available workspaces: {', '.join(str(w) for w in sorted(workspaces))}.",
            "workspaces": sorted(workspaces)
        }
    except FileNotFoundError:
        raise ToolError("hyprctl not found — not running Hyprland?")
    except Exception as e:
        raise ToolError(f"Failed to list workspaces: {e}")


@register("moveToWorkspace")
def move_to_workspace(args: Dict[str, Any]) -> Dict[str, Any]:
    ws = args.get("workspace", "")
    if not ws:
        raise ToolError("Parameter 'workspace' is required.")
    try:
        subprocess.run(["hyprctl", "dispatch", "movetoworkspace", str(ws)], check=True)
        return {"result": f"Moved active window to workspace {ws}."}
    except subprocess.CalledProcessError as e:
        raise ToolError(f"Failed to move window: {e}")
    except FileNotFoundError:
        raise ToolError("hyprctl not found — not running Hyprland?")
