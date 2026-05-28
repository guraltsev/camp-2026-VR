# 23 - Make lighting stable across portal traversal

## Goal

Remove the lighting discontinuity that appears at the moment of portal traversal.

The world does not need shadows, reflections, or physically rich lighting. A simple stylized lighting model is acceptable, but it must not visibly pop when the player or a dynamic object crosses from one cell representation into another.

## Current state

[src/render/three/createThreeApp.ts](../../src/render/three/createThreeApp.ts) currently creates:

- a `THREE.HemisphereLight`,
- a fixed-position `THREE.DirectionalLight`,
- no shadows.

The directional light is likely the discontinuity source. Portal traversal transforms the viewer/object pose through a non-Euclidean cell identification, but a fixed scene-space directional light does not transform with that local cell frame. At the crossing frame, surface normals can be evaluated against a different apparent light direction, causing a visible shading pop.

## Desired behavior

Lighting should be stable under portal teleportation:

- crossing a portal should not cause an obvious brightness or specular-direction jump,
- the same local cell geometry should keep the same stylized appearance before and after crossing,
- dynamic objects should not change from lit-front to lit-back solely because their root cell changed,
- the solution should remain cheap and simple.

## Recommended direction

Prefer a portal-invariant stylized lighting setup over trying to make a global directional sun physically meaningful in a non-Euclidean world.

Good first-pass options:

### Option A: Ambient plus hemisphere only

Remove or greatly reduce the directional light and use a soft hemisphere/ambient mix:

```text
HemisphereLight sky/ground fill
AmbientLight low-strength fill
MeshStandardMaterial or MeshLambertMaterial with low contrast
```

This is the simplest and probably the best match for a stylized classroom world. It removes the global direction that causes most crossing discontinuities.

### Option B: Viewer-local zenith light

Keep a gentle directional light, but make it behave like a head/world-up fill that is stable relative to the current rendered root:

```text
direction = current cell zenith / Three.js up
position = camera.position + zenith * distance
target = camera.position
```

Because this light follows the current view, it should feel like a non-physical art light rather than a global sun. Keep intensity low and combine it with hemisphere fill.

### Option C: Material-level toon/fill lighting

For the cleanest stylized result, consider migrating simple cell geometry and proxy objects toward low-contrast toon or matcap-like materials later. That is probably larger than this issue unless the directional-light removal leaves the scene too flat.

## Scope

In scope:

- replace the current fixed directional key light with a portal-stable lighting setup,
- keep shadows disabled,
- expose a small renderer contract around the chosen lighting rig,
- verify light state updates on camera/cell changes if using a viewer-local light.

Out of scope:

- physically correct non-Euclidean lighting,
- shadow maps,
- screen-space reflections,
- per-portal light transport,
- changing world authoring materials broadly.

## Required work

### 1. Extract lighting setup

Move the light creation/update logic out of the middle of `createThreeApp(...)`, likely into:

```text
src/render/three/sceneLighting.ts
tests/render-contract/sceneLighting.test.ts
```

The module should make the chosen policy explicit, for example:

```text
createStylizedSceneLighting(scene)
updateStylizedSceneLighting(lighting, camera)
disposeStylizedSceneLighting(lighting)
```

If Option A is chosen, `update...` may be a no-op.

### 2. Avoid fixed world-space key lighting

Do not leave a strong fixed `DirectionalLight` at a hard-coded scene position such as `(3, 6, 4)`.

If any directional light remains, it should be:

- low intensity,
- tied to camera/current-root zenith rather than arbitrary scene coordinates,
- documented as an art light, not a simulated sun.

### 3. Tune materials only as needed

The first pass should keep material churn small. If the scene becomes too flat:

- raise hemisphere sky intensity slightly,
- add a weak ambient fill,
- reduce high-contrast roughness/metalness assumptions,
- avoid adding shadows.

### 4. Add tests

Renderer-contract tests should verify:

- the scene lighting rig contains no high-intensity fixed directional light,
- shadows remain disabled,
- if using a viewer-local zenith light, its position/target updates from a camera pose,
- disposing/rebuilding the app does not leak light objects.

## Manual checks

- Stand at a portal and look at a floor/wall/object before crossing.
- Cross the portal slowly and confirm brightness does not pop.
- Watch a marmot cross a portal and confirm its shading remains visually stable.
- Turn in place to confirm the scene remains readable from all directions.
- Check that portal-recursive copies do not show obvious light-direction mismatches.

## Acceptance criteria

This issue is complete when:

- crossing a portal no longer causes an obvious directional lighting pop,
- the fixed high-contrast scene-space directional light is removed or reduced to a harmless fill,
- the chosen lighting policy is centralized in a small renderer module,
- shadows remain disabled,
- renderer-contract tests cover the lighting policy,
- `npm.cmd test -- --run`, `npm.cmd run typecheck`, and `npm.cmd run build` pass.
