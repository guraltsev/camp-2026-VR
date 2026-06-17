# 29 - Non-orientable worlds via orientation double cover

## Goal

Support non-orientable side identifications, such as a Mobius strip-style flipped edge glue, without forcing reflected transforms through every movement, rendering, and object-orientation path.

The user-facing behavior should be:

- authors can mark a portal identification as orientation-reversing,
- walking through a flipped seam changes the player's local handedness sheet,
- after traveling around a non-orientable loop, positions and figures appear mirrored relative to the original local orientation,
- ordinary orientable worlds such as the torus, cube, and Platonic examples continue to behave exactly as they do today.

Use the **orientation double cover** as the implementation model. Internally, a non-orientable world is expanded into two oriented copies of every cell. Flipped portals move between the copies. Orientation-preserving portals stay within the same copy.

## User Model

For authors and players, the intended model is:

```text
normal portal -> same orientation
flipped portal -> crossed into mirrored orientation
two flipped crossings -> original orientation again
```

For a one-room Mobius strip:

```text
rectangle with one flipped edge pair
  -> compiler expands it into two rectangles
  -> flipped seam connects sheet A to sheet B
  -> crossing again returns sheet B to sheet A
```

The player should not see two unrelated worlds. The double cover is an internal implementation detail that lets the engine use ordinary orientation-preserving transforms while representing a non-orientable quotient.

## Terminology

Use these terms consistently:

- `base cell`: the authored cell before orientation-cover expansion.
- `cover cell`: one of the internal oriented copies of a base cell.
- `orientation sheet`: the two cover states, recommended ids `positive` and `negative`, or `0` and `1`.
- `orientation-preserving portal`: a side identification that keeps the player on the same sheet.
- `orientation-reversing portal`: a side identification that crosses to the other sheet.
- `quotient world`: the mathematical/non-orientable world the player is meant to experience.
- `orientation double cover`: the internal orientable world used for simulation and most rendering.

Avoid naming the feature only `mobius`. Mobius strip is the easiest example, but the same mechanism should support a flipped torus/Klein-bottle-style quotient and other non-orientable identifications.

## Why Use The Double Cover

The current codebase is close to supporting matrix reflections in some places, but not everywhere.

Important current facts:

- `src/cell-complex/compilePortalTransforms.ts` derives orientation-preserving portal transforms by mapping source tangent to reversed target tangent, keeping up fixed, and mapping source outward to target inward.
- `src/math/rigidTransform3.ts` stores a `Mat3` plus translation, so it can mathematically represent improper transforms.
- `src/movement/playerPose.ts` stores player orientation as `yawRadians` and reconstructs it with `Math.atan2(...)`; a mirrored orientation cannot be represented by one yaw angle.
- `src/render/three/worldAxes.ts` has `applyWorldRigidTransform(...)`, which converts matrix rotation into a quaternion; quaternions cannot represent reflections.
- portal path composition in `src/cell-complex/portalPaths.ts` is matrix-based and should work well for the cover once transforms are ordinary rotations/translations.

The double-cover implementation avoids pushing negative-determinant matrices through player pose, XR camera rigs, object roots, and quaternion helpers. The simulation remains orientable; non-orientability is represented by sheet switching.

## Authoring API

Extend the world authoring model so a side identification can specify whether it reverses orientation.

Recommended script API:

```js
Portal("room", 0, "room", 2);
FlippedPortal("room", 1, "room", 3);
```

Alternative acceptable API:

```js
Portal("room", 1, "room", 3, { orientation: "reversing" });
```

Choose the smaller change that fits `compileWorldScript` and `worldBuilder`.

Recommended TypeScript shape:

```ts
export type PortalOrientation = "preserving" | "reversing";

export interface AuthoredPortalSpec {
  readonly id: string;
  readonly sideIndex: number;
  readonly targetCellId: string;
  readonly targetPortalId: string;
  readonly orientation?: PortalOrientation;
}
```

Default missing `orientation` to `"preserving"` so existing worlds and tests do not need to change.

When a portal is created reciprocally by the builder, both directions must have the same orientation label. A flipped identification is orientation-reversing in both directions.

## Example Worlds

Add at least one starter/test world for the feature.

Recommended first example:

