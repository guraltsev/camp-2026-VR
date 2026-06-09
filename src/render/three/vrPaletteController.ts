import * as THREE from "three";
import type { PaletteDefinition } from "../../ui/paletteDefinition";
import { createVrPaletteLibraryAdapter } from "./vrPaletteLibraryAdapter";
import { resolveVrPalettePlacement } from "./vrPalettePlacement";
import { createXrDebugPanel } from "./xrDebugPanel";
import type { XrDebugRenderState } from "./renderState";
import { createXrHands, type XrHandInputSourceLike, type XrTrackedHandState } from "./xrHands";
import { chooseActiveXrPointer, createXrPointers } from "./xrPointers";

export interface VrPaletteControllerOptions {
  readonly scene: THREE.Scene;
  readonly getCamera: () => THREE.PerspectiveCamera | THREE.OrthographicCamera;
  readonly getIsOpen: () => boolean;
  readonly onOpenRequested: () => void;
  readonly onCloseRequested: () => void;
  readonly onShowSettingsRequested: () => void;
  readonly onShowMainRequested: () => void;
  readonly onWorldSelected: (worldId: string) => void;
  readonly onReloadRequested: () => void;
  readonly onDebugOverlayToggled: (enabled: boolean) => void;
}

export interface VrPaletteControllerUpdate {
  readonly deltaSeconds: number;
  readonly xrFrame: XRFrame;
  readonly referenceSpace: XRReferenceSpace;
  readonly inputSources: readonly XRInputSource[];
  readonly definition: PaletteDefinition;
  readonly xrDebugState: XrDebugRenderState;
}

export interface VrPaletteController {
  update(frame: VrPaletteControllerUpdate): void;
  onSessionEnded(): void;
  dispose(): void;
}

const forwardAxis = new THREE.Vector3(0, 0, -1);
const worldPosition = new THREE.Vector3();
const worldQuaternion = new THREE.Quaternion();
const worldScale = new THREE.Vector3();
const rayOrigin = new THREE.Vector3();
const rayDirection = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const controllerObjects = new Map<string, THREE.Object3D>();
const handPointerObjects = new Map<string, THREE.Object3D>();

