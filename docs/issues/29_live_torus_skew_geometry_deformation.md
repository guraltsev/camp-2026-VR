# 29 - Dynamic geometry deformation infrastructure and torus skew MVP

## Goal

Add a safe dynamic-geometry infrastructure that can install topology-preserving
deformations of compiled worlds at runtime.

The torus room is the first and main target: skew its square fundamental polygon
into a parallelogram while preserving the same portal pairings. The
implementation should not hard-code the torus into the session, worker, commit,
renderer, or movement hot-swap architecture. Torus skew should be one
deformation family plugged into a more general pipeline.

The first implementation should support slow, discrete steps rather than a
fully continuous morph:

```text
current torus skew -> compute next world snapshot off the hot frame path
                    -> atomically install it when ready
                    -> repeat until target skew is reached
```

The feature should let the user change the torus by small increments, for
example `0.05m` to `0.10m` of skew per step every `1s` to `2s`, without
blocking movement/rendering during the expensive path-table computation.

The general infrastructure should later allow other dynamic deformations, such
as affine prism-cell stretching/shearing, coordinated multi-cell deformations,
or carefully constrained vertex-driven convex-prism deformations, without
rewriting portal rendering or movement.

## Interpretation Of "Keep Portal Mappings Identical"

For this issue, "identical portal mappings" means:

- the same cell ids,
- the same side indices,
- the same portal ids,
- the same reciprocal portal pairs,
- the same topological gluing graph.

It does not mean reusing the old numeric `CompiledPortal.transformToTarget`
after the side geometry changes.

The current compiler derives a rigid transform from the source side and target
side geometry in `src/cell-complex/compilePortalTransforms.ts`. If the torus
face is skewed, the transform must be rederived from the new side geometry so
the crossing transform still maps one portal aperture to its matching aperture.
Keeping an old transform while moving the sides would make movement, portal
visibility, and collision disagree.

If an expert mode later needs fixed numeric transforms independent of geometry,
that should be a separate issue with explicit aperture compatibility checks.

## General Infrastructure Requirement

The implementation should have two layers:

```text
deformation family adapter
  -> produces a valid next CellComplexSpec
  -> produces old-to-new runtime rebase maps
  -> validates deformation-specific constraints

world geometry session
  -> schedules background builds
  -> drops stale results
  -> atomically commits complete snapshots
  -> rebuilds render/runtime derived state
```

Only the adapter should know what "torus skew" means. The session should operate
on generic `WorldDeformationState` values.

Suggested core interface:

```ts
export interface WorldDeformationFamily<TState extends WorldDeformationState> {
  readonly kind: TState["kind"];

  canApplyToSpec(baseSpec: CellComplexSpec): boolean;
  normalizeState(baseSpec: CellComplexSpec, state: TState): TState;
  applyToSpec(baseSpec: CellComplexSpec, state: TState): CellComplexSpec;

  createRebaseMaps(
    previous: TState,
    next: TState,
    previousWorld: CompiledCellComplex,
    nextWorld: CompiledCellComplex,
  ): ReadonlyMap<string, CellDeformationMap>;

  nextStep(
    current: TState,
    target: TState,
    options: DynamicGeometryStepOptions,
  ): TState;

  validateSnapshot(
    previousWorld: CompiledCellComplex,
    nextWorld: CompiledCellComplex,
  ): readonly string[];
}
```

Suggested shared rebase contract:

```ts
export interface CellDeformationMap {
  readonly cellId: string;
  mapPoint(point: Vec3): Vec3;
  mapDirection(direction: Vec3, atPoint?: Vec3): Vec3;
}
```

For affine deformations, `mapDirection(...)` is the linear part of the affine
map. For a later non-affine deformation, the adapter can use a local Jacobian or
fall back to a conservative object reset policy. The infrastructure should not
assume all deformations are torus skews or even affine, but the first persistent
runtime-object preservation policy can require a usable `CellDeformationMap`.

### Supported MVP deformation class

The first generic class should be:

```text
topology-preserving convex prism base deformation
```

Rules:

- cell ids stay the same,
- side counts stay the same,
- side indices stay the same,
- portal ids and reciprocal target ids stay the same,
- every deformed base remains strictly convex,
- every portal-paired side remains length-compatible with its reciprocal side,
- prism heights remain unchanged unless a later deformation family explicitly
  supports height changes.

The torus skew adapter is then a small affine-prism-base deformation that
generates a valid parallelogram for `torus-room`.

### Future deformation families

The architecture should leave room for:

