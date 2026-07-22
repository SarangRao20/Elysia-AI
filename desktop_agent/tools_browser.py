"""
Browser automation via Playwright.

Modes:
  - managed (default): launches its own headed Chromium instance
  - cdp: connects to an existing Chrome via --remote-debugging-port=9222
         (set ELYSIA_BROWSER_MODE=cdp to enable)

Capabilities: open/navigate, new/close tabs, search, click, type, fill forms,
back/forward, scroll. Lazy-initialized; robust to closed pages.
"""

from __future__ import annotations

import asyncio
import os
import threading
from typing import Any, Dict, Optional
from urllib.parse import quote_plus

from .registry import STATE, ToolError, register

# A dedicated event loop + thread runs all Playwright coroutines, because
# Playwright's sync API can deadlock under FastAPI's threadpool. We use the
# async API marshalled through a single loop.
_LOOP: Optional[asyncio.AbstractEventLoop] = None
_LOOP_THREAD: Optional[threading.Thread] = None
_LOOP_LOCK = threading.Lock()


def _get_loop() -> "asyncio.AbstractEventLoop":
    global _LOOP, _LOOP_THREAD
    with _LOOP_LOCK:
        if _LOOP is None or _LOOP.is_closed():
            _LOOP = asyncio.new_event_loop()
            _LOOP_THREAD = threading.Thread(target=_run_loop, daemon=True)
            _LOOP_THREAD.start()
        return _LOOP


def _run_loop() -> None:
    loop = _LOOP
    assert loop is not None
    asyncio.set_event_loop(loop)
    try:
        loop.run_forever()
    finally:
        try:
            loop.close()
        except Exception:
            pass


def _run(coro):
    """Submit a coroutine to the dedicated Playwright loop and block on it."""
    loop = _get_loop()
    future = asyncio.run_coroutine_threadsafe(coro, loop)
    return future.result(timeout=60)


# --- Async Playwright lifecycle ---------------------------------------------


def _browser_mode() -> str:
    """Return 'cdp' or 'managed' based on ELYSIA_BROWSER_MODE env var."""
    return os.environ.get("ELYSIA_BROWSER_MODE", "cdp").strip().lower()


async def _ensure_browser_cdp_async() -> Any:
    """Connect to an already-running Chrome via DevTools Protocol.

    User must start Chrome with: google-chrome --remote-debugging-port=9222
    Uses the user's real profile — all cookies, logins, and extensions.

    Falls back to managed mode if Chrome isn't reachable.
    """
    if STATE.page is not None:
        try:
            if STATE.page.is_closed() or not STATE.browser.is_connected():
                STATE.reset_playwright()
            else:
                return STATE.page
        except Exception:
            STATE.reset_playwright()

    if STATE.playwright is None:
        from playwright.async_api import async_playwright
        STATE.playwright = await async_playwright().start()

    cdp_url = os.environ.get("ELYSIA_CDP_URL", "http://127.0.0.1:9222")
    if getattr(STATE, "browser", None) is None:
        import logging
        log = logging.getLogger("elysia.desktop")
        try:
            STATE.browser = await STATE.playwright.chromium.connect_over_cdp(cdp_url)
        except Exception as e:
            log.warning("CDP connect failed (%s). Auto-launching Chrome with --remote-debugging-port=9222...", e)
            import shutil as _shutil
            import sys as _sys
            chrome_paths = ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser", "chrome"]
            if _sys.platform == "win32":
                chrome_paths.extend([
                    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe")
                ])
            chrome = next((p for p in chrome_paths if os.path.exists(p) or _shutil.which(p)), None)
            if chrome:
                chrome_exe = chrome if os.path.exists(chrome) else _shutil.which(chrome)
                import subprocess as _sp
                _sp.Popen(
                    [chrome_exe, "--remote-debugging-port=9222",
                     f"--user-data-dir={os.path.expanduser('~')}/.elysia_chrome_cdp"],
                    close_fds=True if _sys.platform != "win32" else False,
                    start_new_session=True if _sys.platform != "win32" else False,
                    creationflags=_sp.CREATE_NEW_PROCESS_GROUP | _sp.DETACHED_PROCESS if _sys.platform == "win32" else 0,
                    stdout=_sp.DEVNULL, stderr=_sp.DEVNULL
                )
                await asyncio.sleep(3)
                try:
                    STATE.browser = await STATE.playwright.chromium.connect_over_cdp(cdp_url)
                except Exception:
                    pass
            if STATE.browser is None:
                log.warning(
                    "CDP mode: Could not connect to Chrome on port 9222. "
                    "To use your own Chrome profile, close all Chrome windows first, then run:\n"
                    "  google-chrome-stable --remote-debugging-port=9222\n"
                    "Falling back to managed browser mode."
                )
                return await _ensure_browser_managed_async()
        STATE.context = STATE.browser.contexts[0] if STATE.browser.contexts else None
        if STATE.context is None:
            log.warning("No browser context via CDP. Falling back to managed mode.")
            return await _ensure_browser_managed_async()

    pages = STATE.context.pages
    if pages:
        STATE.page = pages[-1]
    else:
        STATE.page = await STATE.context.new_page()
    return STATE.page


