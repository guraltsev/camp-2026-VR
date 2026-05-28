# 21 - Finish milestone 3 visible-path instances and clip polygons

## Goal

Complete the remaining Milestone 3 renderer work now that `clipPolygonNdc` is available for every visible portal path.

The renderer should draw every necessary visible cell image by:

- computing the ordinary camera-visible portal paths for the current root cell,
- using precomputed destination-cell path indexes from the statically kept portal table,
- computing per-frame visible paths by destination cell from those indexed buckets,
- writing each path's `rootFromDestinationMatrix` into the existing archetype instance pools,
- clipping each rendered instance to its corresponding `clipPolygonNdc`,
- keeping the current depth-0 root cell as just another visible path.

This issue is the follow-up to [docs/issues/_closed/20_milestone_03_archetype_instance_pool_and_debug_path_renders.md](./_closed/20_milestone_03_archetype_instance_pool_and_debug_path_renders.md). Issue 20 built the fixed-capacity archetype pools and debug path renders. This issue turns the normal frame renderer on for all visible paths.

## Current state

The repository already has the required foundation:

- [src/render/three/visiblePortalPaths.ts](../../src/render/three/visiblePortalPaths.ts) returns `VisiblePortalPath` entries with `pathId`, `destinationCellId`, `depth`, `rootFromDestinationMatrix`, `clipRectNdc`, and `clipPolygonNdc`.
- [src/cell-complex/portalPaths.ts](../../src/cell-complex/portalPaths.ts) and the statically culled table already preserve destination-cell path groupings for non-statically culled paths.
- [src/render/three/renderPortalInstances.ts](../../src/render/three/renderPortalInstances.ts) can write per-archetype instance matrices once it receives visible paths grouped by destination cell.
- [src/render/three/cellRenderArchetypes.ts](../../src/render/three/cellRenderArchetypes.ts) builds fixed-capacity `THREE.InstancedMesh` pools for floors, ceilings, solid walls, portal frames, and static objects.
- [src/render/three/createThreeApp.ts](../../src/render/three/createThreeApp.ts) currently calls `computeVisiblePortalPaths(...)` only for debug state and overlays.
- `syncPortalInstanceRender()` currently populates the live instance buffers with only `createRootVisiblePortalPath(playerPose.cellId)`.

The missing connection is:

```text
computeVisiblePortalPaths(...)
  -> update clip data keyed by pathId
  -> derive destinationCell -> visible paths from precomputed destination-cell path buckets
  -> updateCellRenderArchetypeInstances(...)
  -> shader clips each fragment against that instance's clipPolygonNdc
```

## Scope

In scope:

- normal camera-visible portal-copy rendering for every visible path returned by `computeVisiblePortalPaths(...)`,
- per-instance association with the visible path id,
- shader clipping against the path's accumulated `clipPolygonNdc`,
- debug state showing visible path counts, rendered instance counts, clipping counts, and overflow,
- contract tests for visible-path instance population and clip-data behavior.

Out of scope:

- dynamic object duplication through portal paths,
- VR-specific stereo clipping,
- transparent object ordering,
- replacing all material handling for imported GLTF-style assets,
- removing the old debug helpers,
- changing portal path enumeration or static culling.

## Required work

### 0. Treat destination-cell path indexes as load-time data

The mapping from path id to destination cell, and from destination cell to all non-statically culled paths, should be built once with the path tables and static culling result.

Do not make the normal frame path rediscover destination-cell membership by repeatedly grouping the whole visible-path array. The statically kept table should already have enough information to answer:

```text
pathId -> destinationCellId
destinationCellId -> all statically kept paths for that root cell
```

The per-frame renderer should then compute:

```text
destinationCellId -> currently visible paths
```

by looping over:

```text
destinationCellId -> all statically kept paths
```

and checking which path ids are present in the current `visiblePathById` map.

This preserves the intended ownership split:

- load-time/precomputed: topology, path identity, destination-cell membership, static culling,
- frame-time: camera visibility, `clipPolygonNdc`, visible-path ordering, render budget, instance-buffer population.

### 1. Make visible-path computation part of the normal frame path

Move the ordinary per-frame visible-path result out of debug-only control flow.

