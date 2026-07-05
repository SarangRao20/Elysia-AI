# ELYSIA — AI Voice Assistant with Holographic Interface

![Elysia UI](frame.jpg)

A real-time, voice-to-voice holographic AI companion desktop assistant built on the **Google Gemini Live API**. ELYSIA combines a holographic video character, persistent memory, a reminder system, a full desktop automation agent, and an in-app browser — all running locally with a 3-process architecture.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Database / Persistence](#database--persistence)
- [AI Integration](#ai-integration)
- [Function Calling Tools](#function-calling-tools)
- [Desktop Agent (Python)](#desktop-agent-python)
- [Frontend](#frontend)
- [Authentication & API Keys](#authentication--api-keys)
- [Security Model](#security-model)
- [Configuration](#configuration)
- [Running the Project](#running-the-project)
- [Environment Variables](#environment-variables)
- [Themes](#themes)

---

## Architecture Overview

ELYSIA runs as **3 separate processes** that communicate over HTTP/WebSocket:

```
┌─────────────────────────────────────────────────────┐
│                  BROWSER (React)                    │
│   Holographic UI · Settings · Memory · Transcript   │
│         WebSocket (Gemini Live) ←→ Node.js          │
│              HTTP ←→ Desktop Agent (Python)          │
└─────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐     ┌──────────────────────┐
│   Node.js Server │     │  Python Desktop Agent │
│   Port 3000      │     │  Port 8765            │
│                  │     │                       │
│  Express + WS    │     │  FastAPI + Playwright  │
│  Gemini Live API │     │  OS-level tools        │
│  Memory/Reminder │     │  Browser automation    │
│  Function calling│     │  File system, System   │
└─────────────────┘     └──────────────────────┘
```

| Process | Port | Runtime | Role |
|---|---|---|---|
| **Node.js Server** | 3000 | Express + WebSocket | Orchestrator. Bridges browser to Gemini Live API. Handles function calling, memory CRUD, reminders, settings, API key storage. |
| **Python Desktop Agent** | 8765 | FastAPI + Playwright | OS-level tool execution. Receives `POST /execute { tool, args }` dispatches. Manages browser, screenshots, clipboard, files, power actions, system info. |
| **Vite React Frontend** | 3000 (served) | React 19 + Tailwind CSS v4 | Holographic UI with canvas visualizer, video character, settings panel, memory dashboard, transcript, browser agent, text chat fallback. |

---

## Tech Stack

### Frontend
- **React 19** + **TypeScript**
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin)
- **Motion** (animation library)
- **Vite** (build tool + dev server)
- Google Fonts: Space Grotesk, Inter, JetBrains Mono
- Canvas API — custom holographic visualizer with particle rings, plasma core, emotion glow
- Web Speech API — wake word detection ("Hey Elysia")
- Web Audio API — PCM audio encoding/decoding for Gemini Live (16-bit, 16kHz)
- `getDisplayMedia` — screen sharing to Gemini

### Backend (Node.js)
- **Express** HTTP server
- **ws** WebSocket library for Gemini Live API streaming
- **@google/genai** SDK for Gemini function calling
- **esbuild** for server bundling
- Optional: **Electron** for desktop wrapper

### Backend (Python Desktop Agent)
- **FastAPI** + **Uvicorn**
- **Playwright** (async browser automation, dedicated event loop in a thread)
- **psutil** (system monitoring)
- **pyautogui** / **pywin32** (Windows automation)
- **pyperclip** (clipboard)
- **pytesseract** + **Pillow** (OCR / screenshots)
- **pycaw** (Windows audio)
- **Send2Trash** (safe file deletion)
- **nvidia-ml-py3** (NVIDIA GPU stats)

### Platform Abstraction
The Python agent has a backend abstraction layer for cross-platform support:
- `desktop_agent/backends/base.py` — abstract interfaces (`WindowManager`, `AudioController`, `ClipboardManager`, `TerminalController`, `Launcher`, `ScreenshotController`)
- `desktop_agent/backends/factory.py` — OS detection + backend instantiation
- `desktop_agent/backends/windows.py` — Win32 API (win32gui, ctypes)
- `desktop_agent/backends/linux_wayland.py` — Hyprland/Wayland (hyprctl)

---

## Project Structure

```
elysia-ai-assistant/
├── server.ts                  # Main Node.js server (Express + WebSocket + Gemini Live)
├── server_memory.ts           # Memory CRUD API (REST endpoints)
├── server_reminders.ts        # Reminder system (timer-based with notification injection)
├── server_paths.ts            # Data directory path resolution
├── local-agent.js             # Standalone Playwright server (port 3001)
├── run_agent.py               # PyInstaller entry point for standalone agent
├── start_elysia.sh             # Launch script (Python agent + Node server)
│
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── .env                       # Environment variables (GEMINI_API_KEY, etc.)
│
├── public/
│   └── assets/
│       ├── idle.mp4           # Holographic character — idle state
│       ├── thinking.mp4       # Holographic character — thinking state
│       └── talking.mp4        # Holographic character — talking state
│
├── src/
│   ├── main.tsx               # React entry point
│   ├── App.tsx                # Main app component (session management, state)
│   ├── index.css              # Tailwind imports + global styles
│   │
│   ├── lib/
│   │   ├── audio.ts           # PCM audio encoding/decoding for Gemini Live
│   │   ├── memoryTypes.ts     # Memory TypeScript interfaces
│   │   ├── reminderTypes.ts   # Reminder TypeScript interfaces
│   │   ├── settingsStore.ts   # Settings persistence (localStorage + server)
│   │   └── wakeWord.ts        # "Hey Elysia" wake word detection via Web Speech API
│   │
│   └── components/
│       ├── ApiKeyGate.tsx          # First-run API key onboarding overlay
│       ├── ElysiaCoreVisualizer.tsx # Canvas-based holographic visualizer + video character
│       ├── BrowserAgent.tsx        # In-app browser with tabs, address bar, Playwright backend
│       ├── MemoryDashboard.tsx     # Memory CRUD with category filtering
│       ├── SettingsPanel.tsx       # General, Voice, System, About settings tabs
│       ├── TranscriptPanel.tsx     # Conversation transcript with search/filter
│       ├── SudoPopup.tsx           # Dangerous action confirmation dialog with countdown
│       ├── TextChatFallback.tsx    # Text input alternative when microphone fails
│       ├── Toast.tsx               # Toast notification system for reminders
│       └── HolographicProjector.tsx # Simple iframe-based web projector overlay
│
└── desktop_agent/
    ├── __init__.py
    ├── main.py                 # FastAPI app setup, tool registry, /execute dispatcher
    ├── registry.py             # Tool registration system
    ├── requirements.txt        # Python dependencies
    ├── README.md               # Desktop agent documentation
    │
    ├── backends/
    │   ├── __init__.py
    │   ├── base.py             # Abstract backend interfaces
    │   ├── factory.py          # OS detection + backend factory
    │   ├── windows.py          # Windows backend (Win32 API)
    │   └── linux_wayland.py    # Linux/Wayland backend (Hyprland)
    │
    └── tools/
        ├── tools_applications.py   # openApplication, closeApplication (15+ apps)
        ├── tools_browser.py        # desktopBrowser* (14 browser tools)
        ├── tools_clipboard.py      # copy/paste/get/clear clipboard
        ├── tools_coding.py         # createPythonFile, writeCodeFile, runPythonScript
        ├── tools_confirmation.py   # requestPowerAction, requestTerminalAction (2-step token)
        ├── tools_files.py          # create/read/rename/delete/move/open/list/search files
        ├── tools_iitm.py           # IITM BS Degree portal quick links
        ├── tools_pc.py             # volume/brightness/power/shutdown controls
        ├── tools_screenshot.py     # take/save/analyze screenshots, readScreen (OCR)
        ├── tools_search.py         # searchWeb, searchYouTube, searchGoogle, searchGitHub
        ├── tools_startup.py        # enable/disable auto-start (Windows registry)
        ├── tools_system.py         # systemInfo, gpuInfo, temperatureInfo
        ├── tools_terminal.py       # runTerminalCommand (with command blacklist)
        ├── tools_websites.py       # openWebsite (25+ named shortcuts)
        └── tools_windows.py        # minimize/maximize/close/switch windows
```

---

## How It Works

### Voice Flow
1. User speaks into microphone (or types in text fallback)
2. Audio is PCM-encoded (16-bit, 16kHz) and sent via WebSocket to Gemini Live API
3. Gemini processes audio in real-time and streams back audio response
4. Audio is decoded and played through the speaker
5. After each conversation turn, Gemini analyzes recent messages and extracts **memory transactions** (add/update/delete facts about the user)

### Wake Word Detection
- Uses the Web Speech API to listen for "Hey Elysia"
- When detected, the visualizer transitions to listening state and captures speech

### Function Calling
- Gemini can invoke 14+ server-side tools during conversation (reminders, memory management, background changes, app launching, browser control, system commands, voice changes, volume control)
- Server-side tools that need OS access dispatch to the Python Desktop Agent via HTTP

### Holographic Character
- Three MP4 video states: **idle**, **thinking**, **talking**
- Canvas-based visualizer renders particle rings, plasma core, and emotion glow
- Character state transitions based on conversation state
- Mouse-tracking parallax effect on the holographic ring

---

## Database / Persistence

ELYSIA uses **no traditional database**. All data is stored as JSON files in the data directory (`~/.elysia/` by default, configurable via `ELYSIA_DATA_DIR`):

| File | Purpose |
|---|---|
| `secrets.json` | API keys (GEMINI_API_KEY, etc.) — never sent to frontend after setup |
| `settings.json` | User preferences (voice, wake word, sensitivity, theme, volumes) |
| `memories.json` | Persistent memory store with categories |
| `reminders.json` | Timer-based reminders |
| `metadata.json` | AI Studio export metadata |

### Memory System

Memories are categorized into 7 types:
- **identity** — who the user is (name, role, background)
- **preference** — likes, dislikes, habits
- **goal** — what the user is working toward
- **project** — specific projects and their status
- **relationship** — people in the user's life
- **emotional** — mood patterns, emotional state
- **behavior** — behavioral patterns and routines

After each conversation turn, Gemini analyzes a slice of recent messages and produces memory transactions (add/update/delete/ignore). Users can also manage memories manually via the Memory Dashboard.

### Reminder System
- Timer-based using `setInterval` with configurable delay and optional repeat
- Fires browser toast notifications with countdown
- Injects a callback into the active Gemini session so ELYSIA can remind you verbally

---

## AI Integration

### Gemini Live API
- Real-time bidirectional audio streaming via WebSocket
- 16-bit PCM audio at 16kHz sample rate
- Configurable voice (7 options): Aoede, Charon, Fenrir, Kore, Leda, Puck, Zephyr
- System prompt establishes ELYSIA's personality and context

### Function Calling (Server-Side Tools)

| Tool | Description |
|---|---|
| `setReminder` | Create a timed reminder with optional repeat |
| `manageMemory` | Add, update, or delete user memories |
| `changeBackground` | Change the visualizer background gradient |
| `readScreen` | OCR the active window via the desktop agent |
| `launchApp` | Open an application via the desktop agent |
| `browserNavigate` | Navigate the in-app browser to a URL |
| `browserClick` | Click an element in the browser |
| `browserType` | Type text in the browser |
| `browserTabAction` | Open/close/switch browser tabs |
| `systemCommand` | Execute a system command via the desktop agent |
| `changeVoice` | Switch the Gemini Live voice |
| `setWallpaper` | Change desktop wallpaper via the agent |
| `setUserVolume` | Set user's system volume |
| `setAssistantVolume` | Set assistant's audio output volume |

---

## Desktop Agent (Python)

The Python desktop agent runs on port 8765 and provides **40+ tools** across 15 modules:

### Tool Modules

| Module | Tools | Description |
|---|---|---|
| `tools_applications` | `openApplication`, `closeApplication` | Launch/close 15+ pre-configured apps (Chrome, VS Code, Spotify, Discord, etc.) with Windows/Linux path mappings |
| `tools_browser` | 14 browser tools | Full Playwright browser automation: navigate, click, type, fill forms, scroll, read text, get links, tab management |
| `tools_clipboard` | `copySelected`, `pasteClipboard`, `getClipboard`, `clearClipboard` | System clipboard operations |
| `tools_coding` | `createPythonFile`, `writeCodeFile`, `createProjectFolder`, `runPythonScript` | Code file creation (30+ language extensions) and Python execution |
| `tools_confirmation` | `requestPowerAction`, `requestTerminalAction` | Two-step token-based confirmation for dangerous actions (60-second single-use tokens) |
| `tools_files` | `createFile`, `readFile`, `renameFile`, `deleteFile`, `moveFile`, `openFolder`, `listFiles`, `searchFiles` | Full file system operations with path confinement to safe directories |
| `tools_iitm` | `iitmQuickLinks`, `iitmOpen`, `iitmOpenCustom` | IITM BS Degree portal shortcuts |
| `tools_pc` | `volumeUp/Down`, `setVolume`, `brightnessUp/Down`, `setBrightness`, `muteToggle`, `executePowerAction`, `shutdownElysia` | System hardware controls |
| `tools_screenshot` | `takeScreenshot`, `saveScreenshot`, `analyzeScreenshot`, `readScreen` | Screenshot capture + Tesseract OCR |
| `tools_search` | `searchWeb`, `searchYouTube`, `searchGoogle`, `searchGitHub` | Web search shortcuts |
| `tools_startup` | `enableAutoStart`, `disableAutoStart`, `getAutoStartStatus` | Auto-start on login (Windows registry) |
| `tools_system` | `systemInfo`, `gpuInfo`, `temperatureInfo` | CPU, RAM, disk, GPU, temperature monitoring |
| `tools_terminal` | `runTerminalCommand`, `installPackage` | Terminal execution with command blacklist |
| `tools_websites` | `openWebsite` | 25+ named website shortcuts (YouTube, Gmail, GitHub, Reddit, etc.) |
| `tools_windows` | `minimizeWindow`, `maximizeWindow`, `closeWindow`, `switchApplication` | Window management |

---

## Frontend

### Components

| Component | Description |
|---|---|
| `ElysiaCoreVisualizer` | Canvas-based holographic visualizer with particle rings, plasma core, emotion glow, mouse tracking. Renders the video character in idle/thinking/talking states. |
| `BrowserAgent` | Full in-app browser with tabs, address bar, search, powered by the Python Playwright backend |
| `MemoryDashboard` | Memory management UI with category filtering, CRUD operations |
| `SettingsPanel` | 4-tab settings: General, Voice, System, About. Voice selection, wake word config, theme picker, volume controls. |
| `TranscriptPanel` | Conversation transcript with search and filtering |
| `SudoPopup` | Dangerous action confirmation dialog with countdown timer (for power actions, terminal commands) |
| `TextChatFallback` | Text input alternative when microphone access fails |
| `Toast` | Toast notification system for reminders with dismiss and countdown |
| `HolographicProjector` | Simple iframe-based web projector overlay |
| `ApiKeyGate` | First-run onboarding — prompts for Gemini API key, stores it server-side |

### Audio Pipeline
- **Encoding**: `Float32Array` → `Int16Array` PCM at 16kHz
- **Decoding**: Gemini response PCM → `AudioBuffer` → Web Audio API playback
- **Wake Word**: Web Speech API continuous recognition, triggers on "Hey Elysia" detection

---

## Authentication & API Keys

- API keys are entered once via the `ApiKeyGate` onboarding screen
- Stored server-side in `secrets.json` in the data directory
- Never sent to the frontend after initial setup
- Backend reads the key and uses it for Gemini API calls
- Supports `GEMINI_API_KEY`, `GOOGLE_API_KEY`, or `GOOGLE_GENAI_API_KEY`

---

## Security Model

### Terminal Command Blacklist
Blocks dangerous commands: `sudo`, `rm -rf`, `chmod`, `shutdown`, `systemctl`, `curl`, `wget`, `python`, `pip`, `gcc`, `dd`, `mkfs`, `fdisk`, and more.

### Power Action Confirmation (Two-Step Token)
1. `requestPowerAction` mints a single-use, 60-second token
2. `executePowerAction` validates and consumes the token before executing
3. Prevents AI from accidentally shutting down or restarting the machine

### File Path Confinement
File operations are restricted to safe roots: Home, Desktop, Documents, Downloads, Pictures, Music, Videos, and the project directory.

### Safe Deletion
Uses `send2trash` instead of permanent delete by default.

### API Key Isolation
Keys stored in `secrets.json` in the data directory; only the backend reads them.

---

## Configuration

### Settings (settings.json)

| Setting | Options | Default |
|---|---|---|
| `voice` | Aoede, Charon, Fenrir, Kore, Leda, Puck, Zephyr | Kore |
| `wakeWord` | "Hey Elysia", custom string, or disabled | "Hey Elysia" |
| `sensitivity` | 0.1 - 1.0 | 0.5 |
| `theme` | Violet, Crimson, Emerald, Celestial, Gold, Rose, Charcoal | Violet |
| `userVolume` | 0 - 100 | 70 |
| `assistantVolume` | 0 - 100 | 70 |

### Application Shortcuts (tools_websites.py)

25+ named shortcuts: YouTube, Gmail, GitHub, Reddit, Twitter/X, Stack Overflow, Notion, Google Drive, WhatsApp Web, LinkedIn, Netflix, Spotify, ChatGPT, Hugging Face, Kaggle, GeeksforGeeks, and more.

### Pre-configured Applications (tools_applications.py)

Chrome, Firefox, VS Code, Terminal, File Manager, Spotify, Discord, Slack, Obsidian, Notion, Teams, Zoom, Steam — with both Windows and Linux path mappings.

---

## Running the Project

### Prerequisites
- **Node.js** (v18+)
- **Python 3.8+**
- **Gemini API Key** from [Google AI Studio](https://ai.google.dev/)

### Development
```bash
# Install Node dependencies
npm install

# Install Python dependencies
pip install -r desktop_agent/requirements.txt

# Set your API key in .env
echo "GEMINI_API_KEY=your_key_here" > .env

# Start everything (Python agent + Node server)
bash start_elysia.sh
```

Or manually:
```bash
# Terminal 1: Python desktop agent
python desktop_agent/main.py

# Terminal 2: Node.js server + Vite dev server
npm run dev
```

### Production Build
```bash
npm run build    # Vite build + esbuild server bundle
npm run start    # Starts Python agent + Node.js production server
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server + Node.js backend with HMR |
| `npm run build` | `vite build` + `esbuild` bundles server to `dist/server.cjs` |
| `npm run start` | Production: starts Python agent + Node.js server |
| `bash start_elysia.sh` | Launches both processes |

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` / `GOOGLE_GENAI_API_KEY` | Gemini API authentication | — |
| `ELYSIA_DATA_DIR` | Custom data directory path | `~/.elysia/` |
| `ELYSIA_AGENT_HOST` | Desktop agent host | `127.0.0.1` |
| `ELYSIA_AGENT_PORT` | Desktop agent port | `8765` |
| `DISABLE_HMR` | Toggle Vite HMR off | `false` |

---

## Themes

7 built-in themes that change the holographic visualizer colors and UI accents:

| Theme | Primary Color |
|---|---|
| Violet (default) | Purple/violet gradients |
| Crimson | Red/crimson gradients |
| Emerald | Green/emerald gradients |
| Celestial | Blue/cyan celestial gradients |
| Gold | Gold/amber gradients |
| Rose | Pink/rose gradients |
| Charcoal | Dark gray/neutral gradients |

---

## How This Was Built

Originally scaffolded from a **Google AI Studio** export. Heavily expanded into a full desktop automation platform with:
- Holographic video character system
- Persistent memory with AI-powered extraction
- Cross-platform desktop agent with 40+ tools
- In-app Playwright browser
- Wake word detection
- Screen sharing to Gemini
- Toast notification system
- Confirmation dialogs for dangerous actions
- Safe file operations with path confinement

---

*Built by Sarang / Tech GPT*