async def _ensure_browser_managed_async() -> Any:
    """Launch the agent's own headed Chromium instance."""
    if STATE.page is not None:
        try:
            if STATE.page.is_closed() or not STATE.browser.is_connected():
                STATE.reset_playwright()
            else:
                return STATE.page
        except Exception:
            STATE.reset_playwright()

    if STATE.playwright is None:
        from playwright.async_api import async_playwright
        STATE.playwright = await async_playwright().start()

    if getattr(STATE, "context", None) is None:
        user_data_dir = os.path.join(os.path.expanduser("~"), ".elysia_browser_data")
        import shutil as _shutil
        _chrome_channel = "chrome" if _shutil.which("google-chrome-stable") else None
        STATE.context = await STATE.playwright.chromium.launch_persistent_context(
            user_data_dir,
            channel=_chrome_channel,
            headless=False,
            args=[
                "--start-maximized",
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-features=ChromeWhatsNewUI",
                "--disable-features=TranslateUI",
                "--disable-infobars",
                "--no-first-run",
                "--disable-blink-features=IdleDetection",
            ],
            ignore_default_args=[
                "--enable-automation",
                "--disable-field-trial-config",
            ],
            no_viewport=True,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
        )
        # Inject anti-detection script into every new page
        await STATE.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36' });
            // Override chrome.runtime detection
            window.chrome = { runtime: {} };
        """)
        STATE.browser = STATE.context.browser

    pages = STATE.context.pages
    if pages:
        STATE.page = pages[-1]
    else:
        STATE.page = await STATE.context.new_page()
    return STATE.page


async def _ensure_browser_async() -> Any:
    if _browser_mode() == "cdp":
        return await _ensure_browser_cdp_async()
    return await _ensure_browser_managed_async()


async def _page() -> Any:
    return await _ensure_browser_async()


def _normalize_url(raw: str) -> str:
    url = raw.strip()
    if not url:
        raise ToolError("Empty URL.")
    if "://" not in url:
        url = "https://" + url
    return url


# --- Handlers ---------------------------------------------------------------


@register("desktopBrowserOpen")
async def browser_open(args: Dict[str, Any]) -> Dict[str, Any]:
    url = _normalize_url(args.get("url") or "https://www.google.com")
    page = await _page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Could not open {url}: {e}")
    return {"result": f"Opened {url} in the automation browser.", "url": page.url}


@register("desktopBrowserNavigate")
async def browser_navigate(args: Dict[str, Any]) -> Dict[str, Any]:
    # Alias of desktopBrowserOpen, retained for clarity.
    return await browser_open(args)


@register("desktopBrowserOpenTab")
async def browser_open_tab(args: Dict[str, Any]) -> Dict[str, Any]:
    url = _normalize_url(args.get("url") or "about:blank")
    await _ensure_browser_async()
    ctx = STATE.context
    page = await ctx.new_page()
    STATE.page = page  # make it active
    if url != "about:blank":
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=20000)
        except Exception as e:  # noqa: BLE001
            raise ToolError(f"Opened tab but navigation failed: {e}")
    return {"result": f"New tab opened at {url}.", "url": url}


@register("desktopBrowserCloseTab")
async def browser_close_tab(args: Dict[str, Any]) -> Dict[str, Any]:
    page = await _page()
    try:
        await page.close()
    except Exception:
        pass
    pages = STATE.context.pages if STATE.context else []
    STATE.page = pages[-1] if pages else None
    if STATE.page is None:
        return {"result": "Closed the last tab; browser now empty."}
    return {"result": f"Closed tab. Active tab now: {STATE.page.url}"}


@register("browserTabAction")
async def browser_tab_action(args: Dict[str, Any]) -> Dict[str, Any]:
    """Unified tab action handler. Maps browserTabAction to Playwright ops."""
    action = (args.get("action") or "").strip().lower()
    if action == "new":
        url = args.get("url") or "about:blank"
        return await browser_open_tab({"url": url})
    elif action == "close":
        return await browser_close_tab(args)
    elif action == "switch":
        # Switch to a tab by index or URL
        await _ensure_browser_async()
        pages = STATE.context.pages if STATE.context else []
        if not pages:
            raise ToolError("No tabs open.")
        tab_id = args.get("tabId")
        if tab_id:
            # Try to find by URL substring
            for p in pages:
                if tab_id in (p.url or ""):
                    STATE.page = p
                    return {"result": f"Switched to tab: {p.url}"}
        # Default: switch to first tab
        STATE.page = pages[0]
        return {"result": f"Switched to tab: {pages[0].url}"}
    else:
        raise ToolError(f"Unknown tab action '{action}'. Use: new, close, switch.")


@register("desktopBrowserSearch")
async def browser_search(args: Dict[str, Any]) -> Dict[str, Any]:
    query = args.get("query") or args.get("q")
    engine = (args.get("engine") or "google").strip().lower()
    if not query:
        raise ToolError("Parameter 'query' is required.")
    q = quote_plus(str(query))
    url = {
        "google": f"https://www.google.com/search?q={q}",
        "youtube": f"https://www.youtube.com/results?search_query={q}",
        "github": f"https://github.com/search?q={q}",
        "duckduckgo": f"https://duckduckgo.com/?q={q}",
        "bing": f"https://www.bing.com/search?q={q}",
    }.get(engine)
    if not url:
        raise ToolError(f"Unsupported engine '{engine}'.")
    page = await _page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=20000)
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Search navigation failed: {e}")
    return {"result": f"Searched {engine} for '{query}'.", "url": page.url}


@register("desktopBrowserClick")
async def browser_click(args: Dict[str, Any]) -> Dict[str, Any]:
    selector = args.get("selector")
    text = args.get("text")
    page = await _page()
    try:
        if not selector and not text:
            raise ToolError("Provide 'selector' or 'text' to click.")

        if text:
            loc = page.get_by_text(str(text), exact=False).first
        else:
            loc = page.locator(str(selector)).first

        # Try Playwright's native force click
        try:
            await loc.click(timeout=5000, force=True)
        except Exception:
            # Fallback to pure JavaScript click
            await loc.evaluate("node => node.click()")

        return {"result": f"Successfully clicked on '{text or selector}'."}
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Click failed: {e}")


@register("desktopBrowserType")
async def browser_type(args: Dict[str, Any]) -> Dict[str, Any]:
    text = args.get("text")
    selector = args.get("selector")
    clear_first = bool(args.get("clear", True))
    if not text:
        raise ToolError("Parameter 'text' is required.")
    page = await _page()
    try:
        if selector:
            await page.fill(selector, str(text), timeout=5000)
        else:
            if clear_first:
                # Try to clear active element robustly
                await page.evaluate('''() => {
                    if (document.activeElement && typeof document.activeElement.value !== "undefined") {
                        document.activeElement.value = "";
                    }
                }''')
                await page.keyboard.press("Control+a")
                await page.keyboard.press("Delete")
                await page.keyboard.press("Backspace")
            await page.keyboard.type(str(text))
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Type failed: {e}")
    return {"result": f"Typed {len(str(text))} characters."}


@register("desktopBrowserFillForm")
async def browser_fill_form(args: Dict[str, Any]) -> Dict[str, Any]:
    """Fill multiple fields. fields = { selector: value, ... }"""
    fields = args.get("fields")
    submit = args.get("submit")  # optional selector to click after filling
    if not isinstance(fields, dict) or not fields:
        raise ToolError("Parameter 'fields' (object of selector->value) is required.")
    page = await _page()
    filled = 0
    try:
        for sel, val in fields.items():
            await page.fill(str(sel), str(val), timeout=5000)
            filled += 1
        if submit:
            await page.click(str(submit), timeout=5000)
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Form fill failed after {filled} field(s): {e}")
    extra = " and submitted." if submit else "."
    return {"result": f"Filled {filled} field(s){extra}"}


@register("desktopBrowserGoBack")
async def browser_go_back(args: Dict[str, Any]) -> Dict[str, Any]:
    page = await _page()
    try:
        await page.go_back(timeout=15000)
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Back failed: {e}")
    return {"result": f"Went back. Now on {page.url}."}


@register("desktopBrowserGoForward")
async def browser_go_forward(args: Dict[str, Any]) -> Dict[str, Any]:
    page = await _page()
    try:
        await page.go_forward(timeout=15000)
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Forward failed: {e}")
    return {"result": f"Went forward. Now on {page.url}."}


@register("desktopBrowserScroll")
async def browser_scroll(args: Dict[str, Any]) -> Dict[str, Any]:
    direction = (args.get("direction") or "down").lower()
    amount = int(args.get("amount", 500))
    delta = amount if direction != "up" else -amount
    page = await _page()
    try:
        await page.mouse.wheel(0, delta)
    except Exception as e:  # noqa: BLE001
        raise ToolError(f"Scroll failed: {e}")
    return {"result": f"Scrolled {direction} {amount}px."}


@register("desktopBrowserReadText")
async def browser_read_text(args: Dict[str, Any]) -> Dict[str, Any]:
    """Read the visible text content of the current page (trimmed)."""
    max_chars = int(args.get("max_chars", 4000))
    page = await _page()
    try:
        text = await page.evaluate("() => document.body.innerText")
        if not text:
            text = await page.evaluate("() => document.body.textContent || ''")
        text = (text or "").strip()
        if len(text) > max_chars:
            text = text[:max_chars] + "... [truncated]"
        return {"result": f"Page text ({len(text)} chars):", "text": text}
    except Exception as e:
        raise ToolError(f"Read text failed: {e}")


@register("desktopBrowserGetLinks")
async def browser_get_links(args: Dict[str, Any]) -> Dict[str, Any]:
    """Extract all visible hyperlinks from the current page."""
    page = await _page()
    try:
        links = await page.evaluate("""() => {
            const anchors = document.querySelectorAll('a[href]');
            const results = [];
            for (const a of anchors) {
                const text = (a.textContent || '').trim().substring(0, 100);
                const href = a.href;
                if (text && href && !href.startsWith('javascript:')) {
                    results.push({ text, href });
                }
            }
            return results;
        }""")
        if not links:
            return {"result": "No links found on the current page.", "links": []}
        summary = f"Found {len(links)} links on the page."
        formatted = "\n".join(f"  {l['text']} -> {l['href']}" for l in links[:30])
        if len(links) > 30:
            formatted += f"\n  ... and {len(links) - 30} more"
        return {"result": summary, "links": links, "text": formatted}
    except Exception as e:
        raise ToolError(f"Get links failed: {e}")


# Wrap the async handlers so FastAPI's sync threadpool path can call them.
# Each @register'd async function above is replaced by a sync wrapper below.
def _sync_wrap(async_fn):
    def wrapper(args: Dict[str, Any]) -> Dict[str, Any]:
        return _run(async_fn(args))

    wrapper.__name__ = async_fn.__name__
    wrapper.__doc__ = async_fn.__doc__
    return wrapper


# Re-register the async handlers as synchronous wrappers so the registry
# dispatcher (which is sync) can call them uniformly.
from .registry import TOOLS  # noqa: E402

for _name in [
    "desktopBrowserOpen",
    "desktopBrowserNavigate",
    "desktopBrowserOpenTab",
    "desktopBrowserCloseTab",
    "desktopBrowserSearch",
    "desktopBrowserClick",
    "desktopBrowserType",
    "desktopBrowserFillForm",
    "desktopBrowserGoBack",
    "desktopBrowserGoForward",
    "desktopBrowserScroll",
    "desktopBrowserReadText",
    "desktopBrowserGetLinks",
    "browserTabAction",
]:
    _orig = TOOLS[_name]
    if asyncio.iscoroutinefunction(_orig):
        TOOLS[_name] = _sync_wrap(_orig)


def shutdown_browser() -> None:
    """Cleanly stop the Playwright browser (called on app shutdown).

    In CDP mode the agent does not own the browser, so shutdown is a no-op.
    """
    if _browser_mode() == "cdp":
        STATE.reset_playwright()
        return
    if STATE.browser is None:
        return

    async def _stop():
        try:
            if STATE.browser:
                await STATE.browser.close()
        except Exception:
            pass
        try:
            if STATE.playwright:
                await STATE.playwright.stop()
        except Exception:
            pass
        STATE.reset_playwright()

    try:
        _run(_stop())
    except Exception:
        STATE.reset_playwright()


__all__ = [
    "browser_open",
    "browser_navigate",
    "browser_open_tab",
    "browser_close_tab",
    "browser_search",
    "browser_click",
    "browser_type",
    "browser_fill_form",
    "browser_go_back",
    "browser_go_forward",
    "browser_scroll",
    "shutdown_browser",
]