```text
mobius-strip
one square or rectangle cell
one opposite side pair glued with orientation: "reversing"
the other side pair remains solid wall/boundary
```

This is topologically a Mobius strip with boundary.

Optional second example:

```text
flipped-torus
one square cell
one side pair preserving
one side pair reversing
```

This is not literally a torus; it is a closed non-orientable quotient in the Klein-bottle family. Name it carefully in user-facing labels, for example `Klein bottle room` or `flipped torus / Klein bottle demo`.

## Compiler Architecture

Add a compiler expansion step that converts authored cells into cover cells before the usual portal transform/path/render pipeline.

Recommended staged shape:

```text
CellComplexSpec with authored portal orientation
  -> expandOrientationDoubleCover(...)
  -> ordinary CellComplexSpec containing only orientation-preserving cover cells
  -> existing compileCellComplex(...)
```

This keeps most existing code ignorant of non-orientability.

Recommended file:

```text
src/cell-complex/orientationDoubleCover.ts
```

Suggested API:

```ts
export type OrientationSheet = "positive" | "negative";

export interface OrientationCoverMetadata {
  readonly baseCellId: string;
  readonly sheet: OrientationSheet;
}

export interface OrientationDoubleCoverResult {
  readonly spec: CellComplexSpec;
  readonly coverCellMetadataById: ReadonlyMap<string, OrientationCoverMetadata>;
  readonly coverCellIdByBaseCellAndSheet: ReadonlyMap<string, string>;
}

export function expandOrientationDoubleCover(spec: CellComplexSpec): OrientationDoubleCoverResult;
```

Cover cell ids should be deterministic and readable. Examples:

```text
torus-room#positive
torus-room#negative
```

or:

```text
torus-room::sheet-0
torus-room::sheet-1
```

Prefer an id format that cannot collide with normal author ids, or validate and reject author ids that use the reserved separator.

## Portal Expansion Rules

For each authored cell `C`, create:

```text
C positive
C negative
```

For each authored portal from `C` to `D`:

If orientation-preserving:

```text
C positive -> D positive
C negative -> D negative
```

If orientation-reversing:

```text
C positive -> D negative
C negative -> D positive
```

The reciprocal portal ids must also be rewritten to target the matching cover portal ids.

Recommended deterministic portal id convention:

```text
side-1#positive
side-1#negative
```

or keep the portal id the same inside each cover cell if portal ids only need to be unique within a cell. Keeping the id the same is simpler if no cross-cell global portal-id assumption exists.

## Transform Semantics

Inside the expanded cover, every portal transform should remain orientation-preserving.

Do not generate reflected `Mat3` transforms as the first implementation. The whole point of the cover is:

```text
orientation reversal in quotient
  == sheet switch in cover
  + ordinary orientation-preserving local transform
```

The existing `derivePortalTransform(...)` should continue to be used for all cover portals.

If a later feature needs true reflected rendering in the quotient projection, isolate it in presentation helpers instead of changing movement poses to negative-determinant transforms.

## Player Pose And Sheet

The first implementation can encode sheet in `cellId` by using cover cell ids. That keeps `PlayerPose` unchanged:

```ts
interface PlayerPose {
  readonly cellId: string; // now a cover cell id for expanded worlds
  readonly position: Vec3;
  readonly yawRadians: number;
  readonly pitchRadians: number;
}
```

This is the lowest-risk path.

Add metadata helpers so debug UI and future features can map cover cells back to base cells:

```ts
getBaseCellId(compiledWorld, coverCellId): string
getOrientationSheet(compiledWorld, coverCellId): OrientationSheet | undefined
getOppositeSheetCellId(compiledWorld, coverCellId): string | undefined
```

If changing `CompiledCellComplex` is too invasive, store the metadata in a small wrapper returned by world selection/catalog code. Do not parse cover ids ad hoc throughout the app.

## Runtime Objects

For a first implementation, runtime objects may live in cover cells.

Rules:

- placing an object while in `room#positive` stores it in `room#positive`,
- crossing a flipped portal does not mutate existing objects into the other sheet,
- object portal visibility follows the existing cover-cell portal rendering.

