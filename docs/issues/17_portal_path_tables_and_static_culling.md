# 17 - Portal path tables, static culling, and debug inspection

## Goal

Implement the first two milestones from [docs/design/006-non-euclidean-renderer-general-01.md](../design/006-non-euclidean-renderer-general-01.md):

1. keep `compileCellComplex(...)` as the authoritative compiled world contract,
2. add `buildPortalPathTables(...)`,
3. add `staticallyCullPortalPathTables(...)`.

This issue stops before instanced rendering and shader clipping. The outcome should be a tested, inspectable path-data layer that later renderer work can consume without re-deriving topology or portal transforms.

## Background

The recursive portal renderer design is:

```text
compiled cell complex
  -> precomputed portal path tables
  -> conservative static path pruning
  -> per-frame camera-visible path list
  -> compact instance buffers
  -> shader-clipped instanced rendering
```

This issue owns only the first three steps. The path table must preserve distinct visual images of the same destination cell when they are reached through different portal paths. It must use the compiled portal transforms that movement already uses.

## Milestone 1: compiled world contract and path tables

### 1. Confirm `compileCellComplex(...)` provides required runtime data

Review [src/cell-complex/compileCellComplex.ts](../../src/cell-complex/compileCellComplex.ts), [src/cell-complex/prismCells.ts](../../src/cell-complex/prismCells.ts), and [src/cell-complex/specs.ts](../../src/cell-complex/specs.ts). Do not add rendering-specific behavior to the compiler, but make sure the compiled contract exposes enough data for path construction:

- stable cell ids,
- `cellsById`,
- compiled cell side geometry,
- compiled portal ids and side indices,
- target cell and target portal ids,
- `transformToTarget` for each compiled portal,
- reciprocal portal lookup for immediate-reverse detection.

If any of these are missing or awkward to consume, extend the compiled contract in a small renderer-neutral way and cover that with compiler tests.

### 2. Add `src/cell-complex/portalPaths.ts`

Implement a pure cell-complex module with no Three.js imports.

Suggested public API:

```ts
export interface BuildPortalPathTablesOptions {
  readonly maxDepth: number;
  readonly skipImmediateReverse: boolean;
}

export interface PortalPathTablesByRootCell {
  readonly maxDepth: number;
  readonly tablesByRootCellId: ReadonlyMap<string, PortalPathTable>;
}

export interface PortalPathTable {
  readonly rootCellId: string;
  readonly maxDepth: number;
  readonly paths: readonly PortalRenderPath[];
  readonly pathsById: ReadonlyMap<number, PortalRenderPath>;
  readonly pathsByDestinationCellId: ReadonlyMap<string, readonly PortalRenderPath[]>;
  readonly pathsByParentPathId: ReadonlyMap<number, readonly PortalRenderPath[]>;
}

export interface PortalRenderPath {
  readonly id: number;
  readonly rootCellId: string;
  readonly destinationCellId: string;
  readonly depth: number;
  readonly parentPathId?: number;
  readonly steps: readonly PortalRenderStep[];
  readonly destinationFromRoot: RigidTransform3;
  readonly rootFromDestination: RigidTransform3;
}

export interface PortalRenderStep {
  readonly sourceCellId: string;
  readonly sourcePortalId: string;
  readonly targetCellId: string;
  readonly targetPortalId: string;
}

export function buildPortalPathTables(
  world: CompiledCellComplex,
  options: BuildPortalPathTablesOptions,
): PortalPathTablesByRootCell;
```

The exact TypeScript shape can follow existing math types, but the concepts above should remain visible.

### 3. Enumeration rules

Build one table per root cell. Each table must contain a depth-0 path:

```text
rootCellId = destinationCellId
depth = 0
steps = []
destinationFromRoot = identity
rootFromDestination = identity
```

Expand breadth-first until `maxDepth`. For each child path:

- source cell is the parent destination cell,
- source portal is one compiled portal on that cell,
- target cell and target portal come from the compiled portal,
- `destinationFromRoot` composes the new portal transform with the parent transform,
- `rootFromDestination` is the inverse of `destinationFromRoot`,
- `parentPathId` points to the parent path.

