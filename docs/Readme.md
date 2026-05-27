# Documentation

This folder holds the living project context. Closed handoff issues remain in
`docs/issues/_closed`, but future work should consult these active documents
first.

## Living Guides

- [Development_guide.md](Development_guide.md) gives the project overview,
  repository map, stack summary, deployment notes, and links to the focused
  guides.
- [coding_style.md](coding_style.md) records code organization, naming, import
  boundaries, and implementation style.
- [documentation_style.md](documentation_style.md) records public documentation
  and in-code explanation rules.
- [testing.md](testing.md) records the testing philosophy, scripts, and what
  each kind of test should prove.

## Design Records

- [design/001-stack.md](design/001-stack.md) records the Vite, TypeScript,
  Three.js, and Vitest choice.
- [design/002-cell-complex-first.md](design/002-cell-complex-first.md) records
  the prism-cell-first runtime direction.
- [design/003-no-curvature-engine.md](design/003-no-curvature-engine.md)
  records the no-theorem-engine boundary for the first runtime.

## Handoff Packet

The staged handoff packet now begins at
[implementation-reading-order.md](implementation-reading-order.md). The
non-stage design and workflow notes were promoted into stable docs, while the
remaining stage-specific handoff files stay in `docs/llm-handoff`. Parts `01`
through `04` were completed as bootstrap work and archived in
`docs/issues/_closed` with closing notes and evidence.