- `torus-skew`: first MVP, one-cell affine parallelogram deformation,
- `affine-prism-cells`: per-cell affine transforms constrained by portal-pair
  side lengths,
- `prism-base-vertices`: explicit convex base vertices supplied by an editor or
  parametric function,
- `multi-cell-lattice`: coordinated deformation of several cells sharing a
  lattice or symmetry,
- future volume-cell deformations after the project grows beyond prism cells.

Do not implement all of these in this issue. The requirement is that adding one
later is an adapter plus tests, not a rewrite of `createThreeApp.ts`.

## Current Code Findings

### Authoring and torus shape

The current torus world is authored in
`src/examples/torus.world.js` as one square face:

```js
square = [
  [-7.5, -7.5],
  [7.5, -7.5],
  [7.5, 7.5],
  [-7.5, 7.5],
];

PolygonFace("torus-room", floorTexture("river_pebbles"), square);

Portal("torus-room", 0, "torus-room", 2);
Portal("torus-room", 1, "torus-room", 3);
```

`createWorldBuilder()` turns each `Portal(...)` call into two reciprocal portal
specs with stable ids like `side-0`, `side-2`, `side-1`, and `side-3`.

This is ideal for a first live-deformation feature because a skewed torus can
stay as one convex quadrilateral cell with the same four side indices.

### Compiled world is currently static

Startup in `src/main.ts` does this once:

```text
loadWorldSpec(...)
compileCellComplex(...)
preloadWorldAssets(...)
createInitialAppState(world)
createThreeApp(...)
```

`AppState` stores a readonly `world: CompiledCellComplex`.
`createThreeApp.ts` closes over `appState.world` in movement, renderer setup,
runtime object updates, tool placement, geodesic tracing, debug helpers, and
portal rendering.

There is no current hot-swap boundary for the compiled world.

### The compiler has the right source of truth

`compileCellComplex(...)` validates the authoring spec, compiles prism geometry,
derives portal transforms, and links portal maps.

Important dependencies:

- `compilePrismCellGeometry(...)` computes `baseVertices`, side normals, side
  lengths, portal junctions, singularity columns, and forbidden zones.
- `compilePortalTransforms(...)` derives `CompiledPortal.transformToTarget`
  from side tangent, side normal, vertical up, and side midpoint.
- Movement and geodesic tracing use the compiled portal transform directly.
- Rendering and portal visibility use the same compiled side geometry.

This means the safe live-deformation boundary is a new compiled-world snapshot,
not a renderer-only mesh edit.

### Movement depends on one coherent world snapshot

`movePlayer(...)` delegates to `moveDynamicObject(...)` when a world is present.
`moveDynamicObject(...)` uses:

- `world.cellsById`,
- compiled side normals,
- side lengths,
- portal side assignments,
- `portal.transformToTarget`,
- singularity/forbidden-zone cylinders.

Portal crossing uses `crossDynamicObjectPortal(...)`, which composes the object
pose with `portal.transformToTarget`.

Therefore a frame must not mix old movement geometry with new portal path
matrices or new render meshes.

### Portal rendering has reusable machinery but static setup

`createThreeApp.ts` currently builds these once:

- `portalStaticCull = buildStaticallyCulledPortalPathTables(appState.world, ...)`
- `archetypeCapacitiesByCellId = deriveCellRenderArchetypeCapacities(...)`
- `warmupViewsByCellId`
- `cellRenderArchetypes`
- `cellMeshes`
- `portalDebugRuntime`

Each frame it computes visible paths from the static-cull table for the current
root cell, updates `portalClipData`, and writes instance matrices into static
and runtime-object archetypes.

This is close to what live deformation needs, but the setup variables must
become replaceable as one world-render bundle.

### Runtime objects require an explicit rebase policy

Runtime objects are registry-owned and have cell-local poses. Examples include:

- dynamic authored creatures,
- placed signs,
- geodesic emitters,
- geodesic segments,
- geodesic intersections,
- measured lengths,
- protractor angles,
- collision records for authored static assets.

Many operations pass `appState.world` into pure helpers at the moment they run,
so they will work with a new world once the call sites read the new snapshot.
The tricky part is preserving or invalidating existing local object state when
the cell geometry changes.

Dynamic creature runtimes currently store private `state` and write into the
registry during `update(...)`. If the registry is rebased without also rebasing
the runtime's private state, the next update will overwrite the rebased registry
object. These runtimes need a rebase method or they need to read their state
back from the registry after a geometry commit.

### Tools and geodesics can become stale

The geodesic cannon tools trace against current cell sides and portal
transforms. A segment chain made before a skew may no longer represent a valid
locally straight chain after a skew because portal transforms and side
positions changed.