This produces a correct simulation in the orientation double cover. It may show two cover copies of an object as distinct if the player can see both through portals. That is acceptable for the first milestone if documented in debug/testing, but the desired quotient experience eventually needs object identity projection.

Recommended first milestone:

```text
simulate cover objects literally
ensure mirrored traversal works
do not try to merge object identities across sheets yet
```

Recommended follow-up:

```text
quotient object presentation
one authored/base object can render on both sheets with mirrored relationship
interactions resolve back to one quotient object id
```

## Rendering Model

The initial implementation should render the expanded cover through the existing portal instance renderer.

This should work because:

- cover portals use ordinary rigid transforms,
- `PortalRenderPath` composition remains orientation-preserving,
- cell archetypes and runtime object archetypes already render per destination cell.

However, there are two distinct rendering goals:

### Milestone 1: Cover-Correct Rendering

Render the orientation double cover as an orientable world.

Acceptance:

- crossing a flipped seam switches to the other cover cell,
- portal views continue to render,
- returning through a second flipped crossing returns to the original sheet,
- existing quaternion-based object/root helpers are not given reflected matrices.

This is the recommended scope for the first PR.

### Milestone 2: Quotient-Mirrored Presentation

Render cover sheets as two presentations of the same physical quotient world.

In this model, objects and positions on the opposite sheet should appear mirrored relative to the current local orientation.

Do not attempt this until Milestone 1 is stable. It may require:

- per-path sheet metadata,
- quotient object ids distinct from cover instance ids,
- mirror-aware picking,
- mirror-aware labels/debug overlays,
- careful handling of text and asymmetric models.

## World Catalog Integration

Do not force all worlds to double in size if they are orientable.

Recommended behavior:

- if a world has no orientation-reversing portals, compile it normally,
- if a world has at least one orientation-reversing portal, expand the double cover before compilation.

Add helper:

```ts
hasOrientationReversingPortal(spec): boolean
prepareWorldForCompilation(spec): PreparedCellComplexSpec
```

The prepared result should carry metadata when expansion occurred.

Potential files:

- `src/authoring/exampleWorlds.ts`
- `src/authoring/worldCatalog.ts`
- `src/cell-complex/compileCellComplex.ts`
- `src/cell-complex/orientationDoubleCover.ts`

Avoid scattering expansion calls in renderer or movement code.

## Validation

Extend `validateAuthoringSpec(...)` to check:

- `orientation` is missing, `"preserving"`, or `"reversing"`,
- reciprocal portals agree about orientation,
- reserved cover id separators are not used by authored cell ids if the expansion uses those separators,
- flipped portals are still valid reciprocal side identifications.

Do not reject a world only because it is non-orientable.

Add clear errors such as:

```text
Portal "room:side-1" has invalid orientation "flipped"; expected "preserving" or "reversing".
Portal "room:side-1" and reciprocal "room:side-3" disagree about orientation.
Cell id "room#positive" uses reserved orientation-cover suffix.
```

## Debug UI

Update debug descriptions enough that developers can see what is happening.

Recommended debug additions:

- show base cell id and orientation sheet in the debug overlay,
- show cover cell id in verbose/debug modes,
- add a geometry description line indicating whether the world was orientation-cover expanded.

Example:

```text
cell mobius-room
sheet negative
cover cell mobius-room#negative
```

Avoid exposing cover ids prominently in normal classroom/player UI.

## Geodesic And Tool Behavior

Geodesic tools should work in the cover in the first implementation.

Because cover portal transforms are orientation-preserving:

- `traceGeodesicSegment` can transform directions through portals exactly as today,
- geodesic segment objects can live in cover cells,
- portal-hit terminal metadata should store cover cell ids.

Do not add special geodesic mirroring logic in the first pass.

If quotient-level geodesic identity becomes important later, add it after runtime object quotient projection exists.

## Tests

Add focused tests before touching renderer integration.

### Authoring Tests

- `FlippedPortal(...)` creates reciprocal portal specs with `orientation: "reversing"`.
- `Portal(...)` continues to default to preserving orientation.
- invalid orientation values are rejected.
- reciprocal orientation mismatch is rejected.
- existing world scripts still compile unchanged.

### Double Cover Tests

For a one-cell Mobius strip spec:

- expansion creates exactly two cover cells,
- each cover cell has the same base vertices and visuals as the source cell,
- the flipped side in sheet positive targets sheet negative,
- the flipped side in sheet negative targets sheet positive,
- non-glued sides remain non-portals,
- metadata maps each cover cell back to the same base cell with different sheets.

For an orientable torus:

- `hasOrientationReversingPortal(...)` returns false,
- compilation can skip expansion,
- existing torus transform tests remain unchanged.

For a mixed flipped/preserving one-cell square:

- preserving portal keeps sheet,
- reversing portal changes sheet,
- two reversing crossings return to the original sheet.

### Movement Tests

- moving through a preserving portal keeps the orientation sheet,
- moving through a reversing portal changes the orientation sheet,
- moving through two reversing portal crossings returns to the original sheet,
- yaw remains a normal finite angle after every crossing,
- existing `movePlayer` tests still pass for orientable examples.

### Portal Path Tests

- portal path tables include paths into both sheets for a non-orientable world,
- path transforms are invertible and orientation-preserving,
- immediate reverse skipping still works for cover portals,
- static portal culling does not throw on expanded cover worlds.

### Rendering Contract Tests

Keep these pure where possible:

- `rigidTransformToThreeMatrix(...)` is only given orientation-preserving cover transforms for non-orientable examples,
- visible portal paths can be computed for a Mobius cover world,
- cell render archetype capacities are derived for both cover cells,
- runtime object portal instances can render an object in each cover sheet.

### Regression Tests

- existing torus tests pass unchanged,
- cube, tetrahedron, octahedron, dodecahedron, and icosahedron examples compile,
- existing movement/collision tests pass,
- existing runtime object portal rendering tests pass.

## Implementation Plan

### 1. Add portal orientation to specs

Update:

- `src/cell-complex/specs.ts`,
- `src/authoring/worldBuilder.ts`,
- `src/authoring/compileWorldScript.ts` if needed,
- `src/authoring/validateAuthoringSpec.ts`,
- authoring tests.

Default all existing portals to preserving orientation.

### 2. Add the script API

Add `FlippedPortal(...)` or an options parameter to `Portal(...)`.

Prefer keeping the normal `Portal(...)` call unchanged. If both APIs are easy, support:

```js
FlippedPortal("room", 1, "room", 3);
Portal("room", 1, "room", 3, { orientation: "reversing" });
```

Tests should make clear which API is primary.

### 3. Implement orientation double cover expansion

Create `src/cell-complex/orientationDoubleCover.ts`.

Implement:

- `hasOrientationReversingPortal(...)`,
- `expandOrientationDoubleCover(...)`,
- metadata maps,
- deterministic cover ids,
- reserved id validation helper if needed.

Keep this module free of Three.js and renderer imports.

### 4. Integrate expansion into world preparation

Choose one central place where authored specs become compiled worlds.

Good options:

- inside `compileCellComplex(...)`, returning metadata on `CompiledCellComplex`,
- or just before calls to `compileCellComplex(...)` in world catalog/example preparation.

Prefer the option that minimizes renderer/movement changes while still keeping metadata available for debug UI.

Do not require callers to remember to expand manually for non-orientable worlds.

### 5. Add Mobius example world

Add a world script, for example:

```text
src/examples/mobius.world.js
```

Add it to the world catalog with a clear label:

```text
Mobius strip
```

Use ASCII `Mobius` in filenames and identifiers. User-facing labels may use `Mobius` too for consistency with the repo's ASCII convention.

The first example can be a rectangle with:

- one flipped portal pair,
- two solid boundary walls,
- a few asymmetric objects so mirroring/sheet behavior is visually obvious.

Use existing assets and object-library helpers. Do not add new art.

### 6. Update movement and debug display

Movement should mostly work automatically because the player crosses to a different cover cell id.

Add tests proving sheet transitions.

Update debug overlay or geometry description to show:

- base cell id,
- sheet,
- cover cell id in verbose/debug mode.

Keep normal UI labels friendly.

### 7. Verify portal rendering on the cover

Run the existing render-contract tests and add a small contract test for visible paths/archetype capacity in the Mobius example.

If static portal culling has assumptions that break due to duplicated cells or loop structure, fix the assumptions in the culling/path code rather than bypassing portal rendering for non-orientable worlds.

