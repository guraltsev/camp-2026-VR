# Testing

Tests should make refactoring safe by checking public behavior and contracts,
not private implementation details.

## Commands

```sh
npm run typecheck
npm test
npm run build
```

Use `npm run test:watch` during active implementation.

## Philosophy

Good tests describe observable behavior:

```text
Moving through a portal transforms the player position and facing direction by
the portal transform.
```

Avoid tests that freeze private structure:

```text
compilePrismCells calls makePortalMap exactly once.
```

Tests must not depend on private function names, internal loop structure,
renderer pass counts, incidental object layout, or helper-call counts.

## What To Test

Prioritize behavior tests for:

- Geometry primitives and explicit tolerances.
- Cell and portal spec validation.
- Prism-cell compilation.
- Portal transforms.
- Forbidden-zone rejection near portal junctions.
- Player movement, collision, and portal crossing.
- Straight ray tracing through portals.
- Tool outputs such as markers, paths, and measurements.

Renderer tests should be contract or smoke tests. They should prove that the app
can build and that public render functions accept the expected domain outputs,
not that Three.js internals have a particular object layout.

## Browser Smoke Tests

Playwright is reserved for later browser smoke tests. It should not be used for
mathematical correctness.

## Stage Gates

Before closing implementation work for a stage, run:

```sh
npm run typecheck
npm test
npm run build
```

If a command cannot be run, record that explicitly in the closing note or final
handoff.