The first implementation should use a conservative policy:

- preserve ordinary placed objects and authored moving creatures by rebasing
  their local poses,
- clear or mark stale geodesic segments, measurements, and protractor angles on
  a geometry commit,
- rebuild selected geodesics later only after the geometry hot-swap path is
  stable.

## First Deformation Family: Torus Skew

Represent the torus room as a centered parallelogram with two lattice vectors:

```text
u = (widthMeters, 0)
v = (skewXMeters, depthMeters)
```

For the current torus:

```text
widthMeters = 15
depthMeters = 15
skewXMeters = 0
```

The skewed vertices should be:

```ts
const u = { x: widthMeters, y: 0 };
const v = { x: skewXMeters, y: depthMeters };

const vertices = [
  { x: -0.5 * u.x - 0.5 * v.x, y: -0.5 * u.y - 0.5 * v.y },
  { x:  0.5 * u.x - 0.5 * v.x, y:  0.5 * u.y - 0.5 * v.y },
  { x:  0.5 * u.x + 0.5 * v.x, y:  0.5 * u.y + 0.5 * v.y },
  { x: -0.5 * u.x + 0.5 * v.x, y: -0.5 * u.y + 0.5 * v.y },
];
```

With `u = (15, 0)` and `v = (2, 15)`, this gives:

```text
(-8.5, -7.5)
( 6.5, -7.5)
( 8.5,  7.5)
(-6.5,  7.5)
```

The side order remains:

```text
side 0: bottom edge, portal to side 2
side 1: skewed right edge, portal to side 3
side 2: top edge, portal to side 0
side 3: skewed left edge, portal to side 1
```

Opposite sides stay parallel and equal length, so the compiler can derive
aperture-compatible rigid portal transforms.

## Deformation Maps

Every deformation family needs two related maps:

1. Spec deformation:
   generate the next `CellComplexSpec` from a base spec and a deformation
   state.

2. Runtime rebase:
   move existing player/runtime-object positions from old material coordinates
   to new material coordinates.

For the torus parallelogram adapter, use lattice coordinates.

Given a point `p` in an old parallelogram:

```text
p = oldOrigin + alpha * oldU + beta * oldV
```

Preserve `(alpha, beta, z)` and place the point in the new parallelogram:

```text
p' = newOrigin + alpha * newU + beta * newV
```

For yaw-bearing objects, transform the heading direction through the 2D affine
linear map:

```text
heading = (cos(yaw), sin(yaw))
heading' = normalize(A * heading)
yaw' = atan2(heading'.y, heading'.x)
```

This keeps objects aligned with the material coordinates of the deforming face.
The collision shapes remain ordinary circular cylinders after the rebase; they
are not sheared.

For other deformation families:

- affine prism deformations should provide exact affine point and direction
  maps,
- explicit vertex-driven convex polygon deformations should either provide a
  tested coordinate map, such as mean-value coordinates, or opt into resetting
  runtime objects that cannot be safely rebased,
- deformations that cannot map directions coherently should not preserve
  yaw-sensitive runtime objects without a family-specific policy.

## Proposed Architecture

Introduce a replaceable world snapshot bundle and a deformation-family registry:

```ts
type WorldDeformationState =
  | TorusSkewDeformationState
  | AffinePrismCellsDeformationState
  | PrismBaseVerticesDeformationState;

interface WorldDeformationFamilyRegistry {
  get<TState extends WorldDeformationState>(
    kind: TState["kind"],
  ): WorldDeformationFamily<TState> | undefined;
}
```

The MVP may only register `torus-skew`, but the types and session code should
not require that assumption.

```ts
interface WorldGeometrySnapshot {
  readonly version: number;
  readonly deformation: WorldDeformationState;
  readonly spec: CellComplexSpec;
  readonly world: CompiledCellComplex;
  readonly staticCull: StaticPortalPathCullResult;
  readonly buildStats: {
    readonly requestedAtMs: number;
    readonly completedAtMs: number;
    readonly worker: boolean;
  };
}

interface ActiveWorldBundle {
  readonly snapshot: WorldGeometrySnapshot;
  readonly archetypeCapacitiesByCellId: ReadonlyMap<string, number>;
  readonly warmupViewsByCellId: ReadonlyMap<string, ReturnType<typeof createCellWarmupViews>>;
}
```

`createThreeApp.ts` should stop treating `appState.world` as the live world.
Instead it should keep a current bundle:

