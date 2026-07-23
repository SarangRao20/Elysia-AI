# ELYSIA Desktop Control Agent

A local Python FastAPI service that gives ELYSIA **JARVIS-style desktop control** —
open apps, manage files, control volume, take screenshots, OCR the screen, automate a
real browser, run code, execute terminal commands, control Google Calendar/Gmail/Tasks,
manage Hyprland workspaces, and more.

> **This agent does NOT modify ELYSIA's UI, personality, or chat system.** It is a pure
> backend tool layer that ELYSIA's existing Node bridge (`server.ts`) calls over HTTP.

---

## Prerequisites

| Dependency | Why | Notes |
|---|---|---|
| **Python 3.11+** | Runtime | Use `python` or `python3` from your PATH |
| **pip** | Install Python packages | Ships with Python |
| **Chromium/Chrome** | Browser automation | Installed via `playwright install chromium`, or use your own Chrome via CDP mode |
| **Tesseract OCR** *(optional)* | Screen text reading | Install via system package manager. Non-OCR tools work without it. |

---

## Setup (one-time)

```bash
# 1. Navigate to the project root
cd path/to/elysia-ai

# 2. Install Python dependencies
python3 -m pip install -r agent/requirements.txt

# 3. Install the Playwright Chromium browser (one-time, ~130MB download)
python3 -m playwright install chromium

# 4. (Optional) Install Tesseract OCR for screen-reading
#    Arch:  sudo pacman -S tesseract tesseract-data-eng
#    macOS:  brew install tesseract
#    Ubuntu: sudo apt install tesseract-ocr tesseract-ocr-eng
#    Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
```

---

## Run

```bash
# Start the desktop agent on port 8765
python3 agent/server.py

# Or with uvicorn directly:
python3 -m uvicorn agent.server:app --host 127.0.0.1 --port 8765
```

The agent binds to `127.0.0.1:8765`. Then start ELYSIA normally with `npm run dev`.

---

## Browser Modes

Set via `ELYSIA_BROWSER_MODE` env var (in `.env`):

| Mode | Behavior |
|------|----------|
| `managed` (default) | Agent launches its own headed Chromium instance via Playwright — works out of the box |
| `cdp` | Connects to your existing Chrome via DevTools Protocol on port 9222. Preserves your cookies, logins, and extensions. Start Chrome with: `google-chrome-stable --remote-debugging-port=9222` |

Switch at runtime with `desktopBrowserSetMode(mode: "cdp" | "managed")`.

### Media Controls

`browserMediaControl` sends YouTube keyboard shortcuts (ArrowUp/Down for volume, k for play/pause, m for mute, f for fullscreen, l for skip 10s, j for rewind 10s).

---

## Sudo Password Flow

When a command needs `sudo`, the agent returns a `command_id`. The UI shows a password popup, then calls `provideSudoPassword` with the password. The password is piped via stdin to `sudo -S` — never appears in process listings.

---

## Google Services (OAuth 2.0)

6 tools for Calendar, Gmail, and Tasks:

| Tool | Description |
|---|---|
| `getCalendarEvents` | List events from primary Google Calendar |
| `createCalendarEvent` | Create a new event with title, time, optional description |
| `sendEmail` | Send an email via Gmail |
| `getEmails` | List recent inbox emails |
| `getTasks` | List tasks from Google Tasks |
| `createTask` | Create a new task in Google Tasks |

**Setup**: Place `credentials.json` (Google Cloud OAuth desktop app credentials) in `~/.elysia/google_oauth/`. First use opens a browser for consent. Tokens cached in `~/.elysia/google_oauth/token.json`. If credentials are missing, tools return a setup error.

---

## OS Input Simulation

| Tool | Description |
|---|---|
| `osType` | Type text at the OS level (simulates keystrokes) |
| `osPress` | Press specific key combinations (e.g., Ctrl+C, Alt+Tab) |
| `osClick` | Click at absolute screen coordinates |

Useful for code editors (VS Code, LeetCode Monaco editor), OS-native dialogs, or any UI where DOM automation fails.

---

## API

### `GET /health`
Returns `{ "status": "ok", "tools": [...], "tool_count": N }`.

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

## Available Tools (88)

### 🖥️ Applications
| Tool | Description |
|---|---|
| `openApplication` | Open Notepad, Chrome, VS Code, Calculator, Explorer, etc. |
| `closeApplication` | Close a running application by name |

### 🪟 Window Management
| Tool | Description |
|---|---|
| `minimizeWindow` / `maximizeWindow` / `closeWindow` / `switchApplication` | Window control |

### 🌐 Websites & Search
| Tool | Description |
|---|---|
| `openWebsite` | Open a named site or arbitrary URL in the default browser |
| `searchWeb` / `searchYouTube` / `searchGoogle` / `searchGitHub` | Search shortcuts |

### 📁 Files
| Tool | Description |
|---|---|
| `createFile` / `readFile` / `renameFile` / `deleteFile` | Full file CRUD |
| `moveFile` / `openFolder` / `listFiles` / `searchFiles` | File management |

