import * as THREE from "three";
import { createRayPointer, type Pointer } from "@pmndrs/pointer-events";
import type { ScenePalettePointerSource, ScenePalettePointerState } from "./scenePaletteInput";

export interface ScenePointers {
  update(scene: THREE.Object3D, sources: readonly ScenePalettePointerSource[]): readonly ScenePalettePointerState[];
  dispose(): void;
}

export function createScenePointers(
  getCamera: () => THREE.PerspectiveCamera | THREE.OrthographicCamera,
): ScenePointers {
  const entries = new Map<string, PointerEntry>();

  return {
    update(scene, sources) {
      const seenIds = new Set<string>();
      const states: ScenePalettePointerState[] = [];

      for (const source of sources) {
        seenIds.add(source.id);
        const entry = getOrCreatePointerEntry(entries, source, getCamera);
        source.object.updateMatrixWorld(true);
        entry.pointer.move(scene, createPointerEvent(source.id));

        const previousPressed = entry.selectPressed;
        if (!previousPressed && source.selectPressed) {
          entry.pointer.down(createPointerButtonEvent(source.id));
        } else if (previousPressed && !source.selectPressed) {
          entry.pointer.up(createPointerButtonEvent(source.id));
        }
        entry.selectPressed = source.selectPressed;

        states.push({
          id: source.id,
          kind: source.kind,
          hoveredTargetId: readHoveredTargetId(entry.pointer),
          selectPressed: source.selectPressed,
          selectStarted: !previousPressed && source.selectPressed,
          selectEnded: previousPressed && !source.selectPressed,
          dominant: source.dominant ?? false,
        });
      }

      for (const [id, entry] of entries) {
        if (seenIds.has(id)) {
          continue;
        }

        entry.pointer.exit(createPointerEvent(id));
        entries.delete(id);
      }

      return states;
    },
    dispose() {
      for (const [id, entry] of entries) {
        entry.pointer.exit(createPointerEvent(id));
      }
      entries.clear();
    },
  };
}

export function chooseActiveScenePointer(
  states: readonly ScenePalettePointerState[],
): ScenePalettePointerState | undefined {
  return states.find((state) => state.selectPressed)
    ?? states.find((state) => state.hoveredTargetId && state.dominant)
    ?? states.find((state) => state.hoveredTargetId)
    ?? states.find((state) => state.dominant)
    ?? states[0];
}

interface PointerEntry {
  readonly pointer: Pointer;
  selectPressed: boolean;
}

function getOrCreatePointerEntry(
  entries: Map<string, PointerEntry>,
  source: ScenePalettePointerSource,
  getCamera: () => THREE.PerspectiveCamera | THREE.OrthographicCamera,
): PointerEntry {
  const existing = entries.get(source.id);
  if (existing) {
    return existing;
  }

  const pointer = createRayPointer(getCamera, { current: source.object }, { sourceId: source.id }, undefined, "ray");
  const created: PointerEntry = {
    pointer,
    selectPressed: false,
  };
  entries.set(source.id, created);
  return created;
}

function createPointerEvent(sourceId: string): PointerEvent {
  return {
    pointerId: 1,
    pointerType: "ray",
    buttons: 0,
    sourceId,
  } as unknown as PointerEvent;
}

function createPointerButtonEvent(sourceId: string): PointerEvent & { readonly button: number } {
  return {
    ...createPointerEvent(sourceId),
    button: 0,
    buttons: 1,
  } as unknown as PointerEvent & { readonly button: number };
}

function readHoveredTargetId(pointer: Pointer): string | undefined {
  const object = pointer.getIntersection()?.object;
  return typeof object?.userData?.scenePaletteItemId === "string"
    ? object.userData.scenePaletteItemId
    : typeof object?.userData?.xrPaletteItemId === "string"
      ? object.userData.xrPaletteItemId
      : undefined;
}
