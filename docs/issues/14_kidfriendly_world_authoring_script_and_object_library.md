# 14 - Kidfriendly world authoring script and object library

## Goal

Make example worlds easier to author by replacing TypeScript object-literal plumbing with a small procedural authoring script.

The author-facing syntax should read like construction notes:

- define polygon faces,
- glue face edges with portals,
- create named objects,
- place those objects on faces.

The runtime should still receive an ordinary checked `CellComplexSpec`, and the existing cell-complex compiler, movement code, renderer, and tests should continue to consume the same runtime contracts.

## Motivation

Now that portal transforms are compiled from side identifications, authored prism worlds no longer need to encode runtime seam math.

Files like [src/cell-complex/examples/cube.ts](../../src/cell-complex/examples/cube.ts) should not need helper functions such as `cubeFace(...)`, explicit `AuthoredPortalSpec` construction, hand-built asset paths, or object imports. The world file should be suitable for a teacher or student to read and modify without understanding TypeScript module mechanics.

The target is not a full visual editor. The target is a small script format that is friendly enough for classroom use while still compiling into the existing validated world model.

## Target authoring syntax

Prefer a trusted JavaScript-like world script over a normal imported TypeScript module.

The script should be procedural:

```js
square = [
  [-7.5, -7.5],
  [7.5, -7.5],
  [7.5, 7.5],
  [-7.5, 7.5],
];

PolygonFace("front", "#d95f5f", square);
PolygonFace("right", "#4f9d69", square);
PolygonFace("back", "#5f79d9", square);
PolygonFace("left", "#d9b44f", square);
PolygonFace("top", "#8f6ed5", square);
PolygonFace("bottom", "#4fb8c7", square);

Portal("front", [0, 1], "bottom", [2, 3]);
Portal("front", [1, 2], "right", [0, 3]);
Portal("front", [2, 3], "top", [0, 1]);
Portal("front", [0, 3], "left", [1, 2]);

house1 = house("front-house", {
  position: [-1.2, 0, 0.6],
  scale: 3,
  yaw: 0.2,
});

marmot = geodesic_marmot("front-runner", {
  position: [-4.2, 0, -1.8],
  scale: 1.05,
  velocity: [2.3, 0.65],
});

OnFace("front", [house1, marmot]);

clock1 = clock("right-clock", {
  position: [0.8, 0, -0.5],
  scale: 2,
  yaw: -0.35,
});

OnFace("right", [clock1]);
```

This is the desired authoring feel:

- no imports in the world script,
- no callback lambdas,
- no destructuring of a library object,
- no hand-authored portal ids,
- no raw asset paths in world files,
- no direct `CellComplexSpec` object literals in beginner-facing examples.

The implementation may still keep TypeScript versions of examples during migration, but the new authoring path should be the preferred syntax for classroom-facing worlds.

## Script globals

The authoring script should execute in a deliberately provided context. It should have access to only the intended authoring functions and object constructors.

Required face and topology globals:

- `PolygonFace(name, color, vertices)`
- `Portal(face1, edge1, face2, edge2)`
- `OnFace(faceName, objects)`

Required object constructor globals:

- `house(name, params)`
- `clock(name, params)`
- `campfire(name, params)`
- `tree(name, params)`
- `rocks(name, params)`
- `emergency_button(name, params)`
- `geodesic_marmot(name, params)`

Do not make the script depend on real browser globals. The authoring compiler should supply these names intentionally.

## Authoring function behavior

### PolygonFace

`PolygonFace(name, color, vertices)` defines one prism cell.

Inputs:

- `name`: unique face id.
- `color`: floor color string.
- `vertices`: array of `[x, z]` pairs in counterclockwise order.

Defaults:

- prism height should default to the current example height of `4` meters unless an optional later parameter is added.

Output:

- records a `PrismCellSpec` shell with empty portals and empty objects.

Validation:

- reject duplicate face names,
- reject fewer than 3 vertices,
- reject malformed coordinate arrays before calling `validateAuthoringSpec(...)`,
- rely on existing authoring validation for convexity and winding.

### Portal

`Portal(face1, edge1, face2, edge2)` glues two face edges and automatically creates both directed portal specs.

Inputs:

- `face1`: source face name.
- `edge1`: two vertex indexes, such as `[0, 1]`, `[1, 2]`, `[2, 3]`, or `[0, 3]`.
- `face2`: target face name.
- `edge2`: two vertex indexes using the same convention.

Edge rule:

- edge pairs are always written with the smaller index first.
- `[0, 3]` means the wraparound edge between vertex `3` and vertex `0`.
- all other valid pairs must be consecutive: `[0, 1]`, `[1, 2]`, `[2, 3]`, etc.

