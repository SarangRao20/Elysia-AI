# Project Phases

## Phase 1: Core Foundation & UI
- Initialize Vite/React project with Tailwind CSS.
- Build the core glassmorphic UI components (Settings Panel, Memory Dashboard, Toolbars).
- Establish the backend Node server for basic Gemini API communication.
- Implement the API Key Onboarding gate.

## Phase 2: Agent OS Integration
- Develop the Python local desktop agent.
- Implement OS-specific factory backends (Linux Wayland/Hyprland & Windows).
- Integrate Tesseract OCR for screen reading.
- Connect the React frontend to the Python agent via local API calls.

## Phase 3: Visual Polish & Expressiveness
- Integrate dynamic, looping cinematic video backgrounds.
- Add character animation states (idle, thinking, talking) overlaid on the background.
- Refine the UI to use bright frosted glass (`bg-white/[0.05]`) for contrast against cinematic backgrounds.
- Add dynamic theme color mapping for solid backgrounds.

## Phase 4: Polish & Advanced Capabilities (Current/Future)
- Package the application into a standalone desktop executable (Electron/Tauri).
- Implement advanced vector-based contextual memory retrieval.
- Enhance voice interactions with lower latency TTS/STT pipelines.
- Ensure seamless cross-distro compatibility.
