# Architecture and Technical Stack

## 1. System Flow
Elysia AI operates on a client-server-agent architecture to separate the UI, the AI reasoning engine, and the dangerous OS-level capabilities.

1. **Frontend (Overlay UI):** Renders the transparent, glassmorphic UI overlay on the desktop. Captures user audio and text inputs.
2. **Backend Node Server (`server.ts`):** Handles communication with the Google Gemini API, manages configuration (like API keys), and orchestrates requests between the UI and the Python Agent.
3. **Desktop Agent (`desktop_agent/`):** A privileged Python service running locally that provides OS-specific capabilities (taking screenshots, running terminal commands) securely to the Node server.

## 2. Directory Structure
```text
/
├── src/                  # React Frontend source code
│   ├── components/       # UI Components (Visualizer, Settings, Dashboard)
│   ├── lib/              # Utility functions, stores, and API wrappers
│   └── index.css         # Global Tailwind and animation styles
├── desktop_agent/        # Python OS-level Agent
│   ├── backends/         # OS-specific implementations (linux_wayland.py, windows.py)
│   └── server.py         # Local API exposing OS capabilities
├── server.ts             # Express backend for Gemini AI and system orchestration
└── public/assets/        # Cinematic video backgrounds and character webm files
```

## 3. Technical Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS (v4), Framer Motion, Lucide React.
- **Backend:** Node.js, Express, Google GenAI SDK.
- **OS Agent:** Python 3, FastAPI/Uvicorn, `hyprctl`/`grim` (Linux Vision), Win32 API (Windows Vision), Tesseract (OCR).
