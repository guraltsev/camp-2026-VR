import * as THREE from "three";
import type { PortalClipData } from "./portalClipData";

export interface PortalClipMaterialState {
  readonly clipData: PortalClipData;
  readonly smoothClipEdges: boolean;
  readonly uniforms: {
    readonly portalClipTexture: { value: THREE.DataTexture };
    readonly portalViewportOriginPixels: { value: THREE.Vector2 };
    readonly portalViewportPixels: { value: THREE.Vector2 };
    readonly portalMaxVisiblePaths: { value: number };
    readonly portalMaxClipVerticesPerPath: { value: number };
    readonly portalClipTextureRows: { value: number };
    readonly portalClipTextureRowOffset: { value: number };
  };
}

export function createPortalClipMaterialState(
  clipData: PortalClipData,
  viewportPixels: { readonly width: number; readonly height: number },
  options: { readonly smoothClipEdges?: boolean } = {},
): PortalClipMaterialState {
  return {
    clipData,
    smoothClipEdges: options.smoothClipEdges ?? true,
    uniforms: {
      portalClipTexture: { value: clipData.texture },
      portalViewportOriginPixels: { value: new THREE.Vector2(0, 0) },
      portalViewportPixels: { value: new THREE.Vector2(viewportPixels.width, viewportPixels.height) },
      portalMaxVisiblePaths: { value: clipData.maxVisiblePaths },
      portalMaxClipVerticesPerPath: { value: clipData.maxClipVerticesPerPath },
      portalClipTextureRows: { value: clipData.clipTextureRows },
      portalClipTextureRowOffset: { value: 0 },
    },
  };
}

export function updatePortalClipMaterialViewport(
  state: PortalClipMaterialState,
  viewportPixels: { readonly width: number; readonly height: number },
  viewportOriginPixels: { readonly x: number; readonly y: number } = { x: 0, y: 0 },
): void {
  state.uniforms.portalViewportOriginPixels.value.set(viewportOriginPixels.x, viewportOriginPixels.y);
  state.uniforms.portalViewportPixels.value.set(viewportPixels.width, viewportPixels.height);
}

export function updatePortalClipMaterialTextureEye(
  state: PortalClipMaterialState,
  eyeIndex: number,
): void {
  const clampedEyeIndex = Math.min(
    state.clipData.maxClipTextureEyes - 1,
    Math.max(0, Math.floor(eyeIndex)),
  );

  state.uniforms.portalClipTextureRowOffset.value = clampedEyeIndex * Math.max(1, state.clipData.maxVisiblePaths);
}

