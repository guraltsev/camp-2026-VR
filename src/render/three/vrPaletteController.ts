import * as THREE from "three";
import type { PaletteDefinition } from "../../ui/paletteDefinition";
import { createVrPaletteLibraryAdapter } from "./vrPaletteLibraryAdapter";
import { resolveVrPalettePlacement } from "./vrPalettePlacement";
import { createXrDebugPanel } from "./xrDebugPanel";
import type { XrDebugRenderState } from "./renderState";
import { createXrControllerHandModels } from "./xrControllerHandModels";
import { xrRigidTransformLocalMatrix } from "./xrPlayerRig";
import { chooseActiveXrPointer, createXrPointers } from "./xrPointers";
import type { PortalPanelModeId } from "../../glue/portalPanelMode";
import type {
  RuntimeDebugOverlayItemId,
  RuntimeMenuConsoleLogLevelId,
} from "../../runtime/runtimeMenuState";

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
  readonly onDebugEnabledChanged: (enabled: boolean) => void;
  readonly onDebugSettingsRequested: () => void;
  readonly onConsoleLogLevelSelected: (level: RuntimeMenuConsoleLogLevelId) => void;
  readonly onDebugOverlayToggled: (enabled: boolean) => void;
  readonly onDebugOverlayItemToggled: (itemId: RuntimeDebugOverlayItemId, enabled: boolean) => void;
  readonly onPortalPanelModeSelected: (mode: PortalPanelModeId) => void;
  readonly onPortalInspectionToggled: (enabled: boolean) => void;
  readonly onCollisionGeometryWireframesToggled: (enabled: boolean) => void;
}

export interface VrPaletteControllerUpdate {
  readonly deltaSeconds: number;
  readonly xrFrame: XRFrame;
  readonly referenceSpace: XRReferenceSpace;
  readonly referenceSpaceToWorldMatrix: THREE.Matrix4;
  readonly inputSources: readonly XRInputSource[];
  readonly definition: PaletteDefinition;
  readonly debugPanelVisible: boolean;
  readonly debugOverlayItems: readonly RuntimeDebugOverlayItemId[];
  readonly xrDebugState: XrDebugRenderState;
  readonly frameRateFps?: number;
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
const controllerRayObjects = new Map<string, THREE.Line>();
const debugPanelCameraOffset = new THREE.Vector3(-0.12, 0.24, -0.9);

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
    onDebugEnabledChanged: options.onDebugEnabledChanged,
    onDebugSettingsRequested: options.onDebugSettingsRequested,
    onConsoleLogLevelSelected: options.onConsoleLogLevelSelected,
    onDebugOverlayToggled: options.onDebugOverlayToggled,
    onDebugOverlayItemToggled: options.onDebugOverlayItemToggled,
    onPortalPanelModeSelected: options.onPortalPanelModeSelected,
    onPortalInspectionToggled: options.onPortalInspectionToggled,
    onCollisionGeometryWireframesToggled: options.onCollisionGeometryWireframesToggled,
  });
  adapter.root.rotation.y = Math.PI;
  paletteRoot.add(adapter.root);
  options.scene.add(paletteRoot);

  const debugPanel = createXrDebugPanel();
  const camera = options.getCamera();
  debugPanel.root.position.copy(debugPanelCameraOffset);
  debugPanel.root.quaternion.identity();
  camera.add(debugPanel.root);

  const controllerHandModels = createXrControllerHandModels(options.scene);
  const xrPointers = createXrPointers(options.getCamera);
  let currentDefinitionSignature = "";
  let previousPosition: THREE.Vector3 | undefined;
  let previousQuaternion: THREE.Quaternion | undefined;
  let previousMenuTogglePressed = false;

  return {
    update(frame) {
      const definitionSignature = JSON.stringify(frame.definition);
      if (definitionSignature !== currentDefinitionSignature) {
        currentDefinitionSignature = definitionSignature;
        adapter.setDefinition(frame.definition);
      }

      const frameCamera = options.getCamera();
      frameCamera.updateMatrixWorld(true);
      frameCamera.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
      const controllerSources = createControllerSources(
        frame.inputSources,
        frame.xrFrame,
        frame.referenceSpace,
        frame.referenceSpaceToWorldMatrix,
      );
      controllerHandModels.update({
        inputSources: frame.inputSources,
        xrFrame: frame.xrFrame,
        referenceSpace: frame.referenceSpace,
        referenceSpaceToWorldMatrix: frame.referenceSpaceToWorldMatrix,
      });
      syncControllerRays(options.scene, controllerSources.pointerSources, options.getIsOpen());
      const pointerStates = xrPointers.update(options.scene, controllerSources.pointerSources);
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
      adapter.update(frame.deltaSeconds * 1000);
      const pointerSourcesById = new Map(controllerSources.pointerSources.map((source) => [source.id, source] as const));
      const activePointerSource = activePointer ? pointerSourcesById.get(activePointer.id) : undefined;
      const hoveredAction = options.getIsOpen() && activePointerSource
        ? resolvePaletteActionHit(adapter.root, activePointerSource.object)
        : undefined;
      if (hoveredAction && activePointer?.justStarted) {
        hoveredAction();
      }

      debugPanel.update({
        ...frame.xrDebugState,
        frameRateFps: frame.frameRateFps,
        inputMode: describeVrInputMode(controllerSources.pointerSources.length > 0, activePointer?.kind),
      }, frame.debugPanelVisible, frame.debugOverlayItems);
    },
    onSessionEnded() {
      previousMenuTogglePressed = false;
      previousPosition = undefined;
      previousQuaternion = undefined;
      adapter.setVisible(false);
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
      hideControllerRays();
    },
    dispose() {
      xrPointers.dispose();
      controllerHandModels.dispose();
      adapter.dispose();
      paletteRoot.removeFromParent();
      debugPanel.dispose();
      controllerObjects.clear();
      disposeControllerRays();
    },
  };
}