```ts
let activeWorldBundle = createInitialWorldBundle(appState.world, initialSpec);

function activeWorld(): CompiledCellComplex {
  return activeWorldBundle.snapshot.world;
}

function activeStaticCull(): StaticPortalPathCullResult {
  return activeWorldBundle.snapshot.staticCull;
}
```

Then replace call sites that participate in runtime behavior:

```text
appState.world -> activeWorld()
portalStaticCull -> activeStaticCull()
archetypeCapacitiesByCellId -> activeWorldBundle.archetypeCapacitiesByCellId
warmupViewsByCellId -> activeWorldBundle.warmupViewsByCellId
```

This can be staged. The first refactor can keep `appState.world` as the initial
world but avoid using it after `createThreeApp` starts.

The deformation session should expose generic operations:

```ts
interface WorldDeformationNudge {
  readonly kind: WorldDeformationState["kind"];
}

interface WorldGeometrySession {
  setTarget(target: WorldDeformationState): void;
  nudge(request: WorldDeformationNudge): void;
  cancel(): void;
  pollReadySnapshot(): WorldGeometrySnapshot | undefined;
  readonly state: LiveGeometryDebugState;
}
```

The torus debug helper can wrap this generic session with friendly commands
like `SetTorusSkew(...)`.

## Background Build Pipeline

### Worker first, async fallback second

Use a Web Worker for the heavy pure work:

```text
src/runtime/worldGeometryWorker.ts
src/runtime/worldGeometryWorkerClient.ts
```

The worker may import pure modules:

- `src/cell-complex/compileCellComplex.ts`
- `src/cell-complex/staticPortalPathCull.ts`
- `src/runtime/worldGeometryDeformations.ts`
- deformation family modules that do not import renderer or DOM code

The worker must not import Three.js renderer modules, DOM code, asset loading,
or anything that calls `document`.

Worker input:

```ts
interface BuildWorldGeometrySnapshotRequest {
  readonly requestId: number;
  readonly baseSpec: CellComplexSpec;
  readonly deformation: WorldDeformationState;
  readonly portalPathOptions: {
    readonly maxDepth: number;
    readonly skipImmediateReverse: boolean;
    readonly toleranceMeters: number;
    readonly maxKeptPathsPerRoot: number;
  };
}
```

The worker should resolve `deformation.kind` through the same pure family
registry as the main thread. It should not contain a switch that is embedded
inside renderer code.

Worker output:

```ts
type BuildWorldGeometrySnapshotResponse =
  | {
      readonly kind: "built";
      readonly requestId: number;
      readonly spec: CellComplexSpec;
      readonly world: CompiledCellComplex;
      readonly staticCull: StaticPortalPathCullResult;
      readonly completedAtMs: number;
    }
  | {
      readonly kind: "failed";
      readonly requestId: number;
      readonly message: string;
    };
```

`Map` values in `CompiledCellComplex` and `StaticPortalPathCullResult` are
structured-clone compatible in modern browsers. If any browser target fails on
structured clone, add serialization helpers that turn maps into entry arrays at
the worker boundary.

If worker creation fails, use a fallback scheduler that chunks work through
`setTimeout` or `requestIdleCallback`. The fallback can initially support only
small deformation steps, because the worker is the intended non-blocking path.

### Drop stale results

The main thread should keep a monotonically increasing request id:

```ts
let latestRequestedGeometryBuildId = 0;
let latestCommittedGeometryBuildId = 0;
```

If response `requestId < latestRequestedGeometryBuildId`, ignore it. This lets
the user drag or step the deformation target while old builds finish out of
order.

### Discrete step scheduler

Use a state machine instead of rebuilding on every slider tick or editor drag:

```ts
interface LiveGeometrySchedulerState {
  readonly current: WorldDeformationState;
  readonly target: WorldDeformationState;
  readonly pending?: WorldDeformationState;
  readonly stepOptions: DynamicGeometryStepOptions;
  readonly minStepIntervalMs: number;
  readonly buildInFlight: boolean;
  readonly lastCommitAtMs: number;
}
```

Default values:

```ts
maxStepMeters = 0.05;
minStepIntervalMs = 1000;
```

Frame/update behavior:

1. If a build is in flight, do nothing.
2. If the target and current deformation states are equivalent within the
   family tolerance, do nothing.
3. If the last commit was too recent, wait.
4. Ask the active deformation family for the next step:

   ```ts
   next = family.nextStep(current, target, stepOptions)
   ```

5. When the build result arrives, install it at the start of the next frame.
6. Repeat until the target is reached.

This gives the user the requested slow deformation while ensuring each rendered
state is internally coherent.

