# 20 - Milestone 3 archetype instance pool and debug path renders

## Goal

Prepare Milestone 3 from [docs/design/006-non-euclidean-renderer-general-01.md](../design/006-non-euclidean-renderer-general-01.md) by replacing renderer-owned per-cell scene objects with reusable archetype-backed `InstancedMesh` pools.

This issue should create the pool and move the active-cell render onto it first. The pool is also the intended foundation for later visible portal-path copies, but those copies are not currently rendered and should not be treated as existing behavior.

The completed Milestone 3 pool should render:

- the current active cell at depth 0,
- optional instance-backed debug renders created by `window.noneuclidPortalDebug.ShowCellPath(...)`.

It should prepare, but not require, ordinary camera-visible portal-path copies of destination cells.

This issue is design-only until implementation begins.

## Current situation

The renderer currently builds one real Three.js object tree per compiled cell through [src/render/three/buildCellMesh.ts](../../src/render/three/buildCellMesh.ts), stores those trees in `cellMeshes`, and toggles visibility so only the player cell is shown. Static objects such as decorations are attached directly to those cell object trees, while geodesci marmots are managed separately as runtime objects.

Portal path data is already available:

- `buildPortalPathTables(...)` exists in [src/cell-complex/portalPaths.ts](../../src/cell-complex/portalPaths.ts).
- `buildStaticallyCulledPortalPathTables(...)` exists in [src/cell-complex/staticPortalPathCull.ts](../../src/cell-complex/staticPortalPathCull.ts).
- `computeVisiblePortalPaths(...)` exists in [src/render/three/visiblePortalPaths.ts](../../src/render/three/visiblePortalPaths.ts).
- `ShowCellPath(...)` currently draws an ad-hoc destination-cell floor overlay using the destination cell floor color.

Milestone 3 should stop treating the active cell as special real scene geometry. The active cell should become the depth-0 path rendered through an archetype instance pool. That is the intermediate step before the normal renderer starts drawing camera-visible destination-cell copies through portals.

## Required behavior

### Active cell rendering

The floors, ceilings, walls, portal frames, and static objects of the current active cell must be rendered from archetype `InstancedMesh` pools.

The active cell render should use a depth-0 render path:

```text
destinationCellId = playerPose.cellId
rootFromDestination = identity
clipPolygonNdc = full screen
```

That means ordinary active-cell rendering starts using the same data shape that recursive portal rendering will use later:

```text
render paths
  -> grouped by destination cell
  -> archetype instance buffers
  -> InstancedMesh.count
```

### Future static portal copies

This issue should make the renderer ready to draw visible portal-path copies, but the first completion point is the active-cell instance render plus debug path instance render.

The later portal-copy renderer will use every visible path returned by `computeVisiblePortalPaths(...)` and render each archetype belonging to that path's destination cell with `visiblePath.rootFromDestinationMatrix`.

The renderer should not clone a cell mesh per path. It should compact visible path instances into the first `N` slots of each archetype mesh and then set:

```ts
instancedMesh.count = N;
```

### Debug `ShowCellPath(...)` behavior

Add a debug-toggleable option named:

```text
ShowCellPathRendersInstances
```

Recommended implementation surface:

- Add a launcher/debug option with an id such as `portal-path-overlay-instances`.
- Expose the resolved boolean on `window.noneuclidPortalDebug.state.ShowCellPathRendersInstances`.
- Also expose a mutable helper property or setter if convenient:

```ts
window.noneuclidPortalDebug.ShowCellPathRendersInstances = true;
```

The exact TypeScript casing can follow local style, but the public debug concept should use the requested name.

When `ShowCellPathRendersInstances` is false:

- `window.noneuclidPortalDebug.ShowCellPath("...")` keeps the existing behavior.
- It renders only an ad-hoc floor overlay with the correct destination-cell color.
- It does not render destination-cell objects, ceilings, walls, or portal frames.
- It remains useful as a cheap path-location probe.

When `ShowCellPathRendersInstances` is true:

- `ShowCellPath("...")` renders through the new archetype instance path.
- It shows the destination cell's archetyped floors, ceilings, walls, portal frames, and static objects.
- The transform must be the inspected path's `rootFromDestination` transform.
- It should still include the path trace overlay unless that conflicts visually.
- This is the first explicit way to view a non-root destination cell through the instance machinery before ordinary portal-copy rendering is switched on.

## Proposed modules

Add:

```text
src/render/three/cellRenderArchetypes.ts
src/render/three/renderPortalInstances.ts
src/render/three/portalInstanceDebug.ts
tests/render-contract/cellRenderArchetypes.test.ts
tests/render-contract/portalInstanceBuffers.test.ts
```

Potentially modify:

```text
src/render/three/createThreeApp.ts
src/render/three/buildCellMesh.ts
src/render/three/buildDecorationMesh.ts
src/render/three/buildPortalMesh.ts
src/render/three/renderState.ts
src/render/three/debugOverlay.ts
src/glue/debugOptions.ts
tests/debugSettings.test.ts
```

## Archetype model

An archetype is a reusable render batch for one cell-local geometry/material group.

```ts
export interface CellRenderArchetype {
  readonly cellId: string;
  readonly archetypeId: string;
  readonly kind:
    | "floor"
    | "ceiling"
    | "solid-wall"
    | "portal-frame"
    | "static-object";
  readonly mesh: THREE.InstancedMesh;
  readonly capacity: number;
  readonly sourceObjectName?: string;
}
```

Build one or more archetypes per cell. The first implementation should cover:

- floor,
- ceiling,
- solid walls,
- portal frame or portal wall/debug panel geometry where applicable,
- non-dynamic decoration objects already handled by `buildDecorationMesh(...)`.

Dynamic objects should remain out of scope for this issue. Geodesci marmots can continue using their current runtime path until a later dynamic-object instancing pass.

## Capacity rule

Each archetype needs a fixed capacity chosen from the statically culled path tables.

For a cell `C`, compute:

```text
capacity(C) =
  max over root-cell tables of
    count(kept paths where destinationCellId == C)
```

Because every archetype belonging to `C` is rendered once per visible path to `C`, each archetype for `C` can use the same capacity.

If the runtime visible-path budget is lower than the static count, capacity may be:

```text
min(staticDestinationPathCapacity, maxVisiblePaths)
```

but the implementation must report that choice in debug state so budget truncation is visible.

The renderer should never allocate one permanent hidden mesh per path. It should allocate fixed buffers once, then update `mesh.count` each frame.

## Startup pipeline

After world load and asset preload:

```text
1. buildStaticallyCulledPortalPathTables(...)
2. derive cell destination capacities from the kept tables
3. buildCellRenderArchetypes(world, assets, capacities, debug settings)
4. add archetype InstancedMesh objects to the scene
5. hide or remove old per-cell object trees from the normal render path
```

During the transition, old `buildCellMesh(...)` may remain as a fallback or as a geometry source, but it should not be the default active-cell render once this issue is complete.

## Frame pipeline

Each frame:

```text
1. update player pose
2. create the depth-0 render path for playerPose.cellId
3. group render paths by destinationCellId
4. update all archetype instance matrices
5. set each InstancedMesh.count
6. render scene
7. publish instance counts into debug state
```

The root path is the only required normal render path for this issue. `computeVisiblePortalPaths(...)` should remain available for debug visibility data and for the later portal-copy integration, but ordinary visible portal copies are not required for Milestone 3 completion.

## Instance update guide

The core update should look like:

```ts
function updateCellRenderArchetypeInstances(
  archetypes: readonly CellRenderArchetype[],
  visiblePathsByDestinationCell: ReadonlyMap<string, readonly VisiblePortalPath[]>,
  diagnostics: PortalInstanceDiagnostics,
): void {
  for (const archetype of archetypes) {
    const paths = visiblePathsByDestinationCell.get(archetype.cellId) ?? [];
    const count = Math.min(paths.length, archetype.capacity);

    for (let index = 0; index < count; index += 1) {
      archetype.mesh.setMatrixAt(index, paths[index].rootFromDestinationMatrix);
    }

    archetype.mesh.count = count;
    archetype.mesh.instanceMatrix.needsUpdate = true;

    if (paths.length > archetype.capacity) {
      diagnostics.recordCapacityOverflow(archetype, paths.length);
    }
  }
}
```

This keeps the frame cost proportional to visible paths, not all candidate paths.

## Debug path rendering guide

`ShowCellPath(...)` should share as much code as possible with the normal instance update, but it should not mutate the main frame buffers in a way that causes flicker.

Recommended approach:

1. Keep the existing ad-hoc floor overlay implementation.
2. Add a separate temporary debug instance group for inspected paths.
3. When `ShowCellPathRendersInstances` is true, fill the debug group from the destination cell's archetype definitions using exactly one instance per archetype.
4. Use the inspected `PortalRenderPath.rootFromDestination` transform.
5. Dispose or return debug instances to a small pool in `HideCellPaths()`.

