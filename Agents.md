# System Agents

## 1. The Python Desktop Agent
While Elysia's mind lives in the cloud (via Google Gemini) and her body lives in the React overlay UI, her **hands** are the Python Desktop Agent (`desktop_agent/`). 
Because a web browser (even in an Electron-like container) has strict security sandboxes, it cannot natively run complex terminal commands, read other applications' windows, or manage the OS. The Python Agent solves this by running as a privileged background FastAPI service that the Node backend talks to over HTTP.

## 2. Capabilities (70+ tools)
The agent is modular via a "tools" architecture with these categories:

| Category | What it does |
|----------|-------------|
| **Vision** | Takes screenshots via OS APIs (`grim` on Wayland, Win32 on Windows), runs Tesseract OCR for text extraction |
| **Browser Automation** | Drives a real Chromium/Chrome via Playwright — open URLs, click, type, fill forms, scroll, read page text |
| **Browser Mode** | Two modes: `managed` (agent launches its own browser) or `cdp` (connects to your existing Chrome with all your logins via DevTools Protocol) |
| **Terminal** | Executes shell commands with output capture. Sudo commands trigger an interactive password popup flow |
| **File System** | Read, create, move, delete, search files across safe folders |
| **Desktop Control** | Volume, brightness, power actions (shutdown/restart with two-step confirmation), window management |
| **Clipboard** | Copy, paste, read, clear clipboard contents |
| **Coding** | Create and run Python scripts, scaffold project folders |
| **System Info** | CPU, RAM, disk, GPU, temperature sensors |

## 3. Platform Agnostic Factory (`backends/factory.py`)
The agent uses a Factory pattern to detect the host OS at startup:
- **`linux_wayland.py`**: Interacts with Hyprland/Wayland tools (`hyprctl`, `grim`, `wpctl`, `wtype`)
- **`windows.py`**: Binds to native Win32 APIs (`pywin32`, `pycaw`) for window and audio control

## 4. Security
- **Terminal blacklist**: Only truly destructive patterns blocked (`rm -rf /`, `mkfs.`, `dd if=`)
- **Sudo commands**: Interactive password flow via `provideSudoPassword` — password piped via stdin to `sudo -S`
- **Power actions**: Two-step confirmation tokens with 60-second TTL
- **File operations**: Scoped to user home directories by default
