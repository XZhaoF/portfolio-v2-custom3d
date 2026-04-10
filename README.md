# Portfolio Website - Version 2
A personal portfolio website built around a real-time 3D field rendered in the browser. The scene serves as an interactive background with camera transitions between sections and (future) audio-reactive visuals.
## Goals
- **3D flower field** — A Ghibli-inspired grass and flower field, rendered using instanced geometry and custom GLSL shaders
- **Audio reactivity** — Flower colors and wind intensity respond to background music via the Web Audio API
- **Section-based camera** — Fixed camera that smoothly transitions to new vantage points when navigating portfolio sections
- **Performance** — GPU-driven animation (vertex-shader wind, instanced rendering) targeting 60fps on mid-range hardware
## Tech Stack
- React + TypeScript + Vite
- Three.js + React Three Fiber + drei
- Custom GLSL vertex/fragment shaders
- Leva for real-time parameter tuning during development
## Live Preview
Check current progress at **https://portfolio-v2-custom3d.vercel.app/**
