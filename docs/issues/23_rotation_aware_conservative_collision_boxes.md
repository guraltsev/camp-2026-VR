# 23 - Rotation-aware conservative collision boxes

## Goal

Improve object collision fidelity when dynamic objects rotate, without adopting full oriented-box collision.

The existing `SimpleCollisionBox` should remain the authored collision shape. Runtime collision should derive a conservative axis-aligned box that encloses the rotated collision box in cell-local coordinates. This keeps movement, forbidden-zone checks, and future object-object collision simple while reducing obvious visual mismatch for rotated long or wide objects.

## Problem

Today a `SimpleCollisionBox` is axis-aligned in cell-local coordinates and ignores `localPose.rotation`.

That is stable and fast, but it means a visually rotated object keeps the same collision extents along cell-local X/Y/Z. A long object rotated 45 degrees can appear to clip or block in surprising places because its collision footprint does not respond to yaw.

Full oriented-box collision is more accurate, but it is not the right next step for this codebase. It would add separating-axis tests, harder portal/debug behavior, and a more complex mental model before object-object collision has landed.

## Scope

Implement a conservative derived AABB for `SimpleCollisionBox`:

- keep `SimpleCollisionBox` as `dx`, `dy`, `dz`, and optional `offset`,
- keep collision tests axis-aligned after bounds derivation,
- use object rotation to expand the runtime AABB so it contains the rotated box,
- apply the derived bounds to floor, ceiling, wall, forbidden-zone, portal-reachability, and object-object collision helpers,
- preserve current behavior for identity rotation,
- keep broad behavior deterministic and easy to test.

This issue may include the first simple object-object collision helper if it naturally fits the bounds helper work, but the primary goal is rotation-aware bounds derivation.

## Non-Goals

- Do not implement true oriented-box collision.
- Do not rotate wall planes or forbidden-zone cylinders.
- Do not add a physics solver.
- Do not add pushing, sliding, impulses, mass, friction, or stacking.
- Do not change portal transforms.
- Do not make renderer code the source of truth for collision.

## Design Direction

### Conservative derived AABB

Treat the authored `SimpleCollisionBox` as a local box centered at:

```text
object.localPose.translation + rotatedOffset
```

Then derive cell-local half-extents from the absolute values of the rotation matrix:

```text
halfX = |r00| * dx/2 + |r01| * dy/2 + |r02| * dz/2
halfY = |r10| * dx/2 + |r11| * dy/2 + |r12| * dz/2
halfZ = |r20| * dx/2 + |r21| * dy/2 + |r22| * dz/2
```

The result is still an AABB, but it is large enough to contain the rotated box.

For typical yaw-only object rotation, this expands the horizontal footprint as expected while leaving height mostly unchanged. If pitch or roll appears later, the same formula remains conservative.

### Offset handling

The existing `collision.offset` should be interpreted in the object's local collision space, then rotated into cell-local space before adding it to the object translation.

For identity rotation, this must match the current behavior exactly:

```text
center = translation + offset
```

For rotated objects:

```text
center = translation + rotation * offset
```

### Keep one bounds helper authoritative

The code should avoid multiple ad hoc bounds calculations.

Prefer evolving `getCollisionBounds(...)` or adding a nearby replacement that accepts the full object pose, for example:

```text
getDynamicObjectCollisionBounds(object)
```

Then route movement and future object-object tests through that helper.

## Likely Files

Likely touched files:

- `src/movement/collision.ts`
- `src/movement/moveDynamicObject.ts`
- `src/movement/dynamicObject.ts`
- `tests/movement/moveDynamicObject.test.ts`

Possible new tests:

- `tests/movement/collision.test.ts`
- `tests/movement/objectCollision.test.ts`

Possible later renderer/debug updates:

- `src/render/three/debugCollisionWireframes.ts`
- `tests/render-contract/buildCellMesh.test.ts`

Renderer updates are optional for this issue unless existing collision wireframes would become materially misleading.

## Implementation Plan

### 1. Add rotation-aware bounds derivation

Introduce a helper that takes a `DynamicObjectState` and returns `SimpleBoxBounds`.

