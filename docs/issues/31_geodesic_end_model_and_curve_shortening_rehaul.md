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

A geodesic has two endpoint attachments.

Each endpoint is attached to an anchor object. Emitters are visible anchors.
Invisible free ends are anchors for free rays, moving curve-shortening vertices,
and other temporary unattached endpoints. An endpoint may be absent only
transiently during an operation that will either repair the invariant or delete
the geodesic.

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

- A geodesic always has exactly two endpoint attachments.
- Every endpoint attachment points to an anchor object with
  `canAttachGeodesics: true`.
- A locked geodesic has two emitter anchors. The two endpoints may attach to
  the same emitter if they are different incidences.
- A free geodesic has at least one endpoint attached to a
  `FreeGeodesicEndObject`.
- An aimable free geodesic has one emitter endpoint, one free-end endpoint, and
  the free end has exactly one attached geodesic endpoint total.
- A curve-shortening pair contains two moving geodesics. Each has one
  emitter-attached endpoint and one endpoint attached to the same
  `FreeGeodesicEndObject`.
- A geodesic segment object never spans a portal. Portal crossing remains a
  chain of segment objects.
- A geodesic may carry a portal word, lift transform, or equivalent path
  metadata. Same visible emitter coordinates do not imply same global endpoint
  lift.
- Homotopically distinct locked geodesics between the same emitters are allowed.
  Duplicate pruning must compare endpoint incidences and portal words, not only
  emitter ids and local coordinates.

## Proposed Domain Model

Introduce geodesic anchor objects and explicit geodesic records in the existing
runtime object registry.

An anchor is any runtime object that can host geodesic endpoints. Geodesic
emitters are visible anchors. Invisible free ends are anchors used for open
rays, moving curve-shortening vertices, and other temporary unattached
endpoints.

```ts
interface GeodesicAnchorObject {
  readonly id: string;
  readonly cellId: string;
  readonly canAttachGeodesics: true;
}

interface FreeGeodesicEndObject extends RuntimeWorldObjectBase {
  readonly kind: "free-geodesic-end";
  readonly canAttachGeodesics: true;
  readonly localPoint: Vec3;
  readonly faceId?: string;
}
```

`FreeGeodesicEndObject` is not rendered as a user-facing object. It is a
topological anchor. It may have one attached geodesic endpoint for an ordinary
free ray, or two attached geodesic endpoints for a curve-shortening glued
point.

A geodesic is the source of truth for its two endpoint identities and path
word. The segment chain remains drawable/cache output derived from this record.
Exact naming can adapt to the codebase, but the model should be equivalent to:

```ts
type GeodesicEndRole = "start" | "end";

interface GeodesicObject extends RuntimeWorldObjectBase {
  readonly kind: "geodesic";
  readonly start: GeodesicEndpointAttachment;
  readonly end: GeodesicEndpointAttachment;
  readonly pathWord: readonly GeodesicPortalTraversal[];
  readonly motionState: "stable" | "moving";
}

interface GeodesicEndpointAttachment {
  readonly id: string;
  readonly geodesicId: string;
  readonly role: GeodesicEndRole;
  readonly anchorObjectId: string;
  readonly incidenceId: string;
  readonly tangentYawRadians?: number;
}
```

The source of truth is therefore:

- anchor objects own positions and can host endpoint attachments;
- geodesic objects own endpoint identities and path words;
- segment objects are derived visual traces and never define identity.

Required helper APIs:

```ts
function getGeodesicEndpointAttachmentsForAnchor(
  registry: RuntimeObjectRegistry,
  anchorObjectId: string,
): readonly GeodesicEndpointAttachment[];

function getGeodesicEndpoints(
  registry: RuntimeObjectRegistry,
  geodesicId: string,
): readonly [GeodesicEndpointAttachment, GeodesicEndpointAttachment] | undefined;

function collectEmitterGeodesicIncidences(
  registry: RuntimeObjectRegistry,
  emitterId: string,
): readonly GeodesicIncidentSelection[];
```

Reverse lookup is the public way to answer:

- which geodesic endpoints are attached to this emitter?
- which geodesic endpoints are attached to this free end?
- which tangent does an endpoint present at its anchor?
- which portal word/lift distinguishes this incidence from another one?

Do not turn a portal-wrapped geodesic into one renderer object. A geodesic owns a
path word and a derived segment chain. Segment objects still never span portals.

An aimable free geodesic is a special case of this model: one endpoint is
attached to an emitter, the other endpoint is attached to a
`FreeGeodesicEndObject`, that free end has exactly one attached endpoint total,
and the geodesic is not `moving`. This condition should be checked through
reverse lookup, not encoded as a separate object kind.

Visual state is derived from the geodesic record:

- locked geodesic: both endpoint anchors are emitters; render derived segments
  with the locked color;
- free stable geodesic: at least one endpoint anchor is a free end and
  `motionState === "stable"`; render derived segments with the free color;
- moving geodesic: `motionState === "moving"`; render derived segments with the
  moving color.

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
  readonly anchorObjectId: string;
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
3. Identify the two opposite endpoint attachments.
4. Remove or replace the old geodesic records that used the detached incidences.
5. Create a `FreeGeodesicEndObject` at the detached point.
6. Create a curve-shortening pair from the opposite emitter-attached endpoints
   to the shared free end.
7. Mark the two temporary geodesics as `moving`.
8. Preserve portal/lift metadata from both incoming arcs.

Special case that must be valid:

```text
opposite end A emitter id === opposite end B emitter id
```

This is the torus wrapped-loop case. The two opposite ends attach to the same
emitter but different incidences/lifts.

A locked loop whose start and end anchors are the same emitter must also be
valid. Reverse lookup on that emitter returns two endpoint attachments for the
same geodesic. Tie/release may select those two incidences and detach the loop
from that emitter exactly as it would detach two different geodesics. Same
`geodesicId` and same anchor object do not imply same incidence.

The current same-cell construction in `tieAndDetachIncidentGeodesics` should be
replaced by a portal-aware initialization:

- keep each half's existing traced chain up to the detached emitter;
- reverse or re-orient chains as needed so each half runs from its remaining
  emitter-attached end to the shared free-end anchor;
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
  readonly freeEndAnchorId: string;
  readonly previousTotalLengthMeters?: number;
}

interface FreeGeodesicEndObject extends RuntimeWorldObjectBase {
  readonly kind: "free-geodesic-end";
  readonly canAttachGeodesics: true;
  readonly localPoint: Vec3;
  readonly liftFromFirstEndpoint?: readonly GeodesicPortalTraversal[];
}
```

The glued point is represented by the shared `FreeGeodesicEndObject`. Reverse
lookup on `freeEndAnchorId` must return exactly the two moving geodesic endpoint
attachments in the shortening pair.

Each tick:

1. Resolve the shared free-end anchor and the two attached moving endpoints.
2. Compute the two incident tangent directions at the free end in a common
   lift.
3. Move the free-end anchor a small step along the half-angle direction that
   reduces the smaller angle.
4. Retrace both halves from their emitter-attached end to the moved free end,
   respecting portals and forbidden zones.
5. Compute total length as `first.length + second.length`.
6. If a half hits a forbidden zone, break the pair:
   - delete the half that failed;
   - delete the curve-shortening pair relation;
   - leave the surviving emitter-attached path as an unlocked geodesic when it
     is still valid.
7. If total length suddenly increases past tolerance, stop dynamic motion and
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
4. Create one stable geodesic record whose two endpoint attachments point to
   the final emitter anchors.
5. Preserve distinct endpoint ids and incidence ids, even when both endpoint
   attachments point to the same emitter.
6. Mark the resulting geodesic `stable`.
7. Delete the two temporary moving geodesics, the shared free-end anchor, and
   the shortening pair.

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

Add geodesic anchor helpers, `FreeGeodesicEndObject`, and `GeodesicObject`
records in the existing runtime object registry. Keep compatibility helpers for
current cannon connection data during the migration, but make the new public
helpers return endpoint attachments and incidences.

Tests should cover:

- geodesic emitters report `canAttachGeodesics: true`;
- free geodesic ends report `canAttachGeodesics: true` and are not rendered as
  user-facing objects;
- an aimable free geodesic has one emitter endpoint and one singly-attached
  free-end endpoint;
- a locked geodesic has two emitter endpoint attachments;
- same-emitter locked loop has two different endpoint attachments and
  incidence ids;
- reverse lookup from an emitter returns endpoint attachments, not only
  geodesic ids;
- reverse lookup from a free end returns all endpoint attachments attached to
  it.

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
- tie/release can act on the two incidences of one locked same-emitter loop;
- tie/release can act when the two opposite ends attach to the same emitter.

### 4. Introduce curve-shortening pair state

Separate temporary shortening state from ordinary connected geodesic state.

Acceptance:

- a shortening pair stores two moving geodesics and a shared
  `FreeGeodesicEndObject`;
- reverse lookup on the shared free end returns exactly the two moving
  endpoints;
- tick logic uses portal-aware retracing;
- total length is tracked across ticks.

### 5. Implement portal-aware final fusion

Replace same-cell `lockStraightenedGeodesic` with a segment-chain fusion path.

Acceptance:

- final fusion may produce multiple segments;
- final fusion may produce a locked geodesic whose two ends attach to the same
  emitter;
- final fusion deletes the temporary moving geodesics and shared free-end
  anchor;
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

- emitters and free geodesic ends are geodesic anchors;
- reverse lookup returns all geodesic endpoint attachments for an emitter;
- reverse lookup returns all geodesic endpoint attachments for a free end;
- aimable free geodesic requires a singly-attached free end and one emitter
  endpoint;
- protractor allows two different incidences of the same geodesic;
- protractor rejects selecting the exact same incidence twice;
- a geodesic can be locked from an emitter back to the same emitter through a
  nonempty portal word;
- a locked same-emitter loop exposes two selectable incidences at that emitter;
- tie/release can detach the two incidences of a locked same-emitter loop;
- tie/release at one emitter in a two-emitter torus loop creates a shortening
  pair whose moving geodesics share one free-end anchor and whose remaining
  ends both attach to the other emitter;
- advancing that pair fuses into one connected wrapped geodesic;
- final fused wrapped geodesic has two emitter ends with distinct incidence ids;
- final fused wrapped geodesic has a nonempty portal word;
- final fusion deletes temporary moving geodesics and the shared free-end
  anchor;
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
- tie/release highlights endpoint incidences, not whole geodesic ids;
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
anchor objects own positions where geodesics attach
geodesic objects own two endpoint attachments and one path word
reverse lookup finds all incidences attached to an anchor
segment chains are visual traces derived from geodesic records
incidences are what tools select and measure
path words distinguish wrapped realizations
```

Once those concepts exist, the torus behavior becomes ordinary instead of a
special case.