For torus skew, `nextStep(...)` can use:

```text
nextSkew = currentSkew + clamp(targetSkew - currentSkew, -maxStepMeters, maxStepMeters)
```

## Atomic Commit Pipeline

Install a prepared snapshot only at a frame boundary before movement and object
updates.

Suggested function:

```ts
function commitWorldGeometrySnapshot(snapshot: WorldGeometrySnapshot): void
```

Commit steps:

1. Capture old snapshot and old world.
2. Assert the new snapshot is topology-compatible with the old snapshot.
3. Build rebase maps from old deformation state to new deformation state.
4. Rebase `playerPose`.
5. Rebase registry objects that should persist.
6. Rebase dynamic runtime private state or force those runtimes to pull from
   the rebased registry state.
7. Clear geometry-dependent transient tools that are not preserved in the MVP.
8. Replace `activeWorldBundle`.
9. Rebuild cell roots, cell render archetypes, static collision debug roots,
   and warmup views using the new world.
10. Recreate or refresh portal debug helpers so they close over the new path
    tables.
11. Reinstall runtime diagnostics against the new world if diagnostics are
    active.
12. Reparent runtime object roots to the new `cellMeshes`.
13. Recompute visible portal paths and runtime-object portal instances.
14. Render once.

This should be one synchronous main-thread commit. The expensive path-table
computation happens before this point.

## Topology Compatibility Guard

Hot swap only if the topology is unchanged. This guard is generic and should run
for every deformation family. A family may add stricter checks, but it must not
skip the shared guard.

Add a pure guard:

```ts
function assertHotSwappableCellComplex(
  previous: CompiledCellComplex,
  next: CompiledCellComplex,
): void
```

Checks:

- same cell ids in the same order,
- same side counts per cell,
- same portal ids per cell,
- same portal side indices,
- same target cell ids and target portal ids,
- same cell heights unless height deformation is explicitly added later,
- same object ids for authored static/dynamic objects if preserving authored
  objects in place,
- reciprocal portal side lengths equal within tolerance,
- reciprocal portal heights equal within tolerance.

The current compiler does not visibly reject unequal portal side lengths. The
live-deformation path should add this guard before allowing hot swap, because
dynamic portal movement cannot tolerate aperture mismatch.

For general prism-base deformation, this guard is the main safety rail. It lets
the infrastructure accept many shape changes while preventing accidental
topology edits, portal aperture mismatches, and side-index drift.

## Runtime Preservation Policy

### Preserve and rebase

Preserve these by applying the old-to-new deformation map:

- player pose,
- authored dynamic creature runtime state,
- placed signs,
- geodesic emitters if there are no active geodesic segments,
- user-placed non-geodesic runtime objects,
- authored static asset collision objects.

For a runtime object:

```ts
function rebaseRuntimeObjectPose(
  object: RuntimeWorldObject,
  map: CellDeformationMap,
): RuntimeWorldObject
```

This should rebase:

- `localPose.translation`,
- yaw encoded in `localPose.rotation`,
- `aimStickyTarget.localPoint` when present.

### Clear or mark stale in the MVP

Clear these on commit in the first implementation:

- geodesic segment objects,
- geodesic intersection objects,
- measured geodesic length objects,
- protractor angle objects,
- active geodesic cannon edit state,
- active protractor tool state,
- active measurement tool state.

This prevents stale geometry from being presented as current. Later issues can
rebuild geodesic chains from emitters after a deformation.

### Validate after rebase

After rebasing player and objects:

1. Run `testCellCollision(...)` for the player.
2. If blocked by wall or forbidden zone, push inward using side normals where
   possible.
3. If still invalid, move to the new cell center at the old height.
4. For runtime objects, either keep only valid rebased objects or mark invalid
   objects as hidden/disabled with diagnostics.

Because the torus skew steps are small, this should rarely trigger, but it is
important for target jumps and future deformations.

## Renderer Integration Details

### Variables that must become replaceable

In `createThreeApp.ts`, these are currently effectively startup constants and
must become part of the active bundle or be rebuilt on commit:

- `portalStaticCull`
- `archetypeCapacitiesByCellId`
- `warmupViewsByCellId`
- `cellRenderArchetypes`
- `portalInstanceDebugRenderer`
- `portalDebugRuntime`
- `cellMeshes`
- static object collision wireframes
- selectable hitbox debug groups
- aim collision outline debug groups

`portalClipData` and `portalClipMaterialState` can remain alive because the
maximum visible path budget does not change. They should be updated with the
new visible paths after commit.

### Rebuild cell archetypes from new compiled geometry

