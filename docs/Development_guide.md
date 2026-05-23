# Development Guide

This is the living overview for building the NonEuclidean FPV experience.

## Project Purpose

Build a private VR/FPS-style exploration environment for discrete non-Euclidean
geometry models. Middle-school students should be able to move through glued
cell worlds, shoot locally straight rays, leave markers, trace paths, compare
measurements, and notice mathematical patterns with limited instructor guidance.

The software provides the environment. It does not teach theorems directly.

## Teaching Stance

The application is a playground, not a tutor. The instructor and course
materials are responsible for interpretation. The software is responsible for a
coherent world and reliable tools.

Initially provide:

- Walkable glued cells.
- Stable portals.
- Collision rules.
- Locally straight ray shooting.
- Markers and path traces.
- Length and angle measurement tools when requested.
- Reset, save, and load support.
- Teacher-authored worlds.
- Simple debug views.

Do not initially provide:

- Automatic theorem explanations.
- Curvature computation.
- Gauss-Bonnet computation.
- Holonomy computation.
- Euler characteristic computation.
- Global point-to-point geodesic solving.
- Adaptive lesson logic.

## First Runtime Model

The runtime should be 3D-cell aware from the beginning, but the first implemented
cell type is a vertical prism over a 2D polygonal base. Students walk inside the
prism. Floors and ceilings are ordinary barriers. Selected vertical side faces
are portals.

The player and placed tools must never come within 15 cm of a portal junction.
Treat this as a movement and collision safety rule, not as a curvature
calculation.

## Stack

Use a single Vite TypeScript project with Three.js rendering, WebXR through
Three.js when VR is added, and Vitest for unit and contract tests. Playwright is
reserved for later browser smoke tests.

Do not use React, Next.js, A-Frame, Unity, Godot, a backend, or a monorepo in the
first implementation.

Useful commands:

```sh
npm run dev
npm run typecheck
npm test
npm run build
npm run build:pages
```

For local classroom serving:

```sh
npm run dev -- --host 0.0.0.0
```

For GitHub Pages, `scripts/deploy-pages.sh` builds locally and pushes the built
`dist/` contents to the `gh-pages` branch root. Configure GitHub Pages manually
to serve that branch.

## Repository Map

- `src/main.ts` is the small browser entrypoint.
- `src/appState.ts` holds app-level state contracts.
- `src/math` holds low-level geometry primitives and tolerances.
- `src/cell-complex` holds cell, portal, compiler, transform, and forbidden-zone
  rules.
- `src/movement` holds player body, collision, movement, and portal-crossing
  behavior.
- `src/tools` holds ray, marker, path trace, and measurement contracts.
- `src/render/three` holds Three.js rendering glue.
- `src/classroom` holds reset, discovery log, and preflight helpers.
- `src/authoring` holds world spec and future authoring validation code.
- `src/glue` holds browser storage, asset URLs, and deployment-specific helpers.
- `public/assets` holds small static assets that support scene legibility.
- `tests` holds behavior and contract tests.

## Import Direction

Keep mathematically meaningful runtime rules out of renderer files.

Use this dependency direction:

```text
math -> no project imports
cell-complex -> math
movement -> math + cell-complex
tools -> math + cell-complex + movement public types
render/three -> math + cell-complex + movement + tools public outputs
classroom -> public app/tool state only
authoring -> cell-complex specs and validation
glue -> browser APIs, storage, URLs, deployment-specific helpers
```

`math`, `cell-complex`, `movement`, and `tools` must not import from
`render/three`.

## Focused Guides

- [coding_style.md](coding_style.md) covers code organization, naming, comments,
  public modules, and import boundaries.
- [documentation_style.md](documentation_style.md) covers public docs, JSDoc,
  and in-code narration.
- [testing.md](testing.md) covers testing philosophy, scripts, and stage gates.
- [design/001-stack.md](design/001-stack.md) explains the stack decision.
- [design/002-cell-complex-first.md](design/002-cell-complex-first.md) explains
  the prism-cell-first decision.
- [design/003-no-curvature-engine.md](design/003-no-curvature-engine.md)
  explains the no-curvature-engine boundary.