Behavior:

- append `face1 -> face2`,
- append `face2 -> face1`,
- generate stable portal ids internally, for example `edge-0-1`, `edge-0-3`, etc.

Validation:

- reject unknown face names,
- reject invalid edge pairs,
- reject duplicate portal assignment on the same face edge,
- reject attempts to connect an edge to itself unless explicitly supported later.

Important:

- Do not require the author to understand side indexes.
- Do not require the author to write reciprocal portal calls.
- Do not derive rigid transforms here; the existing compiler should continue doing that.

### OnFace

`OnFace(faceName, objects)` places authored objects on a face.

Inputs:

- `faceName`: target face name.
- `objects`: array of object specs returned by object constructors.

Behavior:

- append the provided objects to the target face's `visuals.objects`.
- preserve object ids and positions exactly as produced by the object library.

Validation:

- reject unknown face names,
- reject objects that were not produced by the object library,
- reject duplicate object ids within the generated world.

## Object library

Create a well-defined TypeScript object library that owns the knowledge of which classroom objects exist and what their defaults are.

Suggested location:

- `src/world-objects/library.ts`

Supporting per-object wrappers may live beside existing object code:

- `src/world-objects/staticAssets.ts`
- `src/world-objects/geodesciMarmot.ts`

The word "library" is intentional. Avoid naming this a generic manager or registry unless the implementation truly needs persistent runtime state.

### Static asset wrappers

Static wrappers should create `AssetObjectSpec` values and should not add collision unless the object is deliberately meant to affect movement later.

Required wrappers:

- `house(name, params)` maps to `house-low-poly/scene.gltf`.
- `clock(name, params)` maps to `clock_low_poly/scene.gltf`.
- `campfire(name, params)` maps to `low_poly_campfire/scene.gltf`.
- `tree(name, params)` maps to `low_poly_tree_wind/scene.gltf`.
- `rocks(name, params)` maps to `low_poly_rocks/scene.gltf`.
- `emergency_button(name, params)` maps to `low_poly_emergency_button/scene.gltf`.

Shared static params:

```ts
interface StaticObjectAuthoringParams {
  readonly position: readonly [x: number, y: number, z: number];
  readonly scale?: number;
  readonly yaw?: number;
}
```

Static wrappers should normalize authoring params into:

```ts
AssetObjectSpec {
  id,
  kind: "asset",
  assetPath,
  position: { x, y, z },
  scale,
  yawRadians: yaw,
}
```

### Dynamic object wrappers

`geodesic_marmot(name, params)` should wrap the existing geodesic marmot object spec creator.

Suggested params:

```ts
interface GeodesicMarmotAuthoringParams {
  readonly position: readonly [x: number, y: number, z: number];
  readonly velocity: readonly [vx: number, vz: number];
  readonly scale?: number;
}
```

The wrapper should normalize arrays into the current structured format and delegate to the existing marmot spec creation code.

The object wrapper is responsible for object defaults:

- asset path,
- animation clip default,
- collision presence,
- collision box dimensions,
- collision offset,
- default scale.

World scripts should not hand-author those low-level details.

### Collision policy

The object library should make collision decisions explicit:

- static decorative objects have no collision by default,
- dynamic objects may carry collision when their behavior depends on movement rules,
- `geodesic_marmot` must keep its small collision box,
- future collidable decorations should use named wrappers rather than ad hoc per-world collision boxes.

## Script compiler

Add a focused compiler for the script authoring format.

Suggested module:

- `src/authoring/compileWorldScript.ts`

Responsibilities:

- accept source text,
- execute it with the authoring globals,
- collect faces, portals, and objects,
- emit a `CellComplexSpec`,
- return readable authoring errors.

The script compiler should be separate from `compileCellComplex(...)`.

Pipeline:

```text
world script source
  -> compileWorldScript(...)
  -> CellComplexSpec
  -> validateAuthoringSpec(...)
  -> compileCellComplex(...)
  -> CompiledCellComplex
```

The runtime should not care whether a `CellComplexSpec` came from a TypeScript module or from a script.

## Execution safety

This feature is intended for trusted local classroom scripts, not untrusted internet code.

Still, the script should be executed with a narrow context:

- provide only the authoring globals,
- avoid exposing `window`, `document`, filesystem APIs, network APIs, or project internals,
- fail with readable errors when the script calls an unknown function,
- keep implementation browser-compatible for Vite.

Do not overbuild a full sandbox in this issue. The key requirement is to keep script execution behind a small explicit authoring API.

## File format and loading

Recommended file extension:

- `.world.js`