`createThreeApp.ts` should maintain a frame-local or cached `ComputeVisiblePortalPathsResult` whenever a table exists for the current `playerPose.cellId`, regardless of whether `portal-visible-path-debug` is active.

The debug option should control display and helper behavior, not whether the renderer has the visible paths it needs.

Recommended shape:

```text
applyCameraPose()
compute current visible portal paths
update clip data from visible paths
update archetype instance buffers from destination-cell visible-path buckets
update debug overlay if enabled
renderer.render(scene, camera)
```

The root cell should come from the computed visible result with `includeRootCell: true`; do not separately add a second root instance.

### 2. Replace root-only instance population

Update `syncPortalInstanceRender()` or replace it with a function that accepts the current visible result and the precomputed destination-cell buckets for the active root cell.

The live frame path should do conceptually:

```ts
const visiblePathsByDestinationCell = buildVisiblePathsByDestinationCell(
  staticallyKeptPathsByDestinationCell,
  visiblePathById,
);
updateCellRenderArchetypeInstances(cellRenderArchetypes, visiblePathsByDestinationCell, portalInstanceDiagnostics);
```

`groupVisiblePortalPathsByDestinationCell(...)` may remain useful in tests or as a small fallback helper, but the ordinary renderer path should use the precomputed destination-cell path buckets.

Acceptance detail:

- if two visible paths reach the same destination cell, that cell's archetypes should receive two active instances,
- instance transforms should come from each path's `rootFromDestinationMatrix`,
- `mesh.count` should stay capped by archetype capacity,
- capacity overflow should be reported, not silently ignored.

### 3. Add per-instance path ids

Each archetype instance needs a stable way for the shader to look up the right clip polygon.

Add an instanced attribute such as:

```text
portalPathId
```

to every `CellRenderArchetype`.

`updateCellRenderArchetypeInstances(...)` should write `visiblePath.pathId` beside the matrix for each active slot. This should be tested without requiring a live WebGL context.

Path ids are the right key because `clipPolygonNdc` is produced per visible path, not merely per destination cell.

### 4. Add portal clip data

Add a small clip-data module, likely:

```text
src/render/three/portalClipData.ts
```

Responsibilities:

- accept the current `readonly VisiblePortalPath[]`,
- store each path's `clipPolygonNdc`,
- expose a compact lookup by `pathId`,
- enforce a first-pass maximum vertex count per polygon,
- produce uniform-friendly or texture-friendly data for materials.

Initial implementation can use uniform arrays if it is compatible with target material count and WebGL limits.

Suggested first-pass constants:

```text
maxClipVerticesPerPath = 8
maxVisiblePaths = same budget used by computeVisiblePortalPaths(...)
```

If a polygon has more than `maxClipVerticesPerPath`, either clamp conservatively only if that is mathematically safe, or fail/report clearly. Do not silently change the portal aperture in a way that can draw outside the visible window.

### 5. Add clip-aware materials

Add a material patching module, likely:

```text
src/render/three/portalClipMaterial.ts
```

The fragment shader should discard fragments outside the visible path's `clipPolygonNdc`.

For a convex NDC polygon, the shader can:

- compute the fragment NDC from `gl_FragCoord.xy` and viewport size,
- read the current instance's `portalPathId`,
- fetch that path's polygon vertices and vertex count,
- test all polygon edge half-spaces,
- `discard` when outside.

Coordinate convention must match `visiblePortalPaths.ts`:

```text
clipPolygonNdc.x: -1 left, +1 right
clipPolygonNdc.y: -1 bottom, +1 top
```

The viewport conversion must account for WebGL's bottom-left `gl_FragCoord` origin. Add a focused test around the CPU-side helper or generated constants if the shader path is hard to unit-test directly.

### 6. Apply clipping to archetype materials

When `buildCellRenderArchetypes(...)` clones source materials, wrap or patch those materials so every archetype mesh can access:

- viewport size,
- clip polygon data,
- clip vertex counts,
- per-instance path id.

It is acceptable for the first pass to support the simple materials produced by current cell geometry and static objects. If a material cannot be patched safely, render it with a portal-compatible fallback material and document that limitation in the code.

### 7. Prevent legacy root cell meshes from double-rendering static content

The normal static cell visuals should come from archetype instances, not from the old per-cell object tree.

