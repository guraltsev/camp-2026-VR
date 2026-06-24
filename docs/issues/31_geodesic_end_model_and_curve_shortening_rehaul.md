# 31 - Geodesic end model and portal-safe curve shortening rehaul

## Goal

Rehaul the geodesic system around explicit geodesic ends, not whole-geodesic
incident identity.

The immediate bugs to fix are:

- tying and releasing a portal-wrapped loop can delete or break the whole
  construction instead of collapsing it to one wrapped geodesic;
- angle measurement rejects two distinct incidences of the same geodesic at an
  emitter;
- straightening assumes the two halves live in one cell and can fuse into one
  same-cell segment, which is false on quotient spaces such as the torus.

The corrected model should make the torus case natural:

```text
>- G1 -- E1 -- G2 -- E2 -- G1 ->
```

If the player ties and releases at `E2`, the two incident ends at `E2` should
detach, enter curve shortening, and eventually fuse into one locked geodesic
whose two ends are incident to `E1`. That fused geodesic may wrap through one or
more portals. It must not be rejected just because both ends attach to the same
emitter.

## Current Diagnosis

The current code has useful building blocks, but the identity model is too
coarse.

`src/world-objects/geodesicCannon.ts` currently represents a connection as:

```ts
interface GeodesicEmitterConnection {
  readonly outgoingEmitterId: string;
  readonly incomingEmitterId?: string;
  readonly state: "open" | "connected" | "straightening";
}
```

This describes a relation between a geodesic id and one or two emitters. It does
not describe the two ends of the geodesic as separate incident objects. That
causes several downstream problems:

- `tieAndDetachIncidentGeodesics` rejects duplicate selected geodesic ids, so a
  single geodesic that returns to the same emitter cannot provide two selectable
  incidences.
- `resolveDetachedEndpoint` returns only the other emitter, not which end,
  direction, segment, portal lift, or incidence is involved.
- `tieAndDetachIncidentGeodesics` requires both remaining endpoints and the
  detached emitter to be in the same cell.
- `advanceStraighteningGeodesics` deletes the straightening geodesic when the
  two straightening segments are not exactly two same-cell segments.
- `lockStraightenedGeodesic` fuses by creating one segment in one cell from
  `start` to `end`.
- `findCoincidentConnectedGeodesic` treats a same endpoint pair and same
  same-cell segment as a duplicate, which is dangerous once homotopically
  distinct wrapped geodesics exist.

The protractor has the same identity problem. `createProtractorAngleObject`
throws when the two selections have the same `geodesicId`, even when they are
different incidences of the same geodesic at the same emitter.

## Design Principle

A geodesic has two ends.

Each end may be attached to an emitter, attached to the other straightening
half's free end, or absent only transiently during an operation that will either
repair the invariant or delete the geodesic.

The important identity for editing and measuring is not just:

```text
geodesicId
```

It is:

```text
geodesicEndId / incidenceId
```

Two selections with the same `geodesicId` are valid if they refer to different
ends or different incidences. Two selections are invalid only if they refer to
the same incidence.

## Invariants

- A geodesic always has at least one end attached to an emitter.
- An unlocked geodesic has exactly one emitter-attached end and one open end.
- A locked geodesic has two emitter-attached ends. The two ends may attach to
  the same emitter if they are different incidences.
- A curve-shortening pair contains two geodesics, each with one emitter-attached
  end and one free end glued to the other's free end.
- A geodesic segment object never spans a portal. Portal crossing remains a
  chain of segment objects.
- A geodesic may carry a portal word, lift transform, or equivalent path
  metadata. Same visible emitter coordinates do not imply same global endpoint
  lift.
- Homotopically distinct locked geodesics between the same emitters are allowed.
  Duplicate pruning must compare endpoint incidences and portal words, not only
  emitter ids and local coordinates.

## Proposed Domain Model

Introduce explicit end and incidence records. Exact naming can adapt to the
codebase, but the model should be equivalent to:

```ts
type GeodesicEndRole = "start" | "end";

interface GeodesicEnd {
  readonly id: string;
  readonly geodesicId: string;
  readonly role: GeodesicEndRole;
  readonly attachment: GeodesicEndAttachment;
  readonly tangentYawRadians?: number;
  readonly portalWordFromSegmentChain?: readonly GeodesicPortalTraversal[];
}

type GeodesicEndAttachment =
  | {
      readonly kind: "emitter";
      readonly emitterId: string;
      readonly incidenceId: string;
    }
  | {
      readonly kind: "open";
    }
  | {
      readonly kind: "glued-free-end";
      readonly shorteningPairId: string;
      readonly mateEndId: string;
    };
```

The source of truth can live on the emitter objects, on new runtime objects, or
in a derived registry helper. What matters is that all operations can answer:

- which ends does this geodesic have?
- which end is incident to this emitter?
- what tangent does that end present at the emitter?
- what portal word/lift distinguishes this incidence from another one?