`buildCellRenderArchetypes(...)` already builds floor, wall, portal frame, and
static object archetypes from a `CompiledCellComplex`.

After commit:

```text
dispose old cell archetypes
build new archetypes with new activeWorld()
attach onBeforeRender clip-state hook
add to scene
syncPortalInstanceRender()
syncRuntimeObjectPortalInstances()
```

### Keep assets loaded

The torus skew does not add or remove assets. It changes geometry only.

Do not call `preloadWorldAssets(...)` on every skew step. Continue using the
existing `PreparedWorldAssets`.

If a future deformation can add/remove cells or objects, it should go through a
separate world reload or an asset-diff preloader. That is out of scope here.

### Warmup views

`createCellWarmupViews(cell)` depends on cell geometry. Recompute it after each
commit:

```ts
warmupViewsByCellId = new Map(
  activeWorld().cells.map((cell) => [cell.id, createCellWarmupViews(cell)] as const),
);
```

For a one-cell torus this is cheap.

### Debug overlays

`portalDebugRuntime` closes over path tables and world data. Dispose and
recreate it after a geometry commit.

Add geometry fields to debug state:

```ts
interface LiveGeometryDebugState {
  readonly version: number;
  readonly deformationKind: WorldDeformationState["kind"];
  readonly current: WorldDeformationState;
  readonly target: WorldDeformationState;
  readonly buildInFlight: boolean;
  readonly lastBuildMs?: number;
  readonly lastCommitMs?: number;
  readonly lastError?: string;
}
```

Expose a temporary console helper:

```ts
window.noneuclidGeometry = {
  SetTorusSkew(skewXMeters: number): void;
  StepTorusSkew(deltaXMeters: number): void;
  Cancel(): void;
  readonly state: LiveGeometryDebugState;
}
```

The debug overlay may display torus-specific convenience fields when
`deformationKind === "torus-skew"`, but the underlying state should remain
generic.

A palette slider or stepper can be added later once the runtime behavior is
safe.

## Suggested Files

New pure files:

```text
src/runtime/worldGeometryDeformations.ts
src/runtime/worldGeometryDeformationFamilies.ts
src/runtime/deformations/torusSkewDeformation.ts
src/runtime/worldGeometrySession.ts
src/runtime/worldGeometryWorker.ts
src/runtime/worldGeometryWorkerClient.ts
tests/runtime/worldGeometryDeformations.test.ts
tests/runtime/torusSkewDeformation.test.ts
tests/runtime/worldGeometrySession.test.ts
```

Potential new renderer/runtime integration helpers:

```text
src/render/three/worldGeometryCommit.ts
tests/render-contract/worldGeometryCommit.test.ts
```

Likely touched files:

```text
src/appState.ts
src/main.ts
src/render/three/createThreeApp.ts
src/render/three/renderState.ts
src/render/three/debugOverlay.ts
src/world-objects/simpleGeoCreature.ts
src/world-objects/geodesciMarmot.ts
src/world-objects/runtimeObjectRegistry.ts
src/glue/debugOptions.ts
src/runtime/runtimeMenuState.ts
src/ui/paletteDefinition.ts
```

Keep the first pass focused. Most implementation risk is in `createThreeApp.ts`
because it currently has many direct `appState.world` reads.

## Implementation Plan

### 1. Add pure deformation contracts and the torus adapter

Create `worldGeometryDeformations.ts` and
`worldGeometryDeformationFamilies.ts` with:

- `WorldDeformationState`,
- `WorldDeformationFamily`,
- `CellDeformationMap`,
- `DynamicGeometryStepOptions`,
- `applyWorldDeformationToSpec(...)`,
- `createCellDeformationMaps(...)`,
- shared point/direction/pose rebase helpers where they are family-neutral.

Then create `deformations/torusSkewDeformation.ts` with:

- `TorusSkewDeformationState`,
- `buildTorusParallelogramVertices(...)`,
- torus-specific `applyToSpec(...)`,
- torus-specific affine `createRebaseMaps(...)`,
- torus-specific `nextStep(...)`.

For the MVP, only support:

```ts
{
  kind: "torus-skew";
  cellId: "torus-room";
  widthMeters: 15;
  depthMeters: 15;
  skewXMeters: number;
}
```

Reject deformation requests if the selected world is not the torus or if the
expected cell/side topology is not present.

Do not put torus-specific checks in the generic session or commit code.

As a small proof that the infrastructure is not torus-only, make the torus
adapter produce or reuse a generic internal representation for convex prism
base edits:

