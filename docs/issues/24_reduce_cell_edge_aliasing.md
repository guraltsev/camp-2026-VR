# 24 - Reduce aliasing at cell and portal edges

## Goal

Improve the jagged aliasing visible at cell edges and portal clipping boundaries without adding a large performance cost.

The renderer already requests antialiasing, so this issue should verify what is actually happening and then apply targeted fixes where the current pipeline still produces hard aliased edges.

## Current state

[src/render/three/createThreeApp.ts](../../src/render/three/createThreeApp.ts) creates the renderer with:

```ts
new THREE.WebGLRenderer({ antialias: true })
```

However:

- there is no explicit pixel-ratio policy,
- the canvas is sized with `window.innerWidth` and `window.innerHeight`,
- portal clipping currently uses a hard fragment `discard`,
- clip polygons are represented in NDC and converted from `gl_FragCoord`,
- hard shader discards commonly bypass the smoothing benefits that ordinary MSAA gives triangle edges.

So the fix is not simply "turn on antialiasing." The implementation needs to distinguish geometry-edge aliasing from shader clip-edge aliasing.

## Desired behavior

- cell outlines, floor/ceiling edges, and portal frames look reasonably smooth on ordinary desktop displays,
- portal clip boundaries are not visibly stair-stepped when the camera moves,
- high-DPI screens render crisply,
- low-power devices avoid an unbounded pixel-ratio cost,
- the solution does not require postprocessing unless cheaper options fail.

## Scope

In scope:

- verify and expose renderer antialias/pixel-ratio configuration,
- add a capped pixel-ratio policy,
- soften portal clip edges in the clip shader when possible,
- add debug/contract tests for viewport-to-pixel sizing helpers and shader patch contents.

Out of scope:

- full deferred/postprocessing renderer architecture,
- temporal antialiasing,
- expensive full-scene supersampling,
- changing portal path computation,
- replacing all materials.

## Required work

### 1. Add an explicit render quality policy

Create a small module, likely:

```text
src/render/three/renderQuality.ts
tests/render-contract/renderQuality.test.ts
```

It should centralize:

- `antialias: true`,
- a capped device pixel ratio,
- canvas resize dimensions,
- viewport pixel dimensions used by portal clip materials.

Recommended first pass:

```text
pixelRatio = min(window.devicePixelRatio || 1, 2)
```

Use `renderer.setPixelRatio(pixelRatio)` before `renderer.setSize(...)`. Revisit the cap only after measuring.

### 2. Keep viewport uniforms in drawing-buffer pixels if needed

Portal clipping uses `gl_FragCoord.xy`, which is in framebuffer pixels. If `renderer.setPixelRatio(...)` is added, confirm that `portalViewportPixels` matches the drawing buffer coordinate space, not only CSS pixels.

The helper currently named `rendererSizeToViewportPixels(...)` may need to use:

```text
renderer.getDrawingBufferSize(...)
```

instead of `renderer.getSize(...)` if clip edges shift or scale incorrectly on high-DPI displays.

Add a test for the helper so the convention is explicit.

### 3. Soften portal clip edges

Hard `discard` in [src/render/three/portalClipMaterial.ts](../../src/render/three/portalClipMaterial.ts) can produce aliased portal polygon borders even when MSAA is enabled.

Investigate one of these first-pass approaches:

- compute a signed edge distance in NDC/pixel units and fade alpha over roughly one pixel,
- use shader derivatives (`fwidth`) to anti-alias the half-space boundary,
- if WebGL context supports it, evaluate whether alpha-to-coverage is available and worthwhile.

Keep this conservative. A one-pixel smooth edge is enough.

If materials are opaque, this may require making portal-clipped materials transparent or using alpha test carefully. Document any depth-sorting tradeoff before applying it broadly.

### 4. Measure before adding postprocessing

Do not start with FXAA/SMAA unless the cheaper fixes are insufficient.

If postprocessing is later needed, prefer a toggleable low-cost pass and document:

- frame-time impact,
- WebGL1/WebGL2 compatibility,
- interaction with portal clip shader,
- whether it affects debug overlays.

### 5. Add diagnostics

Expose compact render-quality information through debug state or `window.noneuclidPortalDebug`, for example:

```text
antialias requested
pixel ratio
CSS canvas size
drawing buffer size
portal viewport pixels
```

This makes display-specific aliasing issues easier to diagnose.

## Tests to write

Add or extend renderer-contract tests:

```text
tests/render-contract/renderQuality.test.ts
tests/render-contract/portalClipMaterial.test.ts
```

Required coverage:

- pixel ratio is capped to the configured maximum,
- resize helpers return the expected CSS and drawing-buffer sizes,
- portal clip viewport dimensions use the same coordinate space as `gl_FragCoord`,
- the portal clip shader contains edge-smoothing logic if implemented,
- existing `viewportPixelsToNdc(...)` behavior remains consistent with NDC convention:
  - `x = -1` at the left edge,
  - `x = +1` at the right edge,
  - `y = -1` at the bottom edge,
  - `y = +1` at the top edge.

## Manual checks

- Compare before/after screenshots at normal desktop size.
- Check high-DPI display behavior with `devicePixelRatio > 1`.
- Inspect portal clip boundaries while walking slowly.
- Confirm text/debug overlays remain sharp and correctly positioned.
- Check frame time with runtime diagnostics before and after enabling the quality policy.

## Acceptance criteria

This issue is complete when:

- renderer pixel ratio and antialias settings are explicit and centralized,
- portal clip viewport uniforms match framebuffer coordinates,
- cell and portal edges are visibly less jagged,
- the solution avoids a large measurable frame-time increase,
- tests cover render-quality sizing and clip shader conventions,
- `npm.cmd test -- --run`, `npm.cmd run typecheck`, and `npm.cmd run build` pass.
