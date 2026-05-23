# NonEuclidean FPV

This repository is the ground-up TypeScript/Vite scaffold for a private
VR/FPS-style exploration environment for discrete non-Euclidean geometry
models.

The ordered design handoff starts at:

```text
docs/llm-handoff/00_index.md
```

The current implementation intentionally begins small: a single static Vite app,
Three.js rendering, Vitest tests, and visible domain modules for cell complexes,
movement, tools, and classroom glue.

Useful commands:

```bash
npm run dev
npm run typecheck
npm test
npm run build
```