This gives `ShowCellPath(...)` an instance-backed preview without fighting the live visible-path buffers.

Later, once ordinary portal-copy rendering is enabled, this debug path can be simplified to reusing the same renderer state directly.

## Clipping note

Milestone 3 does not need full portal-window clipping. It is acceptable for instance renders to be visible without accumulated aperture clipping at first, matching the existing Milestone 3 scope from the design doc.

Do not block this issue on shader polygon clipping. That belongs to a later milestone.

## Interaction with old cell meshes

`cellMeshes` should stop being the normal source of active-cell rendering.

Transitional options:

- Keep `buildCellMesh(...)` for warmup, tests, and fallback debug rendering.
- Split geometry builders out of `buildCellMesh(...)` so both real meshes and instanced archetypes share construction code.
- Keep `cellMeshes` only for dynamic runtimes until dynamic objects get their own instanced path.

The important acceptance point is that floors and static objects in the active cell are no longer drawn because `cellMesh.visible = true`; they are drawn because the depth-0 visible path wrote instance slot 0.

## Debug state additions

Expose compact instance-render diagnostics:

```ts
export interface PortalInstanceRenderDebugState {
  readonly enabled: boolean;
  readonly ShowCellPathRendersInstances: boolean;
  readonly archetypeCount: number;
  readonly totalCapacity: number;
  readonly renderedInstanceCount: number;
  readonly renderedInstanceCountByCell: readonly {
    readonly cellId: string;
    readonly count: number;
  }[];
  readonly capacityOverflowCount: number;
  readonly capacityOverflowArchetypes: readonly string[];
}
```

The overlay can stay compact:

```text
portal instances: 48 / 1200 slots
archetypes: 36
overflow: 0
```

## Testing plan

Add render-contract tests that do not require a live WebGL context when possible.

Test archetype planning:

- every compiled cell receives floor and ceiling archetype descriptors,
- solid walls and portal frames are represented distinctly,
- non-dynamic decorations become static-object archetypes,
- dynamic geodesci marmot specs are excluded from static archetypes.

Test capacity derivation:

- capacity is computed from statically kept destination-path counts,
- depth-0 root paths contribute to the active cell capacity,
- capacity respects any visible-path budget cap if implemented.

Test instance-buffer updates:

- `mesh.count` equals visible paths for that destination cell,
- `mesh.count` is capped at capacity,
- active root path writes an identity matrix for the active cell,
- duplicate destination cells through different paths produce multiple instance slots,
- overflow is reported instead of silently reallocating.

Test debug option parsing:

- the new debug option appears in `debugOptionDefinitions`,
- it round-trips through `parseDebugOptions(...)` and `serializeDebugOptions(...)`,
- runtime debug state exposes `ShowCellPathRendersInstances`.

Test `ShowCellPath(...)` contract:

- when false, it returns `objectCount: 1` for the ad-hoc floor overlay,
- when true, it returns an object count equal to the rendered debug archetype instances,
- invalid or statically rejected paths still do not render anything,
- `HideCellPaths()` clears both ad-hoc overlays and instance-backed debug overlays.

## Acceptance criteria

This issue is complete when:

- static render archetypes are built per cell from loaded assets and compiled cell geometry,
- each archetype is backed by a fixed-capacity `THREE.InstancedMesh`,
- archetype capacity is derived from statically culled destination-path counts,
- the current active cell renders through the depth-0 path instance pool,
- ordinary floors and static objects are no longer rendered from real visible cell object trees,
- the normal frame path populates instance buffers for at least the active depth-0 cell,
- the architecture is ready for visible portal paths to populate instance buffers by destination cell in a later step,
- `ShowCellPathRendersInstances` is available as a debug-toggleable option,
- `ShowCellPath(...)` preserves the old ad-hoc floor behavior when the option is false,
- `ShowCellPath(...)` renders destination-cell archetype instances with the inspected path transform when the option is true,
- debug state reports archetype counts, rendered instance counts, capacity, and overflows,
- render-contract tests cover archetype planning, capacity derivation, instance updates, and debug behavior,
- `npm.cmd test -- --run`, `npm.cmd run typecheck`, and `npm.cmd run build` pass.

## Non-goals

This issue should not implement:

- shader polygon clipping,
- full recursive portal material clipping,
- dynamic object instancing,
- transparent-object recursion,
- imported asset LOD policy,
- removal of all legacy cell mesh helper code.

Those belong to later renderer milestones.
