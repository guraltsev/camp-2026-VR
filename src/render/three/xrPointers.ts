import * as THREE from "three";
import { createRayPointer, type Pointer } from "@pmndrs/pointer-events";

export type XrPointerKind = "controller" | "hand";

export interface XrPointerSourceState {
  readonly id: string;
  readonly kind: XrPointerKind;
  readonly handedness: "left" | "right";
  readonly hoveredTargetId?: string;
  readonly pressed: boolean;
  readonly justStarted: boolean;
  readonly justEnded: boolean;
  readonly dominant: boolean;
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
  const entries = new Map<string, PointerEntry>();

  return {
    update(scene, sources) {
      const seenIds = new Set<string>();
      const states: XrPointerSourceState[] = [];

      for (const source of sources) {
        seenIds.add(source.id);
        const entry = getOrCreatePointerEntry(entries, source, getCamera);
        source.object.updateMatrixWorld(true);
        entry.pointer.move(scene, createPointerEvent(source.id));

        const previousPressed = entry.pressed;
        if (!previousPressed && source.pressed) {
          entry.pointer.down(createPointerButtonEvent(source.id));
        } else if (previousPressed && !source.pressed) {
          entry.pointer.up(createPointerButtonEvent(source.id));
        }
        entry.pressed = source.pressed;

        const hoveredTargetId = readHoveredTargetId(entry.pointer);
        states.push({
          id: source.id,
          kind: source.kind,
          handedness: source.handedness,
          hoveredTargetId,
          pressed: source.pressed,
          justStarted: !previousPressed && source.pressed,
          justEnded: previousPressed && !source.pressed,
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

export function chooseActiveXrPointer(
  states: readonly XrPointerSourceState[],
): XrPointerSourceState | undefined {
  return states.find((state) => state.pressed)
    ?? states.find((state) => state.hoveredTargetId && state.dominant)
    ?? states.find((state) => state.hoveredTargetId)
    ?? states.find((state) => state.dominant)
    ?? states[0];
}

interface PointerEntry {
  readonly pointer: Pointer;
  pressed: boolean;
}

function getOrCreatePointerEntry(
  entries: Map<string, PointerEntry>,
  source: UpdateXrPointerSource,
  getCamera: () => THREE.PerspectiveCamera | THREE.OrthographicCamera,
): PointerEntry {
  const existing = entries.get(source.id);
  if (existing) {
    return existing;
  }

  const pointer = createRayPointer(getCamera, { current: source.object }, { sourceId: source.id }, undefined, "ray");
  const created: PointerEntry = {
    pointer,
    pressed: false,
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
  return typeof object?.userData?.xrPaletteItemId === "string"
    ? object.userData.xrPaletteItemId
    : undefined;
}