export function createVrPaletteController(options: VrPaletteControllerOptions): VrPaletteController {
  const paletteRoot = new THREE.Group();
  paletteRoot.name = "vr-palette-root";
  const adapter = createVrPaletteLibraryAdapter({
    onLeftAction(actionId) {
      if (actionId === "settings") {
        options.onShowSettingsRequested();
      }
    },
    onRightAction(actionId) {
      if (actionId === "close") {
        options.onCloseRequested();
      } else if (actionId === "back") {
        options.onShowMainRequested();
      }
    },
    onWorldSelected: options.onWorldSelected,
    onReloadRequested: options.onReloadRequested,
    onDebugOverlayToggled: options.onDebugOverlayToggled,
  });
  adapter.root.rotation.y = Math.PI;
  paletteRoot.add(adapter.root);
  const debugBacking = new THREE.Mesh(
    new THREE.PlaneGeometry(1.02, 0.72),
    new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.18,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  debugBacking.name = "vr-palette-debug-backing";
  debugBacking.position.z = 0.01;
  debugBacking.renderOrder = 998;
  paletteRoot.add(debugBacking);
  options.scene.add(paletteRoot);

  const debugPanel = createXrDebugPanel();
  options.scene.add(debugPanel.root);

  const xrHands = createXrHands();
  const xrPointers = createXrPointers(options.getCamera);
  let currentDefinitionSignature = "";
  let previousPosition: THREE.Vector3 | undefined;
  let previousQuaternion: THREE.Quaternion | undefined;
  let openedOnceInSession = false;
  let previousMenuTogglePressed = false;

  return {
    update(frame) {
      if (!openedOnceInSession) {
        openedOnceInSession = true;
        if (!options.getIsOpen()) {
          options.onOpenRequested();
        }
      }

      const definitionSignature = JSON.stringify(frame.definition);
      if (definitionSignature !== currentDefinitionSignature) {
        currentDefinitionSignature = definitionSignature;
        adapter.setDefinition(frame.definition);
      }

      const camera = options.getCamera();
      camera.updateMatrixWorld(true);
      camera.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
      const hands = xrHands.update(frame.inputSources as readonly XrHandInputSourceLike[], frame.xrFrame, frame.referenceSpace);
      const controllerSources = createControllerSources(frame.inputSources, frame.xrFrame, frame.referenceSpace);
      const handSources = createHandSources(hands);
      const pointerStates = xrPointers.update(options.scene, [...controllerSources.pointerSources, ...handSources.pointerSources]);
      const activePointer = chooseActiveXrPointer(pointerStates);
      const anyPointerPressed = pointerStates.some((state) => state.pressed);

      const menuTogglePressed = controllerSources.menuTogglePressed;
      if (menuTogglePressed && !previousMenuTogglePressed) {
        if (options.getIsOpen()) {
          options.onCloseRequested();
        } else {
          options.onOpenRequested();
        }
      }
      previousMenuTogglePressed = menuTogglePressed;

      const placement = resolveVrPalettePlacement({
        head: {
          position: worldPosition,
          quaternion: worldQuaternion,
        },
        hand: handSources.anchor,
        // Head-locked fallback is much easier to recover visually than
        // an off-hand attachment when we are still proving the XR menu path.
        controller: hands.length > 0 ? controllerSources.anchor : undefined,
        previousPosition,
        previousQuaternion,
        smoothing: 0.22,
        freeze: anyPointerPressed,
      });
      previousPosition = placement.position.clone();
      previousQuaternion = placement.quaternion.clone();
      paletteRoot.position.copy(placement.position);
      paletteRoot.quaternion.copy(placement.quaternion);
      paletteRoot.updateMatrixWorld(true);
      adapter.setVisible(options.getIsOpen());
      debugBacking.visible = options.getIsOpen();
      adapter.update(frame.deltaSeconds * 1000);
      const pointerSourcesById = new Map(
        [...controllerSources.pointerSources, ...handSources.pointerSources].map((source) => [source.id, source] as const),
      );
      const activePointerSource = activePointer ? pointerSourcesById.get(activePointer.id) : undefined;
      const hoveredAction = options.getIsOpen() && activePointerSource
        ? resolvePaletteActionHit(adapter.root, activePointerSource.object)
        : undefined;
      if (hoveredAction && activePointer?.justStarted) {
        hoveredAction();
      }

      debugPanel.root.position.copy(placement.position).add(new THREE.Vector3(0, -0.22, 0).applyQuaternion(placement.quaternion));
      debugPanel.root.quaternion.copy(placement.quaternion);
      debugPanel.update({
        ...frame.xrDebugState,
        inputMode: describeVrInputMode(hands.length > 0, controllerSources.pointerSources.length > 0, activePointer?.kind),
      }, options.getIsOpen() && frame.definition.content.kind === "settings" && frame.definition.content.debugOverlayEnabled);
    },
    onSessionEnded() {
      openedOnceInSession = false;
      previousMenuTogglePressed = false;
      previousPosition = undefined;
      previousQuaternion = undefined;
      adapter.setVisible(false);
      debugBacking.visible = false;
      debugPanel.update({
        secureContext: true,
        sessionStatus: "ended",
        activeInputSource: "xr",
        currentCellId: "",
        playerPosition: { x: 0, y: 0, z: 0 },
        yawRadians: 0,
        lastMovementBlocked: false,
      }, false);
      xrPointers.dispose();
    },
    dispose() {
      xrPointers.dispose();
      adapter.dispose();
      paletteRoot.removeFromParent();
      debugBacking.geometry.dispose();
      (debugBacking.material as THREE.Material).dispose();
      debugPanel.dispose();
      controllerObjects.clear();
      handPointerObjects.clear();
    },
  };
}

function createControllerSources(
  inputSources: readonly XRInputSource[],
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
): {
  readonly pointerSources: readonly {
    readonly id: string;
    readonly kind: "controller";
    readonly handedness: "left" | "right";
    readonly object: THREE.Object3D;
    readonly pressed: boolean;
    readonly dominant: boolean;
  }[];
  readonly anchor?: { readonly position: THREE.Vector3; readonly quaternion: THREE.Quaternion };
  readonly menuTogglePressed: boolean;
} {
  const pointerSources: Array<{
    readonly id: string;
    readonly kind: "controller";
    readonly handedness: "left" | "right";
    readonly object: THREE.Object3D;
    readonly pressed: boolean;
    readonly dominant: boolean;
  }> = [];
  let anchor: { readonly position: THREE.Vector3; readonly quaternion: THREE.Quaternion } | undefined;
  let menuTogglePressed = false;

  for (const source of inputSources) {
    const handedness = source.handedness === "left" || source.handedness === "right" ? source.handedness : undefined;
    if (!handedness || source.hand) {
      continue;
    }

    const pose = frame.getPose(source.targetRaySpace, referenceSpace);
    if (!pose) {
      continue;
    }

    const id = `controller:${handedness}`;
    const object = controllerObjects.get(id) ?? new THREE.Object3D();
    object.position.set(pose.transform.position.x, pose.transform.position.y, pose.transform.position.z);
    object.quaternion.set(
      pose.transform.orientation.x,
      pose.transform.orientation.y,
      pose.transform.orientation.z,
      pose.transform.orientation.w,
    );
    object.updateMatrixWorld(true);
    controllerObjects.set(id, object);

    if (handedness === "left") {
      anchor = {
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
      };
      menuTogglePressed ||= isMenuTogglePressed(source.gamepad);
    }

    pointerSources.push({
      id,
      kind: "controller",
      handedness,
      object,
      pressed: isSelectPressed(source.gamepad),
      dominant: handedness === "right",
    });
  }

  return {
    pointerSources,
    anchor,
    menuTogglePressed,
  };
}

function createHandSources(
  hands: readonly XrTrackedHandState[],
): {
  readonly pointerSources: readonly {
    readonly id: string;
    readonly kind: "hand";
    readonly handedness: "left" | "right";
    readonly object: THREE.Object3D;
    readonly pressed: boolean;
    readonly dominant: boolean;
  }[];
  readonly anchor?: { readonly position: THREE.Vector3; readonly quaternion: THREE.Quaternion };
} {
  const pointerSources: Array<{
    readonly id: string;
    readonly kind: "hand";
    readonly handedness: "left" | "right";
    readonly object: THREE.Object3D;
    readonly pressed: boolean;
    readonly dominant: boolean;
  }> = [];
  let anchor: { readonly position: THREE.Vector3; readonly quaternion: THREE.Quaternion } | undefined;

  for (const hand of hands) {
    const id = `hand:${hand.handedness}`;
    const object = handPointerObjects.get(id) ?? new THREE.Object3D();
    object.position.copy(hand.indexTip);
    object.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(forwardAxis, hand.pinchDirection));
    object.updateMatrixWorld(true);
    handPointerObjects.set(id, object);

    if (hand.handedness === "left") {
      anchor = {
        position: hand.wrist.clone(),
        quaternion: hand.wristQuaternion.clone(),
      };
    }

    pointerSources.push({
      id,
      kind: "hand",
      handedness: hand.handedness,
      object,
      pressed: hand.pressed,
      dominant: hand.handedness === "right",
    });
  }

  return {
    pointerSources,
    anchor,
  };
}

