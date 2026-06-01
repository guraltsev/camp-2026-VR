# 20 - VR palette menu from shared definition

## Goal

Port the FPS palette menu to immersive VR by reusing the shared menu definition from issue 19 and rendering it with a VR-capable UI library.

This issue should not recreate widgets from scratch. It should evaluate and integrate a library-backed VR UI path for buttons, toggles, dropdown/list behavior, text, focus/hover/active states, clipping, and controller selection.

Depends on: [19_fps_dom_palette_menu.md](./19_fps_dom_palette_menu.md).

Design reference: [docs/design/011-vr-hand-tools-palette.md](../design/011-vr-hand-tools-palette.md).

## Scope

Bring the existing menu into VR:

- use the same shared palette/menu definition created for FPS mode,
- render the main page in VR:
  - empty rectangular content area,
  - upper-left cogwheel/settings button,
  - upper-right `X` close button,
- render the settings page in VR:
  - upper-right `<-` back button replacing the `X`,
  - world selector,
  - reload button,
  - debug overlay toggle,
- support controller ray hover and select,
- support hand-pinch select if hand tracking is available,
- preserve controller locomotion, reset, collision, and portal traversal,
- avoid hand-written widget implementations where the selected UI library can provide them.

## Library Direction

Default spike target: `@pmndrs/uikit`, specifically its vanilla Three.js path.

Fallback: `three-mesh-ui` if UIKit integration is too heavy or incompatible with the current renderer.

Do not migrate the app to React Three Fiber solely for this menu. `@react-three/xr` and `@react-three/uikit` are useful references, but this app currently uses plain Three.js and should stay there unless a larger renderer migration is explicitly approved.

## Required Files

Likely touched files:

- `package.json`
- `package-lock.json`
- `src/render/three/createThreeApp.ts`
- `src/render/three/xrControls.ts`
- `src/render/three/xrPlayerRig.ts`
- `src/render/three/xrSessionState.ts`

Likely new files:

- `src/render/three/vrPaletteLibraryAdapter.ts`
- `src/render/three/vrPaletteController.ts`
- `src/render/three/vrPalettePlacement.ts`
- `src/render/three/xrPointers.ts`
- `src/render/three/xrHands.ts`
- `src/render/three/xrDebugPanel.ts`

Likely tests:

- `tests/render-contract/vrPaletteController.test.ts`
- `tests/render-contract/vrPalettePlacement.test.ts`
- `tests/render-contract/xrPointers.test.ts`
- `tests/render-contract/xrHands.test.ts`

## Implementation Plan

### 1. Run a UI-library spike

Before wiring the full menu, prove the chosen library can support:

- a panel attached to a Three.js scene,
- readable text at VR menu distance,
- a button with hover/active/click states,
- a toggle control,
- a dropdown or dropdown-equivalent selector,
- a scrollable list or clipped list for long world menus,
- controller ray hover and select,
- clean per-frame update inside `renderer.setAnimationLoop(...)`,
- clean disposal when exiting XR or disposing the app.

If `@pmndrs/uikit` cannot satisfy these without substantial architecture churn, evaluate `three-mesh-ui`.

### 2. Keep the shared menu definition authoritative

The VR implementation should consume the same palette definition as the FPS DOM menu.

Do not fork menu content into a separate VR-only hierarchy. The library adapter may translate the shared definition into UI components, but the app-visible actions and item ids must remain shared.

### 3. Add VR placement

First placement target:

- when hand tracking is available, anchor the palette near the non-dominant wrist/palm,
- face the panel toward the headset,
- smooth pose changes to reduce jitter,
- freeze or stabilize while the user is actively selecting.

Fallback placement:

- attach to the off-hand controller if hands are not available,
- or place the menu in front of the headset at a comfortable distance.

### 4. Add VR input abstraction

Add one pointer abstraction for:

- controller target rays,
- hand-pinch rays or hand-point rays,
- select started/ended edges,
- hover target id,
- active pointer source.

The pointer abstraction should produce menu events and commands, not mutate world/menu state directly.

### 5. Wire controller ray selection

Use the selected UI library's event or hit-testing model if possible.

If manual ray bridging is still required:

- raycast against the library's interactive objects,
- map hits to shared item/action ids,
- dispatch the same commands used by the desktop menu.

### 6. Wire hand-pinch selection

Request optional `hand-tracking` when starting the XR session.

If hand data is available:

- detect index/thumb pinch,
- apply hysteresis so noisy hand poses do not double-click,
- use the dominant hand as the pointer by default,
- leave controller selection available as fallback.

If hand data is unavailable, the menu must remain fully usable with controllers.

### 7. Render settings behavior

The VR menu must match the FPS menu behavior:

- main page has no selectable tools,
- cog opens settings,
- `X` closes main page,
- settings page uses `<-` back in the former `X` slot,
- world selector uses the shared world catalog,
- reload dispatches `reload-world`,
- debug overlay toggle dispatches `set-debug-overlay`.

### 8. Add XR debug overlay rendering

The DOM debug overlay is not visible in immersive VR. Add a renderer-side debug panel that can be toggled from the menu.

The first version can show compact state:

- current cell id,
- XR session state,
- input mode,
- last blocked movement reason,
- visible portal path count if available.

### 9. Preserve VR runtime behavior

Do not regress:

- joystick locomotion,
- continuous turn,
- reset,
- room-scale collision approval,
- forbidden-zone blocking,
- portal traversal,
- desktop fallback.

### 10. Add tests and manual headset checks

Contract tests should cover pure menu and input behavior without requiring a headset.

Manual checks should cover:

- menu opens in headset,
- controller ray hover works,
- controller select works,
- hand-pinch select works if supported,
- settings page back behavior,
- world selector behavior,
- reload behavior,
- debug overlay toggle visibility,
- locomotion still works when the menu is closed.

## Acceptance Criteria

- The VR menu uses the shared palette definition from issue 19.
- A VR UI library handles widget rendering/layout rather than local custom widgets.
- The main VR menu shows an empty rectangular content area with no selectable tools.
- The cog opens settings.
- The `X` closes the main VR menu.
- The settings page uses `<-` back in the former `X` slot.
- Settings include a world selector, reload button, and debug overlay toggle.
- Controller ray hover/select works.
- Hand-pinch select works when hand tracking is available.
- Controller fallback works when hand tracking is unavailable.
- The debug overlay can be toggled in immersive VR.
- Existing VR locomotion, collision, reset, and portal traversal still work.
- Desktop FPS menu from issue 19 still works.
- `npm run typecheck`, `npm test`, and `npm run build` pass.

## Non-goals

- Do not implement geometry tools.
- Do not implement marker, ray, measurement, or path-trace behavior.
- Do not write custom dropdown, toggle, button, or scrolling widgets from scratch unless the library spike fails and the fallback is explicitly approved.
- Do not migrate the app to React Three Fiber as part of this issue.
- Do not require hand tracking for menu use.
- Do not hot-swap worlds inside the current XR session unless it naturally falls out of existing URL/reload behavior.

## Risks

- `@pmndrs/uikit` may require more integration work than expected in a plain Three.js app.
- Dropdown behavior in VR may be better represented as a compact scrollable list than as a literal desktop-style dropdown.
- Hand tracking support varies by browser and headset.
- Text readability and transparent panel ordering need headset testing, not only desktop inspection.
