import * as THREE from "three";
import type { PortalClipData } from "./portalClipData";

export interface PortalClipMaterialState {
  readonly clipData: PortalClipData;
  readonly uniforms: {
    readonly portalClipTexture: { value: THREE.DataTexture };
    readonly portalViewportPixels: { value: THREE.Vector2 };
    readonly portalMaxVisiblePaths: { value: number };
    readonly portalMaxClipVerticesPerPath: { value: number };
  };
}

export function createPortalClipMaterialState(
  clipData: PortalClipData,
  viewportPixels: { readonly width: number; readonly height: number },
): PortalClipMaterialState {
  return {
    clipData,
    uniforms: {
      portalClipTexture: { value: clipData.texture },
      portalViewportPixels: { value: new THREE.Vector2(viewportPixels.width, viewportPixels.height) },
      portalMaxVisiblePaths: { value: clipData.maxVisiblePaths },
      portalMaxClipVerticesPerPath: { value: clipData.maxClipVerticesPerPath },
    },
  };
}

export function updatePortalClipMaterialViewport(
  state: PortalClipMaterialState,
  viewportPixels: { readonly width: number; readonly height: number },
): void {
  state.uniforms.portalViewportPixels.value.set(viewportPixels.width, viewportPixels.height);
}

export function patchPortalClipMaterial(
  material: THREE.Material | THREE.Material[],
  state: PortalClipMaterialState,
): THREE.Material | THREE.Material[] {
  if (Array.isArray(material)) {
    return material.map((entry) => patchSinglePortalClipMaterial(entry, state));
  }

  return patchSinglePortalClipMaterial(material, state);
}

export function viewportPixelsToNdc(
  pointPixels: { readonly x: number; readonly y: number },
  viewportPixels: { readonly width: number; readonly height: number },
): { readonly x: number; readonly y: number } {
  return {
    x: viewportPixels.width === 0 ? 0 : (pointPixels.x / viewportPixels.width) * 2 - 1,
    y: viewportPixels.height === 0 ? 0 : (pointPixels.y / viewportPixels.height) * 2 - 1,
  };
}

function patchSinglePortalClipMaterial(
  material: THREE.Material,
  state: PortalClipMaterialState,
): THREE.Material {
  const previousOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile.call(material, shader, renderer);
    shader.uniforms.portalClipTexture = state.uniforms.portalClipTexture;
    shader.uniforms.portalViewportPixels = state.uniforms.portalViewportPixels;
    shader.uniforms.portalMaxVisiblePaths = state.uniforms.portalMaxVisiblePaths;
    shader.uniforms.portalMaxClipVerticesPerPath = state.uniforms.portalMaxClipVerticesPerPath;
    shader.vertexShader = patchVertexShader(shader.vertexShader);
    shader.fragmentShader = patchFragmentShader(
      shader.fragmentShader,
      state.clipData.maxVisiblePaths,
      state.clipData.maxClipVerticesPerPath,
    );
  };
  material.customProgramCacheKey = () =>
    `portal-clip:${state.clipData.maxVisiblePaths}:${state.clipData.maxClipVerticesPerPath}`;
  material.needsUpdate = true;
  return material;
}

function patchVertexShader(shader: string): string {
  return shader
    .replace(
      "#include <common>",
      [
        "#include <common>",
        "attribute float portalPathId;",
        "attribute float portalClipIndex;",
        "varying float vPortalPathId;",
        "varying float vPortalClipIndex;",
      ].join("\n"),
    )
    .replace(
      "#include <begin_vertex>",
      [
        "vPortalPathId = portalPathId;",
        "vPortalClipIndex = portalClipIndex;",
        "#include <begin_vertex>",
      ].join("\n"),
    );
}

function patchFragmentShader(
  shader: string,
  maxVisiblePaths: number,
  maxClipVerticesPerPath: number,
): string {
  return shader
    .replace(
      "#include <common>",
      [
        "#include <common>",
        "uniform sampler2D portalClipTexture;",
        "uniform vec2 portalViewportPixels;",
        "uniform float portalMaxVisiblePaths;",
        "uniform float portalMaxClipVerticesPerPath;",
        "varying float vPortalPathId;",
        "varying float vPortalClipIndex;",
        portalClipShaderFunctions(maxVisiblePaths, maxClipVerticesPerPath),
      ].join("\n"),
    )
    .replace(
      "void main() {",
      [
        "void main() {",
        "  if (portalFragmentShouldDiscard(gl_FragCoord.xy, vPortalClipIndex)) {",
        "    discard;",
        "  }",
      ].join("\n"),
    );
}

function portalClipShaderFunctions(maxVisiblePaths: number, maxClipVerticesPerPath: number): string {
  return `
vec2 portalClipVertex(float clipIndex, int vertexIndex) {
  vec2 uv = vec2(
    (float(vertexIndex) + 0.5) / portalMaxClipVerticesPerPath,
    (clipIndex + 0.5) / portalMaxVisiblePaths
  );
  return texture2D(portalClipTexture, uv).xy;
}

float portalClipVertexCount(float clipIndex) {
  vec2 uv = vec2(0.5 / portalMaxClipVerticesPerPath, (clipIndex + 0.5) / portalMaxVisiblePaths);
  return texture2D(portalClipTexture, uv).z;
}

bool portalFragmentShouldDiscard(vec2 fragmentPixels, float clipIndex) {
  if (clipIndex < -0.5 || clipIndex >= ${maxVisiblePaths}.0) {
    return true;
  }

  float vertexCount = portalClipVertexCount(clipIndex);
  if (vertexCount < 2.5 || vertexCount > ${maxClipVerticesPerPath}.5) {
    return true;
  }

  vec2 pointNdc = vec2(
    portalViewportPixels.x <= 0.0 ? 0.0 : (fragmentPixels.x / portalViewportPixels.x) * 2.0 - 1.0,
    portalViewportPixels.y <= 0.0 ? 0.0 : (fragmentPixels.y / portalViewportPixels.y) * 2.0 - 1.0
  );
  float twiceArea = 0.0;

  for (int index = 0; index < ${maxClipVerticesPerPath}; index++) {
    if (float(index) >= vertexCount) {
      break;
    }
    int nextIndex = index + 1;
    if (float(nextIndex) >= vertexCount) {
      nextIndex = 0;
    }
    vec2 current = portalClipVertex(clipIndex, index);
    vec2 next = portalClipVertex(clipIndex, nextIndex);
    twiceArea += current.x * next.y - next.x * current.y;
  }

  float clipSign = twiceArea < 0.0 ? -1.0 : 1.0;
  for (int index = 0; index < ${maxClipVerticesPerPath}; index++) {
    if (float(index) >= vertexCount) {
      break;
    }
    int nextIndex = index + 1;
    if (float(nextIndex) >= vertexCount) {
      nextIndex = 0;
    }
    vec2 current = portalClipVertex(clipIndex, index);
    vec2 next = portalClipVertex(clipIndex, nextIndex);
    vec2 edge = next - current;
    vec2 toPoint = pointNdc - current;
    float edgeSide = clipSign * (edge.x * toPoint.y - edge.y * toPoint.x);
    if (edgeSide < -0.00001) {
      return true;
    }
  }

  return false;
}
`;
}