function isSelectPressed(gamepad: XRInputSource["gamepad"] | undefined): boolean {
  return gamepad?.buttons?.[0]?.pressed === true;
}

function isMenuTogglePressed(gamepad: XRInputSource["gamepad"] | undefined): boolean {
  return gamepad?.buttons?.[1]?.pressed === true
    || gamepad?.buttons?.[3]?.pressed === true
    || gamepad?.buttons?.[4]?.pressed === true
    || gamepad?.buttons?.[5]?.pressed === true;
}

export function describeVrInputMode(
  hasHands: boolean,
  hasControllers: boolean,
  activeKind: "controller" | "hand" | undefined,
): string {
  if (activeKind === "hand") {
    return hasControllers ? "hybrid-hands" : "hands";
  }
  if (activeKind === "controller") {
    return hasHands ? "hybrid-controllers" : "controllers";
  }
  if (hasHands && hasControllers) {
    return "hybrid";
  }
  if (hasHands) {
    return "hands";
  }
  if (hasControllers) {
    return "controllers";
  }
  return "xr";
}

function resolvePaletteActionHit(
  root: THREE.Object3D,
  sourceObject: THREE.Object3D,
): (() => void) | undefined {
  sourceObject.updateMatrixWorld(true);
  sourceObject.matrixWorld.decompose(rayOrigin, worldQuaternion, worldScale);
  rayDirection.copy(forwardAxis).applyQuaternion(worldQuaternion).normalize();
  raycaster.ray.origin.copy(rayOrigin);
  raycaster.ray.direction.copy(rayDirection);
  raycaster.near = 0.01;
  raycaster.far = 4;

  const intersections = raycaster.intersectObject(root, true);
  for (const intersection of intersections) {
    const action = findPaletteAction(intersection.object);
    if (action) {
      return action;
    }
  }

  return undefined;
}

function findPaletteAction(object: THREE.Object3D | null): (() => void) | undefined {
  let current: THREE.Object3D | null = object;

  while (current) {
    const action = current.userData.xrPaletteAction;
    if (typeof action === "function") {
      return action as () => void;
    }
    current = current.parent;
  }

  return undefined;
}