```ts
interface PrismBaseReplacement {
  readonly cellId: string;
  readonly baseVertices: readonly { readonly x: number; readonly y: number }[];
}
```

The public MVP can expose only `torus-skew`, but the pure helper that applies
base replacements should be reusable by later deformation families.

### 2. Add topology and portal compatibility guards

Add tests before wiring the renderer.

Required behavior:

- same torus topology passes,
- changed portal target fails,
- changed portal side index fails,
- changed side count fails,
- reciprocal side length mismatch fails,
- nonconvex deformed base fails through existing validation.

### 3. Add the worker build path

Implement worker and client.

The worker should:

1. resolve the deformation family by `deformation.kind`,
2. apply deformation to the base spec,
3. compile the cell complex,
4. run shared and family-specific hot-swap validation,
5. build statically culled portal path tables,
6. return the compiled snapshot.

The main thread client should:

- use request ids,
- ignore stale results,
- surface errors in debug state,
- fall back gracefully if worker setup fails.

### 4. Refactor `createThreeApp` around an active world bundle

Introduce:

```ts
let activeWorldBundle: ActiveWorldBundle;
const activeWorld = () => activeWorldBundle.snapshot.world;
```

Mechanically replace runtime `appState.world` reads with `activeWorld()` where
the code should see hot-swapped geometry.

Leave the initial `appState.playerPose` and `appState.playerBody` as initial
state. Consider replacing `resetPlayerToHome()` with a stored home pose that is
rebased or recomputed for the current deformation.

### 5. Add atomic commit

Implement `commitWorldGeometrySnapshot(...)` inside `createThreeApp.ts` first,
then extract if it becomes too large.

The commit should:

- update `playerPose`,
- rebase or clear runtime objects by policy,
- replace `activeWorldBundle`,
- rebuild meshes/archetypes/debug helpers,
- sync portal instances,
- sync runtime object instances,
- update diagnostics.

Do not install a partial snapshot.

### 6. Add runtime object rebase hooks

Add a minimal method to dynamic authored runtimes:

```ts
rebaseGeometry(mapByCellId: ReadonlyMap<string, CellDeformationMap>): void;
```

It should update private `state`, registry state, root object transform, and
collision wireframes.

For static/collision-only authored asset objects, add a helper that updates or
rebuilds their registry entries from the newly deformed spec or by applying the
same cell map to the old registry objects.

### 7. Add conservative transient-tool cleanup

On each geometry commit:

- remove geodesic segments,
- remove geodesic intersections,
- remove measured geodesic lengths,
- remove protractor angle objects,
- clear active geodesic/protractor edit state,
- resync runtime object portal instances and hitbox debug.

This can be relaxed later once geodesic rebuild semantics are designed.

### 8. Add a temporary debug control

Expose `window.noneuclidGeometry` only when debugging is enabled or when the
selected world is the torus.

Initial commands:

```text
SetTorusSkew(1.0)
StepTorusSkew(0.05)
Cancel()
state
```

This gives a safe manual test path before adding UI.

### 9. Add UI only after the debug path works

Later UI can be:

- a debug settings slider,
- a pair of step buttons,
- an in-scene palette control once issue 27 lands.

Use a stepper or slider with discrete commit semantics. Do not wire pointer
movement directly to immediate world compilation.

## Tests

### Deformation family tests

```text
tests/runtime/worldGeometryDeformations.test.ts
```

Cover:

- family registry resolves `torus-skew` by kind,
- unknown deformation kinds are rejected clearly,
- generic convex prism base replacement preserves cell ids and portal specs,
- generic hot-swap guard rejects topology edits before renderer code sees them,
- adding a deformation family does not require importing Three.js or DOM code.

### Pure deformation tests

```text
tests/runtime/torusSkewDeformation.test.ts
```

Cover:

- zero skew reproduces the current torus square,
- positive skew produces a convex parallelogram,
- negative skew produces a convex parallelogram,
- side ids and portal ids are unchanged,
- opposite side lengths remain equal,
- lattice-coordinate point rebase preserves `(alpha, beta, z)`,
- yaw rebase maps a vertical-lattice heading into the skewed heading,
- invalid non-torus specs are rejected clearly.

### Compiler/path table tests

Add or extend cell-complex tests:

- compiling a skewed torus yields finite portal transforms,
- crossing side 0 then side 2 is an immediate reverse and still filtered,
- depth-10 static cull completes for a skewed torus under the normal budget,
- no generated transform contains `NaN` or `Infinity`.

### Session/worker tests

```text
tests/runtime/worldGeometrySession.test.ts
```

Cover:

