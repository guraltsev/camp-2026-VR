import * as THREE from "three";
import type { RuntimeInputFrame } from "./renderState";

export interface VrComfortOptions {
  readonly moveSpeedMetersPerSecond: number;
  readonly joystickDeadZone: number;
  readonly turnSpeedRadiansPerSecond: number;
  readonly maxPhysicalStepMeters: number;
  readonly antiNauseaModeEnabled: boolean;
  readonly antiNauseaVisibleFovScale: number;
  readonly antiNauseaFadeFovDegrees: number;
  readonly antiNauseaFadeSeconds: number;
  readonly antiNauseaMaxOpacity: number;
}

export const defaultVrComfortOptions: VrComfortOptions = {
  moveSpeedMetersPerSecond: 1.5,
  joystickDeadZone: 0.18,
  turnSpeedRadiansPerSecond: 1.35,
  maxPhysicalStepMeters: 0.75,
  antiNauseaModeEnabled: true,
  antiNauseaVisibleFovScale: 0.5,
  antiNauseaFadeFovDegrees: 6,
  antiNauseaFadeSeconds: 0.14,
  antiNauseaMaxOpacity: 0.96,
};

export interface VrComfortVignette {
  readonly root: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  setOptions(options: Partial<VrComfortOptions>): void;
  update(options: {
    readonly active: boolean;
    readonly deltaSeconds: number;
    readonly normalFovDegrees: number;
  }): void;
  dispose(): void;
}

export interface ComfortVignetteAngles {
  readonly innerConeRadians: number;
  readonly outerConeRadians: number;
  readonly visibleFovDegrees: number;
}

const minVisibleFovScale = 0.05;
const maxVisibleFovScale = 1;
const minFovDegrees = 1;
const maxFovDegrees = 179;
const locomotionEpsilon = 1e-5;

export function createVrComfortVignette(
  camera: THREE.Camera,
  options: Partial<VrComfortOptions> = {},
): VrComfortVignette {
  let comfort = { ...defaultVrComfortOptions, ...options };
  let opacity = 0;
  const uniforms = {
    uInnerConeCos: { value: 1 },
    uOuterConeCos: { value: 1 },
    uOpacity: { value: 0 },
  };
  const geometry = new THREE.SphereGeometry(0.5, 48, 24);
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vLocalPosition;

      void main() {
        vLocalPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vLocalPosition;
      uniform float uInnerConeCos;
      uniform float uOuterConeCos;
      uniform float uOpacity;

      void main() {
        vec3 direction = normalize(vLocalPosition);
        float cosAngle = dot(direction, vec3(0.0, 0.0, -1.0));
        float vignette = 1.0 - smoothstep(uOuterConeCos, uInnerConeCos, cosAngle);
        gl_FragColor = vec4(0.0, 0.0, 0.0, vignette * uOpacity);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const root = new THREE.Mesh(geometry, material);
  root.name = "vr-comfort-anti-nausea-vignette";
  root.frustumCulled = false;
  root.renderOrder = 2000;
  root.visible = false;
  camera.add(root);

  return {
    root,
    setOptions(nextOptions) {
      comfort = { ...comfort, ...nextOptions };
    },
    update(updateOptions) {
      const targetActive = updateOptions.active && comfort.antiNauseaModeEnabled;
      opacity = advanceComfortVignetteOpacity(opacity, targetActive, updateOptions.deltaSeconds, comfort);
      uniforms.uOpacity.value = opacity * clamp01(comfort.antiNauseaMaxOpacity);
      root.visible = uniforms.uOpacity.value > 0.001;

      if (!root.visible) {
        return;
      }

      const angles = resolveComfortVignetteAngles(updateOptions.normalFovDegrees, comfort);
      uniforms.uInnerConeCos.value = Math.cos(angles.innerConeRadians);
      uniforms.uOuterConeCos.value = Math.cos(angles.outerConeRadians);
    },
    dispose() {
      root.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

export function resolveComfortVignetteAngles(
  normalFovDegrees: number,
  options: Partial<VrComfortOptions> = {},
): ComfortVignetteAngles {
  const comfort = { ...defaultVrComfortOptions, ...options };
  const normalFov = clampNumber(normalFovDegrees, minFovDegrees, maxFovDegrees);
  const visibleScale = clampNumber(
    comfort.antiNauseaVisibleFovScale,
    minVisibleFovScale,
    maxVisibleFovScale,
  );
  const visibleFovDegrees = normalFov * visibleScale;
  const innerConeRadians = THREE.MathUtils.degToRad(visibleFovDegrees * 0.5);
  const maxConeRadians = THREE.MathUtils.degToRad(normalFov * 0.5);
  const fadeRadians = THREE.MathUtils.degToRad(Math.max(0, comfort.antiNauseaFadeFovDegrees));
  const outerConeRadians = Math.min(maxConeRadians, innerConeRadians + fadeRadians);

  return {
    innerConeRadians,
    outerConeRadians: Math.max(innerConeRadians, outerConeRadians),
    visibleFovDegrees,
  };
}

export function isArtificialLocomotionActive(
  frame: Pick<RuntimeInputFrame, "localDisplacement" | "yawDeltaRadians">,
): boolean {
  return Math.hypot(frame.localDisplacement.x, frame.localDisplacement.y, frame.localDisplacement.z) > locomotionEpsilon ||
    Math.abs(frame.yawDeltaRadians) > locomotionEpsilon;
}

export function advanceComfortVignetteOpacity(
  currentOpacity: number,
  active: boolean,
  deltaSeconds: number,
  options: Partial<VrComfortOptions> = {},
): number {
  const comfort = { ...defaultVrComfortOptions, ...options };
  const fadeSeconds = Math.max(0.001, comfort.antiNauseaFadeSeconds);
  const step = Math.max(0, deltaSeconds) / fadeSeconds;
  const target = active ? 1 : 0;

  if (currentOpacity < target) {
    return Math.min(target, currentOpacity + step);
  }

  return Math.max(target, currentOpacity - step);
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clampNumber(value, 0, 1);
}
