# 31 - Geodesic end model and portal-safe curve shortening rehaul

## Goal

Rehaul the geodesic system around explicit geodesic ends, not whole-geodesic
incident identity.

The immediate bugs to fix are:

- tying and releasing a portal-wrapped loop can delete or break the whole
  construction instead of collapsing it to one wrapped geodesic;
- angle measurement rejects two distinct endpoint selections of the same
  geodesic at an emitter;
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
  endpoint roles.
- `resolveDetachedEndpoint` returns only the other emitter, not which endpoint
  role, direction, segment, or portal lift is involved.
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
different endpoint roles of the same geodesic at the same emitter.

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
geodesic endpoint = (geodesicId, endRole)
```

where `endRole` is `start` or `end`. Two selections with the same `geodesicId`
are valid if they refer to different endpoint roles. Two selections are invalid
only if they refer to the same `(geodesicId, endRole)` pair.

## Invariants

- A geodesic always has exactly two endpoint attachments.
- Every endpoint attachment points to an anchor object with
  `canAttachGeodesics: true`.
- A locked geodesic has two emitter anchors. The two endpoints may attach to
  the same emitter if they are different endpoint roles.
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
  Duplicate pruning must compare endpoint roles and portal words, not only
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

Free-end lifecycle:

- creating an aimable geodesic creates one `GeodesicObject` and one
  `FreeGeodesicEndObject`;
- the `start` endpoint attaches to the emitter and the `end` endpoint attaches
  to the free end;
- extending or aiming the geodesic moves the free-end object and rebuilds the
  derived segment chain;
- locking the geodesic to an emitter replaces the free-end attachment with an
  emitter attachment and deletes the now-unattached free-end object;
- deleting a geodesic deletes any free-end anchor that no remaining geodesic
  endpoint uses.

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
  readonly geodesicId: string;
  readonly role: GeodesicEndRole;
  readonly anchorObjectId: string;
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

function collectEmitterGeodesicEndpointSelections(
  registry: RuntimeObjectRegistry,
  emitterId: string,
): readonly GeodesicEndpointSelection[];
```

Reverse lookup is the public way to answer:

- which geodesic endpoints are attached to this emitter?
- which geodesic endpoints are attached to this free end?
- which tangent does an endpoint present at its anchor?
- which portal word/lift distinguishes this endpoint from another one?

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

Selecting a geodesic at an emitter should select an endpoint role, not only a
geodesic id.

Palette rows may still display `G1`, `G2`, and so on, but action callbacks
should carry enough information to identify the selected endpoint:

```ts
interface GeodesicEndpointSelection {
  readonly geodesicId: string;
  readonly endRole: GeodesicEndRole;
  readonly anchorObjectId: string;
}
```

This also lets the same geodesic appear twice at one emitter when it arrives in
two different ways.

### Protractor

The protractor should reject identical endpoint selections, not identical
geodesic ids.

Replace:

```text
first.geodesicId !== second.geodesicId
```

with:

```text
first.geodesicId !== second.geodesicId || first.endRole !== second.endRole
```

If the same geodesic has both endpoint roles attached to an emitter, measuring
the angle between those ends is valid.

The persisted protractor selection should store `geodesicId`, `endRole`, and a
fallback segment id so it can refresh after rebuilds.

## Tie And Release Semantics

Tie/release at an emitter should:

1. Resolve the two selected endpoint roles at that emitter.
2. Verify they are two different endpoint selections.
3. Identify the two opposite endpoint attachments.
4. Remove or replace the old geodesic records that used the detached endpoints.
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
emitter but different endpoint roles/lifts.

A locked loop whose start and end anchors are the same emitter must also be
valid. Reverse lookup on that emitter returns two endpoint attachments for the
same geodesic. Tie/release may select those two endpoint roles and detach the loop
from that emitter exactly as it would detach two different geodesics. Same
`geodesicId` and same anchor object do not imply the same selected endpoint.

The current same-cell construction in `tieAndDetachIncidentGeodesics` should be
replaced by a portal-aware initialization:

- keep each half's existing traced chain up to the detached emitter;
- reverse or re-orient chains as needed so each half runs from its remaining
  emitter-attached end to the shared free-end anchor;
- do not collapse to straight same-cell segments at tie time.

## Curve Shortening Regime

Curve shortening is a state over two geodesic halves, not a special state of one
ordinary locked geodesic.

Represent curve-shortening state as an explicit runtime object. It is not
rendered, does not collide, and exists only to coordinate the two moving
geodesics that share one free-end anchor.