When `skipImmediateReverse` is true, skip the portal that directly returns through the previous step's target portal. This should be based on compiled portal ids and target metadata, not string guessing.

### 4. Milestone 1 tests

Add `tests/cell-complex/portalPaths.test.ts`.

Cover:

- every root cell gets a table,
- every table has exactly one depth-0 path,
- depth-1 path count matches outgoing portal count,
- immediate reverse paths are skipped when enabled,
- immediate reverse paths are present when disabled,
- distinct paths to the same destination cell are preserved,
- `rootFromDestination` and `destinationFromRoot` are inverses,
- path ids are stable and unique within a table,
- parent ids refer to earlier paths,
- cube world builds to depth 10 without NaN transforms.

Avoid testing private loop structure.

## Milestone 2: static portal path culling

### 1. Add `src/cell-complex/staticPortalPathCull.ts`

Implement a second pure cell-complex module with no Three.js imports.

Suggested public API:

```ts
export interface StaticPortalPathCullOptions {
  readonly toleranceMeters: number;
  readonly maxKeptPathsPerRoot?: number;
  readonly keepRejectedPathDetails: boolean;
}

export interface StaticPortalPathCullResult {
  readonly tables: PortalPathTablesByRootCell;
  readonly summariesByRootCellId: ReadonlyMap<string, StaticPortalPathCullSummary>;
}

export interface StaticPortalPathCullSummary {
  readonly rootCellId: string;
  readonly inputPathCount: number;
  readonly keptPathCount: number;
  readonly rejectedPathCount: number;
  readonly rejectedByReason: ReadonlyMap<StaticPortalPathRejectReason, number>;
  readonly rejectedPaths: readonly RejectedPortalRenderPath[];
}

export type StaticPortalPathRejectReason =
  | "outside-ancestor-portal-plane"
  | "outside-ancestor-portal-slab"
  | "outside-ancestor-vertical-range"
  | "static-path-budget";

export interface RejectedPortalRenderPath {
  readonly pathId: number;
  readonly reason: StaticPortalPathRejectReason;
  readonly details?: string;
}

export function staticallyCullPortalPathTables(
  world: CompiledCellComplex,
  pathTables: PortalPathTablesByRootCell,
  options: StaticPortalPathCullOptions,
): StaticPortalPathCullResult;
```

Immediate-reverse filtering belongs in path enumeration, not in this culling result, unless a later implementation needs a diagnostic-only mode that reports reverse skips.

### 2. Conservative culling rule

Static culling may keep too much, but it must not reject any path that can be visible.

For each candidate path:

- keep all depth-0 paths,
- compute a conservative prism bound for the destination cell using all floor and ceiling base vertices,
- transform that bound into root-cell coordinates with `rootFromDestination`,
- compare the entire transformed bound against every ancestor portal aperture required by the path,
- reject only when the whole bound is outside a required half-space, slab, or vertical range,
- never reject from a single center point, floor point, or decoration point.

If the conservative math is not ready, ship a no-op culler that returns all paths plus summaries. The public API and tests should still exist so later culling can be added behind the same contract.

### 3. Static culling summaries

The culling result should preserve the same path ids for kept paths. It should also expose enough summary data for debug UI and dev-console helpers:

- total candidate paths,
- kept paths,
- rejected paths,
- rejection counts by reason,
- optional rejected path details when `keepRejectedPathDetails` is true.

### 4. Milestone 2 tests

Add `tests/cell-complex/staticPortalPathCull.test.ts`.

Cover:

- depth-0 paths are never removed,
- culling preserves path ids for kept paths,
- ambiguous bounds are kept,
- impossible bounds are rejected once geometric rejection is implemented,
- rejection summaries count reasons correctly,
- `maxKeptPathsPerRoot` reports `"static-path-budget"` instead of silently truncating,
- empty or no-op culling still returns a well-formed table and summary.

## Debug menu and dev-console inspection

Add debug options in [src/glue/debugOptions.ts](../../src/glue/debugOptions.ts) and wire them through the existing launch/debug controls:

- `portal-path-debug`: enable path-table summaries and dev-console helpers,
- `portal-static-cull-debug`: include static-cull summaries and rejected-path details,
- `portal-path-overlays`: allow temporary visual overlays created by path helper functions.

The flags should be available only when debug level is not `off`, consistent with existing `hasActiveDebugOption(...)` behavior.

### Debug state

Add a renderer-neutral debug state module if needed, for example:

```text
src/cell-complex/portalPathDebug.ts
```

It should expose:

- current root cell id,
- configured max depth,
- candidate path count,
- kept path count after static culling,
- rejected path count by reason,
- maximum available path depth,
- whether the static path budget was exhausted.

The renderer overlay can show a compact version later, but this issue should at least make the state available for tests and console helpers.

### Dev-console helper functions

When `portal-path-debug` is active, install a small namespaced helper object on `window`. Prefer a namespace such as `window.noneuclidPortalDebug` rather than several unrelated globals.

Required helpers:

```ts
CheckCellPath(path: string): PortalPathCheckResult;
ShowCellPath(path: string): PortalPathOverlayResult;
HideCellPaths(): void;
```

The path string is a sequence of space-separated portal side numbers or portal indices, interpreted from the current root cell. For example:

```text
"0 2 3"
```

`CheckCellPath(...)` should report:

- whether the string parses,
- whether each step exists from the current path destination,
- the resulting destination cell id,
- the matched path id if present,
- whether that path exists in the built table,
- whether it survived static culling,
- if culled, the rejection reason when available.

`ShowCellPath(...)` should:

- call `CheckCellPath(...)`,
- refuse invalid or culled paths with a clear result object,
- draw the destination cell floor transformed by `rootFromDestination`,
- use a bright red debug material,
- name created Three.js objects with a stable prefix such as `debug-cell-path-overlay:`,
- return the path id and object count.

`HideCellPaths()` should remove all objects created by `ShowCellPath(...)` and dispose their debug geometry/materials where appropriate.

The implementation can live in renderer code because it draws Three.js overlays, but path validation should call pure helper functions from the path-table layer so it can be tested without WebGL.

### Helper function testing

Add tests for the pure parsing and checking logic. Browser-global installation and actual Three.js drawing can be covered by a narrow renderer-contract test or left as a manual debug acceptance item if the current test harness cannot exercise it cleanly.

## Integration plan

Startup should eventually look like:

```ts
const world = compileCellComplex(spec);
const portalPathTables = buildPortalPathTables(world, {
  maxDepth: 10,
  skipImmediateReverse: true,
});
const staticCull = staticallyCullPortalPathTables(world, portalPathTables, {
  toleranceMeters: 1e-6,
  keepRejectedPathDetails: hasActiveDebugOption(debugLevel, debugOptions, "portal-static-cull-debug"),
});
```

For this issue, it is acceptable to build the tables lazily or only behind `portal-path-debug` if startup cost is a concern. The pure modules and tests should not depend on the renderer being active.

## Acceptance criteria

This issue is complete when:

- `compileCellComplex(...)` exposes the compiled portal data needed by path tables without renderer-specific coupling,
- `buildPortalPathTables(...)` exists in a pure cell-complex module,
- path tables are generated per root cell up to configurable depth,
- path ids, parent links, destination cells, and accumulated transforms are inspectable,
- immediate reverse skipping is implemented and tested,
- `staticallyCullPortalPathTables(...)` exists in a pure cell-complex module,
- static culling returns kept tables plus rejection summaries,
- no-op conservative culling is acceptable only if the API and summary tests are in place,
- debug flags for portal path inspection are defined,
- `CheckCellPath(...)`, `ShowCellPath(...)`, and `HideCellPaths()` are planned or implemented behind debug flags,
- tests cover path enumeration, culling summaries, and pure path-checking behavior,
- `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build` pass.

## Out of scope

Do not implement these in this issue:

- camera-visible path projection,
- recursive aperture clipping,
- instanced floor/wall rendering,
- shader clip materials,
- dynamic object portal copies,
- replacement of the current portal visual mode.

Those belong to later renderer milestones after the path-data layer is stable.
