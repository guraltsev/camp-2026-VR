# 22 - Make dynamic-object portal traversal continuous

## Goal

Fix visible discontinuities when geodesci marmots cross portals.

All portal traversal should feel continuous: an object should remain in its source cell until the traversal point at the center of the object crosses the portal plane, then appear in the target cell with the same physical pose transformed through the portal.

This issue is only about the crossing moment and visual continuity. Later portal-bleeding logic, where an object can be drawn partially on both sides of a portal while straddling it, is explicitly out of scope.

## Current state

The repository already has shared movement logic:

- [src/movement/moveDynamicObject.ts](../../src/movement/moveDynamicObject.ts) supports `portalCrossingMode: "bounds" | "anchor"`.
- [src/movement/movePlayer.ts](../../src/movement/movePlayer.ts) uses `portalCrossingMode: "anchor"`, allowing the player body to straddle a portal before changing root cell.
- [src/world-objects/geodesciMarmot.ts](../../src/world-objects/geodesciMarmot.ts) currently calls `moveDynamicObject(...)` without specifying a crossing mode, so it uses the default bounds behavior.

That default is likely the cause of the observed marmot pop: the marmot changes cells when its collision bounds exit the source cell, not when the object's traversal center crosses the portal plane.

## Desired behavior

For geodesci marmots and ordinary autonomous dynamic objects:

- portal crossing is checked against the object's center/traversal anchor,
- the object may remain in the source cell while its collision body slightly overlaps a portal plane,
- the cell switch happens only when that traversal center crosses the portal side,
- the transformed target pose preserves velocity-facing orientation,
- the rendered parent cell changes on the same frame as the movement state changes,
- no object disappears, stalls, or snaps backward during a portal crossing.

The traversal center should use the same point used by `moveDynamicObject(..., portalCrossingMode: "anchor")`: the collision bounds center when a collision box exists, otherwise the local pose translation.

## Scope

In scope:

- make geodesci marmot movement use center/anchor crossing,
- document and test the intended default for autonomous dynamic objects,
- add diagnostics or test helpers that make the crossing frame easy to inspect,
- keep wall, floor, ceiling, and forbidden-zone rejection behavior intact.

Out of scope:

- rendering an object in two cells at once while it straddles the portal,
- changing player movement semantics,
- changing portal transform compilation,
- adding animation blending or mesh deformation,
- solving object-object collisions.

## Required work

### 1. Introduce an explicit dynamic-object traversal policy

Do not leave marmot behavior dependent on the implicit default of `moveDynamicObject(...)`.

Recommended first pass:

```ts
moveDynamicObject({
  world,
  object: state,
  displacement,
  portalCrossingMode: "anchor",
});
```

If the codebase wants a clearer name later, add a small wrapper or type alias such as `portalCrossingMode: "center"` only if it reduces confusion. Avoid broad movement refactors in this issue.

### 2. Preserve portal reachability checks

Anchor crossing should still require that the center projects inside the portal side and that the object fits vertically in the source/target cells.

Do not weaken:

- wall blocking on non-portal sides,
- floor/ceiling blocking,
- forbidden-zone blocking near portal junctions,
- target-cell collision checks after portal transform.

### 3. Keep render-parent sync aligned with movement state

After a marmot crosses, `GeodesciMarmotRuntime.syncParent(...)` should attach the root object to the new cell root during the same frame. If a pop remains after anchor crossing, inspect ordering in [src/render/three/createThreeApp.ts](../../src/render/three/createThreeApp.ts):

```text
runtime.update(...)
runtime.syncParent(...)
updateVisibleCell(...)
renderer.render(...)
```

The movement state, cell parent, and rendered transform must not be one frame out of sync.

### 4. Add focused tests

Extend [tests/movement/moveDynamicObject.test.ts](../../tests/movement/moveDynamicObject.test.ts) and/or add a geodesci marmot runtime test.

Required coverage:

- an object using anchor crossing does not switch cells when only its bounds cross the portal plane,
- the same object switches cells when its center crosses the portal plane,
- the crossed target pose matches the portal transform,
- forbidden-zone and blocked-target checks still reject invalid crossings,
- the marmot runtime calls the shared movement path with center/anchor crossing semantics.

The existing player test "lets the player straddle a portal before changing root cell when the camera anchor crosses" is a good behavioral model.

## Manual checks

- In `cube`, watch the front marmot cross a portal edge-on and head-on.
- Confirm the marmot does not vanish early when its nose/front bounds touch the portal.
- Confirm the visual switch happens when the body's center crosses the portal plane.
- Confirm the marmot continues facing and moving smoothly after crossing.
- Confirm reset returns marmots to their initial cells and parents.

## Acceptance criteria

This issue is complete when:

- geodesci marmot portal crossing uses center/anchor traversal, not bounds-first traversal,
- the marmot cell switch occurs only when the traversal center crosses a portal side,
- the rendered marmot parent and movement state update in the same frame,
- tests cover before-center and after-center crossing behavior,
- no existing player movement, wall collision, or forbidden-zone tests regress,
- `npm.cmd test -- --run`, `npm.cmd run typecheck`, and `npm.cmd run build` pass.
