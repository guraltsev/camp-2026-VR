import * as THREE from "three";

export type ScenePalettePointerKind = "desktop-aimer" | "xr-controller" | "xr-hand";

export interface ScenePalettePointerSource {
  readonly id: string;
  readonly kind: ScenePalettePointerKind;
  readonly object: THREE.Object3D;
  readonly selectPressed: boolean;
  readonly dominant?: boolean;
  readonly visibleRay?: boolean;
}

export interface ScenePaletteInputFrame {
  readonly deltaSeconds: number;
  readonly menuTogglePressed: boolean;
  readonly pointers: readonly ScenePalettePointerSource[];
}

export interface ScenePalettePointerState {
  readonly id: string;
  readonly kind: ScenePalettePointerKind;
  readonly hoveredTargetId?: string;
  readonly selectPressed: boolean;
  readonly selectStarted: boolean;
  readonly selectEnded: boolean;
  readonly dominant: boolean;
}

export interface ScenePalettePlacement {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly scale?: number;
  readonly freeze?: boolean;
}