Suggested example path:

- `src/cell-complex/examples/cube.world.js`

Migration options:

- keep `cube.ts` as a thin wrapper that imports or loads the script and exports `cube: CellComplexSpec`,
- or replace `cube.ts` with a generated/compiled call if Vite integration is straightforward.

Prefer the smallest implementation that keeps `worldCatalog.ts` able to load a `CellComplexSpec` without making runtime startup complicated.

## Implementation plan

### 1. Add object library wrappers

Create the TypeScript object library first.

Goals:

- expose named object constructors,
- centralize asset paths and collision defaults,
- remove object-specific imports from example worlds over time.

### 2. Add the procedural world builder

Implement the lower-level builder used by script globals.

It should support:

- face creation,
- edge validation and edge-to-side-index conversion,
- automatic reciprocal portal creation,
- object placement.

This builder can be TypeScript and fully unit tested without executing script text.

### 3. Add script execution

Implement `compileWorldScript(...)`.

Start with enough functionality for `cube.world.js`.

Keep error messages pointed at author concepts:

- unknown face,
- invalid edge,
- duplicate portal,
- duplicate object id,
- malformed object params.

### 4. Migrate cube authoring

Rewrite the cube example into the target procedural form.

The authored world should include:

- six `PolygonFace(...)` calls,
- reciprocal portal topology expressed through one `Portal(...)` call per undirected edge pairing,
- static objects through object library wrappers,
- the geodesic marmot through `geodesic_marmot(...)`,
- `OnFace(...)` calls with arrays of named objects.

### 5. Keep existing examples working

Do not require all worlds to migrate in the first pass.

Existing TypeScript world specs should remain valid so the authoring script can be introduced incrementally.

## Tests to add

### Object library tests

Add tests proving:

- each static wrapper produces the expected asset path and object id,
- static wrappers do not add collision by default,
- `geodesic_marmot(...)` produces a dynamic object with velocity and collision,
- array params normalize into `{ x, y, z }` and `{ x, z }` shapes.

### Builder tests

Add tests proving:

- `PolygonFace(...)` creates prism cells with expected vertices and colors,
- `Portal(...)` creates both directed portal specs,
- edge pairs map to correct side indexes,
- `[0, 3]` maps to the wraparound edge in a four-vertex face,
- invalid edges fail clearly,
- duplicate portal assignments fail clearly,
- `OnFace(...)` attaches objects to the right face.

### Script compiler tests

Add tests proving:

- a minimal script compiles to a valid `CellComplexSpec`,
- a cube-like script compiles and then passes `compileCellComplex(...)`,
- generated cube portals satisfy existing seam-transform tests after compilation,
- malformed scripts produce readable authoring errors.

### Regression tests

Keep current tests for:

- [tests/cell-complex/compileCellComplex.test.ts](../../tests/cell-complex/compileCellComplex.test.ts),
- [tests/cell-complex/describeGeometry.test.ts](../../tests/cell-complex/describeGeometry.test.ts),
- [tests/movement/moveDynamicObject.test.ts](../../tests/movement/moveDynamicObject.test.ts).

Update expectations only where the authored world contents intentionally change.

## Acceptance criteria

This issue is complete when:

- `cube` can be authored in the procedural script style described above,
- the script compiler emits an ordinary `CellComplexSpec`,
- existing runtime compilation and movement code do not need script-specific branches,
- `Portal(...)` automatically creates reciprocal portal specs,
- author-facing edges use vertex pairs like `[0, 1]` and `[0, 3]`, not side indexes,
- object wrappers exist for house, clock, campfire, tree, rocks, emergency button, and geodesic marmot,
- object wrappers own asset paths and collision defaults,
- static object wrappers have no collision by default,
- geodesic marmot keeps its dynamic collision box,
- tests cover object wrappers, edge conversion, reciprocal portal creation, and script compilation,
- `npm test` and `npm run build` pass.

## Non-goals

- Do not build a visual editor.
- Do not build QR authoring here.
- Do not allow arbitrary portal transforms in the script.
- Do not expose renderer or Three.js objects to the script.
- Do not change `compileCellComplex(...)` to understand script syntax directly.
- Do not require every existing example world to migrate in this issue.
- Do not add collision for static decorations unless a specific wrapper intentionally owns that behavior.

## Notes for future LLM sessions

Favor classroom readability in the script, but keep the implementation boring and typed underneath.

The authoring syntax can be playful and permissive; the emitted `CellComplexSpec` must remain precise, validated, and compatible with the current compiler.

If a tradeoff appears between script prettiness and runtime clarity, keep runtime clarity and hide the complexity in the authoring compiler.