The helper should:

- return `undefined` when the object has no collision shape,
- rotate `collision.offset` by `localPose.rotation`,
- compute conservative AABB half-extents from the absolute rotation matrix,
- preserve existing identity-rotation results.

Keep the old position-based helper only if needed as a low-level utility. Prefer making call sites use the object-based helper so rotation cannot be accidentally ignored.

### 2. Update movement collision call sites

Update movement code so all object collision bounds come from the rotation-aware helper.

Required call sites include:

- `testCellCollision`,
- `findBoundaryCrossing`,
- portal reachability checks,
- anchor crossing checks,
- blocked wall resolution.

If a function currently takes `position` and `collision`, consider changing it to take the whole `DynamicObjectState`. That makes it harder to forget rotation.

### 3. Preserve portal crossing semantics

Portal crossing should continue to transform the object pose through the existing portal transform.

After crossing, collision should be tested in the target cell using the transformed pose and the same derived AABB logic. Do not special-case portal-crossed objects.

### 4. Add simple AABB object-object helper

If object-object collision is included in this issue, implement it as a pure helper:

```text
simpleBoxIntersectsSimpleBox(a, b)
```

The helper should use the derived AABBs, not authored dimensions directly.

Intersection should require overlap on all three axes. Use strict overlap for consistency with existing forbidden-zone behavior unless tests reveal boundary jitter.

### 5. Decide movement response for object-object collisions

For the first implementation, reject the candidate move when it intersects another collidable object.

That should behave like forbidden-zone blocking:

- return blocked,
- report a distinct reason if a reason enum is extended,
- leave the moving object at its previous pose,
- do not push either object.

Only add this movement integration if the project already has an authoritative list of current dynamic objects available at the movement boundary. If that state shape is not ready, leave object-object collision as a tested pure helper and document the integration point.

### 6. Update debug wireframes only if necessary

If collision debug helpers render authored `dx/dy/dz` boxes attached to rotated object roots, they may already visually show the rotated local box. That is acceptable if the runtime collision is a conservative enclosing AABB and the visual distinction is clear enough.

If the debug view is intended to show actual blocking geometry, add or adjust a helper that renders the derived AABB in cell-local axes.

Do not route debug helpers through expensive portal render paths.

## Tests

Add focused tests for the math before broad movement tests.

Required tests:

- identity rotation produces the same bounds as the current implementation,
- zero offset still centers the box on object translation,
- explicit offset is rotated by object rotation,
- 90-degree yaw swaps X/Y extents for a rectangular box,
- 45-degree yaw expands the AABB enough to contain the rotated rectangle,
- pitch or roll rotation conservatively affects Z extents,
- forbidden-zone blocking uses rotated/conservative bounds,
- wall blocking uses rotated/conservative bounds,
- portal reachability uses rotated/conservative bounds,
- portal crossing tests collision in the target cell after transform.

If object-object helper is included:

- separated boxes do not collide,
- overlapping boxes collide,
- touching-only boxes follow the chosen strict or non-strict boundary rule,
- rotated boxes collide based on their conservative derived AABBs.

## Acceptance Criteria

- Runtime collision bounds for `SimpleCollisionBox` account for `localPose.rotation`.
- Identity-rotation behavior is unchanged.
- Collision offsets rotate with the object pose before being applied.
- Wall, floor, ceiling, forbidden-zone, and portal-reachability checks use the rotation-aware derived AABB.
- The implementation remains AABB-based after bounds derivation.
- Tests cover identity, yaw, offset rotation, forbidden-zone blocking, wall blocking, and portal crossing behavior.
- No true oriented-box collision or physics solver is introduced.
- Existing movement, portal, and VR locomotion tests continue to pass.

## Notes for LLM Devs

The important distinction is:

```text
authored shape: simple local box
runtime test shape: cell-local AABB enclosing that rotated local box
```

Do not implement SAT or OBB-vs-OBB collision here. The win is getting most of the visual benefit of rotation-aware collision while keeping the runtime collision code inspectable by students and future contributors.