function createControllerSources(
  inputSources: readonly XRInputSource[],
  frame: XRFrame,
  referenceSpace: XRReferenceSpace,
  referenceSpaceToWorldMatrix: THREE.Matrix4,
): {
  readonly pointerSources: readonly {
    readonly id: string;
    readonly kind: "controller";
    readonly handedness: "left" | "right";
    readonly object: THREE.Object3D;
    readonly pressed: boolean;
    readonly dominant: boolean;
  }[];
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
  let menuTogglePressed = false;

  for (const source of inputSources) {
    const handedness = source.handedness === "left" || source.handedness === "right" ? source.handedness : undefined;
    if (!handedness || source.hand) {
      continue;
    }

    const targetRayPose = frame.getPose(source.targetRaySpace, referenceSpace);
    if (!targetRayPose) {
      continue;
    }

    const id = `controller:${handedness}`;
    const object = controllerObjects.get(id) ?? new THREE.Object3D();
    applyXrPoseToObject(object, targetRayPose.transform, referenceSpaceToWorldMatrix);
    object.updateMatrixWorld(true);
    controllerObjects.set(id, object);

    menuTogglePressed ||= isMenuTogglePressed(source.gamepad);

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
    menuTogglePressed,
  };
}

function applyXrPoseToObject(
  object: THREE.Object3D,
  transform: Pick<XRRigidTransform, "position" | "orientation">,
  referenceSpaceToWorldMatrix: THREE.Matrix4,
): void {
  const worldMatrix = referenceSpaceToWorldMatrix.clone().multiply(xrRigidTransformLocalMatrix(transform));
  worldMatrix.decompose(object.position, object.quaternion, object.scale);
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
  hasControllers: boolean,
  activeKind: "controller" | undefined,
): string {
  if (activeKind === "controller") {
    return "controllers";
  }
  if (hasControllers) {
    return "controllers";
  }
  return "xr";
}

function syncControllerRays(
  scene: THREE.Scene,
  sources: readonly { readonly id: string; readonly object: THREE.Object3D }[],
  visible: boolean,
): void {
  const seenIds = new Set<string>();

  for (const source of sources) {
    seenIds.add(source.id);
    const ray = getOrCreateControllerRay(scene, source.id);
    ray.visible = visible;
    ray.position.copy(source.object.position);
    ray.quaternion.copy(source.object.quaternion);
    ray.updateMatrixWorld(true);
  }

  for (const [id, ray] of controllerRayObjects) {
    if (!seenIds.has(id)) {
      ray.visible = false;
    }
  }
}

function getOrCreateControllerRay(scene: THREE.Scene, id: string): THREE.Line {
  const existing = controllerRayObjects.get(id);
  if (existing) {
    return existing;
  }

  const rayGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -2.5),
  ]);
  const rayMaterial = new THREE.LineBasicMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.78,
    depthTest: false,
    depthWrite: false,
  });
  const ray = new THREE.Line(rayGeometry, rayMaterial);
  ray.name = `vr-palette-ray-${id}`;
  ray.renderOrder = 1002;
  ray.visible = false;
  controllerRayObjects.set(id, ray);
  scene.add(ray);
  return ray;
}

function hideControllerRays(): void {
  for (const ray of controllerRayObjects.values()) {
    ray.visible = false;
  }
}

function disposeControllerRays(): void {
  for (const ray of controllerRayObjects.values()) {
    ray.removeFromParent();
    ray.geometry.dispose();
    disposeMaterial(ray.material);
  }
  controllerRayObjects.clear();
}

function disposeMaterial(material: THREE.Material | readonly THREE.Material[]): void {
  if ("dispose" in material) {
    material.dispose();
    return;
  }

  for (const item of material) {
    item.dispose();
  }
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