- only one build in flight,
- stale worker responses are ignored,
- target deformation advances through the active family's `nextStep(...)`,
- torus target skew advances by at most `maxStepMeters`,
- failed builds preserve the old committed snapshot,
- cancel prevents further queued steps.

### Runtime rebase tests

Cover:

- player pose rebase stays inside the skewed torus for ordinary positions,
- placed sign pose and yaw are rebased,
- dynamic creature runtime private state and registry state remain aligned,
- invalid rebased pose is repaired or rejected with diagnostics.

### Renderer contract tests

Cover a pure or lightly mocked commit helper where practical:

- committing a snapshot replaces static-cull tables,
- cell archetype capacities are recomputed from the new table,
- old cell archetypes are disposed,
- visible portal paths are recomputed from the new world,
- runtime object portal instances use paths from the new snapshot,
- portal debug state reports the new geometry version.

### Regression tests

Run:

```text
npm.cmd test -- --run
npm.cmd run typecheck
npm.cmd run build
```

The first implementation should also be manually checked in desktop and XR if
XR behavior is reachable, because the render-root/culling-camera path is
cell-id sensitive.

## Acceptance Criteria

- The runtime has a generic dynamic-geometry session that schedules, builds,
  drops stale, and commits deformation snapshots by `WorldDeformationState`
  kind.
- Torus-specific logic lives in a deformation-family adapter, not in renderer,
  movement, or commit code.
- The generic hot-swap guard rejects topology-changing or portal-incompatible
  deformations.
- A future topology-preserving prism-base deformation can reuse the same worker,
  session, commit, and renderer rebuild pipeline.
- In the torus world, a debug command can set a target skew.
- The torus advances toward the target in discrete steps.
- Movement and collision remain responsive while the next step is being
  computed.
- When a step commits, rendering, movement, collision, portal visibility, and
  runtime object portal rendering all use the same compiled-world snapshot.
- Portal pairings remain `0 <-> 2` and `1 <-> 3`.
- Portal transforms are recompiled from the deformed sides.
- Player pose is preserved by material/lattice coordinates, not reset on every
  step.
- Ordinary runtime objects remain visible and collidable after the commit.
- Geometry-dependent transient geodesic/measurement objects are safely cleared
  or marked stale.
- Debug state reports geometry version, deformation kind, current state, target
  state, in-flight build status, and build/commit timing.
- Stale worker results cannot overwrite a newer committed target.
- Existing tests, typecheck, and build pass.

## Non-Goals

- Do not hard-code torus skew into the worker, session, commit pipeline, or
  portal renderer.
- Do not implement every future deformation family in this issue. Build the
  adapter seam and one high-quality torus-skew adapter.
- Do not implement arbitrary nonconvex face deformation.
- Do not deform floors/walls only in the renderer.
- Do not reuse old portal transforms after changing side geometry.
- Do not allow topology changes during hot swap.
- Do not add or remove assets during skew steps.
- Do not support continuous per-frame morphing in the MVP.
- Do not preserve existing geodesic chains across deformation in the MVP.
- Do not introduce a curvature engine or global geodesic solver.

## Follow-Up Work

- Preserve and rebuild geodesic chains across deformation by replaying emitter
  definitions through the new geometry.
- Add a polished UI control after the debug command path is stable.
- Implement a public `affine-prism-cells` deformation family as the second
  adapter after torus skew.
- Implement a carefully tested `prism-base-vertices` family for editor-driven
  convex polygon deformation.
- Support additional torus deformations, such as independent width/depth
  changes, with side-length compatibility checks.
- Generalize from the torus parallelogram to per-cell affine deformations.
- Add worker-side progress reporting by root cell and depth.
- Add a visual pending/committed indicator in the debug overlay.

## Notes For Future Implementers

The safe mental model is:

```text
compiled world snapshot is immutable
live runtime owns exactly one active snapshot
expensive next snapshot builds in the background
commit swaps the whole snapshot and rebases runtime state
```

If an implementation can only build or commit `"torus-skew"` because the worker,
session, or renderer knows that specific kind by name, it has missed the main
infrastructure requirement. The generic parts should know about deformation
states and family adapters; only the adapter should know the torus formula.

Avoid piecemeal mutation of `CompiledPrismCell.baseVertices`,
`CompiledPrismSide`, or `CompiledPortal.transformToTarget`. Those values are
derived together and should stay together.

The most important implementation discipline is snapshot coherence. During any
single frame, movement, collision, portal paths, portal clip polygons, static
archetype instances, runtime object instances, and debug helpers should all read
from the same active world version.
