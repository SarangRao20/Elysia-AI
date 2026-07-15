# Design and Aesthetics

## 1. Core Visual Identity
- **Theme:** Cinematic, futuristic, and premium.
- **Backgrounds:** Support for dynamic, looping 4K cinematic `.mp4` background videos, gracefully degrading to a complex CSS mesh gradient or a clean solid theme color.
- **Glassmorphism:** The UI relies heavily on bright frosted glass (`bg-white/[0.05]`) layered over intense background blurs (`backdrop-blur-3xl`).
- **Depth:** Elements use drop shadows (`shadow-[0_8px_32px_rgba(0,0,0,0.6)]`) and z-indexing to appear as floating layers in 3D space.

## 2. Dynamic Colors
The app supports multiple semantic themes that cascade across glows, borders, and solid backgrounds:
- **Violet:** Deep purple neon accents (Midnight Purple background).
- **Crimson:** Dark red alerts/accents (Midnight Red background).
- **Emerald:** Minty green accents (Dark Forest background).
- **Celestial:** Sky blue and cyan highlights (Deep Space blue background).
- **Gold:** Amber and yellow accents (Dark Amber background).
- **Rose:** Pink and magenta accents (Dark Rose background).

## 3. Typography
- **Primary:** `Inter` or `Outfit` for extremely legible, modern sans-serif UI text.
- **Monospace/Code:** `JetBrains Mono` or standard browser monospace for logs, code blocks, and configuration keys.
- **Hierarchy:** Rely on distinct font weights (`font-medium` vs `font-bold`), varying text opacities (`text-white/60`), and precise kerning (`tracking-wider` for uppercase labels) to establish clear visual hierarchy.

## 4. Animation Principles
- Smooth state transitions (`transition-all duration-700 ease-out`).
- Constant ambient motion (breathing glows, slow-spinning icons, pulsing borders when active).
- Character videos are anchored to the bottom-center and scaled via viewport height (`100vh`) to maintain proportions without clipping.
