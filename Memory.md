# Project Memory

## Current State & Context
- **Project Goal:** Build a fully functional, hyper-premium AI desktop assistant (Elysia).
- **Environment:** Node server orchestrates the React frontend, and a privileged Python Desktop Agent handles secure OS-level capabilities (like terminal execution and Hyprland/Win32 screen captures).

## Recent Achievements
- **Background System:** Successfully implemented dynamic background video rendering, replacing static black backgrounds with 7 cinematic themes. Character overlay videos are scaled perfectly to `100vh`.
- **UI Refactor:** Transitioned from dark glass to "bright frosted glass" (`bg-white/[0.05]`) to ensure the UI contrasts perfectly against dark cinematic backgrounds. Transformed disjointed floating buttons into a single sleek "Dynamic Island" glass pill.
- **Onboarding:** Verified the `ApiKeyGate.tsx` component works perfectly. (API keys were previously hardcoded in `.env`, masking the onboarding flow).
- **Solid Themes:** Added a purely minimalist fallback for the user: "Solid Theme Color", which dynamically renders rich, dark backgrounds mapped to the semantic UI theme.

## Known Limitations / Next Steps
- **Large Assets:** Background video files are heavy (e.g. `demo.mp4`, `bg-6.mp4`). Must use Git LFS for GitHub synchronization to bypass the 100MB repository limit.
- **Packaging:** Still running as a local development server (`npm run dev`). Next major leap is packaging this securely using Electron or Tauri.