```ts
interface CurveShorteningPairObject extends RuntimeWorldObjectBase {
  readonly kind: "curve-shortening-pair";
  readonly id: string;
  readonly firstGeodesicId: string;
  readonly secondGeodesicId: string;
  readonly freeEndAnchorId: string;
  readonly firstFreeEndRole: GeodesicEndRole;
  readonly secondFreeEndRole: GeodesicEndRole;
  readonly previousTotalLengthMeters?: number;
  readonly state: "moving" | "ready-to-fuse";
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

Creation:

- tie/release deletes or replaces the detached locked geodesic records;
- it creates one shared `FreeGeodesicEndObject` at the detached emitter point;
- it creates two moving `GeodesicObject`s whose free endpoints attach to the
  shared free end;
- each moving geodesic keeps the portal word/lift metadata for the corresponding
  surviving half;
- it creates one `CurveShorteningPairObject` referencing the two moving
  geodesics and the shared free end.

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
7. If total length suddenly increases past tolerance, mark the pair
   `ready-to-fuse` and hand it to final fusion.

Pair invariants:

- both referenced geodesics exist and have `motionState === "moving"`;
- both referenced geodesics have exactly one endpoint attached to
  `freeEndAnchorId`;
- the free end has exactly two attached geodesic endpoints;
- the other endpoint of each moving geodesic is attached to a geodesic emitter;
- the two emitter anchors may be the same object;
- `previousTotalLengthMeters` is updated only after a successful monotone tick.

Failure cleanup:

- if both halves fail retracing, delete both moving geodesics, the shared free
  end, and the pair object;
- if one half fails, delete the failed moving geodesic and the pair object;
- the surviving half becomes a stable free geodesic by keeping its emitter
  endpoint and replacing the shared free end with a singly-attached free end at
  the last valid point;
- remove stale measurements, protractor angles, and intersection markers that
  reference deleted geodesics or endpoint selections.

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
5. Preserve distinct endpoint roles, even when both endpoint attachments point
   to the same emitter.
6. Mark the resulting geodesic `stable`.
7. Delete the two temporary moving geodesics, the shared free-end anchor, and
   the shortening pair.

Fusion consumes a `CurveShorteningPairObject`; it should not infer pairs by
searching for arbitrary moving geodesics that happen to share a free end. The
pair object is the ownership boundary for cleanup and finalization.

For the torus loop, the result may be:

```text
E1 -- segment in torus cell -- portal-hit -- segment in torus cell -- E1
```

The two endpoint anchors may be the same emitter. The two endpoint roles must
remain distinct.

## Portal Requirements

Portal state needs to become part of geodesic identity.

Minimum requirement:

- every locked geodesic can report the ordered portal word along its segment
  chain;
- every endpoint selection can report the tangent in the local emitter cell;
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

## Rehaul Plan

This is a breaking rehaul. Do not preserve the old cannon connection model as a
parallel source of truth. During intermediate phases, later features may be
temporarily disabled rather than kept alive through compatibility shims.

Each phase must leave the app in a coherent state and should be shippable on its
own.

### A. Aiming Works

Replace open geodesics with explicit `GeodesicObject` records and free-end
anchors.

Scope:

- add `GeodesicObject`, `FreeGeodesicEndObject`, and anchor reverse-lookup
  helpers;
- mark geodesic cannons as attachable anchors;
- create a free-end anchor whenever a new aimable geodesic is created;
- move the free-end anchor when aiming or extending the geodesic;
- derive segment chains from the geodesic record;
- keep renderer state derived from segment chains and geodesic motion state.

Acceptance:

- aiming and extending an unlocked geodesic works;
- every aimable geodesic has one emitter endpoint and one free-end endpoint;
- the free end has exactly one attached endpoint;
- deleting the geodesic deletes its unshared free end;
- reverse lookup from the emitter and free end returns endpoint attachments.

### B. Cutting With New Emitter Works

Rebuild emitter placement on an existing geodesic using explicit endpoint
records.

Scope:

- split a geodesic by endpoint role and segment-chain position;
- create or update geodesic records for both resulting halves;
- give each new open half its own free-end anchor unless it immediately locks;
- rebuild derived segments without using old cannon connection state.

Acceptance:

- placing an emitter on a free geodesic cuts it cleanly;
- old segments and stale endpoint attachments are removed;
- each resulting geodesic satisfies the two-endpoint invariant;
- measurements/intersections referencing deleted geodesics are cleaned up.

### C. Locking Upon Collision Works

Lock open geodesics by replacing their free-end anchor with an emitter endpoint.

Scope:

- when tracing reaches an emitter, change the free-end attachment to that
  emitter;
- delete the now-unattached free-end object;
- store the portal word represented by the traced segment chain;
- allow `start` and `end` to attach to the same emitter when the portal word is
  nonempty.

Acceptance:

- locking to a distinct emitter works;
- locking from an emitter back to itself through a nonempty portal word works;
- locked geodesics have two emitter endpoints;
- final derived segments still never span a portal;
- duplicate detection does not remove same-emitter wrapped loops.

### D. Measuring Angles Works

Move protractor identity from geodesic ids to endpoint selections.

Scope:

- extend `ProtractorDirectedGeodesic` with `endRole`;
- reject only identical `(geodesicId, endRole)` selections;
- resolve live selections from endpoint attachments and current derived
  segments;
- persist fallback segment id only as a refresh aid, not as identity.

Acceptance:

- selecting the same endpoint twice is rejected;
- selecting `start` and `end` of the same geodesic is allowed;
- angles refresh after segment rebuilds;
- an emitter menu can expose two rows for the same geodesic id when both
  endpoints attach there.

### E. Carrying Emitters Works

Rebuild locked geodesics from endpoint metadata and portal word while emitters
move.

Scope:

- replace source/incoming connection rebuild with endpoint-role rebuild;
- preserve the geodesic's portal word unless the carry operation explicitly
  crosses a portal and updates the lift;
- update endpoint tangents after rebuild;
- refresh measurements, protractor angles, and intersections after rebuild.

Acceptance:

- carrying an emitter updates every incident locked geodesic;
- carrying preserves wrapped same-emitter loops;
- geometry commits rebuild locked geodesics by explicit endpoints and portal
  word;
- invalid locked geodesics fail with cleanup of stale computed objects.

### F. Tie And Release Works

Introduce curve-shortening pairs and portal-aware final fusion.

Scope:

- change tie/release selection payloads to `(geodesicId, endRole)`;
- create a shared free-end anchor and two moving geodesics from the detached
  endpoint selections;
- create a `CurveShorteningPairObject` to own the two moving geodesics;
- advance pairs by moving the shared free end and retracing both halves in their
  portal/lift classes;
- fuse `ready-to-fuse` pairs into one stable locked geodesic;
- delete temporary moving geodesics, the pair object, and the shared free end.

Acceptance:

- tie/release can act on `start` and `end` of the same geodesic;
- tie/release can act when the two remaining endpoints attach to the same
  emitter;
- reverse lookup on the shared free end returns exactly two moving endpoints;
- total length is tracked monotonically across ticks;
- final fusion may produce multiple segments;
- final fusion may produce a locked geodesic whose two endpoint roles attach to
  the same emitter;
- forbidden-zone failure leaves a valid surviving free geodesic when one half
  remains valid.

### G. Duplicate Detection And Policy Cleanup

Harden global cleanup once all endpoint-based features are in place.

Scope:

- compare endpoint roles, anchor ids, portal word, and per-cell segment geometry
  when pruning duplicates;
- treat reversed endpoint order as equivalent only when the reversed portal word
  represents the same path;
- update computed-object policy to remove or rebuild curve-shortening pairs
  consistently after geometry changes.

Acceptance:

- same local endpoint coordinates with different portal words are not zero
  length;
- same-emitter wrapped loops are not removed as duplicates;
- geometry commit does not delete a valid wrapped locked geodesic solely because
  both endpoint anchors are the same emitter.

## Required Tests

Add tests before or with the implementation.

World-object tests:

- emitters and free geodesic ends are geodesic anchors;
- reverse lookup returns all geodesic endpoint attachments for an emitter;
- reverse lookup returns all geodesic endpoint attachments for a free end;
- aimable free geodesic requires a singly-attached free end and one emitter
  endpoint;
- protractor allows two different endpoint roles of the same geodesic;
- protractor rejects selecting the exact same endpoint role twice;
- a geodesic can be locked from an emitter back to the same emitter through a
  nonempty portal word;
- a locked same-emitter loop exposes two selectable endpoint roles at that
  emitter;
- tie/release can detach the two endpoint roles of a locked same-emitter loop;
- tie/release at one emitter in a two-emitter torus loop creates a shortening
  pair whose moving geodesics share one free-end anchor and whose remaining
  ends both attach to the other emitter;
- advancing that pair fuses into one connected wrapped geodesic;
- final fused wrapped geodesic has two emitter ends with distinct endpoint
  roles;
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

- emitter menu can show two rows for the same geodesic id when both endpoint
  roles are present;
- tie/release action sends `(geodesicId, endRole)` selections;
- tie/release highlights endpoint selections, not whole geodesic ids;
- locked same-emitter loop can be deleted from either endpoint role without
  leaving stale segment or connection state.

Computed-object tests:

- length measurements refresh after same-emitter loop fusion;
- protractor angles centered on an emitter survive wrapped geodesic rebuilds;
- geometry commit does not delete a valid wrapped locked geodesic solely because
  both endpoint anchors are the same emitter.

## Acceptance

- The torus loop scenario collapses to one locked wrapped geodesic instead of
  breaking.
- Geodesics have explicit endpoint-role identity in domain helpers and action
  payloads.
- The protractor measures angles between different endpoint roles of the same
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
operations need endpoint-role identity and portal lift data.

Treat this as a domain-model migration:

```text
anchor objects own positions where geodesics attach
geodesic objects own two endpoint attachments and one path word
reverse lookup finds all endpoint attachments attached to an anchor
segment chains are visual traces derived from geodesic records
endpoint selections are what tools select and measure
path words distinguish wrapped realizations
```

Once those concepts exist, the torus behavior becomes ordinary instead of a
special case.
