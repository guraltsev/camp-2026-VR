# 00 - Index for the LLM handoff packet

This folder is the ordered design handoff for rebuilding the flattened cube experience from the ground up.

Read the files in numeric order. Each file is written for an LLM-assisted implementation workflow where the human developer is a professional mathematician and lower-intermediate programmer. The instructions are intentionally concrete, but they are still scaffolding instructions rather than a final implementation spec.

## Ordered files

1. `00_index.md` - this reading map.
2. `../issues/_closed/01_project_brief.md` - closed; project purpose, audience, non-goals, and corrected teaching stance.
3. `../issues/_closed/02_development_principles.md` - closed; code style, testing philosophy, and LLM behavior rules.
4. `../issues/_closed/03_tech_stack_and_deployment.md` - closed; TypeScript, Vite, Three.js, WebXR, tests, and GitHub Pages branch deployment.
5. `../issues/_closed/04_repository_scaffold.md` - closed; target directory structure and import boundaries.
6. `05_domain_language.md` - shared vocabulary for cells, portals, rays, tools, and forbidden zones.
7. `06_authoring_model.md` - TypeScript world specs now, compiler/QR authoring later.
8. `07_runtime_contracts.md` - public data contracts the implementation should stabilize early.
9. `08_testing_strategy.md` - behavior tests, stage gates, and forbidden implementation-locking tests.
10. `09_llm_workflow.md` - how an LLM should work on this codebase.
11. `10_stage_00_bootstrap.md` - initial empty project and tooling scaffold.
12. `11_stage_01_math_primitives.md` - vectors, transforms, planes, polygons, tolerances.
13. `12_stage_02_prism_cell_compiler.md` - first implemented cell type and portal validation.
14. `13_stage_03_movement_collision_portals.md` - player movement, collision, portal crossing, and 15 cm forbidden zones.
15. `14_stage_04_three_desktop_scene.md` - first visible world with desktop controls.
16. `15_stage_05_portal_viewing.md` - one-hop and recursive portal visibility.
17. `16_stage_06_straight_ray_tool.md` - shoot locally straight rays through portals.
18. `17_stage_07_environment_tools.md` - markers, path traces, rulers, angle tools, and non-teaching data capture.
19. `18_stage_08_webxr_vr_controls.md` - VR entry, controllers, comfort, and fallback behavior.
20. `19_stage_09_classroom_hardening.md` - resets, preflight checks, teacher workflow, and static deployment checks.
21. `20_stage_10_authoring_compiler_and_qr.md` - optional next-year compiler and QR marker authoring app.
22. `21_stage_11_general_volume_cells_later.md` - later true 3D cells without pretending they exist now.
23. `22_stage_12_cleanup_pass.md` - second user-initiated cleanup/documentation pass.
24. `23_acceptance_checklists.md` - compact global and stage-specific exit criteria.
25. `24_example_llm_prompts.md` - ready-to-use prompts for future implementation sessions.

## Core design correction

The software is not a theorem tutor. It should provide a reliable explorable environment.

Do not build a theorem engine. Do not compute curvature effects. Do not compute Gauss-Bonnet, holonomy values, Euler characteristic, or point-to-point geodesics as part of the first implementation. Those ideas may be discovered by students using the environment, physical discussion, instructor guidance, and later optional tools.

The first mathematical tool is a locally straight ray tool: aim, shoot, cross portals by rigid transforms, stop at a wall, forbidden zone, maximum distance, or maximum portal count.

## First implemented world model

The runtime should be 3D-cell aware from the beginning, but the first implemented cell type is a vertical prism over a 2D polygonal base.

A prism cell has:

- a floor,
- a ceiling,
- vertical side faces,
- ordinary walls on non-portal side faces,
- portal faces on selected side faces,
- decorations and markers placed in local cell coordinates.

The floor and ceiling are ordinary collision surfaces and have no portals in the first implementation.

## Absolute rule about singular-looking places

A player or placed tool must never come closer than 15 cm to a portal junction.

A portal junction is a codimension-2 place where two or more portal faces meet. In a prism cell, this is usually a vertical edge where two portal walls meet. The code should treat this as a movement/collision safety rule, not as a curvature calculation.
