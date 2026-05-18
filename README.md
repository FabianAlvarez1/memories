# Memories

Under construction... A private, encrypted journal that keep safe forever and visualize your memories through time.

Visit demo: https://memories-bay-three.vercel.app/

## What is this?

Every memory you write becomes a **neuron** in your personal brain. Neurons connect based on shared emotions, people, or time proximity — forming a unique, organic map of your life that you can explore in 3D.

## Features

- **End-to-End Encryption** — AES-256-GCM via Web Crypto API. Your data never leaves your device unencrypted.
- **3D Neural Visualization** — Bioluminescent neurons with procedural shaders, organic dendrite connections, and energy transport effects built with Three.js.
- **Temporal Navigation** — Scroll through time to explore memories by date. Your brain has depth — recent memories at the front, older ones deeper inside.
- **Emotion Mapping** — Tag memories with Plutchik's wheel of emotions. Each emotion gives neurons a unique color.
- **Offline-First** — All data stored locally in IndexedDB. No server required.
- **Search** — Find any memory by title or date instantly.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19 + TypeScript |
| 3D Engine | Three.js + react-force-graph-3d |
| Animations | Framer Motion + Custom GLSL Shaders |
| State | Zustand |
| Crypto | Web Crypto API (PBKDF2 + AES-256-GCM) |
| Storage | IndexedDB (SQLite-ready via Capacitor) |
| Build | Vite |

## Getting Started

```bash
npm install
npm run dev
```

## License

Proprietary / All Rights Reserved

