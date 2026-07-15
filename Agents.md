# System Agents

## 1. The Python Desktop Agent
While Elysia's mind lives in the cloud (via Google Gemini) and her body lives in the React overlay UI, her **hands** are the Python Desktop Agent (`desktop_agent/`). 
Because a web browser (even in an Electron-like container) has strict security sandboxes, it cannot natively run complex terminal commands, read other applications' windows, or manage the OS. The Python Agent solves this by running as a privileged background service that the Node backend talks to.

## 2. Capabilities
The agent is designed to be highly modular via a "tools" architecture:
- **Vision (Screen Capture):** Uses OS-specific APIs (like `grim` on Linux Wayland or Win32 APIs on Windows) to take rapid, high-quality screenshots and feed them to Tesseract OCR for text extraction.
- **Terminal Execution:** Safely executes bash commands on behalf of the user, passing stdout/stderr back up to the frontend UI.
- **File System Management:** Can read, edit, and navigate the user's workspace.

## 3. Platform Agnostic Factory (`backends/factory.py`)
To ensure Elysia can run on any OS, the agent uses a Factory pattern. When started, it detects the host operating system:
- **`linux_wayland.py`**: Interacts specifically with Hyprland and Wayland tools.
- **`windows.py`**: Binds to native Windows DLLs for screen capture and execution.

## 4. Security & Whitelisting
The agent runs locally but acts on requests from the GenAI. To prevent the AI from executing destructive commands (e.g., `rm -rf /`), the agent implements strict command whitelists and blacklists.