Keep segment objects as the drawable traced chain. Do not turn a portal-wrapped
geodesic into one renderer object.

## Interaction Semantics

### Selection

Selecting a geodesic at an emitter should select an incidence, not only a
geodesic id.

Palette rows may still display `G1`, `G2`, and so on, but action callbacks
should carry enough information to identify the incident end:

```ts
interface GeodesicIncidentSelection {
  readonly geodesicId: string;
  readonly endId: string;
  readonly incidenceId: string;
  readonly emitterId: string;
}
```

This also lets the same geodesic appear twice at one emitter when it arrives in
two different ways.

### Protractor

The protractor should reject identical incidences, not identical geodesic ids.

Replace:

```text
first.geodesicId !== second.geodesicId
```

with:

```text
first.incidenceId !== second.incidenceId
```

If the same geodesic has two different ends incident at an emitter, measuring
the angle between those ends is valid.

The persisted protractor selection should store the incidence id and a fallback
segment id or endpoint role so it can refresh after rebuilds.

## Tie And Release Semantics

Tie/release at an emitter should:

1. Resolve the two selected incidences at that emitter.
2. Verify they are two different incidences.
3. Identify the two opposite ends.
4. Remove the detached emitter from those two geodesic relations.
5. Create a curve-shortening pair from the opposite emitter-attached ends to a
   shared glued free point.
6. Preserve portal/lift metadata from both incoming arcs.

Special case that must be valid:

```text
opposite end A emitter id === opposite end B emitter id
```

This is the torus wrapped-loop case. The two opposite ends attach to the same
emitter but different incidences/lifts.

The current same-cell construction in `tieAndDetachIncidentGeodesics` should be
replaced by a portal-aware initialization:

- keep each half's existing traced chain up to the detached emitter;
- reverse or re-orient chains as needed so each half runs from its remaining
  emitter-attached end to the glued free end;
- do not collapse to straight same-cell segments at tie time.

## Curve Shortening Regime

Curve shortening is a state over two geodesic halves, not a special state of one
ordinary locked geodesic.

Suggested shape:

```ts
interface CurveShorteningPair {
  readonly id: string;
  readonly firstGeodesicId: string;
  readonly secondGeodesicId: string;
  readonly gluedPoint: LiftedPoint;
  readonly previousTotalLengthMeters?: number;
}

interface LiftedPoint {
  readonly cellId: string;
  readonly localPoint: Vec3;
  readonly portalWordFromFirstEnd?: readonly GeodesicPortalTraversal[];
}
```

Each tick:

1. Compute the two incident tangent directions at the glued point in a common
   lift.
2. Move the glued point a small step along the half-angle direction that reduces
   the smaller angle.
3. Retrace both halves from their emitter-attached end to the new glued point,
   respecting portals and forbidden zones.
4. Compute total length as `first.length + second.length`.
5. If a half hits a forbidden zone, break the pair:
   - delete the half that failed;
   - delete the other straightening relation;
   - leave the surviving emitter-attached path as an unlocked geodesic when it
     is still valid.
6. If total length suddenly increases past tolerance, stop dynamic motion and
   start final straightening and fusion.

The length monotonicity check is essential. The current implementation stops
when the vertex is close to a same-cell line. On quotient spaces, the minimum
may occur across a portal word and cannot be detected by same-cell distance to
one chord.

## Final Straightening And Fusion

Final fusion should take the two shortened halves and produce one locked
geodesic with two explicit ends.

It must not assume the result is one segment. Instead:

1. Choose the endpoint pair and portal word/lift represented by the shortened
   halves.
2. Trace the final locally straight path through the cell complex.
3. Create a segment chain, with one segment per cell traversal.
4. Attach both geodesic ends to their emitter incidences.
5. Mark the resulting geodesic `connected`.
6. Delete the two temporary half-geodesics and the shortening pair.

For the torus loop, the result may be:

```text
E1 -- segment in torus cell -- portal-hit -- segment in torus cell -- E1
```

The source and incoming emitter ids may be equal. The two end ids and incidence
ids must be different.

## Portal Requirements

Portal state needs to become part of geodesic identity.

Minimum requirement:

- every locked geodesic can report the ordered portal word along its segment
  chain;
- every endpoint incidence can report the tangent in the local emitter cell;
- rebuilding a locked geodesic preserves its intended portal word unless an
  operation explicitly changes homotopy class;
- duplicate detection includes portal word/lift.

Do not use only local emitter coordinates to decide whether a wrapped loop has
zero length. In a torus, the same emitter coordinate in two lifts can represent
a nontrivial loop.

## Forbidden-Zone Behavior

During curve shortening:

- forbidden-zone hits are detected by retracing each half, not by checking only
  one same-cell segment;
- if one half breaks, the pair exits curve shortening;
- the broken half is removed;
- the other half becomes unlocked if it still has one emitter-attached end and a
  valid open trace;
- all stale measurements, protractor angles, and intersection markers for
  removed ends are cleaned up.

