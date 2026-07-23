"""
IITM BS Degree quick-access tools.

Provides one-click access to IITM BS portal resources, course notes,
Acegrade, and other study tools.
"""

from __future__ import annotations

import webbrowser
from typing import Any, Dict

from ..registry import ToolError, register

IITM_LINKS = {
    # IITM official
    "portal": ("IITM BS Portal Login", "https://app.onlinedegree.iitm.ac.in/auth/login"),
    "course": ("Course Dashboard", "https://ds.study.iitm.ac.in/auth/login?apply_qualifier=true"),
    "academics": ("Academics Info", "https://study.iitm.ac.in/ds/academics.html"),
    "qualifier": ("Qualifier Portal", "https://app.onlinedegree.iitm.ac.in/auth/login?apply_qualifier=true"),
    "exams": ("Exams & Scheduling", "https://es.study.iitm.ac.in/"),
    # Study tools
    "acegrade": ("AceGrade - IITM BS Companion", "https://www.acegrade.in/"),
    "mlt_notes": ("MLT Notes (karthik-iitm)", "https://karthik-iitm.github.io/MLT/"),
    "pdsa_notes": ("PDSA Online Textbook", "https://pdsaiitm.github.io/"),
    "pdsa_notes_community": ("PDSA Notes (harshshah)", "https://harshshah-codes.github.io/PDSA-Notes/"),
    "community_notes": ("Community Notes & Papers", "https://iitmdatascience.com/notes"),
    # GitHub repos
    "mlt_github": ("MLT GitHub (karthik-iitm)", "https://github.com/karthik-iitm/MLT"),
    # Quick actions
    "portal_login": ("Portal Login Page", "https://app.onlinedegree.iitm.ac.in/auth/login"),
}

@register("iitmQuickLinks")
def iitm_quick_links(args: Dict[str, Any]) -> Dict[str, Any]:
    """List all available IITM BS quick links."""
    links_text = "IITM BS Quick Links:\n\n"
    links_text += "Official:\n"
    links_text += f"  portal   - IITM BS Portal\n"
    links_text += f"  course   - Course Dashboard\n"
    links_text += f"  exams    - Exams & Scheduling\n"
    links_text += f"  academics - Academics Info\n\n"
    links_text += "Study:\n"
    links_text += f"  acegrade  - AceGrade Companion\n"
    links_text += f"  mlt_notes - MLT Notes\n"
    links_text += f"  pdsa_notes - PDSA Online Textbook\n"
    links_text += f"  community_notes - Community Notes\n"
    return {"result": links_text, "links": {k: v[0] for k, v in IITM_LINKS.items()}}


@register("iitmOpen")
def iitm_open(args: Dict[str, Any]) -> Dict[str, Any]:
    """Open an IITM BS resource in the system browser."""
    key = (args.get("resource") or "").strip().lower()
    if not key:
        raise ToolError("Parameter 'resource' is required. Use iitmQuickLinks to list available resources.")
    if key not in IITM_LINKS:
        available = ", ".join(sorted(IITM_LINKS.keys()))
        raise ToolError(f"Unknown resource '{key}'. Available: {available}")
    name, url = IITM_LINKS[key]
    try:
        import subprocess
        # Try launching Google Chrome directly, fallback to default browser
        subprocess.Popen(["google-chrome-stable", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        webbrowser.open(url)
    return {"result": f"Opened {name} ({url}) in your browser.", "url": url}


@register("iitmOpenCustom")
def iitm_open_custom(args: Dict[str, Any]) -> Dict[str, Any]:
    """Open a custom IITM URL (e.g. a specific course page)."""
    url = (args.get("url") or "").strip()
    if not url:
        raise ToolError("Parameter 'url' is required.")
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    try:
        import subprocess
        subprocess.Popen(["google-chrome-stable", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        webbrowser.open(url)
    return {"result": f"Opened {url} in your browser.", "url": url}


__all__ = ["iitm_quick_links", "iitm_open", "iitm_open_custom"]