Keep legacy cell roots only for responsibilities that still need them, such as dynamic objects or debug overlays. Make sure the currently visible legacy cell root does not also draw the same floor/wall/static-object meshes on top of the archetype-rendered root path.

### 8. Preserve and improve debug behavior

`window.noneuclidPortalDebug` should continue to work.

Helpful additions:

- expose whether normal visible-path instance rendering is active,
- expose the latest visible path ids and destination cells,
- expose clip polygon vertex counts for selected paths,
- keep `ShowCellPathClipPolygon(...)` using the same `clipPolygonNdc` that the shader uses,
- keep `ShowCellPath(...)` as an inspection overlay, not as the normal rendering mechanism.

The on-screen debug overlay should remain compact.

## Suggested implementation order

1. Confirm or expose the load-time indexes: `pathId -> destinationCellId` and `destinationCellId -> statically kept paths`.
2. Thread `ComputeVisiblePortalPathsResult` into the normal frame loop without changing clipping yet.
3. Build `destinationCellId -> visible paths` each frame by scanning the precomputed destination-cell path buckets against `visiblePathById`.
4. Feed those destination-cell visible buckets into `updateCellRenderArchetypeInstances(...)` and verify duplicate destination instances draw with no clipping.
5. Add the per-instance `portalPathId` attribute and tests.
6. Add `portalClipData.ts` and tests for path-id lookup, polygon counts, and overflow reporting.
7. Patch simple materials to discard outside each path's polygon.
8. Wire viewport-size updates through resize and render paths.
9. Disable duplicate legacy static rendering.
10. Update debug overlay and helper output.

This order keeps the visual milestones inspectable: first "all copies render," then "copies are clipped correctly."

## Tests to write

Add or extend renderer-contract tests:

```text
tests/render-contract/portalInstanceBuffers.test.ts
tests/render-contract/portalClipData.test.ts
tests/render-contract/portalClipMaterial.test.ts
```

Required coverage:

- load-time/static-cull data exposes destination-cell membership for kept paths,
- per-frame destination-cell visible buckets are built by intersecting precomputed kept-path buckets with `visiblePathById`,
- visible paths for duplicate destination cells create duplicate active instances,
- instance matrix slot N matches visible path slot N,
- `portalPathId` attribute slot N matches visible path `pathId`,
- capacity overflow is reported when visible path count exceeds archetype capacity,
- clip data preserves `clipPolygonNdc` by path id,
- clip data rejects or reports polygons beyond the supported vertex count,
- viewport-to-NDC conversion matches the coordinate convention used by `computeVisiblePortalPaths(...)`,
- root path uses a full-screen clip polygon.

Manual checks:

- cube world shows connected cell copies through portals during ordinary rendering,
- nested portal views are bounded by portal windows rather than full destination cells,
- `ShowCellPathClipPolygon(...)` overlays match the actually rendered clipped region,
- moving through a portal keeps the visible view and the movement transition consistent,
- debug overlay reports visible path counts and rendered instance counts that change with camera direction.

## Acceptance criteria

This issue is complete when:

- ordinary rendering uses the full `computeVisiblePortalPaths(...)` result, not only the depth-0 root path,
- all visible destination-cell copies are rendered through archetype `InstancedMesh` pools,
- every rendered instance is transformed by its matching `rootFromDestinationMatrix`,
- every rendered instance is clipped by its matching `clipPolygonNdc`,
- same-destination paths remain visually distinct when both are visible,
- static floors, ceilings, solid walls, portal frames, and static objects participate in visible-path rendering,
- the root cell is rendered through the same path machinery as recursive copies,
- live instance buffers report capacity overflow instead of reallocating or silently dropping diagnostics,
- debug helpers and overlays still work,
- `npm.cmd test -- --run`, `npm.cmd run typecheck`, and `npm.cmd run build` pass.

## Notes

This issue intentionally completes polygon clipping now rather than stopping at rectangular scissor clipping, because `clipPolygonNdc` already exists for every visible path.

If uniform limits are hit, switch clip polygon storage from uniforms to a small `DataTexture`. Keep the public renderer contract the same:

```text
VisiblePortalPath.pathId
VisiblePortalPath.clipPolygonNdc
instance portalPathId
clip data lookup by pathId
```

The important invariant is that path identity, transform identity, and clip-polygon identity stay aligned for every active instance slot.
