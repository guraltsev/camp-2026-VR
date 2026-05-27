# Testing Strategy

## Main rule

Test logically relevant behavior. Do not test implementation details.

The test suite should let the developer freely replace renderer internals, reorganize helpers, or improve algorithms without breaking tests that only cared about private structure.

## Test groups

Use these folders:

```text
tests/math/
tests/cell-complex/
tests/movement/
tests/tools/
tests/render-contract/
tests/e2e/
```

## Math tests

Test stable primitives:

- vector addition, subtraction, dot, and cross behavior,
- rigid transform composition and inverse behavior,
- point-on-plane classification with tolerance,
- segment-plane intersection behavior,
- polygon interior tests.

Do not test how a function loops internally.

## Cell-complex tests

Test compiler behavior:

- duplicate cell ids are rejected,
- missing portal target cell is rejected,
- missing portal target face is rejected,
- incompatible portal faces are rejected,
- prism with non-positive height is rejected,
- invalid base polygon is rejected,
- floor and ceiling are non-portal in the first implementation,
- forbidden zones are created exactly where portal faces meet.

Test public compiled queries:

- asking for an existing cell returns it,
- asking for a portal at a wall returns `undefined`,
- asking for a portal face returns a compiled portal,
- portal transforms round-trip with their reverse when the portal is two-way.

## Movement tests

Test behavior:

- movement inside an empty prism succeeds,
- movement into a wall stops before the wall,
- movement into the ceiling or floor is blocked,
- movement through a portal transforms position and orientation,
- movement near a portal boundary does not accidentally cross,
- movement into a forbidden zone is rejected or shortened,
- movement across a portal too close to a junction is rejected.

Do not test exact collision iteration counts.

## Straight-ray tests

Test behavior:

- a ray inside a cell is straight until it hits something,
- a ray crossing a portal transforms direction correctly,
- a ray stops at a wall,
- a ray stops at maximum distance,
- a ray stops at maximum portal crossings,
- a ray stops before a forbidden zone,
- trace segments preserve cell ids and local coordinates.

Do not call these geodesic tests.

## Renderer contract tests

Renderer tests should be few and public.

Examples:

- building a cell mesh from a compiled prism returns floor, ceiling, and side-face render objects,
- a portal face has a visible aperture object,
- the debug overlay can display the last movement result,
- visible portal state reports the root cell and first-hop portal targets.

Do not snapshot large DOM trees or Three.js object graphs. Snapshots create high-friction lock-in.

## Browser smoke tests

Use Playwright only after the app has a stable first scene.

Smoke tests should verify:

- the page loads,
- no fatal console errors occur during startup,
- the debug overlay appears,
- keyboard movement changes the reported player position,
- the app can enter a non-XR fallback mode.

Do not try to fully test VR headset behavior in automation.

## Forbidden tests

Do not write tests that assert:

- private helper names,
- exact source file organization,
- exact number of renderer passes unless it is a public debug mode contract,
- exact object identity for generated Three.js meshes,
- exact decoration placement unless the world spec contract requires it,
- large snapshots,
- implementation-only tolerances not exposed as behavior.

## Stage gate rule

Every stage must end with:

```bash
npm run typecheck
npm run test
npm run build
```

If Playwright is active for that stage, also run:

```bash
npm run e2e
```

## Failing tests rule

If a test fails, fix the behavior or revise the test only after deciding whether the test expresses a public contract.

Do not delete failing tests merely because the implementation changed.
