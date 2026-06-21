# NonEuclidean FPV

This repository is the ground-up TypeScript/Vite scaffold for a private
VR/FPS-style exploration environment for discrete non-Euclidean geometry
models.

The application is a playground, not a theorem tutor. It should provide a
coherent walkable environment with portals, collision rules, locally straight
rays, markers, traces, measurements, resets, and teacher-authored worlds. The
instructor and course materials are responsible for interpretation.

The first world model is a 3D room made from vertical prism cells over 2D
polygonal bases. Floors and ceilings are ordinary barriers; selected vertical
walls become portals.

## Start here

- [docs/Readme.md](docs/Readme.md) is the documentation index.
- [docs/Development_guide.md](docs/Development_guide.md) is the living
  development overview and links to the deeper guides.
- [docs/llm-handoff/00_index.md](docs/llm-handoff/00_index.md) is the ordered
  staged handoff packet.

## Useful commands

```sh
npm run dev
npm run typecheck
npm test
npm run build
npm run build:pages
```

The current implementation intentionally begins small: a single static Vite app,
Three.js rendering, Vitest tests, and visible domain modules for cell complexes,
movement, tools, and classroom glue.

## GitHub deployment

The default deployment path is GitHub Pages through GitHub Actions.

1. Push the repository to GitHub.
2. In GitHub, open Settings -> Pages and set Source to `GitHub Actions`.
3. Push to `main` to trigger [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

The workflow installs dependencies, runs the test suite, builds the Vite app
with the correct Pages base path, publishes `.nojekyll`, and deploys `dist/`.
