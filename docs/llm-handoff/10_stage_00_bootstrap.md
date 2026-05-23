# 10 - Stage 00: Bootstrap the project

## Goal

Create the empty TypeScript/Vite project scaffold, test harness, source folders, docs folders, and GitHub Pages deployment script.

No geometry, portals, movement, or VR behavior belongs in this stage.

## Entry conditions

Start from either:

- an empty repository, or
- a fresh branch where the proof of concept is available only as reference material.

Do not copy the proof-of-concept runtime wholesale.

## Setup commands

One acceptable setup path:

```bash
npm create vite@latest flattened-cube -- --template vanilla-ts
cd flattened-cube
npm install three
npm install -D vitest typescript @types/three
```

Install Playwright later, when stage 4 or 9 asks for browser smoke tests.

## Files to create

Create:

```text
scripts/deploy-pages.sh
src/main.ts
src/appState.ts
src/math/.gitkeep
src/cell-complex/.gitkeep
src/movement/.gitkeep
src/tools/.gitkeep
src/render/three/.gitkeep
src/classroom/.gitkeep
src/authoring/.gitkeep
src/glue/.gitkeep
tests/smoke.test.ts
docs/design/001-stack.md
docs/design/002-cell-complex-first.md
docs/design/003-no-curvature-engine.md
public/assets/README.md
```

If `.gitkeep` files are disliked, use minimal README files instead.

## `main.ts` contract

At this stage `main.ts` may only mount a simple page saying the scaffold is running.

It should not contain world logic.

## First smoke test

Add a tiny Vitest test that proves the test runner works:

```ts
import { describe, expect, it } from "vitest";

describe("test scaffold", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

This test may be deleted once real tests exist.

## GitHub Pages script

Add the branch deployment script described in `03_tech_stack_and_deployment.md`.

The script should be executable:

```bash
chmod +x scripts/deploy-pages.sh
```

## Decision notes

Write short decision notes:

`001-stack.md`:

```text
Use TypeScript, Vite, Three.js, WebXR, Vitest, and GitHub Pages branch deployment.
Do not use React, Next.js, A-Frame, Unity, Godot, or a backend for the first implementation.
```

`002-cell-complex-first.md`:

```text
The runtime is 3D-cell aware, but the first implemented cell type is a vertical prism over a polygonal base.
```

`003-no-curvature-engine.md`:

```text
The environment does not compute curvature effects. The only curvature-adjacent runtime rule is the 15 cm forbidden zone around portal junctions.
```

## Exit criteria

The stage is complete when:

```bash
npm run typecheck
npm run test
npm run build
```

all pass, and the app can be served with:

```bash
npm run dev
```

## Do not do in this stage

Do not add cells.

Do not add portals.

Do not add Three.js rendering.

Do not add WebXR.

Do not add authoring formats beyond folders and decision notes.