export function updatePortalClipMaterialViewportFromRenderer(
  state: PortalClipMaterialState,
  renderer: THREE.WebGLRenderer,
): void {
  const viewport = renderer.getCurrentViewport(new THREE.Vector4());

  updatePortalClipMaterialViewport(
    state,
    { width: viewport.z, height: viewport.w },
    { x: viewport.x, y: viewport.y },
  );
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
    shader.uniforms.portalViewportOriginPixels = state.uniforms.portalViewportOriginPixels;
    shader.uniforms.portalViewportPixels = state.uniforms.portalViewportPixels;
    shader.uniforms.portalMaxVisiblePaths = state.uniforms.portalMaxVisiblePaths;
    shader.uniforms.portalMaxClipVerticesPerPath = state.uniforms.portalMaxClipVerticesPerPath;
    shader.uniforms.portalClipTextureRows = state.uniforms.portalClipTextureRows;
    shader.uniforms.portalClipTextureRowOffset = state.uniforms.portalClipTextureRowOffset;
    shader.vertexShader = patchVertexShader(shader.vertexShader);
    shader.fragmentShader = patchFragmentShader(
      shader.fragmentShader,
      state.clipData.maxVisiblePaths,
      state.clipData.maxClipVerticesPerPath,
      state.smoothClipEdges,
    );
  };
  material.customProgramCacheKey = () =>
    `portal-clip:${state.clipData.maxVisiblePaths}:${state.clipData.maxClipVerticesPerPath}:${state.smoothClipEdges ? "smooth" : "hard"}`;
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
  smoothClipEdges: boolean,
): string {
  return shader
    .replace(
      "#include <common>",
      [
        "#include <common>",
        "uniform sampler2D portalClipTexture;",
        "uniform vec2 portalViewportOriginPixels;",
        "uniform vec2 portalViewportPixels;",
        "uniform float portalMaxVisiblePaths;",
        "uniform float portalMaxClipVerticesPerPath;",
        "uniform float portalClipTextureRows;",
        "uniform float portalClipTextureRowOffset;",
        "varying float vPortalPathId;",
        "varying float vPortalClipIndex;",
        portalClipShaderFunctions(maxVisiblePaths, maxClipVerticesPerPath),
      ].join("\n"),
    )
    .replace(
      "void main() {",
      smoothClipEdges
        ? [
            "void main() {",
            "  float portalClipCoverage = portalFragmentClipCoverage(gl_FragCoord.xy, vPortalClipIndex);",
            "  if (portalClipCoverage <= 0.0) {",
            "    discard;",
            "  }",
            "  if (portalClipCoverage < 1.0 && portalInterleavedGradientNoise(gl_FragCoord.xy) > portalClipCoverage) {",
            "    discard;",
            "  }",
          ].join("\n")
        : [
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
  float textureRow = portalClipTextureRowOffset + clipIndex;
  vec2 uv = vec2(
    (float(vertexIndex) + 0.5) / portalMaxClipVerticesPerPath,
    (textureRow + 0.5) / portalClipTextureRows
  );
  return texture2D(portalClipTexture, uv).xy;
}

float portalClipVertexCount(float clipIndex) {
  float textureRow = portalClipTextureRowOffset + clipIndex;
  vec2 uv = vec2(0.5 / portalMaxClipVerticesPerPath, (textureRow + 0.5) / portalClipTextureRows);
  return texture2D(portalClipTexture, uv).z;
}

float portalInterleavedGradientNoise(vec2 fragmentPixels) {
  return fract(52.9829189 * fract(0.06711056 * fragmentPixels.x + 0.00583715 * fragmentPixels.y));
}

bool portalFragmentShouldDiscard(vec2 fragmentPixels, float clipIndex) {
  if (clipIndex < -1.5) {
    return false;
  }

  if (clipIndex < -0.5 || clipIndex >= ${maxVisiblePaths}.0) {
    return true;
  }

  float vertexCount = portalClipVertexCount(clipIndex);
  if (vertexCount < 2.5 || vertexCount > ${maxClipVerticesPerPath}.5) {
    return true;
  }

  vec2 pointNdc = vec2(
    portalViewportPixels.x <= 0.0 ? 0.0 : ((fragmentPixels.x - portalViewportOriginPixels.x) / portalViewportPixels.x) * 2.0 - 1.0,
    portalViewportPixels.y <= 0.0 ? 0.0 : ((fragmentPixels.y - portalViewportOriginPixels.y) / portalViewportPixels.y) * 2.0 - 1.0
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

float portalFragmentClipCoverage(vec2 fragmentPixels, float clipIndex) {
  if (clipIndex < -1.5) {
    return 1.0;
  }

  if (clipIndex < -0.5 || clipIndex >= ${maxVisiblePaths}.0) {
    return 0.0;
  }

  float vertexCount = portalClipVertexCount(clipIndex);
  if (vertexCount < 2.5 || vertexCount > ${maxClipVerticesPerPath}.5) {
    return 0.0;
  }

  vec2 pointNdc = vec2(
    portalViewportPixels.x <= 0.0 ? 0.0 : ((fragmentPixels.x - portalViewportOriginPixels.x) / portalViewportPixels.x) * 2.0 - 1.0,
    portalViewportPixels.y <= 0.0 ? 0.0 : ((fragmentPixels.y - portalViewportOriginPixels.y) / portalViewportPixels.y) * 2.0 - 1.0
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
  float maxNdcUnitsPerPixel = max(
    portalViewportPixels.x <= 0.0 ? 2.0 : 2.0 / portalViewportPixels.x,
    portalViewportPixels.y <= 0.0 ? 2.0 : 2.0 / portalViewportPixels.y
  );
  float minSignedDistancePixels = 1000000.0;
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
    float edgeLengthNdc = max(length(edge), 0.0001);
    float signedDistancePixels = edgeSide / (edgeLengthNdc * maxNdcUnitsPerPixel);
    if (signedDistancePixels < -0.5) {
      return 0.0;
    }
    minSignedDistancePixels = min(minSignedDistancePixels, signedDistancePixels);
  }

  return smoothstep(-0.5, 0.5, minSignedDistancePixels);
}
`;
}
