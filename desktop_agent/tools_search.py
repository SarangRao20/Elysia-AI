"""
Search commands: open a search results page for a query on a given engine.

These launch in the user's default browser (separate from the Playwright
automation browser). For form-filling / in-page automation see tools_browser.
"""

from __future__ import annotations

from typing import Any, Dict

from .registry import register
from .tools_websites import _build_search_url, open_url


@register("searchWeb")
def search_web(args: Dict[str, Any]) -> Dict[str, Any]:
    query = args.get("query") or args.get("q")
    engine = (args.get("engine") or "google").strip().lower()
    if not query:
        raise ToolError("Parameter 'query' is required.")
    url = _build_search_url(engine, str(query))
    resolved = open_url(url)
    return {"result": f"Searching {engine} for '{query}': opened {resolved}."}


@register("searchYouTube")
def search_youtube(args: Dict[str, Any]) -> Dict[str, Any]:
    query = args.get("query") or args.get("q")
    if not query:
        raise ToolError("Parameter 'query' is required.")
    url = _build_search_url("youtube", str(query))
    resolved = open_url(url)
    return {"result": f"YouTube search for '{query}' opened at {resolved}."}


@register("searchGoogle")
def search_google(args: Dict[str, Any]) -> Dict[str, Any]:
    query = args.get("query") or args.get("q")
    if not query:
        raise ToolError("Parameter 'query' is required.")
    url = _build_search_url("google", str(query))
    resolved = open_url(url)
    return {"result": f"Google search for '{query}' opened at {resolved}."}


@register("searchGitHub")
def search_github(args: Dict[str, Any]) -> Dict[str, Any]:
    query = args.get("query") or args.get("q")
    if not query:
        raise ToolError("Parameter 'query' is required.")
    url = _build_search_url("github", str(query))
    resolved = open_url(url)
    return {"result": f"GitHub search for '{query}' opened at {resolved}."}


__all__ = ["search_web", "search_youtube", "search_google", "search_github"]