This is different from the current behavior that deletes the entire geodesic
pair when either straightening half enters a forbidden zone.

## Migration Plan

### 1. Add end/incidence helpers without changing UI

Add pure helpers that derive end records from current cannon, connection, and
segment state.

Tests should cover:

- unlocked geodesic has one emitter end and one open end;
- connected geodesic has two emitter ends;
- same-emitter connected loop has two different emitter incidences;
- incident lookup returns end ids, not only geodesic ids.

### 2. Update protractor identity

Extend `ProtractorDirectedGeodesic` with `endId` or `incidenceId`.

Acceptance:

- selecting the same incidence twice is rejected;
- selecting two different incidences of the same geodesic is allowed;
- angle refresh survives segment rebuild.

### 3. Replace tie/release selection plumbing

Change tie/release callbacks and palette content to pass incident selections.

Acceptance:

- tie/release can act on two incidences with the same geodesic id when they are
  distinct;
- tie/release can act when the two opposite ends attach to the same emitter.

### 4. Introduce curve-shortening pair state

Separate temporary shortening state from ordinary connected geodesic state.

Acceptance:

- a shortening pair stores two half geodesics and a shared lifted glued point;
- tick logic uses portal-aware retracing;
- total length is tracked across ticks.

### 5. Implement portal-aware final fusion

Replace same-cell `lockStraightenedGeodesic` with a segment-chain fusion path.

Acceptance:

- final fusion may produce multiple segments;
- final fusion may produce a locked geodesic whose two ends attach to the same
  emitter;
- portal word is preserved and visible in tests.

### 6. Rework duplicate detection

Duplicate detection should compare:

- both endpoint incidence ids,
- segment chain portal word,
- orientation-insensitive endpoint order when appropriate,
- geometric tolerance within each traversed cell.

It should not delete a wrapped loop merely because the endpoint emitter ids are
the same.

### 7. Update computed-object policy

`applyGeometryCommitComputedObjectPolicy` should rebuild locked geodesics by
explicit end metadata and portal word. If a dynamic geometry commit invalidates
a shortening pair, it should either rebuild the pair in the new geometry or
fail it with the same unlocked/broken behavior used for forbidden-zone hits.

## Required Tests

Add tests before or with the implementation.

World-object tests:

- protractor allows two different incidences of the same geodesic;
- protractor rejects selecting the exact same incidence twice;
- a geodesic can be locked from an emitter back to the same emitter through a
  nonempty portal word;
- tie/release at one emitter in a two-emitter torus loop creates a shortening
  pair whose remaining ends both attach to the other emitter;
- advancing that pair fuses into one connected wrapped geodesic;
- final fused wrapped geodesic has two emitter ends with distinct incidence ids;
- final fused wrapped geodesic has a nonempty portal word;
- same-emitter wrapped loop is not removed as a duplicate;
- forbidden-zone hit during shortening leaves a valid surviving unlocked
  geodesic when one half remains valid.

Portal tests:

- same local endpoint coordinates with different portal words are not treated as
  zero length;
- final fusion never creates a segment spanning a portal;
- reversed portal words compare equal only when they represent the same
  endpoint pair in reverse orientation.

Palette/interaction tests:

- emitter menu can show two rows for the same geodesic id when two incidences
  are present;
- tie/release action sends incidence ids;
- locked same-emitter loop can be deleted from either incidence without leaving
  stale segment or connection state.

Computed-object tests:

- length measurements refresh after same-emitter loop fusion;
- protractor angles centered on an emitter survive wrapped geodesic rebuilds;
- geometry commit does not delete a valid wrapped locked geodesic solely because
  source and incoming emitter ids are equal.

## Acceptance

- The torus loop scenario collapses to one locked wrapped geodesic instead of
  breaking.
- Geodesics have explicit end/incidence identity in domain helpers and action
  payloads.
- The protractor measures angles between different incidences of the same
  geodesic.
- Curve shortening is portal-aware and length-monotone.
- Forbidden-zone failures during shortening break only the invalid dynamic pair
  and leave a valid unlocked survivor when possible.
- Final fusion creates a portal-aware segment chain, not one same-cell segment.
- Renderer state remains derived from runtime objects; no geodesic visual spans
  a portal.

## Non-Goals

- Do not implement a global shortest-path solver.
- Do not infer arbitrary homotopy minimizers. Preserve and operate within the
  portal/lift class implied by the current construction.
- Do not replace the runtime object registry with a separate geometry database.
- Do not make geodesic segment meshes the source of truth.

## Notes For LLM Devs

The tempting local fix is to relax the `incidentGeodesicIds[0] ===
incidentGeodesicIds[1]` check. That is not enough. The failure is structural:
operations need end identity, incidence identity, and portal lift data.

Treat this as a domain-model migration:

```text
geodesic id owns segment chain
geodesic ends own emitter/open/glued attachments
incidences are what tools select and measure
portal words distinguish wrapped realizations
```

Once those concepts exist, the torus behavior becomes ordinary instead of a
special case.
