import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createPortalClipData } from "../../src/render/three/portalClipData";
import {
  createPortalClipMaterialState,
  patchPortalClipMaterial,
  updatePortalClipMaterialViewport,
  viewportPixelsToNdc,
} from "../../src/render/three/portalClipMaterial";

describe("portal clip material", () => {
  it("uses WebGL bottom-left pixel coordinates when converting viewport pixels to NDC", () => {
    expect(viewportPixelsToNdc({ x: 0, y: 0 }, { width: 800, height: 600 })).toEqual({ x: -1, y: -1 });
    expect(viewportPixelsToNdc({ x: 800, y: 600 }, { width: 800, height: 600 })).toEqual({ x: 1, y: 1 });
    expect(viewportPixelsToNdc({ x: 400, y: 300 }, { width: 800, height: 600 })).toEqual({ x: 0, y: 0 });
  });

  it("patches materials with portal clip attributes, uniforms, and discard shader code", () => {
    const clipData = createPortalClipData({ maxVisiblePaths: 16, maxClipVerticesPerPath: 8 });
    const state = createPortalClipMaterialState(clipData, { width: 800, height: 600 });
    const material = patchPortalClipMaterial(new THREE.MeshBasicMaterial(), state) as THREE.Material;
    const shader = {
      uniforms: {},
      vertexShader: [
        "#include <common>",
        "void main() {",
        "#include <begin_vertex>",
        "}",
      ].join("\n"),
      fragmentShader: [
        "#include <common>",
        "void main() {",
        "gl_FragColor = vec4(1.0);",
        "}",
      ].join("\n"),
    };

    material.onBeforeCompile(shader as Parameters<THREE.Material["onBeforeCompile"]>[0], {} as THREE.WebGLRenderer);

    expect(shader.vertexShader).toContain("attribute float portalPathId;");
    expect(shader.vertexShader).toContain("attribute float portalClipIndex;");
    expect(shader.fragmentShader).toContain("portalFragmentShouldDiscard(gl_FragCoord.xy, vPortalClipIndex)");
    expect(shader.fragmentShader).toContain("for (int index = 0; index < 8; index++)");
    expect(Object.keys(shader.uniforms)).toEqual(
      expect.arrayContaining([
        "portalClipTexture",
        "portalViewportPixels",
        "portalMaxVisiblePaths",
        "portalMaxClipVerticesPerPath",
      ]),
    );

    updatePortalClipMaterialViewport(state, { width: 320, height: 240 });
    expect(state.uniforms.portalViewportPixels.value).toMatchObject({ x: 320, y: 240 });

    clipData.dispose();
  });
});