### 8. Document limitations and follow-ups

Add a short note in design docs or the issue closeout:

```text
Milestone 1 simulates and renders the orientation double cover.
True quotient object identity/mirrored presentation is a later feature.
```

Do not overpromise that all models are a single mirrored physical object in the first implementation unless quotient projection is actually implemented.

## Likely Files

Likely new files:

- `src/cell-complex/orientationDoubleCover.ts`
- `src/examples/mobius.world.js`
- `tests/cell-complex/orientationDoubleCover.test.ts`

Likely touched files:

- `src/cell-complex/specs.ts`
- `src/cell-complex/compileCellComplex.ts`
- `src/cell-complex/compilePortalTransforms.ts` only if tests need comments or orientation defaults; avoid changing transform derivation for cover portals
- `src/authoring/worldBuilder.ts`
- `src/authoring/compileWorldScript.ts`
- `src/authoring/validateAuthoringSpec.ts`
- `src/authoring/exampleWorlds.ts`
- `src/authoring/worldCatalog.ts`
- `src/cell-complex/describeGeometry.ts`
- `src/render/three/debugOverlay.ts`
- `tests/authoring/worldBuilder.test.ts`
- `tests/authoring/exampleWorlds.test.ts`
- `tests/cell-complex/compileCellComplex.test.ts`
- `tests/cell-complex/portalPaths.test.ts`
- `tests/movement/movePlayer.test.ts`
- `tests/render-contract/visiblePortalPaths.test.ts`

## Non-Goals

- Do not implement true reflected `RigidTransform3` portal crossing in this issue.
- Do not replace `PlayerPose.yawRadians` with a full orientation matrix in this issue.
- Do not make quaternions represent reflections.
- Do not implement quotient-level object identity in the first milestone.
- Do not create a special renderer path only for Mobius worlds.
- Do not add new assets.
- Do not implement curved embedded surfaces. This app models glued cell complexes, not a smooth 3D embedded Mobius band.
- Do not solve global shortest paths or global topology classification.

## Acceptance Criteria

- Authors can create an orientation-reversing side identification.
- Existing `Portal(...)` calls continue to mean orientation-preserving.
- Existing orientable examples compile and behave unchanged.
- A Mobius-strip example world appears in the world catalog.
- Non-orientable worlds are expanded into two cover cells per authored cell.
- Reversing portals switch orientation sheet in the expanded world.
- Preserving portals keep orientation sheet in the expanded world.
- Movement through a flipped seam changes the player's cover cell/sheet.
- Two flipped seam crossings return the player to the original sheet.
- Player yaw remains finite and behaves normally because movement uses ordinary cover transforms.
- Portal path tables and visible portal path computation work on the expanded cover.
- Runtime object rendering does not receive reflected matrices as part of the first implementation.
- Debug output can show base cell id and orientation sheet.
- Automated tests cover authoring, expansion, movement, and portal paths for the Mobius example.

## Follow-Up Ideas

- Quotient object identity: one logical object rendered on both sheets with mirrored presentation.
- Mirror-aware picking so selecting a mirrored instance selects the same quotient object.
- Mirror-aware text/sign rendering options, since text mirroring may be pedagogically useful or confusing depending on the lesson.
- A Klein-bottle-style closed flipped square example.
- A debug visualization that colors orientation sheets differently.
- A topology lesson panel explaining why two trips around the Mobius loop return to the original orientation.
- Optional true reflected-transform support for specialized renderer/debug views, isolated from player pose.

## Notes For LLM Devs

Do not start by adding negative scale or reflected matrices to Three.js object roots. That path will collide with quaternions, `PlayerPose.yawRadians`, XR rig assumptions, and helper functions that decompose matrices.

Use the orientation double cover:

```text
authored non-orientable quotient
  -> two oriented cover copies
  -> flipped portals switch sheets
  -> existing orientable engine machinery
```

Keep the first implementation honest about what it provides. A cover simulation is the right foundation and is already useful for walking around non-orientable identifications. A fully quotient-projected presentation where all models are one mirrored identity is a later layer.

When in doubt, preserve existing orientable behavior. The torus tests are the canary: normal side identifications should keep producing the same translations and rotations as before.
