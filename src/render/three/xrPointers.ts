import * as THREE from "three";
import {
  chooseActiveScenePointer,
  createScenePointers,
} from "./scenePointers";
import type { ScenePalettePointerState, ScenePalettePointerSource } from "./scenePaletteInput";

export type XrPointerKind = "controller";

export interface XrPointerSourceState extends Omit<ScenePalettePointerState, "kind" | "selectPressed" | "selectStarted" | "selectEnded"> {
  readonly id: string;
  readonly kind: XrPointerKind;
  readonly handedness: "left" | "right";
  readonly pressed: boolean;
  readonly justStarted: boolean;
  readonly justEnded: boolean;
}

export interface UpdateXrPointerSource {
  readonly id: string;
  readonly kind: XrPointerKind;
  readonly handedness: "left" | "right";
  readonly object: THREE.Object3D;
  readonly pressed: boolean;
  readonly dominant?: boolean;
}

export interface XrPointers {
  update(scene: THREE.Object3D, sources: readonly UpdateXrPointerSource[]): readonly XrPointerSourceState[];
  dispose(): void;
}

export function createXrPointers(
  getCamera: () => THREE.PerspectiveCamera | THREE.OrthographicCamera,
): XrPointers {
  const pointers = createScenePointers(getCamera);

  return {
    update(scene, sources) {
      const sourceById = new Map(sources.map((source) => [source.id, source] as const));
      return pointers.update(scene, sources.map(toScenePointerSource)).map((state): XrPointerSourceState => {
        const source = sourceById.get(state.id);
        if (!source) {
          throw new Error(`Missing XR pointer source for ${state.id}.`);
        }
        return {
          id: source.id,
          kind: source.kind,
          handedness: source.handedness,
          hoveredTargetId: state.hoveredTargetId,
          pressed: state.selectPressed,
          justStarted: state.selectStarted,
          justEnded: state.selectEnded,
          dominant: state.dominant,
        };
      });
    },
    dispose() {
      pointers.dispose();
    },
  };
}

export function chooseActiveXrPointer(
  states: readonly XrPointerSourceState[],
): XrPointerSourceState | undefined {
  const active = chooseActiveScenePointer(states.map((state): ScenePalettePointerState => ({
    id: state.id,
    kind: "xr-controller",
    hoveredTargetId: state.hoveredTargetId,
    selectPressed: state.pressed,
    selectStarted: state.justStarted,
    selectEnded: state.justEnded,
    dominant: state.dominant,
  })));
  return active ? states.find((state) => state.id === active.id) : undefined;
}

function toScenePointerSource(source: UpdateXrPointerSource): ScenePalettePointerSource {
  return {
    id: source.id,
    kind: "xr-controller",
    object: source.object,
    selectPressed: source.pressed,
    dominant: source.dominant,
  };
}