### 🎛️ PC Control
| Tool | Description |
|---|---|
| `volumeUp` / `volumeDown` / `setVolume` / `muteToggle` | Audio control |
| `brightnessUp` / `brightnessDown` / `setBrightness` | Display brightness |
| `requestPowerAction` / `executePowerAction` | Two-step shutdown/restart/sleep/lock |

### 📋 Clipboard
| Tool | Description |
|---|---|
| `copySelected` / `pasteClipboard` / `getClipboard` / `clearClipboard` | Clipboard access |

### 📸 Screenshot & Screen Reading
| Tool | Description |
|---|---|
| `takeScreenshot` / `saveScreenshot` | Capture and save screenshots |
| `analyzeScreenshot` / `readScreen` | OCR-based text extraction from screen |

### 🌐 Browser Automation (Playwright)
| Tool | Description |
|---|---|
| `desktopBrowserOpen` / `desktopBrowserNavigate` | Open a URL |
| `desktopBrowserOpenTab` / `desktopBrowserCloseTab` | Tab management |
| `desktopBrowserSearch` | Search in the automation browser |
| `desktopBrowserClick` | Click an element by selector or text |
| `desktopBrowserType` / `desktopBrowserFillForm` | Type and fill forms |
| `desktopBrowserGoBack` / `desktopBrowserGoForward` | History navigation |
| `desktopBrowserScroll` | Scroll the page |
| `desktopBrowserReadText` / `desktopBrowserGetLinks` | Extract page content |
| `browserMediaControl` | YouTube keyboard shortcuts (volume, play/pause, mute, fullscreen, skip, rewind) |
| `desktopBrowserSetMode` | Switch between CDP and managed modes at runtime |

### 💻 Terminal
| Tool | Description |
|---|---|
| `runTerminalCommand` | Execute shell commands (output captured and returned) |
| `provideSudoPassword` | Supply sudo password for elevated commands |
| `installPackage` | Install system packages |
| `isCommandAllowed` | Check if a command would be blocked |

### ⌨️ OS Input
| Tool | Description |
|---|---|
| `osType` | Type text at OS level |
| `osPress` | Press key combos (Ctrl+C, Alt+Tab, etc.) |
| `osClick` | Click at screen coordinates |

### 💻 Coding Assistance
| Tool | Description |
|---|---|
| `createPythonFile` / `writeCodeFile` | Create code files in any language |
| `createProjectFolder` | Scaffold project structure |
| `runPythonScript` | Execute Python scripts (captured output + timeout) |

### 📊 System Information
| Tool | Description |
|---|---|
| `systemInfo` | CPU, RAM, disk, uptime |
| `gpuInfo` | NVIDIA GPU stats |
| `temperatureInfo` | Temperature sensors |

### 🗓️ Google Services
| Tool | Description |
|---|---|
| `getCalendarEvents` | List Google Calendar events |
| `createCalendarEvent` | Create calendar event |
| `sendEmail` | Send Gmail |
| `getEmails` | List inbox emails |
| `getTasks` | List Google Tasks |
| `createTask` | Create a task |

### 🌤️ Weather
| Tool | Description |
|---|---|
| `getWeather` | Current weather, feels-like, humidity, wind via wttr.in |

### 📰 News
| Tool | Description |
|---|---|
| `getNews` | Top headlines across 6 categories (top, tech, world, business, science, sports) |

### 🏫 IITM BS Degree
| Tool | Description |
|---|---|
| `iitmQuickLinks` / `iitmOpen` / `iitmOpenCustom` | Portal shortcuts and navigation |

### 💬 Conversation
| Tool | Description |
|---|---|
| `exportConversation` | Save chat history as JSON or text |
| `listExports` | List saved conversation exports |

### 🖥️ Hyprland (Linux/Wayland only)
| Tool | Description |
|---|---|
| `switchWorkspace` | Switch to workspace by number |
| `listWorkspaces` | List all workspaces with status |
| `moveToWorkspace` | Move active window to workspace |

### 🤖 Other
| Tool | Description |
|---|---|
| `shutdownElysia` | Gracefully stop the application |
| `enableAutoStart` / `disableAutoStart` / `getAutoStartStatus` | Auto-start on login (Windows) |

---

## Safety

- **Power actions** require a **two-step confirmation token**: `requestPowerAction` → user confirms → `executePowerAction`
- **Terminal commands**: dangerous patterns (`rm -rf /`, `mkfs.`, `dd if=`) are hard-blocked **before** token generation — AI never asks user to confirm blocked commands
- **Sudo commands**: require interactive password via `provideSudoPassword`
- **File deletions** go to the Recycle Bin by default (`send2trash`)
- **File operations** scoped to safe folders (Home, Desktop, Documents, Downloads, etc.)

---

## Architecture

```
ELYSIA voice chat → Gemini Live API → server.ts → HTTP POST → agent.server (FastAPI)
                                                                    ↓
                                                    linux_wayland.py / windows.py
                                                    Playwright / subprocess / Tesseract
```
