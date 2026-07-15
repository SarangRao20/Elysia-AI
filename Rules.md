# AI Rules and Boundaries

## 1. Visual & Aesthetic Constraints
- **Design Philosophy:** Always prioritize visual excellence. The UI must feel premium, natural, and futuristic (Vision Pro inspired).
- **Styling:** Use standard Tailwind CSS utilities. Never use default browser UI elements without heavy styling. Use `bg-white/[0.05]` and `backdrop-blur-3xl` for sleek glassmorphism against dark cinematic backgrounds.
- **Micro-interactions:** Add subtle hover states, transitions (`transition-all duration-300`), and animations (`animate-pulse`, `animate-breathing`) to make the interface feel alive.

## 2. Technical Constraints
- **Frameworks:** Stick to React for UI components. Do not introduce new massive frontend frameworks unless absolutely necessary.
- **Errors:** Handle errors gracefully in the UI. If a background video fails to load, silently fallback to the CSS mesh gradient. If the OS agent is unreachable, disable OS-dependent features (like screen share) without crashing the app.
- **Code Quality:** Keep components focused and reusable. Preserve all existing comments and docstrings unless explicitly instructed to remove them.

## 3. Security & Safety
- **Command Execution:** The OS Agent must use a whitelist/blacklist approach to prevent destructive terminal commands.
- **API Keys:** Never expose or log the Google Gemini API key. Ensure the onboarding gate (`ApiKeyGate.tsx`) is strictly enforced if environment keys are missing.
