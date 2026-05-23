# Documentation Style

Documentation should make future implementation sessions safer, not create a
second product.

## Public Documentation

Use public docs for durable project context:

- What the project is for.
- What the project is explicitly not doing yet.
- Which architectural boundaries matter.
- Which decisions should not be relitigated without new evidence.
- How to run, test, build, and deploy the app.

Do not create a documentation site during the first implementation.

## JSDoc

Public JSDoc should document contracts, intended use, observable behavior,
guarantees, limitations, inputs, outputs, side effects, and intentional errors.

Do not use JSDoc as a source-code tour. If a function has a dense algorithm,
put narration in block comments inside the function instead.

## In-Code Narration

Code should read like an explained calculation. Use short comments before
nontrivial blocks to explain what the next block establishes, preserves,
constructs, or rejects.

Good:

```ts
// Reject a portal that touches a forbidden junction too closely. The player
// must always cross through the interior of a portal face.
if (distanceToPortalJunction < forbiddenRadiusMeters) {
  return blockedByForbiddenZone(...);
}
```

Avoid comments that merely restate syntax:

```ts
// Check distance.
if (distance < radius) {
  // ...
}
```

## Decision Notes

Use tiny private decision notes when a choice could otherwise be relitigated by
future sessions. Decision notes live in `docs/design` and should answer:

- What did we decide?
- Why now?
- What are we explicitly not deciding?
- What would cause us to revisit this?

Closed one-off work belongs in `docs/issues/_closed` with a closing note and
evidence, but closed issue files should not be the main source of living project
context.
