# ELYSIA Desktop Control Agent

A local Python FastAPI service that gives ELYSIA **JARVIS-style desktop control** —
open apps, manage files, control volume, take screenshots, OCR the screen, automate a
real Chromium browser, run code, read system stats, and more.

> **This agent does NOT modify ELYSIA's UI, personality, or chat system.** It is a pure
> backend tool layer that ELYSIA's existing Node bridge (`server.ts`) calls over HTTP.

---

## Prerequisites

| Dependency | Why | Notes |
|---|---|---|
| **Python 3.11+** | Runtime | Use the full interpreter path, e.g. `C:\Users\MSI\AppData\Local\Programs\Python\Python311\python.exe` |
| **pip** | Install Python packages | Ships with Python |
| **Chromium** (Playwright) | Browser automation | Installed via `playwright install chromium` |
| **Tesseract OCR** *(optional)* | Screen text reading | Download from [UB-Mannheim/tesseract](https://github.com/UB-Mannheim/tesseract/wiki). Non-OCR tools work without it. |

---

## Setup (one-time)

```bash
# 1. Navigate to the project root
cd C:\Users\MSI\Desktop\elysia-ai-assistant

# 2. Install Python dependencies (use the full interpreter path if `python` shim is broken)
"C:\Users\MSI\AppData\Local\Programs\Python\Python311\python.exe" -m pip install -r desktop_agent/requirements.txt

# 3. Install the Playwright Chromium browser (one-time, ~130MB download)
"C:\Users\MSI\AppData\Local\Programs\Python\Python311\python.exe" -m playwright install chromium

# 4. (Optional) Install Tesseract OCR for screen-reading capabilities
#    Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
#    Install to default path: C:\Program Files\Tesseract-OCR\
```

---

## Run

```bash
# Start the desktop agent on port 8765
"C:\Users\MSI\AppData\Local\Programs\Python\Python311\python.exe" -m desktop_agent.main

# Or with uvicorn directly:
"C:\Users\MSI\AppData\Local\Programs\Python\Python311\python.exe" -m uvicorn desktop_agent.main:app --host 127.0.0.1 --port 8765
```

The agent binds to `127.0.0.1:8765`. Then start ELYSIA normally with `npm run dev`.

---

## API

### `GET /health`
Returns `{ status: "ok", tools: [...], tool_count: N }`.

### `GET /tools`
Returns the list of registered tool names.

### `POST /execute`
```json
{ "tool": "openApplication", "args": { "name": "notepad" } }
```
Returns:
```json
{ "ok": true, "result": { "result": "Notepad opened." }, "tool": "openApplication" }
```
On error:
```json
{ "ok": false, "error": "File does not exist: ...", "tool": "readFile" }
```

---

## Available Tools

### 🖥️ Applications
| Tool | Description |
|---|---|
| `openApplication` | Open Notepad, Chrome, VS Code, Calculator, Explorer, Task Manager, Settings, etc. |
| `closeApplication` | Close a running application by name |

### 🌐 Websites & Search
| Tool | Description |
|---|---|
| `openWebsite` | Open a named site (YouTube, Gmail, GitHub…) or arbitrary URL in the default browser |
| `searchWeb` | Search any engine (Google, YouTube, GitHub, DuckDuckGo, Bing) |
| `searchYouTube` | Shortcut: search YouTube |
| `searchGoogle` | Shortcut: search Google |
| `searchGitHub` | Shortcut: search GitHub |

### 📁 Files
| Tool | Description |
|---|---|
| `createFile` | Create a text file with content |
| `readFile` | Read a file's contents |
| `renameFile` | Rename a file |
| `deleteFile` | Delete a file (sends to Recycle Bin by default) |
| `moveFile` | Move a file to a new location |
| `openFolder` | Open Desktop, Documents, Downloads, etc. in Explorer |
| `listFiles` | List files in a folder |
| `searchFiles` | Find files by name/extension (e.g. "find my Python files") |

### 🎛️ PC Control
| Tool | Description |
|---|---|
| `volumeUp` | Increase volume |
| `volumeDown` | Decrease volume |
| `setVolume` | Set volume to a specific percentage |
| `muteToggle` | Toggle mute/unmute |
| `requestPowerAction` | **Step 1**: Request confirmation token for shutdown/restart/sleep/lock |
| `executePowerAction` | **Step 2**: Execute the power action with a valid token |

### 🪟 Window Management
| Tool | Description |
|---|---|
| `minimizeWindow` | Minimize active or named window |
| `maximizeWindow` | Maximize active or named window |
| `closeWindow` | Close active or named window |
| `switchApplication` | Switch to a named window, or Alt+Tab cycle |

### 📋 Clipboard
| Tool | Description |
|---|---|
| `copySelected` | Copy selected text (sends Ctrl+C, reads clipboard) |
| `pasteClipboard` | Paste text into the active input |
| `getClipboard` | Read current clipboard contents |
| `clearClipboard` | Empty the clipboard |

### 📸 Screenshot & Screen Reading
| Tool | Description |
|---|---|
| `takeScreenshot` | Capture the full screen |
| `saveScreenshot` | Save screenshot to Pictures/ElysiaScreenshots |
| `analyzeScreenshot` | Screenshot + OCR to extract visible text |
| `readScreen` | Read the active window's title + visible text via OCR |

### 🌐 Browser Automation (Playwright)
| Tool | Description |
|---|---|
| `browserOpen` / `browserNavigate` | Open a URL in the automation browser |
| `browserOpenTab` | Open a new tab |
| `browserCloseTab` | Close a tab |
| `browserSearch` | Search in the automation browser |
| `browserClick` | Click an element by selector or text |
| `browserType` | Type text into the active element |
| `browserFillForm` | Fill multiple form fields and optionally submit |
| `browserGoBack` / `browserGoForward` | Navigate history |
| `browserScroll` | Scroll the page up or down |

### 💻 Coding Assistance
| Tool | Description |
|---|---|
| `createPythonFile` | Write a .py file |
| `writeCodeFile` | Write a code file in any language |
| `createProjectFolder` | Scaffold a project folder with subfolders |
| `runPythonScript` | Execute a Python script (captured output) |

### 📊 System Information
| Tool | Description |
|---|---|
| `systemInfo` | CPU, RAM, disk usage, uptime |
| `gpuInfo` | NVIDIA GPU utilization, VRAM, temperature |
| `temperatureInfo` | All available temperature sensors |

---

## Safety

- **Power actions** (shutdown, restart, sleep, lock) require a **two-step confirmation token**: ELYSIA must first call `requestPowerAction` (which issues a single-use, 60-second token), ask the user out loud to confirm, then call `executePowerAction` with the token. Without a valid token, the action is refused.
- **File deletions** go to the Recycle Bin by default (`send2trash`).
- **File operations** are scoped to safe folders (Desktop, Documents, Downloads, Pictures, Music, Videos, home, project root). Paths outside these roots are rejected.
- **Python script execution** has a configurable timeout (default 30s).

---

## Architecture

```
ELYSIA voice chat (existing, untouched)
        ↓
Gemini Live API (existing)
        ↓
server.ts — functionCall routing
        ↓
HTTP POST → localhost:8765/execute
        ↓
Python FastAPI desktop_agent
        ↓
pyautogui / pywin32 / psutil / Playwright / pytesseract / etc.
        ↓
Windows Desktop
```
