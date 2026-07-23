# Architecture and Technical Stack

## 1. System Flow
Elysia AI operates on a client-server-agent architecture to separate the UI, the AI reasoning engine, and the dangerous OS-level capabilities.

1. **Frontend (Overlay UI):** Renders the transparent, glassmorphic UI overlay on the desktop. Captures user audio and text inputs.
2. **Backend Node Server (`server.ts`):** Handles communication with the Google Gemini API, manages configuration (like API keys), and orchestrates requests between the UI and the Python Agent.
3. **Desktop Agent (`agent/`):** A privileged Python FastAPI service running locally that provides 70+ OS-level capabilities — browser automation, terminal execution, file management, desktop control — securely to the Node server via HTTP.

## 2. Directory Structure
```text
/
├── src/                  # React Frontend source code
│   ├── components/       # UI Components (Visualizer, Settings, Dashboard)
│   ├── lib/              # Utility functions, stores, and API wrappers
│   └── index.css         # Global Tailwind and animation styles
├── agent/        # Python OS-level Agent (FastAPI)
│   ├── backends/         # OS-specific implementations (linux_wayland.py, windows.py)
│   │   ├── base.py       # Abstract base classes
│   │   ├── factory.py    # Platform-aware backend selection
│   │   ├── linux_wayland.py  # Hyprland/Wayland implementation
│   │   └── windows.py    # Windows implementation
│   ├── tools_*.py        # Tool handlers (browser, terminal, files, etc.)
│   ├── registry.py       # Central tool registry + shared state
│   └── main.py           # FastAPI entrypoint
├── server.ts             # Express backend for Gemini AI and system orchestration
├── server_memory.ts      # Memory consolidation engine
├── run_agent.py          # Agent bootstrap (loads .env, starts uvicorn)
└── public/assets/        # Cinematic video backgrounds and character webm files
```

## 3. Technical Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS (v4), Framer Motion, Lucide React.
- **Backend:** Node.js, Express, Google GenAI SDK, WebSocket.
- **OS Agent:** Python 3, FastAPI/Uvicorn, Playwright (browser automation), Tesseract (OCR).
- **AI:** Gemini 3.1 Flash Live Preview (real-time voice + function calling).
